// src/db/remote.ts
import { createClient } from '@supabase/supabase-js';
import type { SQLiteDatabase } from 'expo-sqlite';
import Constants from 'expo-constants';

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  (Constants.expoConfig?.extra as any)?.EXPO_PUBLIC_SUPABASE_URL ??
  (Constants.manifest2 as any)?.extra?.EXPO_PUBLIC_SUPABASE_URL;

const SUPABASE_ANON =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  (Constants.expoConfig?.extra as any)?.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  (Constants.manifest2 as any)?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// 可能用到嘅 schema / table 名
const SCHEMAS = ['public', 'JLPT'] as const;
const EXAM_TBLS = ['exams', 'simple_testing_exams'] as const;
const Q_TBLS    = ['questions', 'simple_testing_questions'] as const;
const C_TBLS    = ['choices', 'simple_testing_choices'] as const;

type FoundTable = { schema: (typeof SCHEMAS)[number]; table: string };

async function tableExists(schema: (typeof SCHEMAS)[number], table: string) {
  const r = await supabase.schema(schema).from(table).select('*', { head: true, count: 'exact' });
  return !r.error;
}

async function pickFirstExisting(candidates: string[]): Promise<FoundTable | null> {
  for (const s of SCHEMAS) {
    for (const t of candidates) {
      if (await tableExists(s, t)) return { schema: s, table: t };
    }
  }
  return null;
}

/** 只從 Supabase 同步到本地 SQLite（唔再讀 JSON） */
export async function syncFromSupabaseToDB(db: SQLiteDatabase): Promise<boolean> {
  try {
    const exTbl = await pickFirstExisting([...EXAM_TBLS]);
    const qTbl  = await pickFirstExisting([...Q_TBLS]);
    const cTbl  = await pickFirstExisting([...C_TBLS]);

    if (!exTbl || !qTbl || !cTbl) {
      throw new Error(
        `Cannot find tables in schemas (${SCHEMAS.join(', ')}).
Tried exams=${EXAM_TBLS.join('/')} questions=${Q_TBLS.join('/')} choices=${C_TBLS.join('/')}`
      );
    }

    console.log('[sync] using',
      { exams: `${exTbl.schema}.${exTbl.table}`, questions: `${qTbl.schema}.${qTbl.table}`, choices: `${cTbl.schema}.${cTbl.table}` }
    );

    const ex = await supabase.schema(exTbl.schema).from(exTbl.table)
      .select('key,level,year,title').limit(10000);
    if (ex.error) throw ex.error;

    const qs = await supabase.schema(qTbl.schema).from(qTbl.table)
      .select('exam_key,question_number,section,stem,passage').limit(20000);
    if (qs.error) throw qs.error;

    const cs = await supabase.schema(cTbl.schema).from(cTbl.table)
      .select('exam_key,question_number,position,content,is_correct,explanation').limit(80000);
    if (cs.error) throw cs.error;

    db.execSync?.('BEGIN');
    db.execSync?.('DELETE FROM choices;');
    db.execSync?.('DELETE FROM questions;');
    db.execSync?.('DELETE FROM exams;');

    for (const r of ex.data ?? []) {
      db.runSync?.('INSERT INTO exams (key,level,year,title) VALUES (?,?,?,?)',
        [r.key, r.level, r.year, r.title]);
    }
    for (const r of qs.data ?? []) {
      db.runSync?.(
        `INSERT INTO questions (exam_key,question_number,section,stem,passage)
         VALUES (?,?,?,?,?)`,
        [r.exam_key, r.question_number, r.section, r.stem, r.passage ?? null]
      );
    }
    for (const r of cs.data ?? []) {
      db.runSync?.(
        `INSERT INTO choices (exam_key,question_number,position,content,is_correct,explanation)
         VALUES (?,?,?,?,?,?)`,
        [r.exam_key, r.question_number, r.position, r.content, r.is_correct ? 1 : 0, r.explanation]
      );
    }
    db.execSync?.('COMMIT');

    console.log('[syncFromSupabaseToDB] ok exams=', ex.data?.length ?? 0,
                'questions=', qs.data?.length ?? 0,
                'choices=', cs.data?.length ?? 0);
    return true;
  } catch (e) {
    console.warn('[syncFromSupabaseToDB] error:', e);
    try { db.execSync?.('ROLLBACK'); } catch {}
    return false;
  }
}
