// src/store/useQuiz.ts
import { create } from 'zustand';
import { seedIfEmpty, getPoolForFilter, insertMistake, type PracticeFilter } from '../db';
import type { PoolQuestion } from '../db/schema';
import { makeQuestion, type MCQOption } from '../features/practice/quiz';

type QuizState = {
  loading: boolean;
  current?: ReturnType<typeof makeQuestion>;
  score: number;
  total: number;
  totalAvailable: number;
  lastCorrect?: boolean;
  error?: string;

  pool: PoolQuestion[];
  lastAnswerKey?: string;

  init: (filters?: PracticeFilter) => Promise<void>;
  next: () => void;
  answer: (picked: MCQOption) => void;
};

export const useQuiz = create<QuizState>((set, get) => ({
  loading: false,
  score: 0,
  total: 0,
  totalAvailable: 0,
  pool: [],

  async init(filters) {
    set({ loading: true, error: undefined });
    await seedIfEmpty();

    const pool = getPoolForFilter(
      filters ?? { level: 'N2-N3-random', kind: 'language', year: 'random', session: 'random' }
    );

    if (pool.length < 1) {
      set({
        loading: false, pool, current: undefined, totalAvailable: 0,
        error: '題庫為空，請調整篩選或先同步資料。'
      });
      return;
    }

    const q = makeQuestion(pool);
    set({
      loading: false,
      pool,
      current: q,
      totalAvailable: pool.length,
      score: 0,
      total: 0,
      lastCorrect: undefined,
      lastAnswerKey: q.answer.key,
      error: undefined,
    });
  },

  next() {
    const { pool, lastAnswerKey, error } = get();
    if (error || pool.length < 1) return;

    let q = makeQuestion(pool);
    let tries = 0;
    while (lastAnswerKey && q.answer.key === lastAnswerKey && tries++ < 10) {
      q = makeQuestion(pool);
    }
    set({ current: q, lastCorrect: undefined, lastAnswerKey: q.answer.key });
  },

  answer(picked) {
    const { current } = get();
    if (!current) return;

    const correct = picked.key === current.answer.key;

    if (!correct) {
      insertMistake({
        id: current.id,
        stem: current.stem,
        correct: current.answer.text,
        picked: picked.text,
        level: (current.level as any) ?? null,
      });
    }

    set(s => ({
      score: s.score + (correct ? 1 : 0),
      total: s.total + 1,
      lastCorrect: correct,
    }));
  },
}));
