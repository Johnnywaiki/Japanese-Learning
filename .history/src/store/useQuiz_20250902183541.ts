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
  error?: string; // <= 新增

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
  if (mode === 'words') return words.map(w => ({ kind: 'word', ...w }));
  if (mode === 'sentences') return sentences.map(s => ({ kind: 'sentence', ...s }));
  return [
    ...words.map<QuizItem>(w => ({ kind: 'word', ...w })),
    ...sentences.map<QuizItem>(s => ({ kind: 'sentence', ...s })),
  ];
}

function notEnoughMsg(mode: Mode, topic: Topic | 'all', count: number) {
  const modeLabel = mode === 'mix' ? '混合' : mode === 'words' ? '只單字' : '只例句';
  const topicLabel = topic === 'all' ? '全部' : topic;
  return `題庫不足：${modeLabel} + ${topicLabel} 只有 ${count} 題（需要 ≥ 4）。請到「設定」改為「全部」或切換題型/主題。`;
}

export const useQuiz = create<QuizState>((set, get) => ({
  loading: false,
  mode: 'mix',
  topic: 'all',
  score: 0,
  total: 0,
  pool: [],

  async init() {
    set({ loading: true, error: undefined });
    await seedIfEmpty();
    const { mode, topic } = get();
    const { words, sentences } = await getAllForPool({ mode, topic });
    const pool = toPool(words, sentences, mode);

    if (pool.length < 4) {
      set({ loading: false, pool, current: undefined, error: notEnoughMsg(mode, topic, pool.length) });
      return;
    }

    const current = makeQuestion(pool);
    set({
      pool,
      current,
      loading: false,
      score: 0,
      total: 0,
      lastCorrect: undefined,
      lastAnswerKey: keyOf(current.answer),
      error: undefined,
    });
  },

  setMode(m) {
    (async () => {
      set({ loading: true, mode: m, error: undefined });
      const { topic } = get();
      const { words, sentences } = await getAllForPool({ mode: m, topic });
      const pool = toPool(words, sentences, m);

      if (pool.length < 4) {
        set({ loading: false, pool, current: undefined, error: notEnoughMsg(m, topic, pool.length) });
        return;
      }

      let q = makeQuestion(pool);
      const prev = get().lastAnswerKey;
      let tries = 0;
      while (prev && keyOf(q.answer) === prev && tries++ < 10) q = makeQuestion(pool);
      set({ pool, current: q, loading: false, lastCorrect: undefined, lastAnswerKey: keyOf(q.answer), error: undefined });
    })();
  },

  setTopic(t) {
    (async () => {
      set({ loading: true, topic: t, error: undefined });
      const { mode } = get();
      const { words, sentences } = await getAllForPool({ mode, topic: t });
      const pool = toPool(words, sentences, mode);

      if (pool.length < 4) {
        set({ loading: false, pool, current: undefined, error: notEnoughMsg(mode, t, pool.length) });
        return;
      }

      let q = makeQuestion(pool);
      const prev = get().lastAnswerKey;
      let tries = 0;
      while (prev && keyOf(q.answer) === prev && tries++ < 10) q = makeQuestion(pool);
      set({ pool, current: q, loading: false, lastCorrect: undefined, lastAnswerKey: keyOf(q.answer), error: undefined });
    })();
  },

  next() {
    const { pool, lastAnswerKey, error } = get();
    if (error || pool.length < 4) return; // 題庫不足就唔出下一題
    let q = makeQuestion(pool);
    let tries = 0;
    while (lastAnswerKey && keyOf(q.answer) === lastAnswerKey && tries++ < 10) q = makeQuestion(pool);
    set({ current: q, lastCorrect: undefined, lastAnswerKey: keyOf(q.answer) });
  },

  answer(picked) {
    const { current } = get();
    if (!current) return;
    const correct = picked === current.answer;
    set(s => ({ score: s.score + (correct ? 1 : 0), total: s.total + 1, lastCorrect: correct }));
  },
}));