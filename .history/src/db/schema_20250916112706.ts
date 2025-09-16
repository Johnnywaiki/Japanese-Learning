// src/db/schema.ts
export type Topic = 'N1' | 'N2' | 'N3' | 'N4' | 'N5';

/** 題型（SQL 內 column 叫 section）*/
export type Section = 'vocab' | 'grammar' | 'reading' | 'listening'; // listening 只為兼容，DB 可無

// ---- Supabase / SQLite row types ----
export type ExamRow = {
  exam_key: string;         // e.g. "N2-2022-07"
  level: Topic;
  year: number;
  month: '07' | '12';
  title: string;
};

export type QuestionRow = {
  exam_key: string;
  question_number: number;
  section: Section;
  stem: string;
  passage: string | null;
};

export type ChoiceRow = {
  exam_key: string;
  question_number: number;
  position: number;           // 1..4
  content: string;
  is_correct: 0 | 1;          // SQLite 0/1
  explanation: string;
};

/** 給前端出題用（整合 choices） */
export type PoolQuestion = {
  exam_key: string;
  question_number: number;
  section: Section;
  stem: string;
  passage: string | null;
  choices: Array<{ position: number; content: string; is_correct: boolean; explanation: string }>;
};

// 可選：錯題本
export type MistakeRow = {
  id: number;
  created_at: number;
  exam_key: string;
  question_number: number;
  picked_position: number;
};

// ---- SQLite schema ----
export const CREATE_TABLES_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS exams (
  exam_key TEXT PRIMARY KEY,
  level    TEXT NOT NULL,
  year     INTEGER NOT NULL,
  month    TEXT NOT NULL,
  title    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  exam_key        TEXT NOT NULL,
  question_number INTEGER NOT NULL,
  section         TEXT NOT NULL,
  stem            TEXT NOT NULL,
  passage         TEXT,
  PRIMARY KEY (exam_key, question_number),
  FOREIGN KEY (exam_key) REFERENCES exams(exam_key) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS choices (
  exam_key        TEXT NOT NULL,
  question_number INTEGER NOT NULL,
  position        INTEGER NOT NULL,
  content         TEXT NOT NULL,
  is_correct      INTEGER NOT NULL,
  explanation     TEXT NOT NULL,
  PRIMARY KEY (exam_key, question_number, position),
  FOREIGN KEY (exam_key, question_number)
    REFERENCES questions(exam_key, question_number) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mistakes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  exam_key TEXT NOT NULL,
  question_number INTEGER NOT NULL,
  picked_position INTEGER NOT NULL
);
`;

// 兼容舊代碼的別名（有文件還 import 這些）
export type Level = Topic;
export type Kind = Section;
