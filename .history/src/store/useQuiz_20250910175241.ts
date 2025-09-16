// src/store/useQuiz.ts
import { create } from 'zustand';
import { seedIfEmpty, insertMistake } from '../db';
import { getAllForPool } from '../db/remote'; // 👈 由 remote 匯入
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

// 生成唯一 key（用來避免連續兩題答案同一個 item）
function keyOf(item: QuizItem) {
  const any = item as any;
  const kind = any.kind ?? (any.section ? 'question' : 'item');
  const id = any.id ?? any.itemId ?? any.question_id ?? any.choice_id;
  return `${kind}:${String(id)}`;
}

// 由 DB 結果砌成統一的題庫 Pool
async function buildPool(filters?: PracticeFilter): Promise<QuizItem[]> {
  // 直接把 filters 傳入 remote 的 getAllForPool
  const any = (await getAllForPool(filters as any)) as any;

  if (Array.isArray(any?.pool)) {
    console.log('[useQuiz] buildPool: using pool[] from DB, len=', any.pool.length);
    return any.pool as QuizItem[];
  }

  const words: Word[] = Array.isArray(any?.words) ? any.words : [];
  const sentences: Sentence[] = Array.isArray(any?.sentences) ? any.sentences : [];
  console.log('[useQuiz] buildPool: words=', words.length, 'sentences=', sentences.length);

  const mapped: QuizItem[] = [
    ...words.map((w: any) => ({ kind: 'word', ...w })),
    ...sentences.map((s: any) => ({ kind: 'sentence', ...s })),
  ];
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

    try {
      await seedIfEmpty(); // 如果係 Supabase flow，內部可以 no-op
    } catch {
      // 忽略本地種子錯誤
    }

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
      // 這裡用 any 去配合你現有 insertMistake 的簽名（移除 @ts-expect-error）
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
