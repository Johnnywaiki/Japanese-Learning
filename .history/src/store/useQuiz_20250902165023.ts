// src/db/index.ts
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { CREATE_TABLES_SQL, Word, Sentence } from './schema';

let db: SQLiteDatabase | null = null;

export function getDB(): SQLiteDatabase {
  if (db) return db;
  db = openDatabaseSync('jp_quiz.db');
  // 直接執行多段建表 SQL（以分號分隔）
  db.execSync?.(CREATE_TABLES_SQL);
  return db;
}

export async function seedIfEmpty(): Promise<void> {
  const d = getDB();
  // 檢查是否已有資料
  const row = d.getFirstSync?.<{ c: number }>('SELECT COUNT(*) AS c FROM words');
  const hasData = (row?.c ?? 0) > 0;
  if (hasData) return;

  const sampleWords: Omit<Word, 'id'>[] = [
    { jp: '水', reading: 'みず', zh: '水' },
    { jp: '犬', reading: 'いぬ', zh: '狗' },
    { jp: '学校', reading: 'がっこう', zh: '學校' },
    { jp: '先生', reading: 'せんせい', zh: '老師' },
    { jp: '電車', reading: 'でんしゃ', zh: '電車' },
  ];
  const sampleSentences: Omit<Sentence, 'id'>[] = [
    { jp: '水をください。', zh: '請給我水。' },
    { jp: '犬が好きです。', zh: '我喜歡狗。' },
    { jp: '学校へ行きます。', zh: '我要去學校。' },
    { jp: '先生に聞いてください。', zh: '請問老師。' },
    { jp: '電車で会社に行きます。', zh: '我坐電車去公司。' },
  ];

  // 逐條 insert（sync）
  for (const w of sampleWords) {
    d.runSync?.('INSERT INTO words (jp, reading, zh) VALUES (?, ?, ?)', [
      w.jp,
      w.reading ?? null,
      w.zh,
    ]);
  }
  for (const s of sampleSentences) {
    d.runSync?.('INSERT INTO sentences (jp, zh) VALUES (?, ?)', [s.jp, s.zh]);
  }
}

export type PoolOptions = {
  mix: boolean;
  wordsOnly?: boolean;
  sentencesOnly?: boolean;
};

export async function getAllForPool(
  _opts: PoolOptions
): Promise<{ words: Word[]; sentences: Sentence[] }> {
  const d = getDB();
  const words = d.getAllSync?.<Word>('SELECT * FROM words') ?? [];
  const sentences = d.getAllSync?.<Sentence>('SELECT * FROM sentences') ?? [];
  return { words, sentences };
}
