// src/db/remote.ts
import { createClient } from '@supabase/supabase-js';
import type { SQLiteDatabase } from 'expo-sqlite';
import Constants from 'expo-constants';

const URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  (Constants.expoConfig?.extra as any)?.EXPO_PUBLIC_SUPABASE_URL ??
  (Constants.manifest2 as any)?.extra?.EXPO_PUBLIC_SUPABASE_URL;

const ANON =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  (Constants.expoConfig?.extra as any)?.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  (Constants.manifest2 as any)?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!URL || !ANON) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(URL, ANON);

// 強制或自動探測 schema（預設先試 JLPT）
const FORCED_SCHEMA =
  (process.env.EXPO_PUBLIC_SUPABASE_SCHEMA ??
    (Constants.expoConfig?.extra as any)?.EXPO_PUBLIC_SUPABASE_SCHEMA ??
    (Constants.manifest2 as any)?.extra?.EXPO_PUBLIC_SUPABASE_SCHEMA) as
    | 'public'
    | undefined;

const SCHEMAS = FORCED_SCHEMA ? [FORCED_SCHEMA] : (['JLPT', 'public'] as const);

// 你新表名
const TBL_EXAMS = ['exams'] as const;
const TBL_QUESTIONS = ['questions'] as const;
const TBL_CHOICES = ['choices'] as const;

type Found = { schema: string; table: string };

async function probe(tables: readonly string[]): Promise<Found | null> {
  for (const schema of SCHEMAS) {
    for (const table of tables) {
      const r = await supabase.schema(schema).from(table).select('*').limit(1);
      if (!r.error) return { schema, table };
      if (r.error?.code && r.error.code !== 'PGRST205') {
        console.warn(`[probe] ${schema}.${table} error:`, r.error);
      }
    }
  }
  return null;
}

/** 只從 Supabase 同步（**唔會再讀 JSON**） */
export async function syncFromSupabaseToDB(db: SQLiteDatabase): Promise<boolean> {
  try {
    const ex = await probe(TBL_EXAMS);
    const qs = await probe(TBL_QUESTIONS);
    const cs = await probe(TBL_CHOICES);
    if (!ex || !qs || !cs) {
      throw new Error(
        `Cannot find tables in schemas [${SCHEMAS.join(
          ', ',
        )}] — need exams/questions/choices. Reset API cache if you just created them.`
      );
    }
    console.log('[sync] using', {
      exams: `${ex.schema}.${ex.table}`,
      questions: `${qs.schema}.${qs.table}`,
      choices: `${cs.schema}.${cs.table}`,
    });

    // ---- fetch
    const rEx = await supabase
      .schema(ex.schema)
      .from(ex.table)
      .select('exam_key,level,year,month,title')
      .limit(10000);
    if (rEx.error) throw rEx.error;

    const rQs = await supabase
      .schema(qs.schema)
      .from(qs.table)
      .select('exam_key,question_number,section,stem,passage')
      .limit(20000);
    if (rQs.error) throw rQs.error;

    const rCs = await supabase
      .schema(cs.schema)
      .from(cs.table)
      .select('exam_key,question_number,position,content,is_correct,explanation')
      .limit(80000);
    if (rCs.error) throw rCs.error;

    // ---- write
    db.execSync?.('BEGIN');
    db.execSync?.('DELETE FROM choices;');
    db.execSync?.('DELETE FROM questions;');
    db.execSync?.('DELETE FROM exams;');

    for (const e of rEx.data ?? []) {
      db.runSync?.(
        'INSERT INTO exams (exam_key,level,year,month,title) VALUES (?,?,?,?,?)',
        [e.exam_key, e.level, e.year, e.month, e.title],
      );
    }
    for (const q of rQs.data ?? []) {
      db.runSync?.(
        'INSERT INTO questions (exam_key,question_number,section,stem,passage) VALUES (?,?,?,?,?)',
        [q.exam_key, q.question_number, q.section, q.stem, q.passage ?? null],
      );
    }
    for (const c of rCs.data ?? []) {
      db.runSync?.(
        'INSERT INTO choices (exam_key,question_number,position,content,is_correct,explanation) VALUES (?,?,?,?,?,?)',
        [c.exam_key, c.question_number, c.position, c.content, c.is_correct ? 1 : 0, c.explanation],
      );
    }

    db.execSync?.('COMMIT');
    console.log(
      '[syncFromSupabaseToDB] ok exams=',
      rEx.data?.length ?? 0,
      'questions=',
      rQs.data?.length ?? 0,
      'choices=',
      rCs.data?.length ?? 0,
    );
    return true;
  } catch (e) {
    console.warn('[syncFromSupabaseToDB] error:', e);
    try { db.execSync?.('ROLLBACK'); } catch {}
    return false;
  }
}
