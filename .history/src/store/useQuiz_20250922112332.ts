// src/store/useQuiz.ts
import { create } from 'zustand';
import { getAllForFilter, getDailyPool, makeDailyKey, type PoolQuestion } from '../db';

// ---- 避免 TS 衝突：本檔自定義 Topic union ----
type Topic = 'N1' | 'N2' | 'N3' | 'N4' | 'N5';

type Mode = 'mock' | 'daily';

type InitMock = {
  level: Topic | 'N2-N3-random' | 'all';
  kind: 'language' | 'reading' | 'listening';
  year?: number | 'random';
  session?: 'July' | 'December' | 'random';
  month?: '07' | '12' | 'random';
};

type InitDaily = {
  level: Topic;
  kind: 'language';
  extra: {
    level: Topic;
    category: 'grammar' | 'vocab';
    week: number; // 1..10
    day: number;  // 1..7
    dayKey?: string;
  };
};

type InitParams = InitMock | InitDaily;

type Store = {
  mode: Mode;
  pool: PoolQuestion[];
  idx: number;
  correctCount: number;
  meta?: any;

  init: (p: InitParams) => Promise<void>;
  pick: (pos: number) => void;
  next: () => void;
  reset: () => void;
};

function isDaily(p: InitParams): p is InitDaily {
  // 有 extra.category / extra.week / extra.day 就視為 daily
  // @ts-ignore
  return !!(p as any)?.extra?.category && !!(p as any)?.extra?.week && !!(p as any)?.extra?.day;
}

export const useQuiz = create<Store>((set, get) => ({
  mode: 'mock',
  pool: [],
  idx: 0,
  correctCount: 0,
  meta: undefined,

  init: async (p: InitParams) => {
    if (isDaily(p)) {
      // ---- DAILY ----
      const { level, extra } = p;
      const dailyKey = makeDailyKey(level, extra.category, extra.week, extra.day);
      const { pool } = getDailyPool(dailyKey);

      set({
        mode: 'daily',
        pool,
        idx: 0,
        correctCount: 0,
        meta: {
          source: 'daily',
          daily_key: dailyKey,
          level,
          category: extra.category,
          week: extra.week,
          day: extra.day,
          returnTo: '/(tabs)/home', // 結果頁可用
        },
      });
      return;
    }

    // ---- MOCK ----
    const { pool } = getAllForFilter({
      level: p.level,
      kind: p.kind,
      year: 'random',
      month: 'random',
      session: 'random',
    } as any);

    set({
      mode: 'mock',
      pool,
      idx: 0,
      correctCount: 0,
      meta: {
        source: 'mock',
        returnTo: '/(tabs)', // 結果頁可用
      },
    });
  },

  pick: (pos: number) => {
    const { pool, idx, correctCount } = get();
    const q = pool[idx];
    const choice = q?.choices?.find(c => c.position === pos);
    const isCorrect = !!choice?.is_correct;
    set({ correctCount: isCorrect ? correctCount + 1 : correctCount });
  },

  next: () => {
    const { idx, pool } = get();
    if (idx + 1 < pool.length) {
      set({ idx: idx + 1 });
    }
  },

  reset: () => {
    set({ mode: 'mock', pool: [], idx: 0, correctCount: 0, meta: undefined });
  },
}));
