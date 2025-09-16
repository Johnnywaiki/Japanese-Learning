// src/db/schema.ts
export type Level = 'N1' | 'N2' | 'N3' | 'N4' | 'N5';
export type Section = 'vocab' | 'grammar' | 'reading' | 'listening';
export type Kind = 'language' | 'reading' | 'listening';

export type ExamRow = {
  key: string;         // e.g. 'N2-2022'
  level: Level;
  year: number;
  title: string;
};

export type QuestionRow = {
  exam_key: string;
  question_number: number;
  section: Section;
  stem: string;
  passage?: string | null;
};

export type ChoiceRow = {
  exam_key: string;
  question_number: number;
  position: number;
  content: string;
  is_correct: 0 | 1;      // SQLite 用 0/1
  explanation: string;
};

export type PoolQuestion = QuestionRow & {
  level: Level;
  year: number;
  choices: Array<Pick<ChoiceRow, 'position' | 'content' | 'is_correct'>>;
};

export type MistakeRow = {
  id: number;
  item_id: string;    // 例如 'N2-2022#8'
  stem: string;
  correct: string;
  picked: string;
  level: Level | null;
  created_at: number; // epoch ms
};

export const CREATE_TABLES_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS exams (
  key   TEXT PRIMARY KEY,
  level TEXT NOT NULL,
  year  INTEGER NOT NULL,
  title TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  exam_key        TEXT NOT NULL,
  question_number INTEGER NOT NULL,
  section         TEXT NOT NULL,
  stem            TEXT NOT NULL,
  passage         TEXT,
  PRIMARY KEY (exam_key, question_number),
  FOREIGN KEY (exam_key) REFERENCES exams(key) ON DELETE CASCADE
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
    REFERENCES questions(exam_key, question_number)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mistakes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id    TEXT NOT NULL,
  stem       TEXT NOT NULL,
  correct    TEXT NOT NULL,
  picked     TEXT NOT NULL,
  level      TEXT,
  created_at INTEGER NOT NULL
);
`;
