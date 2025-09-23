// src/store/useQuiz.ts
import { create } from 'zustand';
import { getAllForFilter, seedIfEmpty, insertMistake, type PracticeFilter } from '../db';
import { makeQuestion } from '../features/practice/quiz';
import type { PoolQuestion } from '../db/schema';

type Option = { position: number; content: string; is_correct: boolean; explanation: string };
type SavedAnswer = { selected: Option; correct: boolean };

type State = {
  loading: boolean;

  pool: PoolQuestion[];
  idx: number;
  current?: ReturnType<typeof makeQuestion>;

  // 當前題目的即時選擇（未提交前）
  selected?: Option | null;
  // 當前題目是否已提交，以及是否答中（由 answers 還原）
  answered: boolean;
  lastCorrect?: boolean;

  // 全局分數 & 題量
  score: number;
  total: number;
  totalAvailable: number;

  // 每題作答紀錄：key 用 index（與 pool 對齊）
  answers: Record<number, SavedAnswer | undefined>;

  // 行為
  init: (filters?: PracticeFilter) => Promise<void>;
  pick: (o: Option) => void;
  submit: () => void;
  next: () => void;
  prev: () => void;

  // 工具：是否做完最後一題（且已提交）
  isDone: () => boolean;
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
  answers: {},

  async init(filters) {
    set({ loading: true });

    await seedIfEmpty();

    // 先取使用者指定 kind 的題庫
    const base = getAllForFilter(
      (filters as PracticeFilter) ?? { level: 'N2-N3-random', kind: 'language' } as PracticeFilter
    ).pool;

    let list = [...base];

    // ✅ 若偵測到「單一試卷」（只有 1 個 exam_key），自動把 Reading 題目都加埋
    //   這樣 totalAvailable 會包含 Reading；出題按題號順序
    const examKeys = Array.from(new Set(list.map(q => q.exam_key)));
    const isSingleExam = examKeys.length === 1;

    if (isSingleExam) {
      // 補 Reading pool（如果本身 filter 只係 language）
      // 註：你個 getAllForFilter 支援 kind:'reading'；若已包括 reading 亦不會重覆
      const ek = examKeys[0];
      const readingPool = getAllForFilter({ ...(filters as any), kind: 'reading' } as PracticeFilter).pool
        .filter(q => q.exam_key === ek);

      // 合併 & 去重（用 exam_key + question_number）
      const seen = new Set<string>();
      list = [...list, ...readingPool].filter(q => {
        const key = `${q.exam_key}#${q.question_number}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // 單卷 → 題號升序
      list.sort((a, b) => a.question_number - b.question_number);
    } else {
      // 多卷/混合 → 亂序
      list.sort(() => Math.random() - 0.5);
    }

    if (list.length === 0) {
      set({ loading: false, pool: [], current: undefined, totalAvailable: 0, idx: 0, answers: {} });
      return;
    }

    set({
      loading: false,
      pool: list,
      idx: 0,
      current: makeQuestion(list[0]),
      // 還原第一題的作答（通常無）
      selected: null,
      answered: false,
      lastCorrect: undefined,
      score: 0,
      total: 0,
      totalAvailable: list.length,
      answers: {},
    });
  },

  pick(o) {
    // 如果呢題已提交，不可改
    if (get().answered) return;
    set({ selected: o });
  },

  submit() {
    const { current, selected, idx, answers } = get();
    if (!current || !selected) return;

    const correct = current.isCorrect(selected);

    if (!correct) {
      insertMistake({
        exam_key: current.exam_key,
        question_number: current.question_number,
        picked_position: selected.position,
      });
    }

    set(s => ({
      answered: true,
      lastCorrect: correct,
      score: s.score + (correct ? 1 : 0),
      total: s.total + 1,
      answers: { ...answers, [idx]: { selected, correct } },
    }));
  },

  next() {
    const { pool, idx, answers } = get();
    if (pool.length === 0) return;

    const nextIdx = Math.min(pool.length - 1, idx + 1);
    const saved = answers[nextIdx];

    set({
      idx: nextIdx,
      current: makeQuestion(pool[nextIdx]),
      selected: saved?.selected ?? null,
      answered: !!saved,
      lastCorrect: saved?.correct,
    });
  },

  prev() {
    const { pool, idx, answers } = get();
    if (pool.length === 0) return;

    const prevIdx = Math.max(0, idx - 1);
    const saved = answers[prevIdx];

    set({
      idx: prevIdx,
      current: makeQuestion(pool[prevIdx]),
      selected: saved?.selected ?? null,
      answered: !!saved,
      lastCorrect: saved?.correct,
    });
  },

  isDone() {
    const { idx, pool, answers } = get();
    const onLast = idx === pool.length - 1;
    return onLast && !!answers[idx]; // 最後一題已經提交
  },
}));
