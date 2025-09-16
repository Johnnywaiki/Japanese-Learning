// src/db/remote.ts
import type { SQLiteDatabase } from 'expo-sqlite';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Read env from both process.env (EXPO_PUBLIC_*) and app.json extra
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

function getClient(): SupabaseClient | null {
  if (_client) return _client;
  const { url, anon } = readEnv();
  if (!url || !anon) {
    console.warn(
      '[Supabase] Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Set them in app.json -> expo.extra or as EXPO_PUBLIC_* envs.'
    );
    return null;
  }
  _client = createClient(url, anon);
  return _client;
}

/** Pull words/sentences from Supabase into local SQLite. Returns true if done. */
export async function syncFromSupabaseToDB(db: SQLiteDatabase): Promise<boolean> {
  const supabase = getClient();
  if (!supabase) return false; // gracefully skip (prevents route crash)

  try {
    // words
    const resW = await supabase.from('words').select('*').limit(5000);
    if (resW.error) throw resW.error;

    db.execSync?.('BEGIN');
    for (const row of resW.data ?? []) {
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
    const resS = await supabase.from('sentences').select('*').limit(5000);
    if (resS.error) throw resS.error;

    db.execSync?.('BEGIN');
    for (const row of resS.data ?? []) {
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

    console.log('[syncFromSupabaseToDB] ok words=', resW.data?.length ?? 0, 'sentences=', resS.data?.length ?? 0);
    return true;
  } catch (e) {
    console.warn('[syncFromSupabaseToDB] error:', e);
    try { db.execSync?.('ROLLBACK'); } catch {}
    return false;
  }
}
