// src/db/index.ts
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { CREATE_TABLES_SQL, type Topic, type Section, type MistakeRow as SchemaMistake } from './schema';
import { syncFromSupabaseToDB } from './remote';

/** 前端練習用 */
export type PoolChoice = {
  position: number;
  content: string;
  is_correct: boolean;
  explanation: string | null;
};
export type PoolQuestion = {
  exam_key: string;
  question_number: number;
  section: Section;
  stem: string;
  passage: string | null;
  choices: PoolChoice[];
};

/** 錯題表型別（id 可選，方便 setState） */
export type MistakeRow = Omit<SchemaMistake, 'id'> & { id?: number };

const DB_NAME = 'jp_quiz_v3.db';
let _db: SQLiteDatabase | null = null;

export function getDB(): SQLiteDatabase {
  if (_db) return _db;
  const db = openDatabaseSync(DB_NAME);
  db.execSync?.('PRAGMA foreign_keys = ON;');
  db.execSync?.(CREATE_TABLES_SQL);
  _db = db;
  return _db!;
}

/** 只在你按「開始練習」前調用 */
export async function seedIfEmpty(): Promise<void> {
  const db = getDB();
  await syncFromSupabaseToDB(db);
}

/* -------------------- 篩選 & 查題（合併 choices） -------------------- */
export type PracticeFilter = {
  level: Topic | 'N2-N3-random' | 'all';
  kind: 'language' | 'reading' | 'listening';
  year?: number | 'random';
  month?: '07' | '12' | 'random';
  session?: 'July' | 'December' | 'random';
};

export function getAllForFilter(f: PracticeFilter): { pool: PoolQuestion[] } {
  const db = getDB();

  // level → levels[]
  let levels: Topic[] = [];
  if (f.level === 'all') levels = ['N1', 'N2', 'N3', 'N4', 'N5'];
  else if (f.level === 'N2-N3-random') levels = ['N2', 'N3'];
  else levels = [f.level as Topic];

  const effMonth =
    f.month ??
    (f.session === 'July' ? '07' :
     f.session === 'December' ? '12' :
     f.session === 'random' ? 'random' : undefined);

  const conds: string[] = [];
  const params: any[] = [];

  if (levels.length) {
    conds.push(`e.level IN (${levels.map(() => '?').join(',')})`);
    params.push(...levels);
  }
  if (typeof f.year === 'number') {
    conds.push(`e.year = ?`);
    params.push(f.year);
  }
  if (effMonth && effMonth !== 'random') {
    conds.push(`e.month = ?`);
    params.push(effMonth);
  }

  if (f.kind === 'language') {
    conds.push(`q.section IN ('vocab','grammar')`);
  } else if (f.kind === 'reading') {
    conds.push(`q.section = 'reading'`);
  } else {
    conds.push(`1=0`); // listening 未支援
  }

  const whereSQL = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  type QRow = {
    exam_key: string;
    question_number: number;
    section: Section;
    stem: string;
    passage: string | null;
  };

  const qs =
    getDB().getAllSync?.<QRow>(
      `
      SELECT q.exam_key, q.question_number, q.section, q.stem, q.passage
      FROM questions q
      JOIN exams e ON e.exam_key = q.exam_key
      ${whereSQL}
      ORDER BY e.year DESC, q.exam_key, q.question_number
      `,
      ...params
    ) ?? [];

  const pool: PoolQuestion[] = [];
  for (const q of qs) {
    const cs =
      getDB().getAllSync?.<PoolChoice>(
        `
        SELECT position, content, is_correct, explanation
        FROM choices
        WHERE exam_key = ? AND question_number = ?
        ORDER BY position
        `,
        q.exam_key,
        q.question_number
      ) ?? [];

    pool.push({
      exam_key: q.exam_key,
      question_number: q.question_number,
      section: q.section,
      stem: q.stem,
      passage: q.passage ?? null,
      choices: cs.map(c => ({
        position: c.position,
        content: c.content,
        is_correct: !!(c as any).is_correct,
        explanation: (c as any).explanation ?? null,
      })),
    });
  }

  return { pool };
}

/* ---------------------- 題目詳情（錯題頁用） ---------------------- */
export function getQuestionDetail(
  exam_key: string,
  question_number: number
): {
  stem?: string;
  passage?: string | null;
  choices: Array<{ position: number; content: string; is_correct: number | boolean; explanation?: string | null }>;
} {
  const q =
    getDB().getAllSync?.<{ stem: string; passage: string | null }>(
      `SELECT stem, passage FROM questions WHERE exam_key = ? AND question_number = ? LIMIT 1`,
      exam_key,
      question_number
    ) ?? [undefined];

  const choices =
    getDB().getAllSync?.<{ position: number; content: string; is_correct: number; explanation: string | null }>(
      `SELECT position, content, is_correct, explanation
       FROM choices
       WHERE exam_key = ? AND question_number = ?
       ORDER BY position`,
      exam_key,
      question_number
    ) ?? [];

  return { stem: q[0]?.stem, passage: q[0]?.passage ?? null, choices };
}

/* ------------------------- 錯題本 ------------------------- */
export function insertMistake(args: {
  exam_key: string;
  question_number: number;
  picked_position: number;
}): void {
  getDB().runSync?.(
    'INSERT INTO mistakes (created_at, exam_key, question_number, picked_position) VALUES (?,?,?,?)',
    [Date.now(), args.exam_key, args.question_number, args.picked_position]
  );
}

export function getMistakes(): MistakeRow[] {
  return (
    getDB().getAllSync?.<MistakeRow>(
      'SELECT * FROM mistakes ORDER BY created_at DESC'
    ) ?? []
  );
}

export function clearMistakes(): void {
  getDB().execSync?.('DELETE FROM mistakes;');
}
