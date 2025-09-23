/** JLPT 程度 */
export type Topic = 'N1' | 'N2' | 'N3' | 'N4' | 'N5';

/** 類型（目前用 vocab / grammar / reading；listening 之後再開） */
export type Section = 'vocab' | 'grammar' | 'reading' | 'listening';

/** exams 表（mock 試卷） */
export type ExamRow = {
  exam_key: string;            // 例如 N2-2022-07
  level: Topic;                // N1..N5
  year: number;
  month: '07' | '12';
  title: string;
};

/** questions（mock 試卷） */
export type QuestionRow = {
  exam_key: string;
  question_number: number;     // 1..N
  section: Section;            // vocab | grammar | reading | (listening)
  stem: string;
  passage: string | null;
};

/** choices（mock 試卷） */
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
  exam_key: string;            // 支援塞 daily_key 或 exam_key（同一欄）
  question_number: number;     // daily item_number 亦塞落嚟
  picked_position: number;
};

/** ───── Daily 來源 ───── */
export type DailySetRow = {
  daily_key: string;           // 例如 N2-GRAMMAR-0001
  level: Topic;
  category: 'grammar' | 'vocab';
  title: string | null;
};

export type DailyQuestionRow = {
  daily_key: string;
  item_number: number;         // 1..N
  stem: string;
  passage: string | null;
  question_type: 'grammar' | 'vocab' | null;
};

export type DailyChoiceRow = {
  daily_key: string;
  item_number: number;
  position: number;            // 1..4
  content: string;
  is_correct: boolean | 0 | 1;
  explanation: string | null;
};

/** 前端練習用結構（兩個來源統一用呢個） */
export type PoolQuestion = {
  exam_key: string;            // exam_key 或（daily）直接塞 daily_key
  question_number: number;     // question_number 或（daily）塞 item_number
  section: Section;            // daily 用 grammar / vocab
  stem: string;
  passage: string | null;
  choices: Array<{
    position: number;
    content: string;
    is_correct: boolean;
    explanation: string | null;
  }>;
};

/** SQLite 初始化 SQL（加埋 daily_* 三表） */
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

CREATE TABLE IF NOT EXISTS mistakes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at      INTEGER NOT NULL,
  exam_key        TEXT NOT NULL,
  question_number INTEGER NOT NULL,
  picked_position INTEGER NOT NULL
);

/* ===== Daily 來源 ===== */

CREATE TABLE IF NOT EXISTS daily_sets (
  daily_key TEXT PRIMARY KEY,
  level     TEXT NOT NULL,
  category  TEXT NOT NULL, -- 'grammar' | 'vocab'
  title     TEXT
);

CREATE TABLE IF NOT EXISTS daily_questions (
  daily_key   TEXT NOT NULL,
  item_number INTEGER NOT NULL,
  stem        TEXT NOT NULL,
  passage     TEXT,
  question_type TEXT,
  CONSTRAINT pk_daily_question PRIMARY KEY (daily_key, item_number),
  CONSTRAINT fk_daily_question_set
    FOREIGN KEY (daily_key) REFERENCES daily_sets(daily_key)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS daily_choices (
  daily_key   TEXT NOT NULL,
  item_number INTEGER NOT NULL,
  position    INTEGER NOT NULL,
  content     TEXT NOT NULL,
  is_correct  INTEGER NOT NULL,
  explanation TEXT,
  CONSTRAINT uq_daily_choice UNIQUE (daily_key, item_number, position),
  CONSTRAINT fk_daily_choice_question
    FOREIGN KEY (daily_key, item_number)
    REFERENCES daily_questions(daily_key, item_number)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_daily_sets_level_cat ON daily_sets(level, category);
CREATE INDEX IF NOT EXISTS idx_daily_q_key ON daily_questions(daily_key);
CREATE INDEX IF NOT EXISTS idx_daily_c_key ON daily_choices(daily_key, item_number);
`;
