// src/db/remote.ts
import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { SQLiteDatabase } from 'expo-sqlite';
import Constants from 'expo-constants';

function getExtra(key: string): string | undefined {
  return (
    (process.env as any)?.[key] ??
    (Constants.expoConfig?.extra as any)?.[key] ??
    (Constants.manifest2 as any)?.extra?.[key]
  );
}

let _sb: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
  if (_sb) return _sb;
  const url = getExtra('EXPO_PUBLIC_SUPABASE_URL');
  const anon = getExtra('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (!url || !anon) {
    console.warn('[supabase] missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY');
    return null;
  }
  _sb = createClient(url, anon, { auth: { persistSession: false } });
  return _sb;
}

/** 由 Supabase 拉 exams/questions/choices + daily_* 到本地 SQLite */
export async function syncFromSupabaseToDB(db: SQLiteDatabase): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  try {
    console.log('[sync] using', {
      exams: 'public.exams',
      questions: 'public.questions',
      choices: 'public.choices',
      daily_sets: 'public.daily_sets',
      daily_questions: 'public.daily_questions',
      daily_choices: 'public.daily_choices',
    });

    // 讀遠端
    const [ex, qs, cs, dsets, dqs, dcs] = await Promise.all([
      sb.from('exams').select('*').limit(10000),
      sb.from('questions').select('*').limit(200000),
      sb.from('choices').select('*').limit(400000),
      sb.from('daily_sets').select('*').limit(10000),
      sb.from('daily_questions').select('*').limit(200000),
      sb.from('daily_choices').select('*').limit(400000),
    ]);

    // 錯就 throw
    for (const r of [ex, qs, cs, dsets, dqs, dcs]) {
      if ((r as any).error) throw (r as any).error;
    }

    db.execSync?.('BEGIN');

    // mock
    for (const r of ex.data ?? []) {
      db.runSync?.(
        `INSERT OR REPLACE INTO exams (exam_key, level, year, month, title) VALUES (?,?,?,?,?)`,
        [r.exam_key, r.level, r.year, r.month, r.title]
      );
    }
    for (const r of qs.data ?? []) {
      db.runSync?.(
        `INSERT OR REPLACE INTO questions (exam_key, question_number, section, stem, passage)
         VALUES (?,?,?,?,?)`,
        [r.exam_key, r.question_number, r.section, r.stem, r.passage ?? null]
      );
    }
    for (const r of cs.data ?? []) {
      db.runSync?.(
        `INSERT OR REPLACE INTO choices (exam_key, question_number, position, content, is_correct, explanation)
         VALUES (?,?,?,?,?,?)`,
        [r.exam_key, r.question_number, r.position, r.content, r.is_correct ? 1 : 0, r.explanation ?? null]
      );
    }

    // daily
    for (const r of dsets.data ?? []) {
      db.runSync?.(
        `INSERT OR REPLACE INTO daily_sets (daily_key, level, category, title) VALUES (?,?,?,?)`,
        [r.daily_key, r.level, r.category, r.title ?? null]
      );
    }
    for (const r of dqs.data ?? []) {
      db.runSync?.(
        `INSERT OR REPLACE INTO daily_questions (daily_key, item_number, stem, passage, question_type)
         VALUES (?,?,?,?,?)`,
        [r.daily_key, r.item_number, r.stem, r.passage ?? null, r.question_type ?? null]
      );
    }
    for (const r of dcs.data ?? []) {
      db.runSync?.(
        `INSERT OR REPLACE INTO daily_choices (daily_key, item_number, position, content, is_correct, explanation)
         VALUES (?,?,?,?,?,?)`,
        [r.daily_key, r.item_number, r.position, r.content, r.is_correct ? 1 : 0, r.explanation ?? null]
      );
    }

    db.execSync?.('COMMIT');
    console.log('[syncFromSupabaseToDB] ok',
      'exams=', ex.data?.length ?? 0,
      'questions=', qs.data?.length ?? 0,
      'choices=', cs.data?.length ?? 0,
      'daily_sets=', dsets.data?.length ?? 0,
      'daily_questions=', dqs.data?.length ?? 0,
      'daily_choices=', dcs.data?.length ?? 0
    );
    return true;
  } catch (e) {
    console.warn('[syncFromSupabaseToDB] error:', e);
    try { db.execSync?.('ROLLBACK'); } catch {}
    return false;
  }
}
