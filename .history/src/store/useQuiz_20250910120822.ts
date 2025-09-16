// src/store/useQuiz.ts
import { create } from 'zustand';
import { seedIfEmpty, getAllForFilter } from '../db';
import type { PracticeFilter } from '../db';
import type { QuizItem, Word, Sentence, Topic } from '../db/schema';
import { makeQuestion } from '../features/practice/quiz';
import { insertMistake } from '../db';

/* ============ 工具 ============ */
function keyOf(item: QuizItem) {
  return `${item.kind}:${(item as Word | Sentence).id}`;
}
function toPoolFromArrays(words: Word[], sentences: Sentence[]): QuizItem[] {
  return [
    ...words.map<QuizItem>(w => ({ kind: 'word', ...w })),
    ...sentences.map<QuizItem>(s => ({ kind: 'sentence', ...s })),
  ];
}
function filterSummary(f?: PracticeFilter) {
  if (!f) return '（預設 N2–N3 隨機 / 言語知識）';
  const lvl =
    f.level === 'N2-N3-random' ? 'N2–N3 隨機' :
    f.level === 'all' ? '全部' : f.level;
  const yr = f.year === undefined ? '未選年份' : (f.year === 'random' ? '年份隨機' : String(f.year));
  const sess = !f.session ? '未選期別' : (f.session === 'random' ? '期別隨機' : f.session);
  const kind =
    f.kind === 'language' ? '言語知識' :
    f.kind === 'reading' ? '讀解' : '聽解';
  return `${lvl} / ${yr} / ${sess} / ${kind}`;
}
function notEnoughMsg(f: PracticeFilter | undefined, count: number) {
  return `題庫不足：${filterSummary(f)} 只有 ${count} 題（需要 ≥ 4）。請調整條件（例如擴大年份或級別）。`;
}

/* ============ 狀態定義 ============ */
type Mode = 'mix' | 'words' | 'sentences'; // 兼容舊設定頁，不再用來查數據

type QuizState = {
  loading: boolean;
  // —— 舊設定頁殘留 —— //
  mode: Mode;
  topic: Topic | 'all';

  current?: ReturnType<typeof makeQuestion>;
  score: number;
  total: number;
  lastCorrect?: boolean;
  pool: QuizItem[];
  lastAnswerKey?: string;
  error?: string;

  lastFilters?: PracticeFilter; // 記住上次開始練習的條件

  /** 以條件開始／重開練習（若省略 filters，會用預設 N2–N3 隨機 + 言語知識） */
  init: (filters?: PracticeFilter) => Promise<void>;

  /** 兼容舊設定頁（不主動重取資料） */
  setMode: (m: Mode) => void;
  setTopic: (t: Topic | 'all') => void;

  /** 進下一題（必須先提交上一題） */
  next: () => void;

  /** 提交答案（由頁面控制「未選不可提交」） */
  answer: (picked: QuizItem) => void;
};

export const useQuiz = create<QuizState>((set, get) => ({
  loading: false,
  // 舊設定頁殘留
  mode: 'mix',
  topic: 'all',

  score: 0,
  total: 0,
  pool: [],

  async init(filters) {
    set({ loading: true, error: undefined });

    // 預設條件：N2–N3 隨機 + 言語知識（年份、期別未選）
    const effective: PracticeFilter = filters ?? {
      level: 'N2-N3-random',
      kind: 'language',
      year: undefined,
      session: undefined,
    };

    await seedIfEmpty();

    // 取資料（由 getAllForFilter 已按 kind/level/year/session 篩好）
    const { words, sentences } = await getAllForFilter(effective);
    const pool = toPoolFromArrays(words, sentences);

    if (pool.length < 4) {
      set({
        loading: false,
        pool,
        current: undefined,
        error: notEnoughMsg(effective, pool.length),
        lastFilters: effective,
      });
      return;
    }

    const current = makeQuestion(pool);
    set({
      loading: false,
      pool,
      current,
      score: 0,
      total: 0,
      lastCorrect: undefined,
      lastAnswerKey: keyOf(current.answer),
      error: undefined,
      lastFilters: effective,
    });
  },

  // —— 以下兩個只為向後相容舊設定頁 —— //
  setMode(m) { set({ mode: m }); },
  setTopic(t) { set({ topic: t }); },

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

  answer(picked) {
    const { current } = get();
    if (!current) return;

    // 直接比較引用即可（頁面會把 pool 入面嘅物件傳返嚟）
    const correct = picked === current.answer;

    if (!correct) {
      const ans = current.answer as any; // Word | Sentence with { id, topic, kind }
      insertMistake({
        kind: ans.kind,
        itemId: ans.id,
        stem: current.stem,
        correct: current.optionText(current.answer),
        picked: current.optionText(picked),
        topic: ans.topic,
      });
    }

    set(s => ({
      score: s.score + (correct ? 1 : 0),
      total: s.total + 1,
      lastCorrect: correct,
    }));
  },
}));
