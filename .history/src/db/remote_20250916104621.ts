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

// 允許你用 demo 表(simple_testing_*) 或正式表
const EXAM_TBL_CANDIDATES = ['exams', 'simple_testing_exams'] as const;
const Q_TBL_CANDIDATES    = ['questions', 'simple_testing_questions'] as const;
const C_TBL_CANDIDATES    = ['choices', 'simple_testing_choices'] as const;

async function pickTable(nameList: readonly string[]) {
  for (const n of nameList) {
    const r = await supabase.from(n).select('*', { count: 'exact', head: true });
    if (!r.error) return n;
  }
  // 如果都不可用，回傳第一個，後續會噴錯方便你看到
  return nameList[0];
}

/** 只從 Supabase 同步到本地 SQLite（不再讀 JSON） */
export async function syncFromSupabaseToDB(db: SQLiteDatabase): Promise<boolean> {
  try {
    const examTbl = await pickTable(EXAM_TBL_CANDIDATES);
    const qTbl    = await pickTable(Q_TBL_CANDIDATES);
    const cTbl    = await pickTable(C_TBL_CANDIDATES);

    const ex = await supabase.from(examTbl).select('key,level,year,title').limit(10000);
    if (ex.error) throw ex.error;

    const qs = await supabase.from(qTbl).select('exam_key,question_number,section,stem,passage').limit(20000);
    if (qs.error) throw qs.error;

    const cs = await supabase.from(cTbl).select('exam_key,question_number,position,content,is_correct,explanation').limit(80000);
    if (cs.error) throw cs.error;

    db.execSync?.('BEGIN');
    db.execSync?.('DELETE FROM choices;');
    db.execSync?.('DELETE FROM questions;');
    db.execSync?.('DELETE FROM exams;');

    for (const r of ex.data ?? []) {
      db.runSync?.(
        'INSERT INTO exams (key,level,year,title) VALUES (?,?,?,?)',
        [r.key, r.level, r.year, r.title]
      );
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

    console.log('[syncFromSupabaseToDB] ok exams=', ex.count ?? ex.data?.length ?? 0,
                'questions=', qs.count ?? qs.data?.length ?? 0,
                'choices=', cs.count ?? cs.data?.length ?? 0);
    return true;
  } catch (e) {
    console.warn('[syncFromSupabaseToDB] error:', e);
    try { db.execSync?.('ROLLBACK'); } catch {}
    return false;
  }
}
