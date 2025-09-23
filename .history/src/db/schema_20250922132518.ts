// src/db/schema.ts

/** JLPT 程度 */
export type Topic = 'N1' | 'N2' | 'N3' | 'N4' | 'N5';

/** 類型（語言題 or 讀解；listening 之後再開） */
export type Section = 'vocab' | 'grammar' | 'reading' | 'listening';

/** exams 表（以 exam_key 作主鍵，例如 N2-2021-07） */
export type ExamRow = {
  exam_key: string;
  level: Topic;
  year: number;
  month: '07' | '12';
  title: string;
};

/** questions 表（自然鍵 exam_key + question_number） */
export type QuestionRow = {
  exam_key: string;
  question_number: number;
  section: Section;
  stem: string;
  passage: string | null;
};

/** choices 表 */
export type ChoiceRow = {
  exam_key: string;
  question_number: number;
  position: number;            // 1..4
  content: string;
  is_correct: boolean | 0 | 1;
  explanation: string | null;
};

/** 錯題（本地） */
export type MistakeRow = {
  id: number;
  created_at: number;
  exam_key: string;
  question_number: number;
  picked_position: number;
};

/** 前端練習用合併結構 */
export type PoolQuestion = {
  exam_key: string;             // mock: N2-2021-07；daily: DAILY KEY
  question_number: number;      // mock: 試卷題號；daily: item_number
  section: Section;
  stem: string;
  passage: string | null;
  choices: Array<{
    position: number;
    content: string;
    is_correct: boolean;
    explanation: string | null;
  }>;
};

/** SQLite 初始化 SQL（包含 mock & daily & mistakes） */
export const CREATE_TABLES_SQL = `
PRAGMA foreign_keys = ON;

-- mock
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
  is_correct      INTEGER NOT NULL, -- 0/1
  explanation     TEXT,
  CONSTRAINT uq_choice UNIQUE (exam_key, question_number, position),
  CONSTRAINT fk_choice_question
    FOREIGN KEY (exam_key, question_number)
    REFERENCES questions(exam_key, question_number)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_choices_q ON choices (exam_key, question_number);

-- mistakes
CREATE TABLE IF NOT EXISTS mistakes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at      INTEGER NOT NULL,
  exam_key        TEXT NOT NULL,
  question_number INTEGER NOT NULL,
  picked_position INTEGER NOT NULL
);

-- daily（以 daily_key + item_number 為鍵）
CREATE TABLE IF NOT EXISTS daily_sets (
  daily_key TEXT PRIMARY KEY,
  level     TEXT NOT NULL,
  category  TEXT NOT NULL,  -- 'grammar' | 'vocab'
  title     TEXT
);

CREATE TABLE IF NOT EXISTS daily_questions (
  daily_key   TEXT NOT NULL,
  item_number INTEGER NOT NULL,
  stem        TEXT NOT NULL,
  passage     TEXT,
  question_type TEXT,
  CONSTRAINT pk_daily_q PRIMARY KEY (daily_key, item_number),
  CONSTRAINT fk_daily_set FOREIGN KEY (daily_key) REFERENCES daily_sets(daily_key) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS daily_choices (
  daily_key   TEXT NOT NULL,
  item_number INTEGER NOT NULL,
  position    INTEGER NOT NULL,
  content     TEXT NOT NULL,
  is_correct  INTEGER NOT NULL DEFAULT 0,
  explanation TEXT,
  CONSTRAINT uq_daily_choice UNIQUE (daily_key, item_number, position),
  CONSTRAINT fk_daily_q FOREIGN KEY (daily_key, item_number)
    REFERENCES daily_questions(daily_key, item_number)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_daily_sets_lc ON daily_sets(level, category);
CREATE INDEX IF NOT EXISTS idx_daily_questions_key ON daily_questions(daily_key);
CREATE INDEX IF NOT EXISTS idx_daily_choices_key ON daily_choices(daily_key, item_number);
`;
