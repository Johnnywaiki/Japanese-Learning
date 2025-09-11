// 建表 SQL（words: 單字；sentences: 例句）
export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jp TEXT NOT NULL,          -- 日文
  reading TEXT,              -- 讀音/假名
  zh TEXT NOT NULL           -- 中文意思
);

CREATE TABLE IF NOT EXISTS sentences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jp TEXT NOT NULL,          -- 日文例句
  zh TEXT NOT NULL           -- 中文翻譯
);
`;

export type Word = { id:number; jp:string; reading?:string|null; zh:string };
export type Sentence = { id:number; jp:string; zh:string };

// 題目統一型別（混合單字與例句）
export type QuizItem =
  | ({ kind: 'word' } & Word)
  | ({ kind: 'sentence' } & Sentence);
