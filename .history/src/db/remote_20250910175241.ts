import Constants from 'expo-constants';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { PracticeFilter } from '../db';
import type { Word, Sentence, Topic } from './schema';

/* =========================================
 * Env helpers
 * =======================================*/
function getEnv(key: string): string | undefined {
  return (
    (process.env as any)[key] ??
    (Constants.expoConfig?.extra as any)?.[key] ??
    (Constants.manifest2 as any)?.extra?.[key]
  );
}
function getDataUrl(): string | undefined {
  return getEnv('EXPO_PUBLIC_DATA_URL');
}
function getSupabase(): SupabaseClient | null {
  const url = getEnv('EXPO_PUBLIC_SUPABASE_URL') || getEnv('SUPABASE_URL');
  const key = getEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY');
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/* =========================================
 * Public: 測試 JSON 來源
 * =======================================*/
export async function pingJsonSource(): Promise<{ ok: boolean; msg: string; status?: number; url?: string }> {
  const url = getDataUrl();
  if (!url) return { ok: false, msg: '未設定 EXPO_PUBLIC_DATA_URL' };

  try {
    const res = await fetch(url);
    const status = res.status;
    if (!res.ok) return { ok: false, msg: 'HTTP 狀態非 2xx', status, url };
    const json = await res.json();
    const wordsOk = Array.isArray(json?.words);
    const sentsOk = Array.isArray(json?.sentences);
    if (wordsOk || sentsOk) {
      return { ok: true, msg: `可讀取（words=${json?.words?.length ?? 0}, sentences=${json?.sentences?.length ?? 0})`, status, url };
    }
    return { ok: false, msg: 'JSON 內容格式不正確：缺少 words/sentences 陣列', status, url };
  } catch (e: any) {
    return { ok: false, msg: e?.message ?? String(e), url };
  }
}

/* =========================================
 * Public: 直接讀題庫（給 useQuiz）
 * 來源：Supabase 優先 → 後備 JSON
 * 回傳：{ words, sentences }
 * =======================================*/
type RemotePayload = { words?: any[]; sentences?: any[] };

function mapLevelToTopics(level: Topic | 'N2-N3-random' | 'all' | 'daily' | undefined): Topic[] | undefined {
  if (!level || level === 'all') return undefined;
  if (level === 'N2-N3-random') return ['N2', 'N3'];
  if (level === 'daily') return ['daily'] as any;
  return [level as Topic];
}

function normalizeFromJson(payload: RemotePayload, topics?: Topic[] | undefined, prefer?: 'words' | 'sentences' | 'both') {
  const allWords: Word[] = Array.isArray(payload?.words)
    ? payload.words.map((w: any, idx: number) => ({
        id: Number(w?.id ?? idx + 1),
        jp: String(w?.jp ?? w?.ja ?? w?.japanese ?? ''),
        reading: typeof w?.reading === 'string' ? w.reading : (w?.kana ?? ''),
        zh: String(w?.zh ?? w?.cn ?? w?.chinese ?? ''),
        topic: (w?.topic ?? w?.level ?? 'N3') as Topic,
        year: w?.year ? Number(w.year) : null,
        session: typeof w?.session === 'string' ? w.session : null,
        paper: typeof w?.paper === 'string' ? w.paper : null,
      }))
    : [];

  const allSents: Sentence[] = Array.isArray(payload?.sentences)
    ? payload.sentences.map((s: any, idx: number) => ({
        id: Number(s?.id ?? idx + 1),
        jp: String(s?.jp ?? s?.ja ?? s?.japanese ?? ''),
        zh: String(s?.zh ?? s?.cn ?? s?.chinese ?? ''),
        topic: (s?.topic ?? s?.level ?? 'N3') as Topic,
        year: s?.year ? Number(s.year) : null,
        session: typeof s?.session === 'string' ? s.session : null,
        paper: typeof s?.paper === 'string' ? s.paper : null,
      }))
    : [];

  const byTopic = (t?: Topic[] | undefined) => (x: { topic?: Topic }) => !t || (x.topic && t.includes(x.topic));

  const words = (prefer === 'sentences') ? [] : allWords.filter(byTopic(topics));
  const sentences = (prefer === 'words') ? [] : allSents.filter(byTopic(topics));

  return { words, sentences };
}

export async function getAllForPool(filters?: PracticeFilter): Promise<{ words: Word[]; sentences: Sentence[] }> {
  const topics = mapLevelToTopics(filters?.level as any);
  let prefer: 'words' | 'sentences' | 'both' = 'both';
  if (filters?.kind === 'language') prefer = 'words';
  else if (filters?.kind === 'reading') prefer = 'sentences';

  // 1) Supabase 優先
  const supabase = getSupabase();
  if (supabase) {
    try {
      const needWords = prefer !== 'sentences';
      const needSents = prefer !== 'words';

      let words: Word[] = [];
      let sentences: Sentence[] = [];

      if (needWords) {
        let q = supabase.from('words').select('id,jp,reading,zh,topic').order('id', { ascending: true }).limit(1000);
        if (topics && topics.length) q = q.in('topic', topics as any);
        const { data, error } = await q;
        if (error) console.warn('[remote.getAllForPool] words err:', error);
        words = (data ?? []).map((w: any) => ({
          id: Number(w.id), jp: String(w.jp ?? ''), reading: String(w.reading ?? ''), zh: String(w.zh ?? ''), topic: (w.topic ?? 'N3') as Topic,
        }));
      }

      if (needSents) {
        let q = supabase.from('sentences').select('id,jp,zh,topic').order('id', { ascending: true }).limit(1000);
        if (topics && topics.length) q = q.in('topic', topics as any);
        const { data, error } = await q;
        if (error) console.warn('[remote.getAllForPool] sentences err:', error);
        sentences = (data ?? []).map((s: any) => ({
          id: Number(s.id), jp: String(s.jp ?? ''), zh: String(s.zh ?? ''), topic: (s.topic ?? 'N3') as Topic,
        }));
      }

      return { words, sentences };
    } catch (e) {
      console.warn('[remote.getAllForPool] supabase exception:', e);
      // fallthrough to JSON
    }
  }

  // 2) 後備 JSON
  const url = getDataUrl();
  if (!url) {
    console.warn('[remote.getAllForPool] 沒有 SUPABASE，也沒有 EXPO_PUBLIC_DATA_URL；返回空集合。');
    return { words: [], sentences: [] };
  }
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('[remote.getAllForPool] JSON 來源 HTTP 非 2xx:', res.status);
      return { words: [], sentences: [] };
    }
    const payload = (await res.json()) as RemotePayload;
    return normalizeFromJson(payload, topics, prefer);
  } catch (e) {
    console.warn('[remote.getAllForPool] JSON 來源例外:', e);
    return { words: [], sentences: [] };
  }
}

/* =========================================
 * Public: 同步到本地 SQLite（供 db/index.ts 使用）
 * =======================================*/
function upsertWords(db: SQLiteDatabase, rows: Word[]): { inserted: number; updated: number; skipped: number } {
  let inserted = 0, updated = 0, skipped = 0;
  db.execSync?.('BEGIN');
  try {
    for (const w of rows) {
      const exist = db.getFirstSync?.<{ id: number }>('SELECT id FROM words WHERE id=?', w.id);
      if (exist?.id) {
        db.runSync?.(
          'UPDATE words SET jp=?, reading=?, zh=?, topic=?, year=?, session=?, paper=? WHERE id=?',
          [w.jp, w.reading ?? '', w.zh, w.topic ?? null, w.year ?? null, w.session ?? null, w.paper ?? null, w.id]
        );
        updated++;
      } else {
        db.runSync?.(
          'INSERT INTO words (id, jp, reading, zh, topic, year, session, paper) VALUES (?,?,?,?,?,?,?,?)',
          [w.id, w.jp, w.reading ?? '', w.zh, w.topic ?? null, w.year ?? null, w.session ?? null, w.paper ?? null]
        );
        inserted++;
      }
    }
    db.execSync?.('COMMIT');
  } catch (e) {
    db.execSync?.('ROLLBACK');
    console.warn('[sync.upsertWords] rollback:', e);
    skipped += rows.length - inserted - updated;
  }
  return { inserted, updated, skipped };
}

function upsertSentences(db: SQLiteDatabase, rows: Sentence[]): { inserted: number; updated: number; skipped: number } {
  let inserted = 0, updated = 0, skipped = 0;
  db.execSync?.('BEGIN');
  try {
    for (const s of rows) {
      const exist = db.getFirstSync?.<{ id: number }>('SELECT id FROM sentences WHERE id=?', s.id);
      if (exist?.id) {
        db.runSync?.(
          'UPDATE sentences SET jp=?, zh=?, topic=?, year=?, session=?, paper=? WHERE id=?',
          [s.jp, s.zh, s.topic ?? null, s.year ?? null, s.session ?? null, s.paper ?? null, s.id]
        );
        updated++;
      } else {
        db.runSync?.(
          'INSERT INTO sentences (id, jp, zh, topic, year, session, paper) VALUES (?,?,?,?,?,?,?)',
          [s.id, s.jp, s.zh, s.topic ?? null, s.year ?? null, s.session ?? null, s.paper ?? null]
        );
        inserted++;
      }
    }
    db.execSync?.('COMMIT');
  } catch (e) {
    db.execSync?.('ROLLBACK');
    console.warn('[sync.upsertSentences] rollback:', e);
    skipped += rows.length - inserted - updated;
  }
  return { inserted, updated, skipped };
}

/** 優先從 Supabase 拉，成功就返回 true；失敗/無設定返回 false */
export async function syncFromSupabaseToDB(db: SQLiteDatabase): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const { data: wData, error: wErr } = await supabase
      .from('words')
      .select('id,jp,reading,zh,topic')
      .order('id', { ascending: true })
      .limit(2000);
    if (wErr) throw wErr;

    const { data: sData, error: sErr } = await supabase
      .from('sentences')
      .select('id,jp,zh,topic')
      .order('id', { ascending: true })
      .limit(2000);
    if (sErr) throw sErr;

    const words: Word[] = (wData ?? []).map((w: any) => ({
      id: Number(w.id), jp: String(w.jp ?? ''), reading: String(w.reading ?? ''), zh: String(w.zh ?? ''), topic: (w.topic ?? null) as any,
      year: null, session: null, paper: null,
    }));
    const sentences: Sentence[] = (sData ?? []).map((s: any) => ({
      id: Number(s.id), jp: String(s.jp ?? ''), zh: String(s.zh ?? ''), topic: (s.topic ?? null) as any,
      year: null, session: null, paper: null,
    }));

    const w = upsertWords(db, words);
    const s = upsertSentences(db, sentences);

    console.log('[syncFromSupabaseToDB] ok words=%d sentences=%d skipped=%d',
      words.length, sentences.length, w.skipped + s.skipped);
    return (words.length + sentences.length) > 0;
  } catch (e) {
    console.warn('[syncFromSupabaseToDB] error:', e);
    return false;
  }
}

/** 後備：從 JSON 同步到本地 DB */
export async function syncFromJsonToDB(db: SQLiteDatabase): Promise<boolean> {
  const url = getDataUrl();
  if (!url) {
    console.warn('[syncFromJsonToDB] 未設定 EXPO_PUBLIC_DATA_URL');
    return false;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('[syncFromJsonToDB] HTTP 非 2xx:', res.status);
      return false;
    }
    const payload = (await res.json()) as RemotePayload;
    const { words, sentences } = normalizeFromJson(payload, undefined, 'both');

    const w = upsertWords(db, words);
    const s = upsertSentences(db, sentences);

    console.log('[syncFromJsonToDB] ok words=%d sentences=%d skipped=%d',
      words.length, sentences.length, w.skipped + s.skipped);
    return (words.length + sentences.length) > 0;
  } catch (e) {
    console.warn('[syncFromJsonToDB] error:', e);
    return false;
  }
}
