// src/db/index.ts
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import {
  CREATE_TABLES_SQL,
  type MistakeRow as MistakeRowSchema,
  type Topic as TopicSchema,
  type Section as SectionSchema,
} from './schema';
import { syncFromSupabaseToDB } from './remote';

/* ===== 對外型別 ===== */
export type Topic = TopicSchema;
export type Section = SectionSchema;

export type PoolChoice = {
  position: number;
  content: string;
  is_correct: boolean;
  explanation: string | null;
};

export type PoolQuestion = {
  exam_key: string;           // mock: exam_key；daily：用 daily_key 填入
  question_number: number;    // mock: question_number；daily: item_number
  section: Section;           // 'grammar' | 'vocab' | 'reading'...
  stem: string;
  passage: string | null;
  choices: PoolChoice[];
};

export type MistakeRow = MistakeRowSchema;

/* ===== 連線 ===== */
const DB_NAME = 'jp_quiz_v3.db';  // 唔好再改名，改名就會變新檔
let _db: SQLiteDatabase | null = null;

export function getDB(): SQLiteDatabase {
  if (_db) return _db;
  const db = openDatabaseSync(DB_NAME);
  db.execSync?.(CREATE_TABLES_SQL);
  _db = db;
  return _db!;
}

/* ===== seed & 計數 ===== */
export type TableCounts = {
  exams: number; questions: number; choices: number;
  daily_sets: number; daily_questions: number; daily_choices: number;
};

export function tableCounts(): TableCounts {
  const db = getDB();
  // @ts-ignore expo-sqlite web types
  const scalar = (sql: string, params: any[] = []) =>
    Number(db.getFirstSync?.<{ n: number }>(`SELECT (${sql}) AS n`, params)?.n ?? 0);

  const counts = {
    exams: scalar('SELECT COUNT(*) FROM exams'),
    questions: scalar('SELECT COUNT(*) FROM questions'),
    choices: scalar('SELECT COUNT(*) FROM choices'),
    daily_sets: scalar('SELECT COUNT(*) FROM daily_sets'),
    daily_questions: scalar('SELECT COUNT(*) FROM daily_questions'),
    daily_choices: scalar('SELECT COUNT(*) FROM daily_choices'),
  };
  console.log('[db.counts]', counts);
  return counts;
}

let _seeded = false;

/** 只要發現任何一組表為 0，就觸發 Supabase 同步；整個 app 生命週期做一次 */
export async function ensureSeedOnce(): Promise<void> {
  if (_seeded) return;

  const c = tableCounts();
  const needMock = c.exams === 0 || c.questions === 0 || c.choices === 0;
  const needDaily = c.daily_sets === 0 || c.daily_questions === 0 || c.daily_choices === 0;

  if (needMock || needDaily) {
    console.log('[seed] starting sync (mock=', needMock, ', daily=', needDaily, ')');
    const ok = await syncFromSupabaseToDB(getDB());
    if (!ok) {
      console.warn('[seed] sync failed – 檢查 Supabase URL / ANON KEY');
    }
    tableCounts();
  } else {
    console.log('[seed] tables already populated, skip sync');
  }

  _seeded = true;
}

/* ===== Mock 取題 ===== */
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
    (f.session === 'July' ? '07' :
     f.session === 'December' ? '12' :
     f.session === 'random' ? 'random' : undefined);

  const conds: string[] = [];
  const params: any[] = [];
  if (levels.length) { conds.push(`e.level IN (${levels.map(() => '?').join(',')})`); params.push(...levels); }
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
     ORDER BY e.year DESC, q.exam_key, q.question_number`
  , ...params) ?? [];

  const pool: PoolQuestion[] = [];
  for (const q of qs) {
    const cs = db.getAllSync?.<{ position: number; content: string; is_correct: number; explanation: string | null }>(
      `SELECT position, content, is_correct, explanation
       FROM choices
       WHERE exam_key = ? AND question_number = ?
       ORDER BY position`, q.exam_key, q.question_number
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

/* ===== Daily 取題 ===== */
export function makeDailyKey(level: Topic, category: 'grammar' | 'vocab', week: number, day: number): string {
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
     ORDER BY item_number`, daily_key
  ) ?? [];

  const pool: PoolQuestion[] = [];
  for (const q of qs) {
    const cs = db.getAllSync?.<{ position: number; content: string; is_correct: number; explanation: string | null }>(
      `SELECT position, content, is_correct, explanation
       FROM daily_choices
       WHERE daily_key = ? AND item_number = ?
       ORDER BY position`, q.daily_key, q.item_number
    ) ?? [];
    pool.push({
      exam_key: q.daily_key,
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

/* ===== 題詳（錯題頁） ===== */
export function getQuestionDetail(exam_key: string, question_number: number) {
  const db = getDB();
  const q = (db.getAllSync?.<{ stem: string; passage: string | null }>(
    `SELECT stem, passage FROM questions WHERE exam_key = ? AND question_number = ? LIMIT 1`,
    exam_key, question_number
  ) ?? [])[0];
  const choices = db.getAllSync?.<{ position: number; content: string; is_correct: number; explanation: string | null }>(
    `SELECT position, content, is_correct, explanation
     FROM choices
     WHERE exam_key = ? AND question_number = ?
     ORDER BY position`, exam_key, question_number
  ) ?? [];
  return { stem: q?.stem, passage: q?.passage ?? null, choices };
}

/* ===== 錯題 ===== */
export function insertMistake(args: { exam_key: string; question_number: number; picked_position: number; }): void {
  getDB().runSync?.(
    'INSERT INTO mistakes (created_at, exam_key, question_number, picked_position) VALUES (?,?,?,?)',
    [Date.now(), args.exam_key, args.question_number, args.picked_position]
  );
}
export function getMistakes(): MistakeRow[] {
  return getDB().getAllSync?.<MistakeRow>('SELECT * FROM mistakes ORDER BY created_at DESC') ?? [];
}
export function clearMistakes(): void {
  getDB().execSync?.('DELETE FROM mistakes;');
}
