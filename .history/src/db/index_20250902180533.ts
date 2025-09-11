// src/db/index.ts
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { CREATE_TABLES_SQL, Word, Sentence, Topic } from './schema';
import { syncFromJsonToDB } from './remote';

let _db: SQLiteDatabase | null = null;

/** 取得（或開啟）本地 SQLite DB，並確保資料表存在 */
export function getDB(): SQLiteDatabase {
  if (_db) return _db;
  const db = openDatabaseSync('jp_quiz.db');
  // 建表
  db.execSync?.(CREATE_TABLES_SQL);
  // 如舊裝置曾缺欄位，補上
  ensureColumn(db, 'words', 'topic TEXT');
  ensureColumn(db, 'sentences', 'topic TEXT');
  _db = db;
  return _db!;
}

/** 確保某欄位存在；若無則 ALTER TABLE 加上，並補預設值 */
function ensureColumn(db: SQLiteDatabase, table: 'words' | 'sentences', colDef: string) {
  const colName = colDef.split(' ')[0];
  const cols = db.getAllSync?.<{ name: string }>(`PRAGMA table_info(${table})`) ?? [];
  const has = cols.some(c => c.name === colName);
  if (!has) {
    db.execSync?.(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
    if (colName === 'topic') {
      db.execSync?.(`UPDATE ${table} SET topic='daily' WHERE topic IS NULL OR topic=''`);
    }
  }
}

/** 初始化題庫：先試雲端 JSON，同步不到才落本地樣本 */
export async function seedIfEmpty(): Promise<void> {
  const db = getDB();

  // 先試從 JSON 覆蓋（如有設定 EXPO_PUBLIC_DATA_URL）
  const pulled = await syncFromJsonToDB(db);
  if (pulled) return;

  // 若 words 已有資料就唔再 seed
  const row = db.getFirstSync?.<{ c: number }>('SELECT COUNT(*) AS c FROM words');
  const hasData = (row?.c ?? 0) > 0;
  if (hasData) return;

  // 內置最小樣本（含 topic）
  const sampleWords: Omit<Word, 'id'>[] = [
    { topic: 'N3', jp: '水', reading: 'みず', zh: '水' },
    { topic: 'N3', jp: '犬', reading: 'いぬ', zh: '狗' },
    { topic: 'N2', jp: '状況', reading: 'じょうきょう', zh: '狀況' },
    { topic: 'daily', jp: '駅', reading: 'えき', zh: '車站' },
  ];
  const sampleSentences: Omit<Sentence, 'id'>[] = [
    { topic: 'N3', jp: '水をください。', zh: '請給我水。' },
    { topic: 'N2', jp: '現在の状況を説明してください。', zh: '請說明目前的狀況。' },
    { topic: 'daily', jp: '駅まで歩きます。', zh: '步行去車站。' },
  ];

  for (const w of sampleWords) {
    db.runSync?.('INSERT INTO words (jp,reading,zh,topic) VALUES (?,?,?,?)', [
      w.jp, w.reading ?? null, w.zh, w.topic,
    ]);
  }
  for (const s of sampleSentences) {
    db.runSync?.('INSERT INTO sentences (jp,zh,topic) VALUES (?,?,?)', [
      s.jp, s.zh, s.topic,
    ]);
  }
}

/** 題庫查詢參數 */
export type PoolOptions = {
  mode: 'mix' | 'words' | 'sentences';
  topic: Topic | 'all';
};

/** 按 mode + topic 取出可用題庫（回傳 words / sentences 兩組） */
export async function getAllForPool(
  opts: PoolOptions
): Promise<{ words: Word[]; sentences: Sentence[] }> {
  const db = getDB();
  const where = opts.topic === 'all' ? '' : ' WHERE topic = ?';
  const params = opts.topic === 'all' ? [] : [opts.topic];

  const words =
    opts.mode !== 'sentences'
      ? db.getAllSync?.<Word>('SELECT * FROM words' + where, ...params) ?? []
      : [];

  const sentences =
    opts.mode !== 'words'
      ? db.getAllSync?.<Sentence>('SELECT * FROM sentences' + where, ...params) ?? []
      : [];

  return { words, sentences };
}
