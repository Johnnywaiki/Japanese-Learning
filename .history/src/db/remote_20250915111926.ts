// src/db/remote.ts
import { createClient } from '@supabase/supabase-js';
import type { SQLiteDatabase } from 'expo-sqlite';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
export const supabase = createClient(url, anon);

/** 由 Supabase 拉 words/sentences 落本地 SQLite */
export async function syncFromSupabaseToDB(db: SQLiteDatabase): Promise<boolean> {
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
