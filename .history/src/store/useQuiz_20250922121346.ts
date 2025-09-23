// src/store/useQuiz.ts
import { create } from 'zustand';
import {
  ensureSeedOnce,
  getAllForFilter,
  getDailyPool,
  makeDailyKey,
  insertMistake,
  type PracticeFilter,
  type Topic,
  type PoolQuestion,
} from '../db';
import { makeQuestion } from '../features/practice/quiz';

/** 選項（供 UI 用） */
type Option = {
  position: number;
  content: string;
  is_correct: boolean;
  explanation?: string | null;
};
type AnswerRec = { picked: Option; correct: boolean };

/** Daily 進入參數（你喺 home.tsx 用緊呢個） */
type DailyMeta = {
  daily_key?: string;
  level: Topic;
  category: 'grammar' | 'vocab';
  week: number; // 1..10
  day: number; // 1..7
  dayKey?: string; // 例如 'day1'（非必須）
};

/** Store 狀態 */
type State = {
  // 基本
  loading: boolean;
  mode: 'mock' | 'daily';
  meta?: DailyMeta | (PracticeFilter & {}) | undefined;

  // 題池 & 游標
  pool: PoolQuestion[];
  idx: number; // 0-based
  current?: ReturnType<typeof makeQuestion>;

  // 當前選擇 & 回答狀態
  selected?: Option | null; // 當前選擇（未提交）
  answered: boolean;
  lastCorrect?: boolean;

  // 成績統計
  score: number; // 已答對題數
  total: number; // 已作答題數
  totalAvailable: number; // 題目總數（本輪）

  // 每題作答紀錄
  answers: Record<number, AnswerRec>;

  /** 初始化（讀 daily 或 mock 題庫） */
  init: (
    params?:
      | (PracticeFilter & { extra?: undefined })
      | { extra: DailyMeta; level?: Topic; kind?: 'language' | 'reading' }
      | any
  ) => Promise<boolean>;

  /** 選項點擊 */
  pick: (o: Option) => void;

  /** 提交答案（會記錯題到 DB） */
  submit: () => void;

  /** 換題 */
  next: () => void;
  prev: () => void;
  jumpTo: (i: number) => void;

  /** 清空目前測驗（返回首頁時可用） */
  reset: () => void;
};

/* ---------------- helpers（只在本檔用） ---------------- */

/** exam_key 取年 */
function yearFromExamKey(key?: string): number | undefined {
  if (!key) return undefined;
  const m = key.match(/^(N[1-5])-(\d{4})-(\d{2})$/);
  return m ? Number(m[2]) : undefined;
}
/** exam_key 取月（'07' | '12'） */
function monthFromExamKey(key?: string): '07' | '12' | undefined {
  if (!key) return undefined;
  const m = key.match(/^(N[1-5])-(\d{4})-(\d{2})$/);
  if (!m) return undefined;
  return m[3] === '07' || m[3] === '12' ? (m[3] as '07' | '12') : undefined;
}
/** 去重（exam_key + question_number） */
function uniqueByExamAndNo(rows: PoolQuestion[]) {
  const mp = new Map<string, PoolQuestion>();
  for (const q of rows) {
    const k = `${q.exam_key}#${q.question_number}`;
    if (!mp.has(k)) mp.set(k, q);
  }
  return Array.from(mp.values());
}

/* ---------------- store ---------------- */
export const useQuiz = create<State>((set, get) => ({
  loading: false,
  mode: 'mock',
  meta: undefined,

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

  /** 初始化：會自動 seed，一次就夠 */
  async init(raw) {
    set({ loading: true });

    // 1) 確保本地 DB 有數據
    await ensureSeedOnce();

    // 2) Daily or Mock 判斷
    const extra: DailyMeta | undefined = raw?.extra;
    let pool: PoolQuestion[] = [];
    let mode: 'daily' | 'mock' = 'mock';
    let meta: any = undefined;

    if (extra && (extra.daily_key || (extra.level && extra.category && extra.week && extra.day))) {
      // ---- Daily 模式 ----
      mode = 'daily';

      const daily_key =
        extra.daily_key ??
        makeDailyKey(extra.level, extra.category, extra.week, extra.day);

      const r = getDailyPool(daily_key);
      pool = r.pool ?? [];
      meta = { ...extra, daily_key };

      if (!pool.length) {
        console.warn('[useQuiz.init] daily pool empty:', daily_key);
        set({
          loading: false,
          mode,
          meta,
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
        return false;
      }
    } else {
      // ---- Mock 模式 ----
      const DEFAULTS: PracticeFilter = { level: 'N2-N3-random', kind: 'language' };
      const f: PracticeFilter = raw ?? DEFAULTS;

      const { level, year, session, month } = f as PracticeFilter;

      // 直接按 filter 取
      const r = getAllForFilter(f);
      pool = r.pool ?? [];
      meta = f;

      // 前端安全過濾（多重保險）
      if (typeof year === 'number') {
        pool = pool.filter((q) => yearFromExamKey(q.exam_key) === year);
      }
      // session 舊參數兼容：轉 month 比對
      const sCode =
        session === 'July' ? '07' :
        session === 'December' ? '12' :
        undefined;

      const effMonth = month ?? sCode;
      if (effMonth === '07' || effMonth === '12') {
        pool = pool.filter((q) => monthFromExamKey(q.exam_key) === effMonth);
      }

      // 去重 + 排序（按 exam_key + question_number）
      pool = uniqueByExamAndNo(pool).sort((a, b) => {
        if (a.exam_key === b.exam_key) return a.question_number - b.question_number;
        return a.exam_key < b.exam_key ? -1 : 1;
        // 如要按年份倒序可自行改
      });

      if (!pool.length) {
        console.warn('[useQuiz.init] mock pool empty:', { raw });
        set({
          loading: false,
          mode: 'mock',
          meta,
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
        return false;
      }
    }

    // 3) 設定首題
    set({
      loading: false,
      mode,
      meta,
      pool,
      idx: 0,
      current: makeQuestion(pool[0]),
      selected: null,
      answered: false,
      lastCorrect: undefined,
      score: 0,
      total: 0,
      totalAvailable: pool.length,
      answers: {},
    });

    return true;
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

  reset() {
    set({
      loading: false,
      mode: 'mock',
      meta: undefined,
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
  },
}));
