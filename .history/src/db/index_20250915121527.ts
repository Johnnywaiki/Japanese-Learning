// src/db/index.ts
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { CREATE_TABLES_SQL, Word, Sentence, Topic, MistakeRow } from './schema';
import { syncFromSupabaseToDB } from './remote';

let _db: SQLiteDatabase | null = null;

export function getDB(): SQLiteDatabase {
  if (_db) return _db;
  const db = openDatabaseSync('jp_quiz.db');
  db.execSync?.(CREATE_TABLES_SQL);
  // 升級欄位（保險）
  ensureColumn(db, 'words', 'year INTEGER');
  ensureColumn(db, 'words', 'session TEXT');
  ensureColumn(db, 'words', 'paper TEXT');
  ensureColumn(db, 'sentences', 'year INTEGER');
  ensureColumn(db, 'sentences', 'session TEXT');
  ensureColumn(db, 'sentences', 'paper TEXT');
  _db = db;
  return _db!;
}
function ensureColumn(db: SQLiteDatabase, table: 'words'|'sentences', colDef: string) {
  const col = colDef.split(' ')[0];
  const meta = db.getAllSync?.<{ name: string }>(`PRAGMA table_info(${table})`) ?? [];
  if (!meta.some(m => m.name === col)) {
    db.execSync?.(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
  }
}

/** 只係本地完全無數據先同步（而且只用 Supabase） */
export async function seedIfEmpty(): Promise<void> {
  const db = getDB();
  const c1 = db.getFirstSync?.<{ c: number }>('SELECT COUNT(*) c FROM words')?.c ?? 0;
  const c2 = db.getFirstSync?.<{ c: number }>('SELECT COUNT(*) c FROM sentences')?.c ?? 0;
  if (c1 + c2 > 0) return;
  await syncFromSupabaseToDB(db);
}

/* ------------ 查題（支援 Level/Year/Session/Type） ------------ */
export type PracticeFilter = {
  level: Topic | 'N2-N3-random' | 'all';
  kind: 'language' | 'reading' | 'listening';
  // 👇 容許 null（某啲地方可能傳 null 落嚟）
  year?: number | 'random' | null;
  session?: 'July' | 'December' | 'random' | null;
};

export function getAllForFilter(
  f: PracticeFilter
): { words: Word[]; sentences: Sentence[] } {
  const db = getDB();

  // topics
  let topics: Topic[] = [];
  if (f.level === 'all') topics = ['N1','N2','N3','N4','N5'];
  else if (f.level === 'N2-N3-random') topics = ['N2','N3'];
  else topics = [f.level as Topic];

  // 將 null 視為未選（undefined）
  const year = f.year === null ? undefined : f.year;
  const session = f.session === null ? undefined : f.session;

  const conds: string[] = [];
  const params: any[] = [];
  if (topics.length) {
    conds.push(`topic IN (${topics.map(() => '?').join(',')})`);
    params.push(...topics);
  }
  if (year && year !== 'random') { conds.push('year = ?'); params.push(year); }
  if (session && session !== 'random') { conds.push('LOWER(session) = LOWER(?)'); params.push(session); }

  const where = conds.length ? ` WHERE ${conds.join(' AND ')}` : '';

  let words: Word[] = [];
  let sentences: Sentence[] = [];

  if (f.kind === 'language') {
    words = getAllSafe<Word>(
      `SELECT * FROM words${where} AND (paper IS NULL OR paper='' OR LOWER(paper)='vocab')`,
      params
    );
    sentences = getAllSafe<Sentence>(
      `SELECT * FROM sentences${where} AND (LOWER(paper)='grammar_reading')`,
      params
    );
  } else if (f.kind === 'reading') {
    sentences = getAllSafe<Sentence>(
      `SELECT * FROM sentences${where} AND (paper IS NULL OR LOWER(paper)='reading' OR LOWER(paper)='grammar_reading')`,
      params
    );
  } else {
    // listening 未處理 → 回空
    words = [];
    sentences = [];
  }

  return { words, sentences };
}

function getAllSafe<T>(sql: string, params: any[]): T[] {
  const db = getDB();
  // expo-sqlite 的 getAllSync 係 (...args) 格式
  // @ts-ignore
  return db.getAllSync?.<T>(sql, ...params) ?? [];
}

/* ---------------- 錯題本 API ---------------- */
export function insertMistake(args: {
  kind: 'word' | 'sentence';
  itemId: number; stem: string; correct: string; picked: string; topic: Topic;
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

/**（可選）清空題庫（如果要擺脫舊 JSON 數據）*/
export function nukeLocalQuestions(): void {
  const db = getDB();
  db.execSync?.('BEGIN');
  db.execSync?.('DELETE FROM words;');
  db.execSync?.('DELETE FROM sentences;');
  db.execSync?.('COMMIT');
}

/** ✅ 重新 export 類型，畀其他檔 import */
export type { Topic, Word, Sentence, MistakeRow } from './schema';
