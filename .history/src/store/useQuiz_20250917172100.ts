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

const sessionToCode = (
  s: any
): '07' | '12' | undefined => {
  if (s === 'July' || s === 7 || s === '7' || s === '07') return '07';
  if (s === 'December' || s === 12 || s === '12') return '12';
  return undefined;
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

  async init(raw) {
    set({ loading: true });

    await seedIfEmpty();

    // ---- 1) 決定係咪「完整一份卷」模式 ----
    const level = raw?.level;
    const year =
      typeof raw?.year === 'number' ? raw?.year : undefined;
    const sCode = sessionToCode(raw?.session);

    const wantWholePaper =
      isNLevel(level) && year !== undefined && sCode !== undefined;

    // ---- 2) 準備第一套查詢參數（優先用 '07' / '12'）----
    const filters1: any = wantWholePaper
      ? { level, year, session: sCode } // 忽略 kind，攞全卷（含 reading）
      : {
          ...(raw ?? { level: 'N2-N3-random', kind: 'language' }),
          // 如果有提供 session，就正規化；否則保留原狀（例如 random）
          ...(raw?.session !== undefined ? { session: sCode ?? raw?.session } : {}),
        };

    let { pool } = getAllForFilter(filters1);

    // ---- 3) fallback：完整一份卷但搵唔到 → 試用 July/December ----
    if (wantWholePaper && pool.length === 0) {
      const altSession = sCode === '07' ? 'July' : 'December';
      const { pool: pool2 } = getAllForFilter({
        level,
        year,
        session: altSession,
      } as any);
      pool = pool2;
    }

    console.log('[init] filters1 =', filters1, 'pool size =', pool.length);

    // ---- 4) 排序：卷內按題號升序，多卷按 exam_key ----
    const ordered = [...pool].sort((a, b) => {
      if (a.exam_key === b.exam_key) {
        return a.question_number - b.question_number;
      }
      return a.exam_key < b.exam_key ? -1 : 1;
    });

    if (ordered.length === 0) {
      console.warn(
        '[init] 無題目：',
        JSON.stringify(filters1)
      );
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
      totalAvailable: ordered.length, // ✅ 包含 reading
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
