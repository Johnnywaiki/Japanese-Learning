// src/db/index.ts
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import {
  CREATE_TABLES_SQL,
  type MistakeRow as MistakeRowSchema,
  type Topic as TopicSchema,
  type Section as SectionSchema,
} from './schema';
import { syncFromSupabaseToDB } from './remote';

/* -------- 對外型別 -------- */
export type Topic = TopicSchema;
export type Section = SectionSchema;

export type PoolChoice = {
  position: number;
  content: string;
  is_correct: boolean;
  explanation: string | null;
};

export type PoolQuestion = {
  // mock: exam_key；daily: 用 daily_key 代入此欄，方便共用 UI
  exam_key: string;
  question_number: number;
  section: Section;
  stem: string;
  passage: string | null;
  choices: PoolChoice[];
};

export type MistakeRow = MistakeRowSchema;

/* -------- DB 連線 -------- */
const DB_NAME = 'jp_quiz_v3.db';
let _db: SQLiteDatabase | null = null;

export function getDB(): SQLiteDatabase {
  if (_db) return _db;
  const db = openDatabaseSync(DB_NAME);
  db.execSync?.(CREATE_TABLES_SQL);
  _db = db;
  return _db!;
}

export async function seedIfEmpty(): Promise<void> {
  const db = getDB();
  await syncFromSupabaseToDB(db);
}

/* -------- Mock paper 取題 -------- */
export type PracticeFilter = {
  level: Topic | 'N2-N3-random' | 'all';
  kind: 'language' | 'reading' | 'listening';
  year?: number | 'random';
  month?: '07' | '12' | 'random';
  session?: 'July' | 'December' | 'random';
};

export function getAllForFilter(f: PracticeFilter): { pool: PoolQuestion[] } {
  const db = getDB();

  let levels: Topic[] = [];
  if (f.level === 'all') levels = ['N1', 'N2', 'N3', 'N4', 'N5'];
  else if (f.level === 'N2-N3-random') levels = ['N2', 'N3'];
  else levels = [f.level as Topic];

  const effMonth =
    f.month ??
    (f.session === 'July' ? '07'
      : f.session === 'December' ? '12'
      : f.session === 'random' ? 'random'
      : undefined);

  const conds: string[] = [];
  const params: any[] = [];
  if (levels.length) {
    conds.push(`e.level IN (${levels.map(() => '?').join(',')})`);
    params.push(...levels);
  }
  if (f.year && f.year !== 'random') { conds.push(`e.year = ?`); params.push(f.year); }
  if (effMonth && effMonth !== 'random') { conds.push(`e.month = ?`); params.push(effMonth); }
  if (f.kind === 'language') conds.push(`q.section IN ('vocab','grammar')`);
  else if (f.kind === 'reading') conds.push(`q.section = 'reading'`);
  else conds.push(`1=0`);

  const whereSQL = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  type QRow = {
    exam_key: string;
    question_number: number;
    section: Section;
    stem: string;
    passage: string | null;
  };

  const qs = db.getAllSync?.<QRow>(
    `SELECT q.exam_key, q.question_number, q.section, q.stem, q.passage
     FROM questions q
     JOIN exams e ON e.exam_key = q.exam_key
     ${whereSQL}
     ORDER BY e.year DESC, q.exam_key, q.question_number`,
    ...params
  ) ?? [];

  const pool: PoolQuestion[] = [];
  for (const q of qs) {
    const cs = db.getAllSync?.<{
      position: number; content: string; is_correct: number; explanation: string | null;
    }>(
      `SELECT position, content, is_correct, explanation
       FROM choices
       WHERE exam_key = ? AND question_number = ?
       ORDER BY position`,
      q.exam_key, q.question_number
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
        is_correct: !!c.is_correct,
        explanation: c.explanation ?? null,
      })),
    });
  }
  return { pool };
}

/* -------- Daily 取題 -------- */
export function makeDailyKey(
  level: Topic,
  category: 'grammar' | 'vocab',
  week: number,
  day: number
): string {
  const idx = (Math.max(1, week) - 1) * 7 + Math.max(1, day); // 1..70
  const cat = category.toUpperCase() === 'VOCAB' ? 'VOCAB' : 'GRAMMAR';
  return `${level}-${cat}-${String(idx).padStart(4, '0')}`;
}

export function getDailyPool(daily_key: string): { pool: PoolQuestion[] } {
  const db = getDB();

  type QRow = {
    daily_key: string;
    item_number: number;
    stem: string;
    passage: string | null;
    question_type: string | null;
  };

  const qs = db.getAllSync?.<QRow>(
    `SELECT daily_key, item_number, stem, passage, question_type
     FROM daily_questions
     WHERE daily_key = ?
     ORDER BY item_number`,
    daily_key
  ) ?? [];

  const pool: PoolQuestion[] = [];
  for (const q of qs) {
    const cs = db.getAllSync?.<{
      position: number; content: string; is_correct: number; explanation: string | null;
    }>(
      `SELECT position, content, is_correct, explanation
       FROM daily_choices
       WHERE daily_key = ? AND item_number = ?
       ORDER BY position`,
      q.daily_key, q.item_number
    ) ?? [];

    pool.push({
      exam_key: q.daily_key,                // 用 daily_key 當通用 key
      question_number: q.item_number,
      section: (q.question_type === 'vocab' ? 'vocab' : 'grammar'),
      stem: q.stem,
      passage: q.passage ?? null,
      choices: cs.map(c => ({
        position: c.position,
        content: c.content,
        is_correct: !!c.is_correct,
        explanation: c.explanation ?? null,
      })),
    });
  }

  return { pool };
}

/* -------- 題目詳情（錯題頁） -------- */
export function getQuestionDetail(
  exam_key: string,
  question_number: number
): {
  stem?: string;
  passage?: string | null;
  choices: Array<{ position: number; content: string; is_correct: number | boolean; explanation?: string | null }>;
} {
  const db = getDB();

  const q =
    (db.getAllSync?.<{ stem: string; passage: string | null }>(
      `SELECT stem, passage FROM questions WHERE exam_key = ? AND question_number = ? LIMIT 1`,
      exam_key, question_number
    ) ?? [])[0];

  const choices =
    db.getAllSync?.<{ position: number; content: string; is_correct: number; explanation: string | null }>(
      `SELECT position, content, is_correct, explanation
       FROM choices
       WHERE exam_key = ? AND question_number = ?
       ORDER BY position`,
      exam_key, question_number
    ) ?? [];

  return { stem: q?.stem, passage: q?.passage ?? null, choices };
}

/* -------- 錯題本 -------- */
export function insertMistake(args: {
  exam_key: string;
  question_number: number;
  picked_position: number;
}): void {
  const db = getDB();
  db.runSync?.(
    'INSERT INTO mistakes (created_at, exam_key, question_number, picked_position) VALUES (?,?,?,?)',
    [Date.now(), args.exam_key, args.question_number, args.picked_position]
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

/* ---- 額外顯式匯出（避免 IDE 誤判） ---- */
export {
  // functions
  getAllForFilter as _getAllForFilter,
  getDailyPool as _getDailyPool,
  makeDailyKey as _makeDailyKey,
};
export type {
  PracticeFilter as _PracticeFilter,
  PoolChoice as _PoolChoice,
  PoolQuestion as _PoolQuestion,
  MistakeRow as _MistakeRow,
};
