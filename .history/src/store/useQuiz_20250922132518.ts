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

/** 選項 + 答案記錄 */
type Option = {
  position: number;
  content: string;
  is_correct: boolean;
  explanation?: string | null;
};
type AnswerRec = { picked: Option; correct: boolean };

/** Daily 額外 metadata（Home → Practice 用） */
export type DailyMeta = {
  daily_key?: string;
  level: Topic;
  category: 'grammar' | 'vocab';
  week: number; // 1..10
  day: number;  // 1..7
  dayKey?: string;
};

/** 由 PoolQuestion 變成畫面需要的結構 */
function makeQuestion(q: PoolQuestion) {
  const options: Option[] = q.choices.map(c => ({
    position: c.position,
    content: c.content,
    is_correct: c.is_correct,
    explanation: c.explanation ?? null,
  }));
  const correctOption = options.find(o => o.is_correct)!;
  return {
    exam_key: q.exam_key,
    question_number: q.question_number,
    stem: q.stem,
    passage: q.passage,
    options,
    correctOption,
    isCorrect: (o: Option) => !!o?.is_correct,
  };
}

type State = {
  loading: boolean;
  mode: 'mock' | 'daily';
  /** mode = daily → DailyMeta；mode = mock → PracticeFilter */
  meta?: DailyMeta | PracticeFilter;

  pool: PoolQuestion[];
  idx: number;
  current?: ReturnType<typeof makeQuestion>;

  selected?: Option | null;
  answered: boolean;
  lastCorrect?: boolean;

  score: number;
  total: number;
  totalAvailable: number;
  answers: Record<number, AnswerRec>;

  /** init（成功= true；冇題= false） */
  init: (
    params?:
      | (PracticeFilter & { extra?: undefined })
      | { extra: DailyMeta; level?: Topic; kind?: 'language' | 'reading' }
      | any
  ) => Promise<boolean>;

  pick: (o: Option) => void;
  submit: () => void;
  next: () => void;
  prev: () => void;
  jumpTo: (i: number) => void;

  reset: () => void;
};

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

  async init(raw) {
    set({ loading: true });

    await ensureSeedOnce();

    const extra: DailyMeta | undefined = raw?.extra;
    let pool: PoolQuestion[] = [];
    let mode: 'daily' | 'mock' = 'mock';
    let meta: any = undefined;

    if (extra && (extra.daily_key || (extra.level && extra.category && extra.week && extra.day))) {
      // ------- Daily -------
      mode = 'daily';
      const daily_key =
        extra.daily_key ?? makeDailyKey(extra.level, extra.category, extra.week, extra.day);
      const r = getDailyPool(daily_key);
      pool = r.pool ?? [];
      meta = { ...extra, daily_key };

      if (!pool.length) {
        console.warn('[useQuiz.init] daily pool empty:', daily_key);
        set({
          loading: false, mode, meta, pool: [],
          idx: 0, current: undefined, selected: null, answered: false,
          lastCorrect: undefined, score: 0, total: 0, totalAvailable: 0, answers: {},
        });
        return false;
      }
    } else {
      // ------- Mock -------
      const DEFAULTS: PracticeFilter = { level: 'N2-N3-random', kind: 'language' };
      const f: PracticeFilter = raw ?? DEFAULTS;

      const r = getAllForFilter(f);
      pool = (r.pool ?? []).slice();

      // 去重 & 排序
      pool = uniqueByExamAndNo(pool).sort((a, b) => {
        if (a.exam_key === b.exam_key) return a.question_number - b.question_number;
        return a.exam_key < b.exam_key ? -1 : 1;
      });

      meta = f;

      if (!pool.length) {
        console.warn('[useQuiz.init] mock pool empty:', { raw });
        set({
          loading: false, mode: 'mock', meta, pool: [],
          idx: 0, current: undefined, selected: null, answered: false,
          lastCorrect: undefined, score: 0, total: 0, totalAvailable: 0, answers: {},
        });
        return false;
      }
    }

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
    if (!pool.length) return;
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
    if (!pool.length) return;
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
    if (!pool.length) return;
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
