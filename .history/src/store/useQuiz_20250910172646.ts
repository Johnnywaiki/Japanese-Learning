// src/store/useQuiz.ts
import { create } from 'zustand';
import { seedIfEmpty, getAllForPool, insertMistake } from '../db';
import type { PracticeFilter } from '../db';
import type { QuizItem, Word, Sentence, Topic } from '../db/schema';
import { makeQuestion } from '../features/practice/quiz';

/** 舊版可能會用到的 Mode；現時主要靠 PracticeFilter */
type Mode = 'mix' | 'words' | 'sentences';

type QuizState = {
  // ---- UI / 進度 ----
  loading: boolean;
  current?: ReturnType<typeof makeQuestion>;
  score: number;           // 答對數
  total: number;           // 已作答題數
  totalAvailable: number;  // 題庫總數（當前篩選後）
  lastCorrect?: boolean;   // 上一題是否正確
  error?: string;

  // ---- 題庫狀態 ----
  pool: QuizItem[];
  lastAnswerKey?: string;  // 上題答案 key，用嚟避重

  // ---- 舊 API（保兼容；現時未必使用）----
  mode?: Mode;
  topic?: Topic | 'all';

  // ---- 動作 ----
  init: (filters?: PracticeFilter) => Promise<void>;
  next: () => void;
  answer: (picked: QuizItem) => void;

  // 舊 API（可選，避免舊頁面壞咗）
  setMode?: (m: Mode) => void;
  setTopic?: (t: Topic | 'all') => void;
};

// 為唔同結構計出唯一 key（方便避重）
function keyOf(item: QuizItem) {
  // 兼容：word/sentence/question 結構
  const any = item as any;
  const kind = any.kind ?? (any.section ? 'question' : 'item');
  const id = any.id ?? any.itemId ?? any.question_id ?? any.choice_id;
  return `${kind}:${String(id)}`;
}

// 由 DB 結果組成統一的題庫 Pool
async function buildPool(filters?: PracticeFilter): Promise<QuizItem[]> {
  // 可能有兩種返回：{ pool } 或 { words, sentences }
  const any = (await getAllForPool({ filters } as any)) as any;

  if (Array.isArray(any?.pool)) {
    return any.pool as QuizItem[];
  }

  const words: Word[] = Array.isArray(any?.words) ? any.words : [];
  const sentences: Sentence[] = Array.isArray(any?.sentences) ? any.sentences : [];

  // 舊本地資料：把 word/sentence 轉成通用 QuizItem
  const mapped: QuizItem[] = [
    ...words.map((w: any) => ({ kind: 'word', ...w })),
    ...sentences.map((s: any) => ({ kind: 'sentence', ...s })),
  ];
  return mapped;
}

export const useQuiz = create<QuizState>((set, get) => ({
  // ---- state 初值 ----
  loading: false,
  score: 0,
  total: 0,
  totalAvailable: 0,
  pool: [],

  // ---- 初始化 / 重新載入（帶篩選）----
  async init(filters) {
    set({ loading: true, error: undefined });

    // 兼容本地 DB 初始種子
    try {
      await seedIfEmpty();
    } catch {
      // 無需拋錯，Supabase 情境下可能唔需要
    }

    const pool = await buildPool(filters);

    // 題庫太少（少過四條無法組四選一）
    if (pool.length < 4) {
      set({
        loading: false,
        pool,
        current: undefined,
        totalAvailable: pool.length,
        error: `題庫不足（只有 ${pool.length} 題，需要 ≥ 4）。請調整篩選條件。`,
      });
      return;
    }

    let q = makeQuestion(pool);
    // 避免同上一題答案相同（初次通常無 lastAnswerKey）
    const prev = get().lastAnswerKey;
    let tries = 0;
    while (prev && keyOf(q.answer) === prev && tries++ < 10) {
      q = makeQuestion(pool);
    }

    set({
      loading: false,
      pool,
      current: q,
      totalAvailable: pool.length,
      // 重置統計
      score: 0,
      total: 0,
      lastCorrect: undefined,
      lastAnswerKey: keyOf(q.answer),
      error: undefined,
    });
  },

  // ---- 下一題 ----
  next() {
    const { pool, lastAnswerKey, error } = get();
    if (error || pool.length < 4) return;

    let q = makeQuestion(pool);
    let tries = 0;
    while (lastAnswerKey && keyOf(q.answer) === lastAnswerKey && tries++ < 10) {
      q = makeQuestion(pool);
    }
    set({ current: q, lastCorrect: undefined, lastAnswerKey: keyOf(q.answer) });
  },

  // ---- 作答 ----
  answer(picked) {
    const { current } = get();
    if (!current) return;

    const correct = picked === current.answer;

    // 記錄錯題（兼容舊/新 DB 結構）
    if (!correct) {
      const a: any = current.answer; // 正確答案所屬的 item（word/sentence/question…）
      // 柔性 payload，後端自行處理多結構（建議你的 insertMistake 支援以下欄位）
      const payload = {
        kind: a?.kind ?? 'question',
        itemId: a?.id ?? a?.itemId ?? a?.question_id ?? a?.choice_id,
        stem: current.stem,
        correct: current.optionText(current.answer),
        picked: current.optionText(picked),
        topic: a?.topic ?? a?.level ?? null,
      };
      // 讓類型檢查通過，同時支援多後端
      // @ts-expect-error backend payload is intentionally flexible
      void insertMistake(payload);
    }

    set(s => ({
      score: s.score + (correct ? 1 : 0),
      total: s.total + 1,
      lastCorrect: correct,
    }));
  },

  // ---- 舊 API：保留但不使用（避免其他頁面壞咗）----
  setMode: (m: Mode) => {
    set({ mode: m });
    // 若真要支援舊模式，可在此觸發 init() 重載
  },
  setTopic: (t: Topic | 'all') => {
    set({ topic: t });
  },
}));
