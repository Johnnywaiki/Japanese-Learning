// src/db/index.ts
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import {
  CREATE_TABLES_SQL,
  type Topic,
  type Section,
  type PoolQuestion,
  type MistakeRow,
} from './schema';
import { syncFromSupabaseToDB } from './remote';

/* ------------------------- DB 連線 ------------------------- */
// ✅ 新檔名，確保用新 schema（有 exam_key）
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

/** 只用 Supabase，同步入本地 DB（不讀 JSON） */
export async function seedIfEmpty(): Promise<void> {
  const db = getDB();
  await syncFromSupabaseToDB(db);
}

/* -------------------- 篩選 & 查題（合併 choices） -------------------- */
export type PracticeFilter = {
  level: Topic | 'N2-N3-random' | 'all';
  kind: 'language' | 'reading' | 'listening';
  year?: number | 'random' | undefined;
  month?: '07' | '12' | 'random' | undefined;           // 新：月份
  // 舊參數（若傳入會自動映射 month）
  session?: 'July' | 'December' | 'random' | undefined;
};

export function getAllForFilter(f: PracticeFilter): { pool: PoolQuestion[] } {
  const db = getDB();

  // level → levels[]
  let levels: Topic[] = [];
  if (f.level === 'all') levels = ['N1', 'N2', 'N3', 'N4', 'N5'];
  else if (f.level === 'N2-N3-random') levels = ['N2', 'N3'];
  else levels = [f.level as Topic];

  // 月份（容許沿用 session）
  const effMonth =
    f.month ??
    (f.session === 'July'
      ? '07'
      : f.session === 'December'
      ? '12'
      : f.session === 'random'
      ? 'random'
      : undefined);

  // where & params
  const conds: string[] = [];
  const params: any[] = [];

  if (levels.length) {
    conds.push(`e.level IN (${levels.map(() => '?').join(',')})`);
    params.push(...levels);
  }
  if (f.year && f.year !== 'random') {
    conds.push(`e.year = ?`);
    params.push(f.year);
  }
  if (effMonth && effMonth !== 'random') {
    conds.push(`e.month = ?`);
    params.push(effMonth);
  }

  // 類型 → section
  if (f.kind === 'language') {
    conds.push(`q.section IN ('vocab','grammar')`);
  } else if (f.kind === 'reading') {
    conds.push(`q.section = 'reading'`);
  } else {
    // listening 暫未支援：令結果為空
    conds.push(`1=0`);
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
    db.getAllSync?.<QRow>(
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
      db.getAllSync?.<{
        position: number;
        content: string;
        is_correct: number;
        explanation: string;
      }>(
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
      choices: cs.map((c) => ({
        position: c.position,
        content: c.content,
        is_correct: c.is_correct === 1, // boolean
        explanation: c.explanation,
      })),
    });
  }

  return { pool };
}

/* ---------------------- 題目詳情（俾錯題頁用） ---------------------- */
export async function getQuestionDetail(
  exam_key: string,
  question_number: number
): Promise<{
  stem?: string;
  passage?: string | null;
  choices: Array<{
    position: number;
    content: string;
    is_correct: number | boolean; // 方便前端用 === true 或 === 1
    explanation?: string | null;
  }>;
}> {
  const db = getDB();

  const q =
    (db.getAllSync?.<{ stem: string; passage: string | null }>(
      `SELECT stem, passage
       FROM questions
       WHERE exam_key = ? AND question_number = ?
       LIMIT 1`,
      exam_key,
      question_number
    ) ?? [])[0];

  const choices =
    db.getAllSync?.<{
      position: number;
      content: string;
      is_correct: number;
      explanation: string | null;
    }>(
      `SELECT position, content, is_correct, explanation
       FROM choices
       WHERE exam_key = ? AND question_number = ?
       ORDER BY position`,
      exam_key,
      question_number
    ) ?? [];

  return {
    stem: q?.stem,
    passage: q?.passage ?? null,
    choices: choices.map((c) => ({
      position: c.position,
      content: c.content,
      is_correct: c.is_correct, // keep number (0/1) for union
      explanation: c.explanation ?? null,
    })),
  };
}

/* ------------------------- 錯題本 ------------------------- */
export function insertMistake(args: {
  exam_key: string;
  question_number: number;
  picked_position: number;
}): void {
  const db = getDB();
  db.runSync?.(
    `INSERT INTO mistakes (created_at, exam_key, question_number, picked_position)
     VALUES (?,?,?,?)`,
    [Date.now(), args.exam_key, args.question_number, args.picked_position]
  );
}

export function getMistakes(): MistakeRow[] {
  const db = getDB();
  return (
    db.getAllSync?.<MistakeRow>(
      'SELECT * FROM mistakes ORDER BY created_at DESC'
    ) ?? []
  );
}

export function clearMistakes(): void {
  const db = getDB();
  db.execSync?.('DELETE FROM mistakes;');
}

/* ------------------------- re-exports ------------------------- */
// 讓其他檔只要 import 自 "src/db" 就有一致型別
export type { Topic, Section, PoolQuestion, MistakeRow } from './schema';
