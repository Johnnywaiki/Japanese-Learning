// src/store/useQuiz.ts
import { create } from 'zustand';
import { getAllForPool, seedIfEmpty } from '../db';
import { QuizItem } from '../db/schema';
import { makeQuestion } from '../features/practice/quiz';

type QuizState = {
  loading: boolean;
  mixMode: boolean;
  current?: ReturnType<typeof makeQuestion>;
  score: number;
  total: number;
  lastCorrect?: boolean;
  pool: QuizItem[];
  init: () => Promise<void>;
  toggleMix: (v: boolean) => void;
  next: () => void;
  answer: (picked: QuizItem) => void;
};

export const useQuiz = create<QuizState>((set, get) => ({
  loading: false,
  mixMode: true,
  score: 0,
  total: 0,
  pool: [],
  async init() {
    set({ loading: true });
    await seedIfEmpty();
    const { words, sentences } = await getAllForPool({ mix: true });
    const pool: QuizItem[] = [
      ...words.map((w) => ({ kind: 'word', ...w } as QuizItem)),
      ...sentences.map((s) => ({ kind: 'sentence', ...s } as QuizItem)),
    ];
    const current = makeQuestion(pool);
    set({
      pool,
      current,
      loading: false,
      score: 0,
      total: 0,
      lastCorrect: undefined,
    });
  },
  toggleMix(v) {
    const { pool } = get();
    set({ mixMode: v, current: makeQuestion(pool), lastCorrect: undefined });
  },
  next() {
    const { pool } = get();
    set({ current: makeQuestion(pool), lastCorrect: undefined });
  },
  answer(picked) {
    const { current } = get();
    if (!current) return;
    const correct = picked === current.answer;
    set((s) => ({
      score: s.score + (correct ? 1 : 0),
      total: s.total + 1,
      lastCorrect: correct,
    }));
  },
}));
