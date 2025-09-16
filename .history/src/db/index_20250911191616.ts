// src/db/index.ts
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import {
  CREATE_TABLES_SQL,
  Word,
  Sentence,
  Topic,
  MistakeRow,
  PracticeFilter,
} from './schema';
import {
  syncFromSupabaseToDB,
  syncFromJsonToDB,
  fetchJLPTPool,
} from './remote';

let _db: SQLiteDatabase | null = null;

export function getDB(): SQLiteDatabase {
  if (_db) return _db;
  const db = openDatabaseSync('jp_quiz.db');
  db.execSync?.(CREATE_TABLES_SQL);
  // 升級欄位（存在即跳過）
  ensureColumn(db, 'words', 'year INTEGER');
  ensureColumn(db, 'words', 'session TEXT');
  ensureColumn(db, 'words', 'paper TEXT');
  ensureColumn(db, 'sentences', 'year INTEGER');
  ensureColumn(db, 'sentences', 'session TEXT');
  ensureColumn(db, 'sentences', 'paper TEXT');
  _db = db;
  return _db!;
}

function ensureColumn(
  db: SQLiteDatabase,
  table: 'words' | 'sentences',
  colDef: string
) {
  const col = colDef.split(' ')[0];
  const meta = db.getAllSync?.<{ name: string }>(`PRAGMA table_info(${table})`) ?? [];
  if (!meta.some((m) => m.name === col)) {
    db.execSync?.(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
  }
}

/** 初始化同步：優先 Supabase，失敗再 JSON */
export async function seedIfEmpty(): Promise<void> {
  const db = getDB();
  if (await syncFromSupabaseToDB(db)) return;
  await syncFromJsonToDB(db);
}

/** 強制重新同步（可清表） */
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

/* ---------------- 查題（Level/Year/Session/Type） ---------------- */
export { PracticeFilter }; // 供外部 import

export async function getAllForFilter(
  f: PracticeFilter
): Promise<{ words: Word[]; sentences: Sentence[]; pool?: any[] }> {
  const db = getDB();

  // topics
  let topics: Topic[] = [];
  if (f.level === 'all') topics = ['N1', 'N2', 'N3', 'N4', 'N5', 'daily'];
  else if (f.level === 'N2-N3-random') topics = ['N2', 'N3'];
  else topics = [f.level as Topic];

  // WHERE 片段
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
  const whereBase = conds.length ? ` WHERE ${conds.join(' AND ')}` : '';
  const andOrWhere = conds.length ? ' AND ' : ' WHERE ';

  // 放寬 paper 匹配
  const PAPER_VOCAB =
    "(paper IS NULL OR paper='' OR LOWER(paper) LIKE '%vocab%' OR LOWER(paper) LIKE '%language%')";
  const PAPER_GRAM =
    "(paper IS NULL OR LOWER(paper) LIKE '%grammar%' OR LOWER(paper) LIKE '%grammar_reading%')";
  const PAPER_READ =
    "(paper IS NULL OR paper='' OR LOWER(paper) LIKE '%reading%' OR LOWER(paper) LIKE '%grammar_reading%')";

  let words: Word[] = [];
  let sentences: Sentence[] = [];

  if (f.kind === 'language') {
    words =
      db.getAllSync?.<Word>(
        `SELECT * FROM words${whereBase}${andOrWhere}${PAPER_VOCAB}`,
        ...params
      ) ?? [];
    sentences =
      db.getAllSync?.<Sentence>(
        `SELECT * FROM sentences${whereBase}${andOrWhere}${PAPER_GRAM}`,
        ...params
      ) ?? [];
  } else if (f.kind === 'reading') {
    sentences =
      db.getAllSync?.<Sentence>(
        `SELECT * FROM sentences${whereBase}${andOrWhere}${PAPER_READ}`,
        ...params
      ) ?? [];
  } else {
    // listening（本地暫不提供）
    words = [];
    sentences = [];
  }

  // 本地無數 → 走 JLPT 正規表直讀（線上）
  if ((words?.length ?? 0) + (sentences?.length ?? 0) === 0) {
    try {
      const pool = await fetchJLPTPool(f);
      if (pool.length > 0) return { words: [], sentences: [], pool };
    } catch (e) {
      console.warn('[getAllForFilter] JLPT fallback error:', e);
    }
  }

  return { words, sentences };
}

/** 舊名兼容 */
export const getAllForPool = getAllForFilter;

/* ---------------- 錯題本（本地持久化） ---------------- */
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

/** 由 DB 取題幹（顯示錯題詳情） */
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
