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

/* ============== DB 連線 ============== */
const DB_NAME = 'jp_quiz_v3.db';
let _db: SQLiteDatabase | null = null;

export function getDB(): SQLiteDatabase {
  if (_db) return _db!;
  const db = openDatabaseSync(DB_NAME);
  db.execSync?.(CREATE_TABLES_SQL);
  _db = db;
  return _db!;
}

/* ============== 首次 seed（若空） ============== */
let _seeded = false;
export async function ensureSeedOnce(): Promise<void> {
  if (_seeded) return;
  const db = getDB();

  const count = (table: string) =>
    db.getFirstSync?.<{ c: number }>(`SELECT COUNT(*) AS c FROM ${table}`)?.c ?? 0;

  const counts = {
    exams: count('exams'),
    questions: count('questions'),
    choices: count('choices'),
    daily_sets: count('daily_sets'),
    daily_questions: count('daily_questions'),
    daily_choices: count('daily_choices'),
  };
  console.log('[db.counts]', counts);

  const emptyAll = Object.values(counts).every(c => c === 0);
  if (emptyAll) {
    const ok = await syncFromSupabaseToDB(db);
    console.log(ok ? '[seed] synced from supabase' : '[seed] supabase unavailable');
  } else {
    console.log('[seed] tables already populated, skip sync');
  }
  _seeded = true;
}

/* ============== Mock：依條件取 pool ============== */
export type PracticeFilter = {
  level: Topic | 'N2-N3-random' | 'all';
  kind: 'language' | 'reading' | 'listening';
  year?: number | 'random';
  month?: '07' | '12' | 'random';
  session?: 'July' | 'December' | 'random';
};

/** 把 "July/December" 轉成 "07/12"；random/undefined → undefined */
function sessionToMonth(session?: PracticeFilter['session']): '07' | '12' | undefined {
  if (session === 'July') return '07';
  if (session === 'December') return '12';
  return undefined;
}

/** 統一月份比較：容許資料庫入面係 '07' 或 '7' */
function monthWhere(col: string): string {
  // 用 SQLite 的 LTRIM 去掉前導 0
  // 令 '07' 與 '7' 都可以 match
  return `( ${col} = ? OR LTRIM(${col}, '0') = LTRIM(?, '0') )`;
}

export function getAllForFilter(f: PracticeFilter): { pool: PoolQuestion[] } {
  const db = getDB();

  // level → levels[]
  let levels: Topic[] = [];
  if (f.level === 'all') levels = ['N1', 'N2', 'N3', 'N4', 'N5'];
  else if (f.level === 'N2-N3-random') levels = ['N2', 'N3'];
  else levels = [f.level as Topic];

  // 決定有效年份 / 月份
  const effYear = f.year && f.year !== 'random' ? Number(f.year) : undefined;
  const effMonth = ((): '07' | '12' | undefined => {
    if (f.month && f.month !== 'random') return f.month;
    return sessionToMonth(f.session);
  })();

  const conds: string[] = [];
  const params: any[] = [];

  // level
  if (levels.length) {
    conds.push(`e.level IN (${levels.map(() => '?').join(',')})`);
    params.push(...levels);
  }

  // year
  if (typeof effYear === 'number' && Number.isFinite(effYear)) {
    conds.push(`e.year = ?`);
    params.push(effYear);
  }

  // month（用 LTRIM 容錯 '07' / '7'）
  if (effMonth) {
    conds.push(monthWhere('e.month'));
    params.push(effMonth, effMonth);
  }

  // section（language = 詞彙/文法；視乎你 UI，若把「言語+讀解」合併，就包含 reading）
  if (f.kind === 'language') {
    conds.push(`q.section IN ('vocab','grammar','language','reading')`);
  } else if (f.kind === 'reading') {
    conds.push(`q.section = 'reading'`);
  } else {
    // 現階段未支援 listening → 不回任何題（避免誤取）
    conds.push(`1 = 0`);
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
    (db.getAllSync?.<QRow>(
      `
      SELECT q.exam_key, q.question_number, q.section, q.stem, q.passage
      FROM questions q
      JOIN exams e ON e.exam_key = q.exam_key
      ${whereSQL}
      ORDER BY e.year DESC, e.month DESC, q.exam_key, q.question_number
      `,
      ...params
    ) ?? []);

  const pool: PoolQuestion[] = [];
  for (const q of qs) {
    const cs =
      (db.getAllSync?.<{
        position: number; content: string; is_correct: number; explanation: string | null;
      }>(
        `SELECT position, content, is_correct, explanation
         FROM choices
         WHERE exam_key = ? AND question_number = ?
         ORDER BY position`,
        q.exam_key, q.question_number
      ) ?? []);
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

/* ============== Daily：key ↔ pool ============== */
export function makeDailyKey(
  level: Topic,
  category: 'grammar' | 'vocab',
  week: number,
  day: number
): string {
  const idx = (week - 1) * 7 + day; // 1..70
  const cat = category.toUpperCase(); // 'GRAMMAR' | 'VOCAB'
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

  const qs =
    (db.getAllSync?.<QRow>(
      `SELECT daily_key, item_number, stem, passage, question_type
       FROM daily_questions
       WHERE daily_key = ?
       ORDER BY item_number`,
      daily_key
    ) ?? []);

  const pool: PoolQuestion[] = [];
  for (const q of qs) {
    const cs =
      (db.getAllSync?.<{
        position: number; content: string; is_correct: number; explanation: string | null;
      }>(
        `SELECT position, content, is_correct, explanation
         FROM daily_choices
         WHERE daily_key = ? AND item_number = ?
         ORDER BY position`,
        q.daily_key, q.item_number
      ) ?? []);
    pool.push({
      exam_key: q.daily_key, // 用 daily_key 當 exam_key
      question_number: q.item_number,
      section: (q.question_type === 'grammar' ? 'grammar' : 'vocab') as Section,
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

/* ============== 單題詳情（mistakes / result 等） ============== */
/** 兼容 mock（questions/choices）與 daily（daily_*），自動判斷 exam_key 格式 */
export function getQuestionDetail(
  exam_key: string,
  question_number: number
): PoolQuestion | null {
  const db = getDB();
  const isDaily = /^N[1-5]-(GRAMMAR|VOCAB)-\d{4}$/.test(exam_key);

  if (isDaily) {
    // daily：question_number = item_number
    const q =
      db.getFirstSync?.<{
        daily_key: string; item_number: number; stem: string; passage: string | null; question_type: string | null;
      }>(
        `SELECT daily_key, item_number, stem, passage, question_type
         FROM daily_questions
         WHERE daily_key = ? AND item_number = ?`,
        exam_key, question_number
      ) ?? null;

    if (!q) return null;

    const cs =
      db.getAllSync?.<{
        position: number; content: string; is_correct: number; explanation: string | null;
      }>(
        `SELECT position, content, is_correct, explanation
         FROM daily_choices
         WHERE daily_key = ? AND item_number = ?
         ORDER BY position`,
        exam_key, question_number
      ) ?? [];

    return {
      exam_key,
      question_number,
      section: (q.question_type === 'grammar' ? 'grammar' : 'vocab') as Section,
      stem: q.stem,
      passage: q.passage ?? null,
      choices: cs.map(c => ({
        position: c.position,
        content: c.content,
        is_correct: !!c.is_correct,
        explanation: c.explanation ?? null,
      })),
    };
  }

  // mock：
  const q =
    db.getFirstSync?.<{
      exam_key: string; question_number: number; section: Section; stem: string; passage: string | null;
    }>(
      `SELECT exam_key, question_number, section, stem, passage
       FROM questions
       WHERE exam_key = ? AND question_number = ?`,
      exam_key, question_number
    ) ?? null;

  if (!q) return null;

  const cs =
    db.getAllSync?.<{
      position: number; content: string; is_correct: number; explanation: string | null;
    }>(
      `SELECT position, content, is_correct, explanation
       FROM choices
       WHERE exam_key = ? AND question_number = ?
       ORDER BY position`,
      exam_key, question_number
    ) ?? [];

  return {
    exam_key,
    question_number,
    section: q.section,
    stem: q.stem,
    passage: q.passage ?? null,
    choices: cs.map(c => ({
      position: c.position,
      content: c.content,
      is_correct: !!c.is_correct,
      explanation: c.explanation ?? null,
    })),
  };
}

/* ============== Mistakes ============== */
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
  return getDB().getAllSync?.<MistakeRow>(
    'SELECT * FROM mistakes ORDER BY created_at DESC'
  ) ?? [];
}

export function clearMistakes(): void {
  getDB().execSync?.('DELETE FROM mistakes;');
}

/* ============== 類型 re-export（方便其他檔案 import） ============== */
export type { Topic, Section, PoolQuestion, MistakeRow } from './schema';
