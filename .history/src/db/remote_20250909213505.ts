// src/db/remote.ts
import type { SQLiteDatabase } from 'expo-sqlite';
import Constants from 'expo-constants';
import type { Topic } from './schema';
import { supabase } from '../remote/supabase';

/* =================== JSON 後備來源（可選） =================== */

type RemoteWord = { jp: string; reading?: string | null; zh: string; topic: Topic };
type RemoteSentence = { jp: string; zh: string; topic: Topic };
type RemotePayload = { words: RemoteWord[]; sentences: RemoteSentence[] };

function getDataUrl(): string | undefined {
  return (
    process.env.EXPO_PUBLIC_DATA_URL ??
    (Constants.expoConfig?.extra as any)?.EXPO_PUBLIC_DATA_URL ??
    (Constants.manifest2 as any)?.extra?.EXPO_PUBLIC_DATA_URL
  );
}

/** 設定頁用：測試 JSON 來源 */
export async function pingJsonSource(): Promise<{ ok: boolean; url?: string; status?: number; msg: string }> {
  const url = getDataUrl();
  if (!url) return { ok: false, msg: 'EXPO_PUBLIC_DATA_URL not set' };
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const status = res.status;
    if (!res.ok) return { ok: false, url, status, msg: `HTTP ${status}` };
    const payload = (await res.json()) as RemotePayload;
    if (!Array.isArray(payload?.words) || !Array.isArray(payload?.sentences)) {
      return { ok: false, url, status, msg: 'Invalid JSON: missing words[] or sentences[]' };
    }
    return { ok: true, url, status, msg: `OK (words:${payload.words.length}, sentences:${payload.sentences.length})` };
  } catch (e: any) {
    return { ok: false, msg: `fetch failed: ${e?.message ?? e}` };
  }
}

/** 同步：JSON → 本地 SQLite（未設 URL 會靜默 false） */
export async function syncFromJsonToDB(db: SQLiteDatabase): Promise<boolean> {
  const url = getDataUrl();
  if (!url) return false; // silent if not set
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return false;
    const p = (await res.json()) as RemotePayload;
    if (!Array.isArray(p?.words) || !Array.isArray(p?.sentences)) return false;

    db.execSync?.('BEGIN;');
    try {
      db.execSync?.('DELETE FROM words;');
      db.execSync?.('DELETE FROM sentences;');
      for (const w of p.words) {
        db.runSync?.('INSERT INTO words (jp,reading,zh,topic) VALUES (?,?,?,?)', [
          w.jp, w.reading ?? null, w.zh, w.topic,
        ]);
      }
      for (const s of p.sentences) {
        db.runSync?.('INSERT INTO sentences (jp,zh,topic) VALUES (?,?,?)', [s.jp, s.zh, s.topic]);
      }
      db.execSync?.('COMMIT;');
      console.log(`[syncFromJsonToDB] ok words=${p.words.length} sentences=${p.sentences.length}`);
      return true;
    } catch (e) {
      db.execSync?.('ROLLBACK;');
      console.warn('[syncFromJsonToDB] write fail:', e);
      return false;
    }
  } catch (e) {
    console.warn('[syncFromJsonToDB] fetch fail:', e);
    return false;
  }
}

/* =================== Supabase 來源（主用） =================== */

function normTopic(level: any): Topic {
  const s = String(level ?? '').toUpperCase();
  if (['N1', 'N2', 'N3', 'N4', 'N5'].includes(s)) return s as Topic;
  return 'daily';
}
function isVocabPaper(paper: any) {
  const s = String(paper ?? '').toLowerCase();
  return s.includes('vocab') || s.includes('vocabulary');
}
function isReadingPaper(paper: any) {
  const s = String(paper ?? '').toLowerCase();
  return s.includes('language_reading') || s.includes('grammar_reading') || s.includes('reading');
}

/** 由 questions / passages 取日文題幹 */
function pickJP(q: any, passageMap: Map<number, any>): string | null {
  const self = q.jp ?? q.ja ?? q.stem ?? q.prompt ?? q.text ?? q.content ?? null;
  const p = q.passage_id ? passageMap.get(q.passage_id) : null;
  const ptxt = p?.jp ?? p?.ja ?? p?.text ?? p?.body ?? null;
  return self ?? ptxt ?? null;
}

/** 由 choices 取中文正解文字（兼容多種命名） */
function pickZH(c: any): string | null {
  return c.zh ?? c.zh_tw ?? c.translation_zh ?? c.translation ?? c.text ?? c.label ?? null;
}
function isCorrect(c: any): boolean {
  const v = c.is_correct ?? c.correct ?? c.isRight ?? c.answer ?? null;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1;
  const s = String(v ?? '').toLowerCase();
  return s === 'true' || s === 't' || s === 'yes' || s === 'y';
}

/** 設定頁用：測試 Supabase 連線 */
export async function pingSupabaseSource(): Promise<{ ok: boolean; msg: string }> {
  if (!supabase) return { ok: false, msg: 'Supabase URL/key not set' };
  const { error } = await supabase.from('exams').select('id').limit(1);
  if (error) return { ok: false, msg: error.message };
  return { ok: true, msg: 'OK' };
}

/** 讀 exams（固定欄位；不選 exam_code 以避免 TS 型別衝突） */
async function selectExams() {
  return await supabase!.from('exams')
    .select('id,level,year,session,paper')
    .order('id');
}

/** 同步：Supabase 新結構 → 本地 SQLite 的 words/sentences */
export async function syncFromSupabaseToDB(db: SQLiteDatabase): Promise<boolean> {
  if (!supabase) return false;
  try {
    const E = await selectExams();
    const [EQ, Q, C, P] = await Promise.all([
      supabase.from('exam_questions').select('exam_id,question_id,question_number').order('exam_id'),
      supabase.from('questions').select('*').order('id'),
      supabase.from('choices').select('*').order('question_id'),
      supabase.from('passages').select('*').order('id'),
    ]);

    if (E.error || EQ.error || Q.error || C.error || P.error) {
      console.warn('[syncFromSupabaseToDB] read error:', E.error ?? EQ.error ?? Q.error ?? C.error ?? P.error);
      return false;
    }

    const exams = new Map<number, any>((E.data ?? []).map(r => [r.id, r]));
    const passageMap = new Map<number, any>((P.data ?? []).map(r => [r.id, r]));
    const qMap = new Map<number, any>((Q.data ?? []).map(r => [r.id, r]));
    const choicesByQ = new Map<number, any[]>();
    (C.data ?? []).forEach(row => {
      const arr = choicesByQ.get(row.question_id) ?? [];
      arr.push(row);
      choicesByQ.set(row.question_id, arr);
    });

    db.execSync?.('BEGIN;');
    try {
      db.execSync?.('DELETE FROM words;');
      db.execSync?.('DELETE FROM sentences;');

      let wCount = 0, sCount = 0;

      for (const link of (EQ.data ?? [])) {
        const exam = exams.get(link.exam_id);
        const q = qMap.get(link.question_id);
        if (!exam || !q) continue;

        const jp = pickJP(q, passageMap);
        if (!jp) continue;

        const chs = (choicesByQ.get(q.id) ?? []);
        const correct = chs.find(isCorrect);
        const zh = correct ? pickZH(correct) : null;
        if (!zh) continue;

        const topic = normTopic(exam.level);

        if (isVocabPaper(exam.paper)) {
          db.runSync?.('INSERT INTO words (jp,reading,zh,topic) VALUES (?,?,?,?)', [
            jp, null, zh, topic,
          ]);
          wCount++;
        } else if (isReadingPaper(exam.paper)) {
          db.runSync?.('INSERT INTO sentences (jp,zh,topic) VALUES (?,?,?)', [
            jp, zh, topic,
          ]);
          sCount++;
        } else {
          // listening / others：暫時略過；將來可擴充
          continue;
        }
      }

      db.execSync?.('COMMIT;');
      console.log(`[syncFromSupabaseToDB] ok words=${wCount} sentences=${sCount}`);
      return true;
    } catch (e) {
      db.execSync?.('ROLLBACK;');
      console.warn('[syncFromSupabaseToDB] write fail:', e);
      return false;
    }
  } catch (e) {
    console.warn('[syncFromSupabaseToDB] connect fail:', e);
    return false;
  }
}
