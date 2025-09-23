// src/db/schema.ts

/** JLPT 程度 */
export type Topic = 'N1' | 'N2' | 'N3' | 'N4' | 'N5';

/** 類型 */
export type Section = 'vocab' | 'grammar' | 'reading' | 'listening';

/** 本地 SQLite 初始化 SQL（加入 daily_*） */
export const CREATE_TABLES_SQL = `
PRAGMA foreign_keys = ON;

/* ---------------- Mock paper ---------------- */
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
  CONSTRAINT uq_question UNIQUE (exam_key, question_number),
  CONSTRAINT fk_question_exam
    FOREIGN KEY (exam_key) REFERENCES exams(exam_key)
    ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_questions_exam ON questions (exam_key);

CREATE TABLE IF NOT EXISTS choices (
  exam_key        TEXT NOT NULL,
  question_number INTEGER NOT NULL,
  position        INTEGER NOT NULL,
  content         TEXT NOT NULL,
  is_correct      INTEGER NOT NULL,
  explanation     TEXT,
  CONSTRAINT uq_choice UNIQUE (exam_key, question_number, position),
  CONSTRAINT fk_choice_question
    FOREIGN KEY (exam_key, question_number)
    REFERENCES questions(exam_key, question_number)
    ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_choices_q ON choices (exam_key, question_number);

/* ---------------- Daily questions ---------------- */
CREATE TABLE IF NOT EXISTS daily_sets (
  daily_key TEXT PRIMARY KEY,
  level     TEXT NOT NULL,                                -- N1..N5
  category  TEXT NOT NULL CHECK (category IN ('grammar','vocab')),
  title     TEXT
);
CREATE INDEX IF NOT EXISTS idx_daily_sets_level_cat
  ON daily_sets(level, category);

CREATE TABLE IF NOT EXISTS daily_questions (
  daily_key   TEXT NOT NULL,
  item_number INTEGER NOT NULL,                           -- 1..N
  stem        TEXT NOT NULL,
  passage     TEXT,
  question_type TEXT,
  CONSTRAINT pk_daily_q PRIMARY KEY (daily_key, item_number),
  CONSTRAINT fk_daily_q_set
    FOREIGN KEY (daily_key) REFERENCES daily_sets(daily_key)
    ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_daily_questions_key
  ON daily_questions(daily_key);

CREATE TABLE IF NOT EXISTS daily_choices (
  daily_key   TEXT NOT NULL,
  item_number INTEGER NOT NULL,
  position    INTEGER NOT NULL,                           -- 1..4
  content     TEXT NOT NULL,
  is_correct  INTEGER NOT NULL,                           -- 0/1
  explanation TEXT,
  CONSTRAINT uq_daily_choice UNIQUE (daily_key, item_number, position),
  CONSTRAINT fk_daily_choice
    FOREIGN KEY (daily_key, item_number)
    REFERENCES daily_questions(daily_key, item_number)
    ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_daily_choices_key
  ON daily_choices(daily_key, item_number);

/* ---------------- Mistakes ---------------- */
CREATE TABLE IF NOT EXISTS mistakes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at      INTEGER NOT NULL,
  exam_key        TEXT NOT NULL,
  question_number INTEGER NOT NULL,
  picked_position INTEGER NOT NULL
);
`;

/* 給錯題頁用 */
export type MistakeRow = {
  id?: number;
  created_at: number;
  exam_key: string;
  question_number: number;
  picked_position: number;
};
