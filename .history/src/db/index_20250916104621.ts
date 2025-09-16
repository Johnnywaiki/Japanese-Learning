// src/db/index.ts
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import {
  CREATE_TABLES_SQL,
  type Level, type Kind, type Section,
  type PoolQuestion, type MistakeRow
} from './schema';
import { syncFromSupabaseToDB } from './remote';

let _db: SQLiteDatabase | null = null;

export function getDB(): SQLiteDatabase {
  if (_db) return _db;
  const db = openDatabaseSync('jp_quiz.db');
  db.execSync?.(CREATE_TABLES_SQL);
  _db = db;
  return _db!;
}

/** 初始化（只拉 Supabase） */
export async function seedIfEmpty(): Promise<void> {
  const db = getDB();
  // 直接同步（每次進 app 可手動按「重新同步」）
  await syncFromSupabaseToDB(db);
}

/* ---------- 練習篩選 ---------- */
export type PracticeFilter = {
  level: Level | 'N2-N3-random' | 'all';
  kind: Kind; // language / reading / listening
  year?: number | 'random';
  session?: 'July' | 'December' | 'random'; // 目前 schema 不用到，可留將來擴充
};

function sectionsFor(kind: Kind): Section[] {
  if (kind === 'language') return ['vocab', 'grammar'];
  if (kind === 'reading')  return ['reading'];
  return ['listening'];
}

export function getPoolForFilter(f: PracticeFilter): PoolQuestion[] {
  const db = getDB();

  // level 清單
  let lvls: Level[];
  if (f.level === 'all') lvls = ['N1', 'N2', 'N3', 'N4', 'N5'];
  else if (f.level === 'N2-N3-random') lvls = ['N2', 'N3'];
  else lvls = [f.level];

  const secs = sectionsFor(f.kind);

  // exams + questions join（依 level / year / section 篩）
  const conds: string[] = [];
  const params: any[] = [];

  conds.push(`e.level IN (${lvls.map(() => '?').join(',')})`);
  params.push(...lvls);

  conds.push(`q.section IN (${secs.map(() => '?').join(',')})`);
  params.push(...secs);

  if (f.year && f.year !== 'random') {
    conds.push(`e.year = ?`);
    params.push(f.year);
  }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const rows = db.getAllSync?.<any>(
    `SELECT q.exam_key, q.question_number, q.section, q.stem, q.passage,
            e.level, e.year
     FROM questions q
     JOIN exams e ON e.key = q.exam_key
     ${where}
     ORDER BY e.year DESC, q.exam_key, q.question_number`,
    ...params
  ) ?? [];

  // 逐題取選項（規模不大，這樣較簡單）
  const pool: PoolQuestion[] = [];
  for (const r of rows) {
    const choices = db.getAllSync?.<any>(
      `SELECT position, content, is_correct FROM choices
       WHERE exam_key = ? AND question_number = ?
       ORDER BY position ASC`,
      r.exam_key, r.question_number
    ) ?? [];
    pool.push({
      exam_key: r.exam_key,
      question_number: r.question_number,
      section: r.section,
      stem: r.stem,
      passage: r.passage ?? null,
      level: r.level as Level,
      year: Number(r.year),
      choices: choices.map((c: any) => ({
        position: Number(c.position),
        content: String(c.content),
        is_correct: Number(c.is_correct) ? 1 : 0,
      }))
    });
  }
  return pool;
}

/* ---------- 錯題本 ---------- */
export function insertMistake(args: {
  id: string; stem: string; correct: string; picked: string; level: Level | null;
}): void {
  const db = getDB();
  db.runSync?.(
    'INSERT INTO mistakes (item_id,stem,correct,picked,level,created_at) VALUES (?,?,?,?,?,?)',
    [args.id, args.stem, args.correct, args.picked, args.level, Date.now()]
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
