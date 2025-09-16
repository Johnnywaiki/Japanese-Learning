// src/db/index.ts
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { CREATE_TABLES_SQL, Word, Sentence, Topic, MistakeRow } from './schema';
import { syncFromSupabaseToDB, syncFromJsonToDB } from './remote';

let _db: SQLiteDatabase | null = null;

/** 取得（或開啟）本地 SQLite DB，並確保資料表存在 */
export function getDB(): SQLiteDatabase {
  if (_db) return _db;
  const db = openDatabaseSync('jp_quiz.db');
  db.execSync?.(CREATE_TABLES_SQL);
  // 舊裝置如未有 topic 欄位時補上
  ensureColumn(db, 'words', 'topic TEXT');
  ensureColumn(db, 'sentences', 'topic TEXT');
  _db = db;
  return _db!;
}

/** 確保某欄位存在；若無則 ALTER TABLE 加上，並補預設值 */
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

/** 初始化題庫：先試 Supabase → 退回 JSON → 再退回本地樣本 */
export async function seedIfEmpty(): Promise<void> {
  const db = getDB();

  // ① Supabase
  const ok1 = await syncFromSupabaseToDB(db);
  if (ok1) return;

  // ② JSON 後備（若未設定 URL 會直接 false）
  const ok2 = await syncFromJsonToDB(db);
  if (ok2) return;

  // ③ 若仍無資料，落最小樣本
  const row = db.getFirstSync?.<{ c: number }>('SELECT COUNT(*) AS c FROM words');
  if ((row?.c ?? 0) > 0) return;

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
    db.runSync?.('INSERT INTO words (jp,reading,zh,topic) VALUES (?,?,?,?)', [w.jp, w.reading ?? null, w.zh, w.topic]);
  }
  for (const s of sampleSentences) {
    db.runSync?.('INSERT INTO sentences (jp,zh,topic) VALUES (?,?,?)', [s.jp, s.zh, s.topic]);
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

/* -------------------- 錯題本 API -------------------- */

/** 新增一條錯題 */
export function insertMistake(args: {
  kind: 'word' | 'sentence';
  itemId: number;
  stem: string;
  correct: string;
  picked: string;
  topic: Topic;
}): void {
  const db = getDB();
  db.runSync?.(
    'INSERT INTO mistakes (kind,item_id,stem,correct,picked,topic,created_at) VALUES (?,?,?,?,?,?,?)',
    [args.kind, args.itemId, args.stem, args.correct, args.picked, args.topic, Date.now()]
  );
}

/** 取出所有錯題，最新在前 */
export function getMistakes(): MistakeRow[] {
  const db = getDB();
  return db.getAllSync?.<MistakeRow>('SELECT * FROM mistakes ORDER BY created_at DESC') ?? [];
}

/** 清空錯題本 */
export function clearMistakes(): void {
  const db = getDB();
  db.execSync?.('DELETE FROM mistakes;');
}

/** 由 DB 取題幹（單字會自動加讀音），失敗回傳 null */
export function getStemById(kind: 'word' | 'sentence', id: number): string | null {
  const db = getDB();
  if (kind === 'word') {
    const w = db.getFirstSync?.<Word>('SELECT * FROM words WHERE id=?', id);
    if (!w) return null;
    return w.reading ? `${w.jp}（${w.reading}）` : w.jp;
  } else {
    const s = db.getFirstSync?.<Sentence>('SELECT * FROM sentences WHERE id=?', id);
    return s?.jp ?? null;
  }
}
