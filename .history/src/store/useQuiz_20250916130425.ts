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

  init: (filters?: PracticeFilter) => Promise<void>;
  pick: (o: Option) => void;
  submit: () => void;
  next: () => void;
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
    const { pool } = getAllForFilter(
      filters ?? { level: 'N2-N3-random', kind: 'language' }
    );
    const shuffled = [...pool].sort(() => Math.random() - 0.5);

    if (shuffled.length === 0) {
      set({ loading: false, pool: [], current: undefined, totalAvailable: 0 });
      return;
    }

    set({
      loading: false,
      pool: shuffled,
      idx: 0,
      current: makeQuestion(shuffled[0]),
      selected: null,
      answered: false,
      lastCorrect: undefined,
      score: 0,
      total: 0,
      totalAvailable: shuffled.length,
    });
  },

  pick(o) {
    if (get().answered) return; // 提交後不可再改
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
    set(s => ({
      answered: true,
      lastCorrect: correct,
      score: s.score + (correct ? 1 : 0),
      total: s.total + 1,
    }));
  },

  next() {
    const { pool, idx } = get();
    if (pool.length === 0) return;
    const nextIdx = (idx + 1) % pool.length;
    set({
      idx: nextIdx,
      current: makeQuestion(pool[nextIdx]),
      selected: null,
      answered: false,
      lastCorrect: undefined,
    });
  },
}));
