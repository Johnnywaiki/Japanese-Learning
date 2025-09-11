// src/store/useQuiz.ts
import { create } from 'zustand';
import { getAllForPool, seedIfEmpty } from '../db';
import { QuizItem, Word, Sentence } from '../db/schema';
import { makeQuestion } from '../features/practice/quiz';

type Mode = 'mix' | 'words' | 'sentences';

type QuizState = {
  loading: boolean;
  mode: Mode;                 // 題型模式
  current?: ReturnType<typeof makeQuestion>;
  score: number;
  total: number;
  lastCorrect?: boolean;
  pool: QuizItem[];           // 依 mode 決定
  lastAnswerKey?: string;     // 用來避免連出同一題
  init: () => Promise<void>;
  setMode: (m: Mode) => void;
  next: () => void;
  answer: (picked: QuizItem) => void;
};

function keyOf(item: QuizItem) {
  // e.g. "word:12" / "sentence:5"
  return `${item.kind}:${(item as Word | Sentence).id}`;
}

function poolFromMode(mode: Mode, words: Word[], sentences: Sentence[]): QuizItem[] {
  if (mode === 'words') return words.map(w => ({ kind: 'word', ...w }));
  if (mode === 'sentences') return sentences.map(s => ({ kind: 'sentence', ...s }));
  // mix
  return [
    ...words.map<QuizItem>(w => ({ kind: 'word', ...w })),
    ...sentences.map<QuizItem>(s => ({ kind: 'sentence', ...s })),
  ];
}

export const useQuiz = create<QuizState>((set, get) => ({
  loading: false,
  mode: 'mix',
  score: 0,
  total: 0,
  pool: [],

  async init() {
    set({ loading: true });
    await seedIfEmpty();
    const { words, sentences } = await getAllForPool({ mix: true });
    const { mode } = get();
    const pool = poolFromMode(mode, words, sentences);
    const current = makeQuestion(pool);
    set({
      pool,
      current,
      loading: false,
      score: 0,
      total: 0,
      lastCorrect: undefined,
      lastAnswerKey: keyOf(current.answer),
    });
  },

  setMode(m) {
    const state = get();
    // 重新建立 pool 並抽新題
    // 注意：這裡不重置分數，方便你隨時切換
    (async () => {
      set({ loading: true, mode: m });
      const { words, sentences } = await getAllForPool({ mix: true });
      const pool = poolFromMode(m, words, sentences);
      let q = makeQuestion(pool);
      // 盡量避免立即抽到與上一題相同答案
      const prevKey = state.lastAnswerKey;
      let tries = 0;
      while (prevKey && keyOf(q.answer) === prevKey && tries < 10) {
        q = makeQuestion(pool);
        tries++;
      }
      set({
        pool,
        current: q,
        loading: false,
        lastCorrect: undefined,
        lastAnswerKey: keyOf(q.answer),
      });
    })();
  },

  next() {
    const { pool, lastAnswerKey } = get();
    let q = makeQuestion(pool);
    let tries = 0;
    while (lastAnswerKey && keyOf(q.answer) === lastAnswerKey && tries < 10) {
      q = makeQuestion(pool);
      tries++;
    }
    set({ current: q, lastCorrect: undefined, lastAnswerKey: keyOf(q.answer) });
  },

  answer(picked) {
    const { current } = get();
    if (!current) return;
    const correct = picked === current.answer;
    set(s => ({
      score: s.score + (correct ? 1 : 0),
      total: s.total + 1,
      lastCorrect: correct,
    }));
  },
}));
