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

  score: number;            // 已答對題數
  total: number;            // 已作答題數
  totalAvailable: number;   // 全卷題數（包含 reading 等）
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

// 可能有 'July' / 'December' / '07' / '12' / 7 / 12 / '7'
function sessionCandidates(s: any): any[] {
  if (s == null) return [undefined];
  if (s === 'July' || s === '07' || s === '7' || s === 7) return ['07', '7', 7, 'July'];
  if (s === 'December' || s === '12' || s === 12) return ['12', 'December', 12];
  return [s];
}

// 從 exam_key 取月份（'07' 或 '12'）
function monthFromExamKey(key?: string): '07' | '12' | undefined {
  if (!key) return undefined;
  const m = key.match(/^(N[1-5])-(\d{4})-(\d{2})$/);
  return (m?.[3] as '07' | '12' | undefined) ?? undefined;
}

// 將 session 正規化成 '07' / '12'
function sessionToCode(s: any): '07' | '12' | undefined {
  if (s === 'July' || s === 7 || s === '7' || s === '07') return '07';
  if (s === 'December' || s === 12 || s === '12') return '12';
  return undefined;
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

    const base: any = raw ?? { level: 'N2-N3-random', kind: 'language' };
    const sCode = sessionToCode(raw?.session);

    // 「完整一份卷」= level 為 N1–N5 且 year + session 齊
    const wholePaper =
      isNLevel(base.level) && typeof base.year === 'number' && raw?.session != null;
    if (wholePaper) {
      delete base.kind; // 讀整份卷時忽略 kind（language + reading 都入）
    }

    // 先用一組候選月份嘗試（避免資料層 month 形態唔一致）
    const candidates = sessionCandidates(raw?.session);

    let pool: PoolQuestion[] = [];
    for (const sess of candidates) {
      const filters1 = sess === undefined ? { ...base } : { ...base, session: sess };
      const { pool: p } = getAllForFilter(filters1);
      if (p.length > 0) {
        pool = p;
        break;
      }
    }

    // 如仍然搵唔到，就再試一次完全唔帶 session（兼容舊數）
    if (pool.length === 0) {
      const { pool: p2 } = getAllForFilter({ ...base });
      pool = p2;
    }

    // ✅ 硬性月份過濾（即使資料層無理 session，都只留返目標月份）
    if (sCode) {
      pool = pool.filter(q => monthFromExamKey(q.exam_key) === sCode);
    }

    // 按卷 + 題號排順序（確保 1 ➜ 尾）
    const ordered = [...pool].sort((a, b) => {
      if (a.exam_key === b.exam_key) return a.question_number - b.question_number;
      return a.exam_key < b.exam_key ? -1 : 1;
    });

    if (ordered.length === 0) {
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
      totalAvailable: ordered.length, // reading 都計埋
      answers: {},
    });
  },

  pick(o) {
    const { idx, answers, answered } = get();
    if (answered) return;     // 已提交唔俾改
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
