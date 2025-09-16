// src/db/index.ts
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { CREATE_TABLES_SQL, Word, Sentence, Topic, MistakeRow } from './schema';
import { syncFromSupabaseToDB, syncFromJsonToDB } from './remote';

let _db: SQLiteDatabase | null = null;

export function getDB(): SQLiteDatabase {
  if (_db) return _db;
  const db = openDatabaseSync('jp_quiz.db');
  db.execSync?.(CREATE_TABLES_SQL);
  // 升級欄位（舊資料可能未有 year/session/paper）
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

/** 初始化：先 Supabase，再 JSON（如有） */
export async function seedIfEmpty(): Promise<void> {
  const db = getDB();
  if (await syncFromSupabaseToDB(db)) return;
  await syncFromJsonToDB(db);
}

/* ------------ 查題（支援 Level/Year/Session/Type） ------------ */
export type PracticeFilter = {
  level: Topic | 'N2-N3-random' | 'all';
  kind: 'language' | 'reading' | 'listening';
  year?: number | 'random';
  session?: 'July' | 'December' | 'random';
};

function buildTopicList(level: PracticeFilter['level']): Topic[] {
  if (level === 'all') return ['N1','N2','N3','N4','N5'];
  if (level === 'N2-N3-random') return ['N2','N3'];
  return [level as Topic];
}

type Pair = { words: Word[]; sentences: Sentence[] };

function queryPair(db: SQLiteDatabase, topics: Topic[], withYear?: number, withSession?: string, kind: PracticeFilter['kind'] = 'language'): Pair {
  const conds: string[] = [];
  const params: any[] = [];

  if (topics.length) {
    conds.push(`topic IN (${topics.map(() => '?').join(',')})`);
    params.push(...topics);
  }
  if (withYear !== undefined) { conds.push('year = ?'); params.push(withYear); }
  if (withSession !== undefined) { conds.push('LOWER(session) = LOWER(?)'); params.push(withSession); }

  const where = conds.length ? ` WHERE ${conds.join(' AND ')}` : '';

  let words: Word[] = [];
  let sentences: Sentence[] = [];

  if (kind === 'language') {
    // 語言知識：字彙 +（舊資料）文法讀解
    words = db.getAllSync?.<Word>(`SELECT * FROM words${where} AND (paper IS NULL OR paper='' OR LOWER(paper)='vocab')`, ...params) ?? [];
    sentences = db.getAllSync?.<Sentence>(`SELECT * FROM sentences${where} AND (LOWER(paper)='grammar_reading')`, ...params) ?? [];
  } else if (kind === 'reading') {
    sentences = db.getAllSync?.<Sentence>(`SELECT * FROM sentences${where} AND (paper IS NULL OR LOWER(paper)='reading' OR LOWER(paper)='grammar_reading')`, ...params) ?? [];
  } else {
    // listening 暫未對應舊資料，先回空
    words = [];
    sentences = [];
  }

  return { words, sentences };
}

export async function getAllForFilter(f: PracticeFilter): Promise<Pair> {
  const db = getDB();
  const topics = buildTopicList(f.level);

  // ① 先用用戶的完整篩選（含 year/session）
  const wantYear = f.year && f.year !== 'random' ? Number(f.year) : undefined;
  const wantSession = f.session && f.session !== 'random' ? String(f.session) : undefined;
  let pair = queryPair(db, topics, wantYear, wantSession, f.kind);

  // ② 如果一題都無，用「忽略月份」再試
  if ((pair.words.length + pair.sentences.length) === 0 && wantSession !== undefined) {
    console.warn('[getAllForFilter] no rows with session filter, retry without session');
    pair = queryPair(db, topics, wantYear, undefined, f.kind);
  }

  // ③ 仍然無，就連年份都忽略（等於隨機年份）
  if ((pair.words.length + pair.sentences.length) === 0 && wantYear !== undefined) {
    console.warn('[getAllForFilter] no rows with year filter, fallback to all years');
    pair = queryPair(db, topics, undefined, undefined, f.kind);
  }

  return pair;
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

/**（可選）由 DB 取題幹 */
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
