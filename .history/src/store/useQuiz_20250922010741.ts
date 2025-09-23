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

type Option = {
  position: number;
  content: string;
  is_correct: boolean;
  explanation?: string | null;
};
type AnswerRec = { picked: Option; correct: boolean };

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

  init: (filters?: PracticeFilter) => Promise<void>;
  pick: (o: Option) => void;
  submit: () => void;
  next: () => void;
  prev: () => void;
  jumpTo: (i: number) => void;
};

// helpers
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

    // ✅ 如果帶入 daily_key，就走 daily 模式
    const dailyKey = (raw as any)?.daily_key ?? (raw as any)?.extra?.daily_key;
    if (dailyKey) {
      let { pool } = getDailyPool(dailyKey);

      // 排序：item_number（我們塞在 question_number）
      const ordered = uniqueByExamAndNo(pool).sort((a, b) =>
        a.question_number - b.question_number
      );

      if (ordered.length === 0) {
        console.warn('[init] 無題目（daily）：', JSON.stringify({ dailyKey }));
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
      return;
    }

    // ── 否則走原本 exam 流程 ──
    const DEFAULTS: PracticeFilter = { level: 'N2-N3-random', kind: 'language' };

    const level = raw?.level;
    const year = typeof raw?.year === 'number' ? raw.year : undefined;
    const sCode = sessionToCode(raw?.session);
    const sWord = sessionToWord(raw?.session);
    const wholePaper = isNLevel(level) && year !== undefined && (sCode || sWord);

    const fetchOnce = (f: any): PoolQuestion[] => {
      let { pool } = getAllForFilter(f);
      if (!pool.length && f.session) {
        const alt =
          f.session === 'July' ? '12' // 其實相反格式係 '07' / 'July'，但保持你舊邏輯
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
      const f = raw ?? DEFAULTS;
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
        exam_key: current.exam_key,         // daily 亦塞 daily_key
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
