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
`;

export type Word = { id: number; jp: string; reading?: string | null; zh: string; topic: Topic };
export type Sentence = { id: number; jp: string; zh: string; topic: Topic };

// 題目統一型別（混合單字與例句）
export type QuizItem =
  | ({ kind: 'word' } & Word)
  | ({ kind: 'sentence' } & Sentence);
