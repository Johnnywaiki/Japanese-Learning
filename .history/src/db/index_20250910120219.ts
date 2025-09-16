// src/db/index.ts
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { CREATE_TABLES_SQL, Word, Sentence, Topic, MistakeRow } from './schema';
import { syncFromSupabaseToDB, syncFromJsonToDB } from './remote';

let _db: SQLiteDatabase | null = null;

export function getDB(): SQLiteDatabase {
  if (_db) return _db;
  const db = openDatabaseSync('jp_quiz.db');
  db.execSync?.(CREATE_TABLES_SQL);
  // 舊版本升級欄位
  ensureColumn(db, 'words', 'year INTEGER');
  ensureColumn(db, 'words', 'session TEXT');
  ensureColumn(db, 'words', 'paper TEXT');
  ensureColumn(db, 'sentences', 'year INTEGER');
  ensureColumn(db, 'sentences', 'session TEXT');
  ensureColumn(db, 'sentences', 'paper TEXT');
  _db = db; return _db!;
}
function ensureColumn(db: SQLiteDatabase, table: 'words'|'sentences', colDef: string) {
  const col = colDef.split(' ')[0];
  const meta = db.getAllSync?.<{ name: string }>(`PRAGMA table_info(${table})`) ?? [];
  if (!meta.some(m => m.name === col)) {
    db.execSync?.(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
  }
}

/** 初始化：先 Supabase 再 JSON（如有） */
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

export async function getAllForFilter(
  f: PracticeFilter
): Promise<{ words: Word[]; sentences: Sentence[] }> {
  const db = getDB();

  // topics
  let topics: Topic[] = [];
  if (f.level === 'all') topics = ['N1','N2','N3','N4','N5'];
  else if (f.level === 'N2-N3-random') topics = ['N2','N3'];
  else topics = [f.level as Topic];

  // where 片段
  const conds: string[] = [];
  const params: any[] = [];
  if (topics.length) {
    conds.push(`topic IN (${topics.map(() => '?').join(',')})`);
    params.push(...topics);
  }
  if (f.year && f.year !== 'random') { conds.push('year = ?'); params.push(f.year); }
  if (f.session && f.session !== 'random') { conds.push('LOWER(session) = LOWER(?)'); params.push(f.session); }
  const where = conds.length ? ` WHERE ${conds.join(' AND ')}` : '';

  let words: Word[] = [];
  let sentences: Sentence[] = [];

  if (f.kind === 'language') {
    // vocab + grammar_reading
    words = db.getAllSync?.<Word>(`SELECT * FROM words${where} AND (paper IS NULL OR paper='' OR LOWER(paper)='vocab')`, ...params) ?? [];
    sentences = db.getAllSync?.<Sentence>(`SELECT * FROM sentences${where} AND (LOWER(paper)='grammar_reading')`, ...params) ?? [];
  } else if (f.kind === 'reading') {
    sentences = db.getAllSync?.<Sentence>(`SELECT * FROM sentences${where} AND (paper IS NULL OR LOWER(paper)='reading' OR LOWER(paper)='grammar_reading')`, ...params) ?? [];
  } else {
    // listening 暫不支援，回空集合
    words = []; sentences = [];
  }

  // N2-N3 隨機：稍後在 useQuiz 洗牌即可；此處只回傳 N2/N3 的集合
  return { words, sentences };
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
