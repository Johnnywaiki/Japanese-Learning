// src/db/remote.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { SQLiteDatabase } from 'expo-sqlite';
import Constants from 'expo-constants';

function getExtra(key: string): string | undefined {
  // Expo 原生：優先取 process.env（Web/Dev Build），否則用 Constants.expoConfig / manifest2
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
  _sb = createClient(url, anon);
  return _sb;
}

/** 由 Supabase 拉 exams/questions/choices 並寫入本地 SQLite（覆蓋式 upsert） */
export async function syncFromSupabaseToDB(db: SQLiteDatabase): Promise<boolean> {
  try {
    const sb = getSupabase();
    if (!sb) return false;

    console.log('[sync] using', { exams: 'public.exams', questions: 'public.questions', choices: 'public.choices' });

    // 讀遠端
    const ex = await sb.from('exams').select('*').limit(10000);
    if (ex.error) throw ex.error;

    const qs = await sb.from('questions').select('*').limit(100000);
    if (qs.error) throw qs.error;

    const cs = await sb.from('choices').select('*').limit(200000);
    if (cs.error) throw cs.error;

    // 寫本地（transaction）
    db.execSync?.('BEGIN');

    // exams
    for (const r of ex.data ?? []) {
      db.runSync?.(
        `INSERT OR REPLACE INTO exams (exam_key, level, year, month, title)
         VALUES (?,?,?,?,?)`,
        [r.exam_key, r.level, r.year, r.month, r.title]
      );
    }

    // questions
    for (const r of qs.data ?? []) {
      db.runSync?.(
        `INSERT OR REPLACE INTO questions (exam_key, question_number, section, stem, passage)
         VALUES (?,?,?,?,?)`,
        [r.exam_key, r.question_number, r.section, r.stem, r.passage ?? null]
      );
    }

    // choices
    for (const r of (cs.data ?? [])) {
      db.runSync?.(
        `INSERT OR REPLACE INTO choices (exam_key, question_number, position, content, is_correct, explanation)
         VALUES (?,?,?,?,?,?)`,
        [r.exam_key, r.question_number, r.position, r.content, r.is_correct ? 1 : 0, r.explanation]
      );
    }

    db.execSync?.('COMMIT');
    console.log('[syncFromSupabaseToDB] ok exams=', ex.data?.length ?? 0, 'questions=', qs.data?.length ?? 0, 'choices=', cs.data?.length ?? 0);
    return true;
  } catch (e) {
    console.warn('[syncFromSupabaseToDB] error:', e);
    try { db.execSync?.('ROLLBACK'); } catch {}
    return false;
  }
}
