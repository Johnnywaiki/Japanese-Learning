// src/db/remote.ts
import type { SQLiteDatabase } from 'expo-sqlite';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

function readEnv() {
  const extra =
    (Constants.expoConfig?.extra as any) ??
    ((Constants.manifest2 as any)?.extra ?? {}) ??
    {};
  const url =
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    extra.EXPO_PUBLIC_SUPABASE_URL ??
    '';
  const anon =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    extra.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    '';
  return { url, anon };
}

let _client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
  if (_client) return _client;
  const { url, anon } = readEnv();
  if (!url || !anon) {
    console.warn('[Supabase] Missing URL/ANON KEY in expo.extra or env');
    return null;
  }
  _client = createClient(url, anon);
  return _client;
}

/** 從 Supabase 拉 words / sentences 到本地 SQLite。成功回 true */
export async function syncFromSupabaseToDB(db: SQLiteDatabase): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    // words
    const w = await supabase.from('words').select('*').limit(5000);
    if (w.error) throw w.error;

    db.execSync?.('BEGIN');
    for (const row of w.data ?? []) {
      db.runSync?.(
        `INSERT OR REPLACE INTO words
         (id,jp,reading,zh,topic,year,session,paper)
         VALUES (?,?,?,?,?,?,?,?)`,
        [
          row.id, row.jp, row.reading ?? null, row.zh,
          row.topic, row.year ?? null, row.session ?? null, row.paper ?? null,
        ],
      );
    }
    db.execSync?.('COMMIT');

    // sentences
    const s = await supabase.from('sentences').select('*').limit(5000);
    if (s.error) throw s.error;

    db.execSync?.('BEGIN');
    for (const row of s.data ?? []) {
      db.runSync?.(
        `INSERT OR REPLACE INTO sentences
         (id,jp,zh,topic,year,session,paper)
         VALUES (?,?,?,?,?,?,?)`,
        [
          row.id, row.jp, row.zh, row.topic,
          row.year ?? null, row.session ?? null, row.paper ?? null,
        ],
      );
    }
    db.execSync?.('COMMIT');

    console.log('[syncFromSupabaseToDB] ok words=', w.data?.length ?? 0, 'sentences=', s.data?.length ?? 0);
    return true;
  } catch (e) {
    console.warn('[syncFromSupabaseToDB] error:', e);
    try { db.execSync?.('ROLLBACK'); } catch {}
    return false;
  }
}
