// src/store/useQuiz.ts
import { create } from 'zustand';
import { getAllForPool, seedIfEmpty } from '../db';
import { QuizItem, Word, Sentence, Topic } from '../db/schema';
import { makeQuestion } from '../features/practice/quiz';

type Mode = 'mix' | 'words' | 'sentences';

type QuizState = {
  loading: boolean;
  mode: Mode;
  topic: Topic | 'all';
  current?: ReturnType<typeof makeQuestion>;
  score: number;
  total: number;
  lastCorrect?: boolean;
  pool: QuizItem[];
  lastAnswerKey?: string;
  init: () => Promise<void>;
  setMode: (m: Mode) => void;
  setTopic: (t: Topic | 'all') => void;
  next: () => void;
  answer: (picked: QuizItem) => void;
};

function keyOf(item: QuizItem) {
  return `${item.kind}:${(item as Word | Sentence).id}`;
}

function toPool(words: Word[], sentences: Sentence[], mode: Mode): QuizItem[] {
  if (mode === 'words') return words.map((w) => ({ kind: 'word', ...w }));
  if (mode === 'sentences') return sentences.map((s) => ({ kind: 'sentence', ...s }));
  return [
    ...words.map<QuizItem>((w) => ({ kind: 'word', ...w })),
    ...sentences.map<QuizItem>((s) => ({ kind: 'sentence', ...s })),
  ];
}

export const useQuiz = create<QuizState>((set, get) => ({
  loading: false,
  mode: 'mix',
  topic: 'all',
  score: 0,
  total: 0,
  pool: [],

  async init() {
    set({ loading: true });
    await seedIfEmpty();
    const { mode, topic } = get();
    const { words, sentences } = await getAllForPool({ mode, topic });
    const pool = toPool(words, sentences, mode);
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
    (async () => {
      set({ loading: true, mode: m });
      const { topic } = get();
      const { words, sentences } = await getAllForPool({ mode: m, topic });
      const pool = toPool(words, sentences, m);
      let q = makeQuestion(pool);
      const prev = get().lastAnswerKey;
      let tries = 0;
      while (prev && keyOf(q.answer) === prev && tries++ < 10) q = makeQuestion(pool);
      set({ pool, current: q, loading: false, lastCorrect: undefined, lastAnswerKey: keyOf(q.answer) });
    })();
  },

  setTopic(t) {
    (async () => {
      set({ loading: true, topic: t });
      const { mode } = get();
      const { words, sentences } = await getAllForPool({ mode, topic: t });
      const pool = toPool(words, sentences, mode);
      let q = makeQuestion(pool);
      const prev = get().lastAnswerKey;
      let tries = 0;
      while (prev && keyOf(q.answer) === prev && tries++ < 10) q = makeQuestion(pool);
      set({ pool, current: q, loading: false, lastCorrect: undefined, lastAnswerKey: keyOf(q.answer) });
    })();
  },

  next() {
    const { pool, lastAnswerKey } = get();
    let q = makeQuestion(pool);
    let tries = 0;
    while (lastAnswerKey && keyOf(q.answer) === lastAnswerKey && tries++ < 10) q = makeQuestion(pool);
    set({ current: q, lastCorrect: undefined, lastAnswerKey: keyOf(q.answer) });
  },

  answer(picked) {
    const { current } = get();
    if (!current) return;
    const correct = picked === current.answer;
    set((s) => ({ score: s.score + (correct ? 1 : 0), total: s.total + 1, lastCorrect: correct }));
  },
}));
