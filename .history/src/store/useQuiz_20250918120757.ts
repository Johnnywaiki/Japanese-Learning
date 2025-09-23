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
  explanation?: string;
};
type AnswerRec = { picked: Option; correct: boolean };

type State = {
  loading: boolean;

  pool: PoolQuestion[];
  idx: number; // 0-based
  current?: ReturnType<typeof makeQuestion>;

  selected?: Option | null; // 當前選擇（未提交）
  answered: boolean;
  lastCorrect?: boolean;

  score: number; // 已答對題數
  total: number; // 已作答題數
  totalAvailable: number; // 全卷題數（包含 reading 等）
  answers: Record<number, AnswerRec>; // 每題作答紀錄

  init: (filters?: PracticeFilter) => Promise<void>;
  pick: (o: Option) => void;
  submit: () => void;
  next: () => void;
  prev: () => void;
  jumpTo: (i: number) => void;
};

const isNLevel = (lv: any) =>
  typeof lv === 'string' && /^N[1-5]$/.test(lv);

const sessionToCode = (s: any): '07' | '12' | undefined => {
  if (s === 'July' || s === 7 || s === '7' || s === '07') return '07';
  if (s === 'December' || s === 12 || s === '12') return '12';
  return undefined;
};

// 由 exam_key 解析 level / year / mm（例如 "N1-2021-07"）
function parseExamKeyForFilter(ek: string) {
  const m = ek.match(/^(N[1-5])-(\d{4})-(\d{2})$/);
  if (!m) return null;
  return {
    level: m[1] as 'N1' | 'N2' | 'N3' | 'N4' | 'N5',
    year: Number(m[2]),
    mm: m[3] as '07' | '12',
  };
}

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

  async init(raw) {
    set({ loading: true });
    await seedIfEmpty();

    // 交畀現有邏輯（保持你原本簡單做法）
    const baseFilters: PracticeFilter =
      (raw ?? { level: 'N2-N3-random', kind: 'language' }) as PracticeFilter;

    let { pool } = getAllForFilter(baseFilters);

    // ✅ 前端 post-filter：如用家有揀 level / year / session，就用 exam_key 再濾一次
    const y = typeof raw?.year === 'number' ? raw.year : undefined;
    const sCode = sessionToCode(raw?.session);
    const lvl = isNLevel(raw?.level) ? String(raw!.level) : undefined;

    if (lvl || y !== undefined || sCode) {
      pool = pool.filter((q) => {
        const p = parseExamKeyForFilter(q.exam_key);
        if (!p) return false;
        if (lvl && p.level !== lvl) return false;
        if (y !== undefined && p.year !== y) return false;
        if (sCode && p.mm !== sCode) return false;
        return true;
      });
    }

    // 排序：卷內按題號升序，多卷按 exam_key
    const ordered = [...pool].sort((a, b) => {
      if (a.exam_key === b.exam_key) {
        return a.question_number - b.question_number;
      }
      return a.exam_key < b.exam_key ? -1 : 1;
    });

    if (ordered.length === 0) {
      console.warn('[init] 無題目：', JSON.stringify({ raw }));
      set({
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
      });
      return;
    }

    set({
      loading: false,
      pool: ordered,
      idx: 0,
      current: makeQuestion(ordered[0]),
      selected: null,
      answered: false,
      lastCorrect: undefined,
      score: 0,
      total: 0,
      totalAvailable: ordered.length, // ✅ 包含 reading（視乎 DB 返回）
      answers: {},
    });
  },

  pick(o) {
    const { idx, answers, answered } = get();
    if (answered) return; // 已提交唔俾改
    if (answers[idx]) return; // 呢題已提交過
    set({ selected: o });
  },

  submit() {
    const { current, selected, idx, answers } = get();
    if (!current || !selected) return;
    if (answers[idx]) return; // 防重覆計分

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
      answers: { ...s.answers, [idx]: { picked: selected, correct } },
    }));
  },

  next() {
    const { pool, idx, answers } = get();
    if (pool.length === 0) return;

    const nextIdx = Math.min(pool.length - 1, idx + 1);
    const q = makeQuestion(pool[nextIdx]);
    const past = answers[nextIdx];

    set({
      idx: nextIdx,
      current: q,
      selected: past?.picked ?? null,
      answered: !!past,
      lastCorrect: past?.correct,
    });
  },

  prev() {
    const { pool, idx, answers } = get();
    if (pool.length === 0) return;

    const prevIdx = Math.max(0, idx - 1);
    const q = makeQuestion(pool[prevIdx]);
    const past = answers[prevIdx];

    set({
      idx: prevIdx,
      current: q,
      selected: past?.picked ?? null,
      answered: !!past,
      lastCorrect: past?.correct,
    });
  },

  jumpTo(i) {
    const { pool, answers } = get();
    if (pool.length === 0) return;

    const clamped = Math.max(0, Math.min(pool.length - 1, i));
    const q = makeQuestion(pool[clamped]);
    const past = answers[clamped];

    set({
      idx: clamped,
      current: q,
      selected: past?.picked ?? null,
      answered: !!past,
      lastCorrect: past?.correct,
    });
  },
}));
