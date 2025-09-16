// src/db/index.ts
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import {
  CREATE_TABLES_SQL,
  Topic, Section,
  ExamRow, QuestionRow, ChoiceRow, PoolQuestion, MistakeRow,
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

/** 只用 Supabase，同步入本地 DB（不讀 JSON） */
export async function seedIfEmpty(): Promise<void> {
  const db = getDB();
  await syncFromSupabaseToDB(db);
}

/** 篩選條件（寬鬆些，接受 undefined / null / 'random' ） */
export type PracticeFilter = {
  level: Topic | 'N2-N3-random' | 'all';
  kind: 'language' | 'reading' | 'listening';
  year?: number | 'random' | undefined | null;
  month?: '07' | '12' | 'random' | undefined | null; // 新：月份
  // 向後兼容（舊 UI 用 session）
  session?: 'July' | 'December' | 'random' | undefined | null;
};

/** 由本地 DB 取出題庫（已合併 choices） */
export function getAllForFilter(f: PracticeFilter): { pool: PoolQuestion[] } {
  const db = getDB();

  // 轉換 level
  let levels: Topic[] = [];
  if (f.level === 'all') levels = ['N1', 'N2', 'N3', 'N4', 'N5'];
  else if (f.level === 'N2-N3-random') levels = ['N2', 'N3'];
  else levels = [f.level as Topic];

  // 月份：容許舊參數 session
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
    conds.push('e.year = ?');
    params.push(f.year);
  }
  if (effMonth && effMonth !== 'random') {
    conds.push('e.month = ?');
    params.push(effMonth);
  }

  // 類型 -> section 篩選
  // language = vocab + grammar；reading = reading；listening 暫無（回空）
  if (f.kind === 'language') {
    conds.push(`q.section IN ('vocab','grammar')`);
  } else if (f.kind === 'reading') {
    conds.push(`q.section = 'reading'`);
  } else {
    // listening：直接令結果為空
    conds.push('1=0');
  }

  const whereSQL = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  // ⚠️ 注意：本地 exams 主鍵叫 key，因此要用 e.key 來 join
  const qs =
    db.getAllSync?.<QuestionRow>(`
      SELECT q.exam_key, q.question_number, q.section, q.stem, q.passage
      FROM questions q
      JOIN exams e ON e.key = q.exam_key
      ${whereSQL}
      ORDER BY e.year DESC, q.exam_key, q.question_number
    `, ...params) ?? [];

  const pool: PoolQuestion[] = [];
  for (const q of qs) {
    const cs =
      db.getAllSync?.<ChoiceRow>(
        `
        SELECT exam_key, question_number, position, content, is_correct, explanation
        FROM choices
        WHERE exam_key = ? AND question_number = ?
        ORDER BY position
      `,
        q.exam_key,
        q.question_number,
      ) ?? [];

    pool.push({
      exam_key: q.exam_key,
      question_number: q.question_number,
      section: q.section as Section,
      stem: q.stem,
      passage: q.passage ?? null,
      choices: cs.map((c) => ({
        position: c.position,
        content: c.content,
        is_correct: !!c.is_correct,
        explanation: c.explanation,
      })),
    });
  }

  return { pool };
}

/* ---------------- 錯題本 ---------------- */
export function insertMistake(args: {
  exam_key: string;
  question_number: number;
  picked_position: number;
}): void {
  const db = getDB();
  db.runSync?.(
    'INSERT INTO mistakes (created_at, exam_key, question_number, picked_position) VALUES (?,?,?,?)',
    [Date.now(), args.exam_key, args.question_number, args.picked_position],
  );
}

export function getMistakes(): MistakeRow[] {
  const db = getDB();
  return db.getAllSync?.<MistakeRow>(
    'SELECT * FROM mistakes ORDER BY created_at DESC',
  ) ?? [];
}

export function clearMistakes(): void {
  const db = getDB();
  db.execSync?.('DELETE FROM mistakes;');
}
