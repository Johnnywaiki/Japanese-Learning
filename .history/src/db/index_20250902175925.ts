// src/db/index.ts
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { CREATE_TABLES_SQL, Word, Sentence, Topic } from './schema';
import { syncFromJsonIfConfigured } from './remote';

let db: SQLiteDatabase | null = null;

export function getDB(): SQLiteDatabase {
  if (db) return db;
  db = openDatabaseSync('jp_quiz.db');
  // 建表（如未有）
  db.execSync?.(CREATE_TABLES_SQL);
  // 確保有 topic 欄位（舊用戶自動補）
  ensureColumn('words', 'topic TEXT');
  ensureColumn('sentences', 'topic TEXT');
  return db;
}

function ensureColumn(table: 'words' | 'sentences', colDef: string) {
  const d = getDB();
  // PRAGMA table_info 取現有欄位
  const cols = d.getAllSync?.<{ name: string }>(`PRAGMA table_info(${table})`) ?? [];
  const has = cols.some((c) => c.name === colDef.split(' ')[0]);
  if (!has) {
    d.execSync?.(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
    // 若新增欄位，補上預設 topic（daily）
    d.execSync?.(`UPDATE ${table} SET topic='daily' WHERE topic IS NULL OR topic=''`);
  }
}

export async function seedIfEmpty(): Promise<void> {
  const d = getDB();

  // 先試遠端 JSON 同步（如設定了 EXPO_PUBLIC_DATA_URL）
  const pulled = await syncFromJsonIfConfigured();
  if (pulled) return;

  // 無遠端就檢查本地是否已有資料
  const row = d.getFirstSync?.<{ c: number }>('SELECT COUNT(*) AS c FROM words');
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
    d.runSync?.('INSERT INTO words (jp,reading,zh,topic) VALUES (?,?,?,?)', [
      w.jp,
      w.reading ?? null,
      w.zh,
      w.topic,
    ]);
  }
  for (const s of sampleSentences) {
    d.runSync?.('INSERT INTO sentences (jp,zh,topic) VALUES (?,?,?)', [s.jp, s.zh, s.topic]);
  }
}

export type PoolOptions = {
  mode: 'mix' | 'words' | 'sentences';
  topic: Topic | 'all';
};

export async function getAllForPool(
  opts: PoolOptions
): Promise<{ words: Word[]; sentences: Sentence[] }> {
  const d = getDB();
  const where = opts.topic === 'all' ? '' : ' WHERE topic = ?';
  const param = opts.topic === 'all' ? [] : [opts.topic];

  const words = (opts.mode !== 'sentences'
    ? d.getAllSync?.<Word>('SELECT * FROM words' + where, ...param)
    : []) ?? [];

  const sentences = (opts.mode !== 'words'
    ? d.getAllSync?.<Sentence>('SELECT * FROM sentences' + where, ...param)
    : []) ?? [];

  return { words, sentences };
}