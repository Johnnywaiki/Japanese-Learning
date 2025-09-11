// src/db/schema.ts
export type Topic = 'N2' | 'N3' | 'daily';

export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jp TEXT NOT NULL,
  reading TEXT,
  zh TEXT NOT NULL,
  topic TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sentences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jp TEXT NOT NULL,
  zh TEXT NOT NULL,
  topic TEXT NOT NULL
);
-- 新增：錯題表
CREATE TABLE IF NOT EXISTS mistakes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,          -- 'word' | 'sentence'
  item_id INTEGER NOT NULL,     -- 對應 words/sentences 的 id
  stem TEXT NOT NULL,           -- 題幹（顯示用）
  correct TEXT NOT NULL,        -- 正解中文
  picked TEXT NOT NULL,         -- 你揀嗰個中文
  topic TEXT NOT NULL,          -- N2 | N3 | daily
  created_at INTEGER NOT NULL   -- epoch ms
);
`;

export type Word = { id: number; jp: string; reading?: string | null; zh: string; topic: Topic };
export type Sentence = { id: number; jp: string; zh: string; topic: Topic };

// 題目統一型別
export type QuizItem =
  | ({ kind: 'word' } & Word)
  | ({ kind: 'sentence' } & Sentence);

export type MistakeRow = {
  id: number;
  kind: 'word' | 'sentence';
  item_id: number;
  stem: string;
  correct: string;
  picked: string;
  topic: Topic;
  created_at: number;
};
