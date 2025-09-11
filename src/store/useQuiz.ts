// src/store/useQuiz.ts
import { create } from 'zustand';
import { seedIfEmpty, getAllForFilter, insertMistake } from '../db';
import type { PracticeFilter } from '../db';
import type { QuizItem, Word, Sentence, Topic } from '../db/schema';
import { makeQuestion } from '../features/practice/quiz';

type Mode = 'mix' | 'words' | 'sentences';

type QuizState = {
  loading: boolean;
  current?: ReturnType<typeof makeQuestion>;
  score: number;
  total: number;
  totalAvailable: number;
  lastCorrect?: boolean;
  error?: string;

  pool: QuizItem[];
  lastAnswerKey?: string;

  // 兼容舊 API（未必再用）
  mode?: Mode;
  topic?: Topic | 'all';

  init: (filters?: PracticeFilter) => Promise<void>;
  next: () => void;
  answer: (picked: QuizItem) => void;

  setMode?: (m: Mode) => void;
  setTopic?: (t: Topic | 'all') => void;
};

// 唯一 key：避免連續兩題同一答案 item
function keyOf(item: QuizItem) {
  const any = item as any;
  const kind = any.kind ?? (any.section ? 'question' : 'item');
  const id = any.id ?? any.itemId ?? any.question_id ?? any.choice_id;
  return `${kind}:${String(id)}`;
}

// ✅ 把本地 DB 的 { words, sentences } 轉成 QuizItem[]（確保 kind 是字面量）
async function buildPool(filters?: PracticeFilter): Promise<QuizItem[]> {
  const { words, sentences } = await getAllForFilter(
    filters ?? { level: 'N2-N3-random', kind: 'language', year: 'random', session: 'random' }
  );

  const wordItems = (Array.isArray(words) ? words : []).map((w: Word) => {
    // 若 Word 型別/資料內已含 kind: string，先剝走
    const { kind: _ignored, ...rest } = w as any;
    return { ...rest, kind: 'word' as const };
  });

  const sentenceItems = (Array.isArray(sentences) ? sentences : []).map((s: Sentence) => {
    const { kind: _ignored, ...rest } = s as any;
    return { ...rest, kind: 'sentence' as const };
  });

  // 這樣組回去，TS 會認到 'word' | 'sentence' 字面量，而唔係 string
  const mapped: QuizItem[] = [...wordItems, ...sentenceItems];
  return mapped;
}

export const useQuiz = create<QuizState>((set, get) => ({
  loading: false,
  score: 0,
  total: 0,
  totalAvailable: 0,
  pool: [],

  async init(filters) {
    set({ loading: true, error: undefined });

    // 同步來源 → 落地本地 DB；成功與否都唔阻止出題（若已經有數）
    try { await seedIfEmpty(); } catch {}

    const pool = await buildPool(filters);
    console.log('[useQuiz] init: pool length =', pool.length, 'filters =', filters);

    if (pool.length < 4) {
      set({
        loading: false,
        pool,
        current: undefined,
        totalAvailable: pool.length,
        error: `題庫不足（只有 ${pool.length} 題，需要 ≥ 4）。請調整篩選條件。`,
      });
      return;
    }

    let q = makeQuestion(pool);
    const prev = get().lastAnswerKey;
    let tries = 0;
    while (prev && keyOf(q.answer) === prev && tries++ < 10) q = makeQuestion(pool);

    set({
      loading: false,
      pool,
      current: q,
      totalAvailable: pool.length,
      score: 0,
      total: 0,
      lastCorrect: undefined,
      lastAnswerKey: keyOf(q.answer),
      error: undefined,
    });
  },

  next() {
    const { pool, lastAnswerKey, error } = get();
    if (error || pool.length < 4) return;

    let q = makeQuestion(pool);
    let tries = 0;
    while (lastAnswerKey && keyOf(q.answer) === lastAnswerKey && tries++ < 10) q = makeQuestion(pool);
    set({ current: q, lastCorrect: undefined, lastAnswerKey: keyOf(q.answer) });
  },

  answer(picked) {
    const { current } = get();
    if (!current) return;

    const correct = picked === current.answer;

    if (!correct) {
      const a: any = current.answer;
      const payload = {
        kind: a?.kind ?? 'question',
        itemId: a?.id ?? a?.itemId ?? a?.question_id ?? a?.choice_id,
        stem: current.stem,
        correct: current.optionText(current.answer),
        picked: current.optionText(picked),
        topic: a?.topic ?? a?.level ?? null,
      };
      void insertMistake(payload as any);
    }

    set(s => ({
      score: s.score + (correct ? 1 : 0),
      total: s.total + 1,
      lastCorrect: correct,
    }));
  },

  // 舊 API（保兼容）
  setMode: (m: Mode) => { set({ mode: m }); },
  setTopic: (t: Topic | 'all') => { set({ topic: t }); },
}));
