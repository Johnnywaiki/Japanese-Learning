// src/db/index.ts
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { CREATE_TABLES_SQL, Word, Sentence, Topic, MistakeRow } from './schema';
import { syncFromSupabaseToDB, syncFromJsonToDB } from './remote';

let _db: SQLiteDatabase | null = null;

/** 取得（或建立）本地 SQLite DB；會確保表及必要欄位存在 */
export function getDB(): SQLiteDatabase {
  if (_db) return _db;
  const db = openDatabaseSync('jp_quiz.db');

  // 建表
  db.execSync?.(CREATE_TABLES_SQL);

  // 舊版本升級欄位（存在就跳過）
  ensureColumn(db, 'words', 'year INTEGER');
  ensureColumn(db, 'words', 'session TEXT');
  ensureColumn(db, 'words', 'paper TEXT');
  ensureColumn(db, 'sentences', 'year INTEGER');
  ensureColumn(db, 'sentences', 'session TEXT');
  ensureColumn(db, 'sentences', 'paper TEXT');

  _db = db;
  return _db!;
}

function ensureColumn(db: SQLiteDatabase, table: 'words' | 'sentences', colDef: string) {
  const col = colDef.split(' ')[0];
  const meta = db.getAllSync?.<{ name: string }>(`PRAGMA table_info(${table})`) ?? [];
  if (!meta.some(m => m.name === col)) {
    db.execSync?.(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
  }
}

/** 初始化：優先從 Supabase 同步到本地；若失敗/未設定，退回 JSON 後備來源 */
export async function seedIfEmpty(): Promise<void> {
  const db = getDB();
  if (await syncFromSupabaseToDB(db)) return;
  await syncFromJsonToDB(db);
}

/** 手動重新同步（可選清表）。回傳來源與最新筆數，方便 UI 顯示。 */
export async function resyncFromRemote(opts?: { clear?: boolean }): Promise<{
  source: 'supabase' | 'json' | 'none';
  words: number;
  sentences: number;
}> {
  const db = getDB();

  if (opts?.clear) {
    db.execSync?.('DELETE FROM words;');
    db.execSync?.('DELETE FROM sentences;');
  }

  let source: 'supabase' | 'json' | 'none' = 'none';
  const supaOk = await syncFromSupabaseToDB(db);
  if (supaOk) source = 'supabase';
  else {
    const jsonOk = await syncFromJsonToDB(db);
    source = jsonOk ? 'json' : 'none';
  }

  const w = db.getFirstSync?.<{ c: number }>('SELECT COUNT(*) AS c FROM words')?.c ?? 0;
  const s = db.getFirstSync?.<{ c: number }>('SELECT COUNT(*) AS c FROM sentences')?.c ?? 0;
  return { source, words: w, sentences: s };
}

/* -------------------- 查題（支援 Level / Year / Session / Type） -------------------- */
export type PracticeFilter = {
  level: Topic | 'N2-N3-random' | 'all';
  kind: 'language' | 'reading' | 'listening';
  year?: number | 'random';
  session?: 'July' | 'December' | 'random';
};

export async function getAllForFilter(
  f: PracticeFilter
): Promise<{ words: Word[]; sentences: Sentence[] }> {
  const db = getDB();

  // topics
  let topics: Topic[] = [];
  if (f.level === 'all') topics = ['N1', 'N2', 'N3', 'N4', 'N5', 'daily' as any];
  else if (f.level === 'N2-N3-random') topics = ['N2', 'N3'];
  else topics = [f.level as Topic];

  // where 片段
  const conds: string[] = [];
  const params: any[] = [];
  if (topics.length) {
    conds.push(`topic IN (${topics.map(() => '?').join(',')})`);
    params.push(...topics);
  }
  if (f.year && f.year !== 'random') {
    conds.push('year = ?');
    params.push(f.year);
  }
  if (f.session && f.session !== 'random') {
    conds.push('LOWER(session) = LOWER(?)');
    params.push(f.session);
  }

  const where = conds.length ? ` WHERE ${conds.join(' AND ')}` : '';
  const joiner = conds.length ? ' AND ' : ' WHERE '; // 防止以 AND 開頭

  // 放寬 paper 命名匹配
  // language（單字）：words 偏 vocab / language；sentences 偏 grammar_reading
  const PAPER_VOCAB_MATCH =
    "(paper IS NULL OR paper='' OR LOWER(paper) LIKE '%vocab%' OR LOWER(paper) LIKE '%vocabulary%' OR LOWER(paper) LIKE '%language%')";
  const PAPER_GRAM_MATCH =
    "(paper IS NULL OR LOWER(paper) LIKE '%grammar%' OR LOWER(paper) LIKE '%grammar_reading%' OR LOWER(paper) LIKE '%language%')";
  const PAPER_READ_MATCH =
    "(paper IS NULL OR paper='' OR LOWER(paper) LIKE '%reading%' OR LOWER(paper) LIKE '%grammar_reading%')";

  let words: Word[] = [];
  let sentences: Sentence[] = [];

  if (f.kind === 'language') {
    words =
      db.getAllSync?.<Word>(
        `SELECT * FROM words${where}${joiner}${PAPER_VOCAB_MATCH}`,
        ...params
      ) ?? [];

    sentences =
      db.getAllSync?.<Sentence>(
        `SELECT * FROM sentences${where}${joiner}${PAPER_GRAM_MATCH}`,
        ...params
      ) ?? [];
  } else if (f.kind === 'reading') {
    sentences =
      db.getAllSync?.<Sentence>(
        `SELECT * FROM sentences${where}${joiner}${PAPER_READ_MATCH}`,
        ...params
      ) ?? [];
  } else {
    // listening 暫未支援（可於將來改由 JLPT 真題表取）
    words = [];
    sentences = [];
  }

  return { words, sentences };
}

/** 舊代碼兼容：把 getAllForPool 指向 getAllForFilter */
export const getAllForPool = getAllForFilter;

/* -------------------------- 錯題本 API（本地持久化） -------------------------- */
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

/**（可選）由 DB 取題幹（方便顯示錯題詳情） */
export function getStemById(kind: 'word' | 'sentence', id: number): string | null {
  const db = getDB();
  if (kind === 'word') {
    const w = db.getFirstSync?.<Word>('SELECT * FROM words WHERE id=?', id);
    return w ? (w.reading ? `${w.jp}（${w.reading}）` : w.jp) : null;
  } else {
    const s = db.getFirstSync?.<Sentence>('SELECT * FROM sentences WHERE id=?', id);
    return s?.jp ?? null;
  }
}
