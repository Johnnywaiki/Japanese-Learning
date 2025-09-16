// src/store/useQuiz.ts
import { create } from 'zustand';
import { seedIfEmpty, getAllForFilter, insertMistake } from '../db';
import type { PracticeFilter } from '../db';
import type { PoolQuestion } from '../db/schema';
import { makeQuestion } from '../features/practice/quiz';

// 組合題目的執行時形狀（由 makeQuestion 產生）
type RunQuestion = ReturnType<typeof makeQuestion>;
type Picked = { position: number; content: string; is_correct: boolean; explanation: string };

type QuizState = {
  loading: boolean;
  error?: string;

  // 題庫（PoolQuestion 為原始資料；current 為運行中題目物件）
  pool: PoolQuestion[];
  current?: RunQuestion;

  // 作答狀態
  selected?: Picked | null;      // 已揀但未提交
  answered: boolean;             // 是否已提交
  lastCorrect?: boolean;         // 上題是否正確
  lastKey?: string;              // 上題 key（避免連出同一題）

  // 分數
  score: number;
  total: number;
  totalAvailable: number;

  // actions
  init: (filters?: PracticeFilter) => Promise<void>;
  pick: (opt: Picked) => void;
  submit: () => void;
  next: () => void;
};

function keyOf(q: { exam_key: string; question_number: number }) {
  return `${q.exam_key}:${q.question_number}`;
}

export const useQuiz = create<QuizState>((set, get) => ({
  loading: false,
  error: undefined,

  pool: [],
  current: undefined,

  selected: null,
  answered: false,
  lastCorrect: undefined,
  lastKey: undefined,

  score: 0,
  total: 0,
  totalAvailable: 0,

  async init(filters) {
    set({ loading: true, error: undefined });

    // 同步遠端 → 本地 SQLite（只用 Supabase）
    try { await seedIfEmpty(); } catch {}

    // 由本地 DB 取題庫
    const { pool } = getAllForFilter(filters ?? {
      level: 'N2-N3-random',
      kind: 'language',
      year: 'random',
      month: 'random',
      session: 'random',
    });

    if (!pool.length) {
      set({
        loading: false,
        pool,
        current: undefined,
        totalAvailable: 0,
        error: '題庫為空或篩選無結果。請換一組條件。',
      });
      return;
    }

    // 揀第一題
    const first = pool[Math.floor(Math.random() * pool.length)];
    const run = makeQuestion(first);

    set({
      loading: false,
      pool,
      current: run,
      totalAvailable: pool.length,
      selected: null,
      answered: false,
      lastCorrect: undefined,
      lastKey: keyOf(first),
      score: 0,
      total: 0,
      error: undefined,
    });
  },

  pick(opt) {
    if (!get().current) return;
    // 未提交前只更新 selected
    set({ selected: opt });
  },

  submit() {
    const { current, selected, score, total } = get();
    if (!current || !selected) return; // 前端會顯示提示，唔喺度 throw

    const correct = current.isCorrect(selected);

    if (!correct) {
      // 記錄錯題（只要 exam_key / question_number / picked_position）
      insertMistake({
        exam_key: current.exam_key,
        question_number: current.question_number,
        picked_position: selected.position,
      });
    }

    set({
      answered: true,
      lastCorrect: correct,
      score: score + (correct ? 1 : 0),
      total: total + 1,
    });
  },

  next() {
    const { pool, lastKey } = get();
    if (!pool.length) return;

    // 避免同一題
    let nextQ = pool[Math.floor(Math.random() * pool.length)];
    let tries = 0;
    while (keyOf(nextQ) === lastKey && tries++ < 10) {
      nextQ = pool[Math.floor(Math.random() * pool.length)];
    }

    set({
      current: makeQuestion(nextQ),
      lastKey: keyOf(nextQ),
      selected: null,
      answered: false,
      lastCorrect: undefined,
    });
  },
}));
