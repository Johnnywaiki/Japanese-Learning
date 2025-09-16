// src/db/index.ts
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { CREATE_TABLES_SQL, Word, Sentence, Topic, MistakeRow } from './schema';
import { syncFromSupabaseToDB, syncFromJsonToDB } from './remote';

let _db: SQLiteDatabase | null = null;

/** 開啟本地 DB 並確保建表 */
export function getDB(): SQLiteDatabase {
  if (_db) return _db;
  const db = openDatabaseSync('jp_quiz.db');
  db.execSync?.(CREATE_TABLES_SQL);
  _db = db;
  return _db!;
}

/** 先 Supabase → 再 JSON（如有）→ 否則保持現有資料 */
export async function seedIfEmpty(): Promise<void> {
  const db = getDB();
  if (await syncFromSupabaseToDB(db)) return;
  await syncFromJsonToDB(db);
}

/** 題庫查詢 */
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

/* ---------------- 錯題本 API（務必 export！） ---------------- */

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

export function getMistakes(): MistakeRow[] {
  const db = getDB();
  return db.getAllSync?.<MistakeRow>('SELECT * FROM mistakes ORDER BY created_at DESC') ?? [];
}

export function clearMistakes(): void {
  const db = getDB();
  db.execSync?.('DELETE FROM mistakes;');
}

/** （可選）由 DB 取題幹 */
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
