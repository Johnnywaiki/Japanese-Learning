// src/db/schema.ts
export type Topic = 'N1' | 'N2' | 'N3' | 'N4' | 'N5' | 'daily';

export type Word = {
  id: number;
  jp: string;
  zh: string;
  topic: Topic;
  reading?: string | null;
  year?: number | null;
  session?: string | null;   // 'July' | 'December'
  paper?: string | null;     // 'vocab' | ...
};

export type Sentence = {
  id: number;
  jp: string;
  zh: string;
  topic: Topic;
  year?: number | null;
  session?: string | null;
  paper?: string | null;     // 'reading' | 'grammar_reading'
};

export type MistakeRow = {
  id: number;
  kind: 'word' | 'sentence';
  item_id: number;
  stem: string;
  correct: string;
  picked: string;
  topic: Topic;
  created_at: number; // epoch ms
};

export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS words (
  id INTEGER PRIMARY KEY,
  jp TEXT NOT NULL,
  reading TEXT,
  zh TEXT NOT NULL,
  topic TEXT NOT NULL,
  year INTEGER,
  session TEXT,
  paper TEXT
);
CREATE TABLE IF NOT EXISTS sentences (
  id INTEGER PRIMARY KEY,
  jp TEXT NOT NULL,
  zh TEXT NOT NULL,
  topic TEXT NOT NULL,
  year INTEGER,
  session TEXT,
  paper TEXT
);
CREATE TABLE IF NOT EXISTS mistakes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  stem TEXT NOT NULL,
  correct TEXT NOT NULL,
  picked TEXT NOT NULL,
  topic TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`;
