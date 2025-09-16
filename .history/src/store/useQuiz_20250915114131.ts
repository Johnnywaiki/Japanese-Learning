// src/store/useQuiz.ts
import { create } from 'zustand';
import {
  seedIfEmpty,
  getAllForFilter,
  insertMistake,
  type PracticeFilter,
  type Topic,
  type Word,
  type Sentence,
} from '../db';
import { makeQuestion, type QuizItemLike } from '../features/practice/quiz';

// Store 內部狀態
type QuizState = {
  loading: boolean;
  current?: ReturnType<typeof makeQuestion>; // 內含 QuizItemLike[]
  score: number;
  total: number;
  totalAvailable: number;
  lastCorrect?: boolean;
  error?: string;

  pool: QuizItemLike[];
  lastAnswerKey?: string;

  init: (filters?: PracticeFilter) => Promise<void>;
  next: () => void;
  answer: (picked: QuizItemLike) => void; // <<<<<<<<< 用 QuizItemLike
};

// 唯一 key（避免連續兩題同一答案 item）
function keyOf(item: QuizItemLike) {
  return `${item.kind}:${item.id}`;
}

// 由 DB 結果砌成統一 pool（QuizItemLike[]）
function buildPool(filters?: PracticeFilter): QuizItemLike[] {
  const { words, sentences } = getAllForFilter(filters ?? { level: 'all', kind: 'language' });

  const mapped: QuizItemLike[] = [
    ...words.map((w: Word) => ({ kind: 'word' as const, ...w })),       // as const 確保 'word' 字面量
    ...sentences.map((s: Sentence) => ({ kind: 'sentence' as const, ...s })),
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
    await seedIfEmpty(); // 本地有數據會自動略過

    const pool = buildPool(filters);
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

    // 直接用 reference 比較（options 入面嗰個 object）
    const correct = picked === current.answer;

    if (!correct) {
      const a = current.answer;
      insertMistake({
        kind: a.kind,
        itemId: a.id,
        stem: current.stem,
        correct: current.optionText(current.answer),
        picked: current.optionText(picked),
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
