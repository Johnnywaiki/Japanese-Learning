// src/db/remote.ts
import type { SQLiteDatabase } from 'expo-sqlite';
import Constants from 'expo-constants';
import type { Topic } from './schema';
import { supabase } from '../remote/supabase';

type RemoteWord = { jp: string; reading?: string | null; zh: string; topic: Topic };
type RemoteSentence = { jp: string; zh: string; topic: Topic };
type RemotePayload = { words: RemoteWord[]; sentences: RemoteSentence[]; meta?: unknown };

function isTopic(x: any): x is Topic {
  return x === 'N2' || x === 'N3' || x === 'daily';
}

/* ----------------- JSON 來源（可留作備援） ----------------- */
function getDataUrl(): string | undefined {
  return (
    process.env.EXPO_PUBLIC_DATA_URL ??
    (Constants.expoConfig?.extra as any)?.EXPO_PUBLIC_DATA_URL ??
    (Constants.manifest2 as any)?.extra?.EXPO_PUBLIC_DATA_URL
  );
}

export async function pingJsonSource(): Promise<{ ok: boolean; url?: string; status?: number; msg: string; }> {
  const url = getDataUrl();
  if (!url) return { ok: false, msg: '未設定 EXPO_PUBLIC_DATA_URL' };
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const status = res.status;
    if (!res.ok) return { ok: false, url, status, msg: `HTTP ${status}` };
    const payload = (await res.json()) as RemotePayload;
    if (!Array.isArray(payload?.words) || !Array.isArray(payload?.sentences)) {
      return { ok: false, url, status, msg: 'JSON 結構不正確：缺少 words[] 或 sentences[]' };
    }
    return { ok: true, url, status, msg: `OK（words:${payload.words.length}，sentences:${payload.sentences.length}）` };
  } catch (e: any) {
    return { ok: false, msg: `fetch 失敗：${e?.message ?? e}` };
  }
}

export async function syncFromJsonToDB(db: SQLiteDatabase): Promise<boolean> {
  const url = getDataUrl();
  if (!url) return false;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return false;
    const payload = (await res.json()) as RemotePayload;
    if (!Array.isArray(payload?.words) || !Array.isArray(payload?.sentences)) return false;

    db.execSync?.('BEGIN;');
    try {
      db.execSync?.('DELETE FROM words;');
      db.execSync?.('DELETE FROM sentences;');
      for (const w of payload.words) {
        const topic = isTopic(w.topic) ? w.topic : 'daily';
        db.runSync?.('INSERT INTO words (jp,reading,zh,topic) VALUES (?,?,?,?)', [
          w.jp, w.reading ?? null, w.zh, topic,
        ]);
      }
      for (const s of payload.sentences) {
        const topic = isTopic(s.topic) ? s.topic : 'daily';
        db.runSync?.('INSERT INTO sentences (jp,zh,topic) VALUES (?,?,?)', [s.jp, s.zh, topic]);
      }
      db.execSync?.('COMMIT;');
      console.log(`[syncFromJsonToDB] 成功同步：words=${payload.words.length}, sentences=${payload.sentences.length}`);
      return true;
    } catch (e) {
      db.execSync?.('ROLLBACK;');
      console.warn('[syncFromJsonToDB] 寫入 DB 失敗：', e);
      return false;
    }
  } catch (e) {
    console.warn('[syncFromJsonToDB] fetch 失敗：', e);
    return false;
  }
}

/* ----------------- Supabase 來源（主用） ----------------- */
export async function pingSupabaseSource(): Promise<{ ok: boolean; msg: string }> {
  if (!supabase) return { ok: false, msg: '未設定 EXPO_PUBLIC_SUPABASE_URL/ANON_KEY' };
  try {
    const [{ data: w, error: ew }, { data: s, error: es }] = await Promise.all([
      supabase.from('words').select('id').limit(1),
      supabase.from('sentences').select('id').limit(1),
    ]);
    if (ew || es) return { ok: false, msg: (ew?.message ?? es?.message ?? '未知錯誤') };
    return { ok: true, msg: 'OK（連線成功）' };
  } catch (e: any) {
    return { ok: false, msg: `連線失敗：${e?.message ?? e}` };
  }
}

export async function syncFromSupabaseToDB(db: SQLiteDatabase): Promise<boolean> {
  if (!supabase) {
    console.warn('[syncFromSupabaseToDB] 尚未設定 Supabase 資訊');
    return false;
  }
  try {
    const [W, S] = await Promise.all([
      supabase.from('words').select('id,jp,reading,zh,topic').order('id'),
      supabase.from('sentences').select('id,jp,zh,topic').order('id'),
    ]);
    if (W.error || S.error || !W.data || !S.data) {
      console.warn('[syncFromSupabaseToDB] 讀取錯誤：', W.error ?? S.error);
      return false;
    }
    db.execSync?.('BEGIN;');
    try {
      db.execSync?.('DELETE FROM words;');
      db.execSync?.('DELETE FROM sentences;');
      for (const w of W.data) {
        const topic = isTopic(w.topic) ? w.topic : 'daily';
        db.runSync?.('INSERT INTO words (id,jp,reading,zh,topic) VALUES (?,?,?,?,?)', [
          w.id, w.jp, w.reading ?? null, w.zh, topic,
        ]);
      }
      for (const s of S.data) {
        const topic = isTopic(s.topic) ? s.topic : 'daily';
        db.runSync?.('INSERT INTO sentences (id,jp,zh,topic) VALUES (?,?,?,?)', [
          s.id, s.jp, s.zh, topic,
        ]);
      }
      db.execSync?.('COMMIT;');
      console.log(`[syncFromSupabaseToDB] 成功同步：words=${W.data.length}, sentences=${S.data.length}`);
      return true;
    } catch (e) {
      db.execSync?.('ROLLBACK;');
      console.warn('[syncFromSupabaseToDB] 寫入 DB 失敗：', e);
      return false;
    }
  } catch (e) {
    console.warn('[syncFromSupabaseToDB] 連線失敗：', e);
    return false;
  }
}
