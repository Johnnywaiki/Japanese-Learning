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
  _sb = createClient(url, anon);
  return _sb;
}

// 小工具：把任何 "7" / 7 / "07" → "07"，"12" → "12"
function normalizeMonth(m: any): '07' | '12' | null {
  const s = String(m ?? '').padStart(2, '0');
  if (s === '07' || s === '7') return '07';
  if (s === '12') return '12';
  return null;
}

/** 由 Supabase 拉 exams/questions/choices 並寫入本地 SQLite（覆蓋式 upsert） */
export async function syncFromSupabaseToDB(db: SQLiteDatabase): Promise<boolean> {
  try {
    const sb = getSupabase();
    if (!sb) return false;

    console.log('[sync] using', {
      exams: 'public.exams',
      questions: 'public.questions',
      choices: 'public.choices',
    });

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
      const month = normalizeMonth((r as any).month);
      db.runSync?.(
        `INSERT OR REPLACE INTO exams (exam_key, level, year, month, title)
         VALUES (?,?,?,?,?)`,
        [
          (r as any).exam_key,
          (r as any).level,
          Number((r as any).year),
          month ?? (r as any).month, // 萬一係空就保持原值
          (r as any).title ?? `${(r as any).level}-${(r as any).year}-${(r as any).month}`,
        ]
      );
    }

    // questions
    for (const r of qs.data ?? []) {
      db.runSync?.(
        `INSERT OR REPLACE INTO questions (exam_key, question_number, section, stem, passage)
         VALUES (?,?,?,?,?)`,
        [
          (r as any).exam_key,
          Number((r as any).question_number),
          (r as any).section,
          (r as any).stem ?? '',
          (r as any).passage ?? null,
        ]
      );
    }

    // choices
    for (const r of cs.data ?? []) {
      db.runSync?.(
        `INSERT OR REPLACE INTO choices (exam_key, question_number, position, content, is_correct, explanation)
         VALUES (?,?,?,?,?,?)`,
        [
          (r as any).exam_key,
          Number((r as any).question_number),
          Number((r as any).position),
          (r as any).content ?? '',
          (r as any).is_correct ? 1 : 0,            // boolean → 0/1
          (r as any).explanation ?? '',             // 保證有字串
        ]
      );
    }

    db.execSync?.('COMMIT');
    console.log(
      '[syncFromSupabaseToDB] ok exams=',
      ex.data?.length ?? 0,
      'questions=',
      qs.data?.length ?? 0,
      'choices=',
      cs.data?.length ?? 0
    );
    return true;
  } catch (e) {
    console.warn('[syncFromSupabaseToDB] error:', e);
    try { db.execSync?.('ROLLBACK'); } catch {}
    return false;
  }
}
