// src/db/index.ts
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { CREATE_TABLES_SQL, type Word, type Sentence, type Topic, type MistakeRow } from './schema';
import { syncFromSupabaseToDB } from './remote';

let _db: SQLiteDatabase | null = null;
export function getDB(): SQLiteDatabase {
  if (_db) return _db;
  const db = openDatabaseSync('jp_quiz.db');
  db.execSync?.(CREATE_TABLES_SQL);
  // 升級欄位（舊版本兼容）
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
  if (!meta.some(m => m.name === col)) db.execSync?.(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
}

/** 只用 Supabase，同步本地（可選 forceReload 會清表重拉） */
export async function seedIfEmpty(opts?: { forceReload?: boolean }): Promise<void> {
  const db = getDB();

  if (!opts?.forceReload) {
    const w = db.getFirstSync?.<{ c: number }>('SELECT COUNT(*) c FROM words')?.c ?? 0;
    const s = db.getFirstSync?.<{ c: number }>('SELECT COUNT(*) c FROM sentences')?.c ?? 0;
    if (w + s > 0) { console.log('[seedIfEmpty] already have', w, s); return; }
  }

  db.execSync?.('DELETE FROM words; DELETE FROM sentences; VACUUM;');
  await syncFromSupabaseToDB(db);
}

/** 練習頁的篩選條件 */
export type PracticeFilter = {
  level: Topic | 'N2-N3-random' | 'all';
  kind: 'language' | 'reading' | 'listening';
  year?: number | 'random';
  session?: 'July' | 'December' | 'random';
};

/** 依條件由本地 SQLite 取題 */
export function getAllForFilter(
  f: PracticeFilter
): { words: Word[]; sentences: Sentence[] } {
  const db = getDB();

  // level → topics
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

  const baseWhere = conds.length ? ` WHERE ${conds.join(' AND ')}` : '';
  const withExtra = (extraSQL: string) => (baseWhere ? `${baseWhere} AND ${extraSQL}` : ` WHERE ${extraSQL}`);

  let words: Word[] = [];
  let sentences: Sentence[] = [];

  if (f.kind === 'language') {
    // 單字（vocab）+ 文法讀解（grammar_reading）
    words = db.getAllSync?.<Word>(
      `SELECT * FROM words${withExtra("(paper IS NULL OR paper='' OR LOWER(paper)='vocab')")}`,
      ...params,
    ) ?? [];
    sentences = db.getAllSync?.<Sentence>(
      `SELECT * FROM sentences${withExtra("LOWER(paper)='grammar_reading'")}`,
      ...params,
    ) ?? [];
  } else if (f.kind === 'reading') {
    sentences = db.getAllSync?.<Sentence>(
      `SELECT * FROM sentences${withExtra("(LOWER(paper)='reading' OR LOWER(paper)='grammar_reading')")}`,
      ...params,
    ) ?? [];
  } else {
    // listening：暫時唔做（你之後可接 exams/questions/choices）
    words = [];
    sentences = [];
  }

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
    [args.kind, args.itemId, args.stem, args.correct, args.picked, args.topic, Date.now()],
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

/**（可選）用 id 取題幹 */
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

// 方便其他檔 import 型別
export type { Word, Sentence, Topic, MistakeRow };
