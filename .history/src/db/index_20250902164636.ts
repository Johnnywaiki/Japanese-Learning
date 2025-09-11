// src/db/index.ts
import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES_SQL, Word, Sentence } from './schema';

type DB = SQLite.SQLiteDatabase;
let _db: DB | null = null;

function ensureTables(db: DB) {
  // 將多段 SQL 分開執行（避免一次 exec 失敗）
  const stmts = CREATE_TABLES_SQL.split(';')
    .map(s => s.trim())
    .filter(Boolean);
  db.transaction((tx: SQLite.SQLTransaction) => {
    for (const s of stmts) {
      tx.executeSql(s + ';');
    }
  });
}

export function getDB(): DB {
  if (_db) return _db;
  // 使用傳統 openDatabase，兼容性最好
  _db = SQLite.openDatabase('jp_quiz.db');
  ensureTables(_db);
  return _db;
}

/** 封裝 read query（有型別） */
function readAll<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = getDB();
  return new Promise<T[]>((resolve, reject) => {
    db.readTransaction((tx: SQLite.SQLTransaction) => {
      tx.executeSql(
        sql,
        params,
        (_tx: SQLite.SQLTransaction, rs: SQLite.SQLResultSet) => {
          const out: T[] = [];
          for (let i = 0; i < rs.rows.length; i++) {
            out.push(rs.rows.item(i) as T);
          }
          resolve(out);
        },
        (_tx: SQLite.SQLTransaction, err: SQLite.SQLError) => {
          reject(err);
          return true;
        }
      );
    });
  });
}

/** 封裝 write（有型別） */
function write(sql: string, params: unknown[] = []): Promise<void> {
  const db = getDB();
  return new Promise<void>((resolve, reject) => {
    db.transaction((tx: SQLite.SQLTransaction) => {
      tx.executeSql(
        sql,
        params,
        (_tx: SQLite.SQLTransaction, _rs: SQLite.SQLResultSet) => resolve(),
        (_tx: SQLite.SQLTransaction, err: SQLite.SQLError) => {
          reject(err);
          return true;
        }
      );
    });
  });
}

export async function seedIfEmpty(): Promise<void> {
  // 檢查 words 是否有資料
  const cnt = await readAll<{ c: number }>('SELECT COUNT(*) AS c FROM words');
  const hasData = (cnt[0]?.c ?? 0) > 0;
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

  const db = getDB();
  await new Promise<void>((resolve, reject) => {
    db.transaction((tx: SQLite.SQLTransaction) => {
      for (const w of sampleWords) {
        tx.executeSql(
          'INSERT INTO words (jp, reading, zh) VALUES (?, ?, ?)',
          [w.jp, w.reading ?? null, w.zh]
        );
      }
      for (const s of sampleSentences) {
        tx.executeSql(
          'INSERT INTO sentences (jp, zh) VALUES (?, ?)',
          [s.jp, s.zh]
        );
      }
    }, reject, resolve);
  });
}

export type PoolOptions = {
  mix: boolean;
  wordsOnly?: boolean;
  sentencesOnly?: boolean;
};

export async function getAllForPool(
  _opts: PoolOptions
): Promise<{ words: Word[]; sentences: Sentence[] }> {
  const words = await readAll<Word>('SELECT * FROM words');
  const sentences = await readAll<Sentence>('SELECT * FROM sentences');
  return { words, sentences };
}
