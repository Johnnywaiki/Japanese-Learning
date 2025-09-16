// src/db/schema.ts
export type Topic = 'N1' | 'N2' | 'N3' | 'N4' | 'N5' | 'daily';

export interface Word {
  id?: number;
  jp: string;
  zh: string;
  reading?: string | null;
  topic: Topic;
  year?: number | null;
  session?: string | null;
  paper?: string | null;
}

export interface Sentence {
  id?: number;
  jp: string;
  zh: string;
  topic: Topic;
  year?: number | null;
  session?: string | null;
  paper?: string | null;
  audio_url?: string | null;
  image_url?: string | null;
}

export type QuizItem =
  | ({ kind: 'word' } & Word)
  | ({ kind: 'sentence' } & Sentence);

export interface MistakeRow {
  id: number;
  kind: 'word' | 'sentence';
  item_id: number;
  stem: string;
  correct: string;
  picked: string;
  topic: Topic;
  created_at: number;
}

export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jp TEXT NOT NULL,
  zh TEXT NOT NULL,
  reading TEXT,
  topic TEXT NOT NULL,
  year INTEGER,
  session TEXT,
  paper TEXT
);
CREATE TABLE IF NOT EXISTS sentences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jp TEXT NOT NULL,
  zh TEXT NOT NULL,
  topic TEXT NOT NULL,
  year INTEGER,
  session TEXT,
  paper TEXT,
  audio_url TEXT,
  image_url TEXT
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

/** 共用的篩選型別（db / remote 都會用） */
export type PracticeFilter = {
  level: Topic | 'N2-N3-random' | 'all';
  kind: 'language' | 'reading' | 'listening';
  year?: number | 'random';
  session?: 'July' | 'December' | 'random';
};
