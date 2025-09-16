// src/db/index.ts
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { CREATE_TABLES_SQL, Word, Sentence, Topic, MistakeRow } from './schema';
import { syncFromSupabaseToDB, syncFromJsonToDB } from './remote';

let _db: SQLiteDatabase | null = null;

export function getDB(): SQLiteDatabase {
  if (_db) return _db;
  const db = openDatabaseSync('jp_quiz.db');
  db.execSync?.(CREATE_TABLES_SQL);
  ensureColumn(db, 'words', 'topic TEXT');
  ensureColumn(db, 'sentences', 'topic TEXT');
  _db = db;
  return _db!;
}

function ensureColumn(db: SQLiteDatabase, table: 'words' | 'sentences', colDef: string) {
  const colName = colDef.split(' ')[0];
  const cols = db.getAllSync?.<{ name: string }>(`PRAGMA table_info(${table})`) ?? [];
  if (!cols.some(c => c.name === colName)) {
    db.execSync?.(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
    if (colName === 'topic') {
      db.execSync?.(`UPDATE ${table} SET topic='daily' WHERE topic IS NULL OR topic=''`);
    }
  }
}

export async function seedIfEmpty(): Promise<void> {
  const db = getDB();

  // ① 先試 Supabase
  const ok1 = await syncFromSupabaseToDB(db);
  if (ok1) return;

  // ② 再試 JSON（如仍保留）
  const ok2 = await syncFromJsonToDB(db);
  if (ok2) return;

  // ③ 最後落本地樣本
  const row = db.getFirstSync?.<{ c: number }>('SELECT COUNT(*) AS c FROM words');
  if ((row?.c ?? 0) > 0) return;

  const sampleWords: Omit<Word, 'id'>[] = [
    { topic: 'N3', jp: '水', reading: 'みず', zh: '水' },
    { topic: 'N3', jp: '犬', reading: 'いぬ', zh: '狗' },
    { topic: 'N2', jp: '状況', reading: 'じょうきょう', zh: '狀況' },
    { topic: 'daily', jp: '駅', reading: 'えき', zh: '車站' }
  ];
  const sampleSentences: Omit<Sentence, 'id'>[] = [
    { topic: 'N3', jp: '水をください。', zh: '請給我水。' },
    { topic: 'N2', jp: '現在の状況を説明してください。', zh: '請說明目前的狀況。' },
    { topic: 'daily', jp: '駅まで歩きます。', zh: '步行去車站。' }
  ];
  for (const w of sampleWords) {
    db.runSync?.('INSERT INTO words (jp,reading,zh,topic) VALUES (?,?,?,?)', [w.jp, w.reading ?? null, w.zh, w.topic]);
  }
  for (const s of sampleSentences) {
    db.runSync?.('INSERT INTO sentences (jp,zh,topic) VALUES (?,?,?)', [s.jp, s.zh, s.topic]);
  }
}

/* 其餘：getAllForPool / mistakes API 保持不變 */
export type PoolOptions = { mode: 'mix' | 'words' | 'sentences'; topic: Topic | 'all' };
export async function getAllForPool(opts: PoolOptions): Promise<{ words: Word[]; sentences: Sentence[] }> {
  const db = getDB();
  const where = opts.topic === 'all' ? '' : ' WHERE topic = ?';
  const params = opts.topic === 'all' ? [] : [opts.topic];

  const words = opts.mode !== 'sentences'
    ? db.getAllSync?.<Word>('SELECT * FROM words' + where, ...params) ?? []
    : [];
  const sentences = opts.mode !== 'words'
    ? db.getAllSync?.<Sentence>('SELECT * FROM sentences' + where, ...params) ?? []
    : [];
  return { words, sentences };
}

/* mistakes API 如你已有可保持 */
export type { MistakeRow } from './schema';
