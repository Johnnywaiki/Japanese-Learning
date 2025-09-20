/** JLPT 程度 */
export type Topic = 'N1' | 'N2' | 'N3' | 'N4' | 'N5';

/** 類型（目前用 vocab / grammar / reading；listening 之後再開） */
export type Section = 'vocab' | 'grammar' | 'reading' | 'listening';

/** exams 表的行（注意：使用 exam_key 作主鍵） */
export type ExamRow = {
  exam_key: string;            // 例如 N2-2022-07
  level: Topic;                // N1..N5
  year: number;
  month: '07' | '12';
  title: string;
};

/** questions 表的行（自然鍵 exam_key + question_number） */
export type QuestionRow = {
  exam_key: string;
  question_number: number;     // 1..N
  section: Section;            // vocab | grammar | reading | (listening)
  stem: string;                // 題幹
  passage: string | null;      // 讀解長文（其他類型可為 null）
};

/** choices 表的行 */
export type ChoiceRow = {
  exam_key: string;
  question_number: number;
  position: number;            // 1..4
  content: string;
  is_correct: boolean | 0 | 1;
  explanation: string;
};

/** 錯題（本地） */
export type MistakeRow = {
  id: number;
  created_at: number;
  exam_key: string;
  question_number: number;
  picked_position: number;
};

/** 給前端練習用的合併結構 */
export type PoolQuestion = {
  exam_key: string;
  question_number: number;
  section: Section;
  stem: string;
  passage: string | null;
  choices: Array<{
    position: number;
    content: string;
    is_correct: boolean;
    explanation: string;
  }>;
};

/** 本地 SQLite 初始化 SQL（使用 exam_key） */
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
  explanation     TEXT NOT NULL,
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
`;
