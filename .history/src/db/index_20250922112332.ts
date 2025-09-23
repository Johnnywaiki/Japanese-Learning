// src/db/index.ts
// --- Imports ---
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import {
  CREATE_TABLES_SQL,
  type Section,
  type PoolQuestion,
  type MistakeRow,
  type Topic,
} from './schema';
import { syncFromSupabaseToDB, getSupabase } from './remote';

// --- Daily types & helpers ---
export type DailyCategory = 'grammar' | 'vocab';

/** 把 (week, day) 映射到 4 位序號：0001..0070（1週=7天） */
export function makeDailyKey(
  level: Topic,
  category: DailyCategory,
  week: number,
  day: number
): string {
  const n = (week - 1) * 7 + day; // 1-based
  const cat = category === 'grammar' ? 'GRAMMAR' : 'VOCAB';
  const seq = String(n).padStart(4, '0');
  return `${level}-${cat}-${seq}`;
}

/* ------------------------- DB 連線（本地） ------------------------- */
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

/** 同步遠端資料落本地 */
export async function seedIfEmpty(): Promise<void> {
  const db = getDB();
  await syncFromSupabaseToDB(db);
}

/* -------------------- Supabase（日更/權威來源） -------------------- */
type DailyChoiceRow = {
  position: number;
  content: string;
  is_correct: boolean;
  explanation: string | null;
};

type DailyQuestionRow = {
  daily_key: string;
  item_number: number;
  stem: string;
  passage: string | null;
  question_type: string | null;
  daily_choices: DailyChoiceRow[];
};

/** 直接由 Supabase 讀取某個 daily_key 的題庫（遠端） */
export async function getDailyPoolByKeyRemote(daily_key: string): Promise<PoolQuestion[]> {
  const sb = getSupabase();
  if (!sb) {
    console.warn('[daily] no supabase client, return empty pool');
    return [];
  }

  // 讀題目 + 內嵌選項
  const { data, error } = await sb
    .from('daily_questions')
    .select(
      `
      daily_key,
      item_number,
      stem,
      passage,
      question_type,
      daily_choices:daily_choices (
        position, content, is_correct, explanation
      )
    `
    )
    .eq('daily_key', daily_key)
    .order('item_number', { ascending: true })
    .order('position', { foreignTable: 'daily_choices', ascending: true });

  if (error) {
    console.warn('[daily] fetch error', error);
    return [];
  }

  const rows = (data ?? []) as unknown as DailyQuestionRow[];
  const toSection = (s: string | null | undefined): Section => {
    if (s === 'grammar' || s === 'vocab' || s === 'reading') return s;
    return 'grammar';
  };

  return rows.map((q) => ({
    exam_key: daily_key, // 借用 exam_key 放 daily_key
    question_number: q.item_number,
    section: toSection(q.question_type),
    stem: q.stem,
    passage: q.passage ?? null,
    choices: (q.daily_choices ?? []).map((c) => ({
      position: c.position,
      content: c.content,
      is_correct: !!c.is_correct,
      explanation: c.explanation ?? null,
    })),
  }));
}

/** 由 level/category/week/day 直接讀取 daily pool（遠端包裝） */
export async function getDailyPoolRemoteByArgs(args: {
  level: Topic;
  category: DailyCategory;
  week: number; // 1..10
  day: number;  // 1..7
}): Promise<{ daily_key: string; pool: PoolQuestion[] }> {
  const daily_key = makeDailyKey(args.level, args.category, args.week, args.day);
  const pool = await getDailyPoolByKeyRemote(daily_key);
  return { daily_key, pool };
}

/* -------------------- 模擬試卷（原有，本地） + daily_key 支援 -------------------- */
export type PracticeFilter = {
  level: Topic | 'N2-N3-random' | 'all';
  kind: 'language' | 'reading' | 'listening';
  year?: number | 'random' | undefined;
  month?: '07' | '12' | 'random' | undefined;
  session?: 'July' | 'December' | 'random' | undefined;
  /** ✅ 新增：如果有 daily_key，就直接走 daily 模式（本地） */
  daily_key?: string;
  /** 其他自由載荷（例如 week/day） */
  extra?: any;
};

/** 本地 daily_key → PoolQuestion[] */
export function getDailyPoolFromDB(daily_key: string): { pool: PoolQuestion[] } {
  const db = getDB();

  const setRow =
    (db.getAllSync?.<{ level: Topic; category: 'grammar' | 'vocab' }>(
      `SELECT level, category FROM daily_sets WHERE daily_key = ? LIMIT 1`,
      daily_key
    ) ?? [])[0];

  const fallbackCategory: 'grammar' | 'vocab' = setRow?.category ?? 'vocab';

  const qs =
    db.getAllSync?.<{
      item_number: number;
      stem: string;
      passage: string | null;
      question_type: string | null;
    }>(
      `
      SELECT item_number, stem, passage, question_type
      FROM daily_questions
      WHERE daily_key = ?
      ORDER BY item_number
    `,
      daily_key
    ) ?? [];

  const pool: PoolQuestion[] = [];
  for (const q of qs) {
    const cs =
      db.getAllSync?.<{
        position: number;
        content: string;
        is_correct: number;
        explanation: string | null;
      }>(
        `
        SELECT position, content, is_correct, explanation
        FROM daily_choices
        WHERE daily_key = ? AND item_number = ?
        ORDER BY position
      `,
        daily_key,
        q.item_number
      ) ?? [];

    pool.push({
      exam_key: daily_key,
      question_number: q.item_number,
      section: ((q.question_type as Section) ?? fallbackCategory),
      stem: q.stem,
      passage: q.passage ?? null,
      choices: cs.map((c) => ({
        position: c.position,
        content: c.content,
        is_correct: !!c.is_correct,
        explanation: c.explanation ?? null,
      })),
    });
  }

  return { pool };
}

/** 主查詢：支援 mock 試卷 + daily_key（本地） */
export function getAllForFilter(f: PracticeFilter): { pool: PoolQuestion[] } {
  // 👉 若傳入 daily_key，優先用 daily（本地）
  if (f.daily_key) {
    return getDailyPoolFromDB(f.daily_key);
  }

  const db = getDB();

  // level → levels[]
  let levels: Topic[] = [];
  if (f.level === 'all') levels = ['N1', 'N2', 'N3', 'N4', 'N5'];
  else if (f.level === 'N2-N3-random') levels = ['N2', 'N3'];
  else levels = [f.level as Topic];

  const effMonth =
    f.month ??
    (f.session === 'July'
      ? '07'
      : f.session === 'December'
      ? '12'
      : f.session === 'random'
      ? 'random'
      : undefined);

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

  if (f.kind === 'language') {
    conds.push(`q.section IN ('vocab','grammar')`);
  } else if (f.kind === 'reading') {
    conds.push(`q.section = 'reading'`);
  } else {
    // listening 未開
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
        explanation: string | null;
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
        is_correct: !!c.is_correct,
        explanation: c.explanation ?? null,
      })),
    });
  }

  return { pool };
}

/* -------------------- Daily 清單（本地） -------------------- */
/** 列出某 level+category 的 daily set（可用於 daily 清單頁） */
export function getDailySets(
  level: Topic,
  category: 'grammar' | 'vocab'
): Array<{ daily_key: string; title: string | null }> {
  const db = getDB();
  return (
    db.getAllSync?.<{ daily_key: string; title: string | null }>(
      `
      SELECT daily_key, title
      FROM daily_sets
      WHERE level = ? AND category = ?
      ORDER BY daily_key
    `,
      level,
      category
    ) ?? []
  );
}

/* ---------------------- 題目詳情（錯題頁共用） ---------------------- */
export function getQuestionDetail(
  examOrDailyKey: string,
  question_number: number
): {
  stem?: string;
  passage?: string | null;
  choices: Array<{
    position: number;
    content: string;
    is_correct: number | boolean;
    explanation?: string | null;
  }>;
} {
  const db = getDB();

  // 先試 mock 試卷
  const q1 =
    (db.getAllSync?.<{ stem: string; passage: string | null }>(
      `SELECT stem, passage FROM questions WHERE exam_key = ? AND question_number = ? LIMIT 1`,
      examOrDailyKey,
      question_number
    ) ?? [])[0];
  if (q1) {
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
        examOrDailyKey,
        question_number
      ) ?? [];
    return { stem: q1.stem, passage: q1.passage ?? null, choices };
  }

  // 再試 daily（本地）
  const q2 =
    (db.getAllSync?.<{ stem: string; passage: string | null }>(
      `SELECT stem, passage FROM daily_questions WHERE daily_key = ? AND item_number = ? LIMIT 1`,
      examOrDailyKey,
      question_number
    ) ?? [])[0];

  if (q2) {
    const choices =
      db.getAllSync?.<{
        position: number;
        content: string;
        is_correct: number;
        explanation: string | null;
      }>(
        `SELECT position, content, is_correct, explanation
         FROM daily_choices
         WHERE daily_key = ? AND item_number = ?
         ORDER BY position`,
        examOrDailyKey,
        question_number
      ) ?? [];
    return { stem: q2.stem, passage: q2.passage ?? null, choices };
  }

  // 兩邊都搵唔到
  return { choices: [] };
}

/* ------------------------- 錯題本 ------------------------- */
export function insertMistake(args: {
  exam_key: string; // 可傳 daily_key
  question_number: number; // daily 亦用 item_number
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
