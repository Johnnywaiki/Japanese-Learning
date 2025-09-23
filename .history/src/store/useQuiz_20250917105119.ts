import { create } from 'zustand';
import { getAllForFilter, seedIfEmpty, insertMistake, type PracticeFilter } from '../db';
import { makeQuestion } from '../features/practice/quiz';
import type { PoolQuestion } from '../db/schema';

type Option = { position: number; content: string; is_correct: boolean; explanation: string };

type State = {
  loading: boolean;
  pool: PoolQuestion[];
  idx: number;
  current?: ReturnType<typeof makeQuestion>;
  selected?: Option | null;
  answered: boolean;
  lastCorrect?: boolean;
  score: number;
  total: number;
  totalAvailable: number;

  init: (filters?: PracticeFilter & { examKey?: string; order?: 'asc' | 'desc' }) => Promise<void>;
  pick: (o: Option) => void;
  submit: () => void;
  next: () => void;
  prev: () => void;
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

    // 取出整個 pool（按舊層 API 設計）
    const { pool } = getAllForFilter(
      (filters as PracticeFilter) ?? { level: 'N2-N3-random', kind: 'language' } as PracticeFilter
    );

    let list = [...pool];

    // 如有指定 examKey：過濾該卷，並按題號排序（預設升序）
    if (filters?.examKey) {
      list = list.filter(q => q.exam_key === filters.examKey);
      const dir = filters.order === 'desc' ? -1 : 1;
      list.sort((a, b) => (a.question_number - b.question_number) * dir);
    } else {
      // 未指定試卷：保持原本隨機做法
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
    if (get().answered) return;
    set({ selected: o });
  },

  submit() {
    const { current, selected } = get();
    if (!current || !selected) return;

    const correct = current.isCorrect(selected);

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
    set({
      idx: prevIdx,
      current: makeQuestion(pool[prevIdx]),
      selected: null,
      answered: false,
      lastCorrect: undefined,
    });
  },
}));
