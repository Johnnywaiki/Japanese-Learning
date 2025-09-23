// src/store/useQuiz.ts
import { create } from 'zustand';
import {
  getAllForFilter,
  seedIfEmpty,
  insertMistake,
  type PracticeFilter,
} from '../db';
import { makeQuestion } from '../features/practice/quiz';
import type { PoolQuestion } from '../db/schema';

type Option = {
  position: number;
  content: string;
  is_correct: boolean;
  explanation: string;
};

type State = {
  loading: boolean;

  // 題庫 & 目前指標
  pool: PoolQuestion[];
  idx: number;

  // 目前一題（由 makeQuestion 生成的可直接用於 UI 的物件）
  current?: ReturnType<typeof makeQuestion>;

  // 使用者作答狀態
  selected?: Option | null;
  answered: boolean;
  lastCorrect?: boolean;

  // 累積分數（本次練習回合）
  score: number;
  total: number;
  totalAvailable: number;

  // 行為
  init: (filters?: PracticeFilter) => Promise<void>;
  pick: (o: Option) => void;
  submit: () => void;
  next: () => void;
  prev: () => void; // ⬅️ 新增：上一題
};

export const useQuiz = create<State>((set, get) => ({
  loading: false,
  pool: [],
  idx: 0,
  current: undefined,
  selected: null,
  answered: false,
  lastCorrect: undefined,
  score: 0,
  total: 0,
  totalAvailable: 0,

async init(filters) {
  set({ loading: true });

  await seedIfEmpty();

  // 取題庫（跟你 index 現有 filters）
  const { pool } = getAllForFilter(
    (filters as PracticeFilter) ?? { level: 'N2-N3-random', kind: 'language' } as PracticeFilter
  );

  let list = [...pool];

  // ✅ 如果只係一份試卷（同一 exam_key），就按題號升序；否則用亂序
  const examKeys = new Set(list.map(q => q.exam_key));
  if (examKeys.size === 1) {
    list.sort((a, b) => a.question_number - b.question_number);
  } else {
    list.sort(() => Math.random() - 0.5);
  }

  if (list.length === 0) {
    set({ loading: false, pool: [], current: undefined, totalAvailable: 0, idx: 0 });
    return;
  }

  set({
    loading: false,
    pool: list,
    idx: 0,
    current: makeQuestion(list[0]),
    selected: null,
    answered: false,
    lastCorrect: undefined,
    score: 0,
    total: 0,
    totalAvailable: list.length,
  });
},

  pick(o) {
    // 已提交後不可再改選
    if (get().answered) return;
    set({ selected: o });
  },

  submit() {
    const { current, selected } = get();
    if (!current || !selected) return;

    const correct = current.isCorrect(selected);

    // 記錄錯題（只在錯時入庫）
    if (!correct) {
      insertMistake({
        exam_key: current.exam_key,
        question_number: current.question_number,
        picked_position: selected.position,
      });
    }

    set((s) => ({
      answered: true,
      lastCorrect: correct,
      score: s.score + (correct ? 1 : 0),
      total: s.total + 1,
    }));
  },

  next() {
    const { pool, idx } = get();
    if (pool.length === 0) return;

    const nextIdx = Math.min(pool.length - 1, idx + 1);
    // 走到尾就停住（如要循環可改成 (idx+1)%pool.length）

    set({
      idx: nextIdx,
      current: makeQuestion(pool[nextIdx]),
      selected: null,
      answered: false,
      lastCorrect: undefined,
    });
  },

  prev() {
    const { pool, idx } = get();
    if (pool.length === 0) return;

    const prevIdx = Math.max(0, idx - 1);
    // 到頭就停（如要循環可改成 (idx-1+pool.length)%pool.length）

    set({
      idx: prevIdx,
      current: makeQuestion(pool[prevIdx]),
      selected: null,
      answered: false,
      lastCorrect: undefined,
    });
  },
}));
