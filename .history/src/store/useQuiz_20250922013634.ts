// src/store/useQuiz.ts
import { create } from 'zustand';
import {
  getAllForFilter,
  getDailyPool,
  seedIfEmpty,
  insertMistake,
  type PracticeFilter,
} from '../db';
import { makeQuestion } from '../features/practice/quiz';
import type { PoolQuestion } from '../db/schema';

// ---------------- Types ----------------
type Option = {
  position: number;
  content: string;
  is_correct: boolean;
  explanation?: string | null;
};
type AnswerRec = { picked: Option; correct: boolean };

// ＊新增：Daily 模式所需的 meta（供完成後進度更新用）
export type DailyMeta = {
  level: 'N1' | 'N2' | 'N3' | 'N4' | 'N5';
  category: 'grammar' | 'vocab';
  week: number;
  day: number;
  daily_key?: string;
};

// ＊為了在 init 傳入 daily 關聯資料
type InitParams = PracticeFilter & { daily_key?: string; extra?: Partial<DailyMeta> };

type State = {
  loading: boolean;

  pool: PoolQuestion[];
  idx: number; // 0-based
  current?: ReturnType<typeof makeQuestion>;

  selected?: Option | null;
  answered: boolean;
  lastCorrect?: boolean;

  score: number;
  total: number;
  totalAvailable: number;
  answers: Record<number, AnswerRec>;

  // ＊新增：模式與每日題 metadata
  mode?: 'daily' | 'mock';
  dailyMeta?: DailyMeta | undefined;

  // ＊變更：init 支援 daily_key / extra
  init: (filters?: InitParams) => Promise<void>;
  pick: (o: Option) => void;
  submit: () => void;
  next: () => void;
  prev: () => void;
  jumpTo: (i: number) => void;
};

// ---------------- Helpers ----------------
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

  // ＊新增：初始值
  mode: undefined,
  dailyMeta: undefined,

  async init(raw) {
    set({ loading: true });
    await seedIfEmpty();

    // ---------- 判斷是否為 DAILY ----------
    const dailyKey = (raw as InitParams | undefined)?.daily_key ?? (raw as InitParams | undefined)?.extra?.daily_key;
    const extra = (raw as InitParams | undefined)?.extra;

    const looksDailyByExtra = !!(extra && typeof extra.week !== 'undefined' && typeof extra.day !== 'undefined');
    const isDaily = !!dailyKey || looksDailyByExtra;

    if (isDaily) {
      // 1) 取 daily 題庫
      const { pool } = getDailyPool(String(dailyKey ?? ''));
      const ordered = uniqueByExamAndNo(pool).sort((a, b) => a.question_number - b.question_number);

      if (!ordered.length) {
        console.warn('[init] 無題目（daily）：', JSON.stringify({ dailyKey, extra }));
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
          mode: 'daily',
          dailyMeta: extra
            ? {
                level: (extra.level ?? 'N2') as DailyMeta['level'],
                category: (extra.category ?? 'grammar') as DailyMeta['category'],
                week: Number(extra.week ?? 1),
                day: Number(extra.day ?? 1),
                daily_key: dailyKey,
              }
            : undefined,
        });
        return;
      }

      // 2) 設定 metadata（供完成練習時上報）
      const dailyMeta: DailyMeta = {
        level: (extra?.level ?? 'N2') as DailyMeta['level'],
        category: (extra?.category ?? 'grammar') as DailyMeta['category'],
        week: Number(extra?.week ?? 1),
        day: Number(extra?.day ?? 1),
        daily_key: dailyKey,
      };

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
        mode: 'daily',
        dailyMeta,
      });
      return;
    }

    // ---------- 否則走 Mock / 舊 Exam 流程 ----------
    const DEFAULTS: PracticeFilter = { level: 'N2-N3-random', kind: 'language' };

    const level = (raw as PracticeFilter | undefined)?.level;
    const year = typeof (raw as PracticeFilter | undefined)?.year === 'number' ? (raw as PracticeFilter).year : undefined;
    const sCode = sessionToCode((raw as PracticeFilter | undefined)?.session);
    const sWord = sessionToWord((raw as PracticeFilter | undefined)?.session);
    const wholePaper = isNLevel(level) && year !== undefined && (sCode || sWord);

    const fetchOnce = (f: any): PoolQuestion[] => {
      let { pool } = getAllForFilter(f);
      if (!pool.length && f.session) {
        const alt =
          f.session === 'July' ? '12'
          : f.session === 'December' ? '07'
          : f.session === '07' ? 'July'
          : f.session === '12' ? 'December'
          : undefined;
        if (alt) {
          const { pool: pool2 } = getAllForFilter({ ...f, session: alt });
          pool = pool2;
        }
      }
      return pool;
    };

    let pool: PoolQuestion[] = [];

    if (wholePaper) {
      const kinds = ['language', 'reading', 'listening'] as const;
      for (const k of kinds) {
        const part = fetchOnce({ level, kind: k, year, session: sWord ?? sCode } as any);
        pool.push(...part);
      }
    } else {
      const f = (raw as PracticeFilter | undefined) ?? DEFAULTS;
      pool = fetchOnce(f as any);
    }

    if (year !== undefined) {
      pool = pool.filter((q) => yearFromExamKey(q.exam_key) === year);
    }
    if (sCode) {
      pool = pool.filter((q) => monthFromExamKey(q.exam_key) === sCode);
    }

    const ordered = uniqueByExamAndNo(pool).sort((a, b) => {
      if (a.exam_key === b.exam_key) return a.question_number - b.question_number;
      return a.exam_key < b.exam_key ? -1 : 1;
    });

    if (ordered.length === 0) {
      console.warn('[init] 無題目（mock/exam）：', JSON.stringify({ raw }));
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
        mode: 'mock',
        dailyMeta: undefined,
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
      mode: 'mock',
      dailyMeta: undefined,
    });
  },

  pick(o) {
    const { idx, answers, answered } = get();
    if (answered) return;
    if (answers[idx]) return;
    set({ selected: o });
  },

  submit() {
    const { current, selected, idx, answers } = get();
    if (!current || !selected) return;
    if (answers[idx]) return;

    const correct = current.isCorrect(selected);

    if (!correct) {
      insertMistake({
        exam_key: current.exam_key, // daily 情況下你可以在 makeQuestion / 資料層把 daily_key 放在 exam_key 存用
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
