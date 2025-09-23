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

// —— 簡單：用候選月份列表逐個試 ——
// ui 可能傳 'July' / 'December' / '07' / '12' / 7 / 12 / '7'
function sessionCandidates(s: any): any[] {
  if (s == null) return [undefined];
  if (s === 'July' || s === '07' || s === '7' || s === 7) {
    return ['07', '7', 7, 'July'];
  }
  if (s === 'December' || s === '12' || s === 12) {
    return ['12', 'December', 12];
  }
  // 其他字串就照 pass
  return [s];
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

    // 基本 filter（未揀就用預設 random N2-N3 language）
    const base: any = raw ?? { level: 'N2-N3-random', kind: 'language' };

    // 「完整一份卷」= level 為 N1–N5 且 year + session 齊
    const wholePaper = isNLevel(base.level) && typeof base.year === 'number' && raw?.session != null;
    if (wholePaper) {
      // 讀整份卷時忽略 kind，等於 language + reading（甚至 listening）一齊攞
      delete base.kind;
    }

    // 月份候選（逐個試直到有題）
    const candidates = sessionCandidates(raw?.session);

    let pool: PoolQuestion[] = [];
    for (const sess of candidates) {
      const filters1 = sess === undefined ? { ...base } : { ...base, session: sess };
      const { pool: p } = getAllForFilter(filters1);
      if (p.length > 0) {
        pool = p;
        // 調試輸出（需要時保留）
        // console.log('[init] matched by', filters1, 'pool=', p.length);
        break;
      }
    }

    // 協助：如果冇 set session（或候選都唔中），試一次完全唔帶 session（方便舊數據）
    if (pool.length === 0) {
      const { pool: p2 } = getAllForFilter({ ...base });
      pool = p2;
      // console.log('[init] fallback no session =>', p2.length);
    }

    // 按卷 + 題號排順序（確保 1 ➜ 尾）
    const ordered = [...pool].sort((a, b) => {
      if (a.exam_key === b.exam_key) return a.question_number - b.question_number;
      return a.exam_key < b.exam_key ? -1 : 1;
    });

    if (ordered.length === 0) {
      // 無題目：保持清晰狀態，畀 UI 彈返去揀卷
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
      totalAvailable: ordered.length, // ✅ reading 都計埋
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
