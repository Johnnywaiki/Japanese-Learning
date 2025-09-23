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

function sanitize(s?: string) {
  return (s ?? '').trim() || undefined;
}

export function getSupabase(): SupabaseClient | null {
  if (_sb) return _sb;

  const rawUrl = getExtra('EXPO_PUBLIC_SUPABASE_URL');
  const rawAnon = getExtra('EXPO_PUBLIC_SUPABASE_ANON_KEY');

  const url = sanitize(rawUrl);
  const anon = sanitize(rawAnon);

  if (!url || !anon) {
    console.warn('[supabase] missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY');
    return null;
  }

  // 基本格式檢查 & 一點點遮罩輸出幫你排錯
  const refOk = /^https:\/\/([a-z0-9]{20})\.supabase\.co$/.test(url);
  const anonLooksJWT = anon.split('.').length === 3;

  console.log('[supabase] url ok?', refOk, 'anon len=', anon.length, 'mask=', anon.slice(0, 6) + '...' + anon.slice(-6));

  try {
    _sb = createClient(url, anon);
    return _sb;
  } catch (e) {
    console.warn('[supabase] createClient failed:', e);
    return null;
  }
}

/** 同步入本地 DB（保留你原本的實作） */
export async function syncFromSupabaseToDB(db: SQLiteDatabase): Promise<boolean> {
  try {
    const sb = getSupabase();
    if (!sb) return false;

    console.log('[sync] using', { exams: 'public.exams', questions: 'public.questions', choices: 'public.choices' });

    const ex = await sb.from('exams').select('*').limit(10000);
    if (ex.error) throw ex.error;

    const qs = await sb.from('questions').select('*').limit(100000);
    if (qs.error) throw qs.error;

    const cs = await sb.from('choices').select('*').limit(200000);
    if (cs.error) throw cs.error;

    db.execSync?.('BEGIN');
    for (const r of ex.data ?? []) {
      db.runSync?.(
        `INSERT OR REPLACE INTO exams (exam_key, level, year, month, title)
         VALUES (?,?,?,?,?)`,
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
  } catch (e: any) {
    console.warn('[syncFromSupabaseToDB] error:', e);
    try { db.execSync?.('ROLLBACK'); } catch {}
    return false;
  }
}
