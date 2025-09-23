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

// ---------- helpers ----------
const isNLevel = (lv: any) => typeof lv === 'string' && /^N[1-5]$/.test(lv);

const sessionToCode = (s: any): '07' | '12' | undefined => {
  if (s === 'July' || s === 7 || s === '7' || s === '07') return '07';
  if (s === 'December' || s === 12 || s === '12') return '12';
  return undefined;
};
const sessionToWord = (s: any): 'July' | 'December' | undefined => {
  if (s === 'July' || s === 7 || s === '7' || s === '07') return 'July';
  if (s === 'December' || s === 12 || s === '12') return 'December';
  return undefined;
};

function yearFromExamKey(key?: string): number | undefined {
  if (!key) return undefined;
  const m = key.match(/^(N[1-5])-(\d{4})-(\d{2})$/);
  return m ? Number(m[2]) : undefined;
}
function monthFromExamKey(key?: string): '07' | '12' | undefined {
  if (!key) return undefined;
  const m = key.match(/^(N[1-5])-(\d{4})-(\d{2})$/);
  if (!m) return undefined;
  return m[3] === '07' || m[3] === '12' ? (m[3] as '07' | '12') : undefined;
}

function uniqueByExamAndNo(rows: PoolQuestion[]) {
  const mp = new Map<string, PoolQuestion>();
  for (const q of rows) {
    const k = `${q.exam_key}#${q.question_number}`;
    if (!mp.has(k)) mp.set(k, q);
  }
  return Array.from(mp.values());
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

    const DEFAULTS: PracticeFilter = { level: 'N2-N3-random', kind: 'language' };

    const level = raw?.level;
    const year = typeof raw?.year === 'number' ? raw.year : undefined;
    const sCode = sessionToCode(raw?.session);     // '07' | '12'
    const sWord = sessionToWord(raw?.session);     // 'July' | 'December'
    const wholePaper = isNLevel(level) && year !== undefined && (sCode || sWord);

    // 單次查詢（包埋 session 兩個格式嘗試）
    const fetchOnce = (f: any): PoolQuestion[] => {
      // 先用傳入 session（可能係 'July'/'December' 或 '07'/'12'）
      let { pool } = getAllForFilter(f);
      if (!pool.length && f.session) {
        // 再試相反格式
        const alt =
          f.session === 'July' ? '07' :
          f.session === 'December' ? '12' :
          f.session === '07' ? 'July' :
          f.session === '12' ? 'December' :
          undefined;
        if (alt) {
          const { pool: pool2 } = getAllForFilter({ ...f, session: alt });
          pool = pool2;
        }
      }
      return pool;
    };

    let pool: PoolQuestion[] = [];

    if (wholePaper) {
      // 1) 完整一份卷：逐個 kind 取，再合併
      const kinds = ['language', 'reading', 'listening'] as const;
      for (const k of kinds) {
        const part = fetchOnce({
          level, kind: k, year, session: sWord ?? sCode,
        } as any);
        pool.push(...part);
      }
    } else {
      // 2) 非完整卷：照用戶 filter 取一次（預設值兜底）
      const f = raw ?? DEFAULTS;
      pool = fetchOnce(f as any);
    }

    // 前端硬性過濾（即使資料層無處理都安全）
    if (year !== undefined) {
      pool = pool.filter((q) => yearFromExamKey(q.exam_key) === year);
    }
    if (sCode) {
      pool = pool.filter((q) => monthFromExamKey(q.exam_key) === sCode);
    }

    // 去重 + 排序
    const ordered = uniqueByExamAndNo(pool).sort((a, b) => {
      if (a.exam_key === b.exam_key) return a.question_number - b.question_number;
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
      totalAvailable: ordered.length,
      answers: {},
    });
  },

  pick(o) {
    const { idx, answers, answered } = get();
    if (answered) return;       // 已提交唔俾改
    if (answers[idx]) return;   // 呢題已提交過
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
