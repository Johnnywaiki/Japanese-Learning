// src/store/useQuiz.ts
import { create } from 'zustand';
import { seedIfEmpty, getAllForFilter, insertMistake, type PracticeFilter, type Topic } from '../db';
import type { Word, Sentence } from '../db'; // re-exported from db/index
import { makeQuestion } from '../features/practice/quiz';

type QuizItem = ({ kind: 'word' } & Word) | ({ kind: 'sentence' } & Sentence);

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

  init: (filters?: PracticeFilter) => Promise<void>;
  next: () => void;
  answer: (picked: QuizItem) => void;
};

// 生成唯一 key（避免連續兩題答案同 item）
function keyOf(item: QuizItem) {
  return `${item.kind}:${item.id}`;
}

async function buildPool(filters?: PracticeFilter): Promise<QuizItem[]> {
  const { words, sentences } = getAllForFilter(filters ?? { level: 'all', kind: 'language' });
  const pool: QuizItem[] = [
    ...words.map(w => ({ kind: 'word' as const, ...w })),
    ...sentences.map(s => ({ kind: 'sentence' as const, ...s })),
  ];
  return pool;
}

export const useQuiz = create<QuizState>((set, get) => ({
  loading: false,
  score: 0,
  total: 0,
  totalAvailable: 0,
  pool: [],

  async init(filters) {
    set({ loading: true, error: undefined });
    // 你可用 { forceReload:true } 去強制由 Supabase 重拉
    await seedIfEmpty();

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
    while (prev && keyOf(q.answer as any) === prev && tries++ < 10) q = makeQuestion(pool);

    set({
      loading: false,
      pool,
      current: q,
      totalAvailable: pool.length,
      score: 0,
      total: 0,
      lastCorrect: undefined,
      lastAnswerKey: keyOf(q.answer as any),
      error: undefined,
    });
  },

  next() {
    const { pool, lastAnswerKey, error } = get();
    if (error || pool.length < 4) return;
    let q = makeQuestion(pool);
    let tries = 0;
    while (lastAnswerKey && keyOf(q.answer as any) === lastAnswerKey && tries++ < 10) q = makeQuestion(pool);
    set({ current: q, lastCorrect: undefined, lastAnswerKey: keyOf(q.answer as any) });
  },

  answer(picked) {
    const { current } = get();
    if (!current) return;
    const correct = picked === (current.answer as any);

    if (!correct) {
      const a = current.answer as QuizItem;
      insertMistake({
        kind: a.kind,
        itemId: a.id,
        stem: current.stem,
        correct: current.optionText(current.answer),
        picked: current.optionText(picked),
        // Word/Sentence 內叫 topic
        topic: (a as any).topic as Topic,
      });
    }

    set(s => ({
      score: s.score + (correct ? 1 : 0),
      total: s.total + 1,
      lastCorrect: correct,
    }));
  },
}));
