// src/db/remote.ts
import type { SQLiteDatabase } from 'expo-sqlite';
import Constants from 'expo-constants';
import type { Topic } from './schema';
import { supabase } from '../remote/supabase';

/* -------- JSON 後備（如不用可保留不設定 URL） -------- */
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
export async function pingJsonSource() {
  const url = getDataUrl();
  if (!url) return { ok: false, msg: 'EXPO_PUBLIC_DATA_URL not set' as const };
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const status = res.status;
    if (!res.ok) return { ok: false, url, status, msg: `HTTP ${status}` as const };
    const p = (await res.json()) as RemotePayload;
    if (!Array.isArray(p?.words) || !Array.isArray(p?.sentences)) {
      return { ok: false, url, status, msg: 'Invalid JSON' as const };
    }
    return { ok: true, url, status, msg: `OK (words:${p.words.length}, sentences:${p.sentences.length})` as const };
  } catch (e: any) { return { ok: false, msg: `fetch failed: ${e?.message ?? e}` as const }; }
}
export async function syncFromJsonToDB(db: SQLiteDatabase): Promise<boolean> {
  const url = getDataUrl(); if (!url) return false;
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
        db.runSync?.('INSERT INTO words (jp,reading,zh,topic) VALUES (?,?,?,?)',
          [w.jp, w.reading ?? null, w.zh, w.topic]);
      }
      for (const s of p.sentences) {
        db.runSync?.('INSERT INTO sentences (jp,zh,topic) VALUES (?,?,?)', [s.jp, s.zh, s.topic]);
      }
      db.execSync?.('COMMIT;');
      console.log(`[syncFromJsonToDB] ok words=${p.words.length} sentences=${p.sentences.length}`);
      return true;
    } catch (e) { db.execSync?.('ROLLBACK;'); console.warn('[syncFromJsonToDB] write fail:', e); return false; }
  } catch (e) { console.warn('[syncFromJsonToDB] fetch fail:', e); return false; }
}

/* ---------------- Supabase（主來源） ---------------- */
const toTopic = (lvl: any): Topic => {
  const s = String(lvl ?? '').toUpperCase();
  return (['N1','N2','N3','N4','N5'] as const).includes(s as any) ? (s as Topic) : 'daily';
};
const isVocab = (x: any) => String(x ?? '').toLowerCase().includes('vocab');
const isReading = (x: any) => {
  const s = String(x ?? '').toLowerCase();
  return s.includes('grammar_reading') || s.includes('reading') || s.includes('language_reading') || s === 'grammar';
};
const isListening = (x: any) => String(x ?? '').toLowerCase().includes('listening');

const pickStem = (q: any, passages: Map<number, any>): string | null => {
  const self = q.stem ?? q.jp ?? q.ja ?? q.text ?? q.prompt ?? q.content ?? q.title ?? null;
  const p = q.passage_id ? passages.get(q.passage_id) : null;
  const ptxt = p?.body ?? p?.jp ?? p?.ja ?? p?.text ?? null;
  return self ?? ptxt ?? null;
};
const isCorrect = (c: any) => {
  const v = c.is_correct ?? c.correct ?? c.isRight ?? c.answer ?? null;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1;
  const s = String(v ?? '').toLowerCase();
  return s === 'true' || s === 't' || s === 'yes' || s === 'y';
};
const pickChoiceText = (c: any): string | null =>
  c.content ?? c.text ?? c.label ?? c.zh ?? c.translation ?? null;

export async function pingSupabaseSource(): Promise<{ ok: boolean; msg: string }> {
  if (!supabase) return { ok: false, msg: 'Supabase URL/key not set' };
  const { error } = await supabase.from('exams').select('id').limit(1);
  return error ? { ok: false, msg: error.message } : { ok: true, msg: 'OK' };
}

export async function syncFromSupabaseToDB(db: SQLiteDatabase): Promise<boolean> {
  if (!supabase) return false;
  try {
    const E = await supabase.from('exams').select('id,level,year,session,paper').order('id');
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
    const passages = new Map<number, any>((P.data ?? []).map(r => [r.id, r]));
    const qMap = new Map<number, any>((Q.data ?? []).map(r => [r.id, r]));
    const choicesByQ = new Map<number, any[]>();
    (C.data ?? []).forEach(row => {
      const arr = choicesByQ.get(row.question_id) ?? [];
      arr.push(row); choicesByQ.set(row.question_id, arr);
    });

    const stat = { w:0, s:0, skipped:0 };

    db.execSync?.('BEGIN;');
    try {
      db.execSync?.('DELETE FROM words;');
      db.execSync?.('DELETE FROM sentences;');

      for (const link of (EQ.data ?? [])) {
        const exam = exams.get(link.exam_id);
        const q = qMap.get(link.question_id);
        if (!exam || !q) { stat.skipped++; continue; }

        // 判斷類型：先看 exam.paper，不明再看 question.section
        const paper = String(exam.paper ?? '').toLowerCase();
        const section = String(q.section ?? '').toLowerCase();
        const asVocab = isVocab(paper) || (!paper && isVocab(section));
        const asReading = isReading(paper) || (!paper && isReading(section));
        const asListen = isListening(paper) || (!paper && isListening(section));
        if (asListen) { stat.skipped++; continue; } // 聽解暫不處理

        const stem = pickStem(q, passages);
        if (!stem) { stat.skipped++; continue; }

        const chs = choicesByQ.get(q.id) ?? [];
        const correct = chs.find(isCorrect);
        const ans = correct ? pickChoiceText(correct) : null;
        if (!ans) { stat.skipped++; continue; }

        const topic = toTopic(exam.level);
        const year = exam.year ?? null;
        const session = exam.session ?? null;

        if (asVocab) {
          db.runSync?.('INSERT INTO words (jp,reading,zh,topic,year,session,paper) VALUES (?,?,?,?,?,?,?)',
            [stem, null, ans, topic, year, session, 'vocab']);
          stat.w++;
        } else if (asReading) {
          const localPaper = paper.includes('grammar') || section.includes('grammar') ? 'grammar_reading' : 'reading';
          db.runSync?.('INSERT INTO sentences (jp,zh,topic,year,session,paper) VALUES (?,?,?,?,?,?)',
            [stem, ans, topic, year, session, localPaper]);
          stat.s++;
        } else {
          stat.skipped++; continue;
        }
      }

      db.execSync?.('COMMIT;');
      console.log(`[syncFromSupabaseToDB] ok words=${stat.w} sentences=${stat.s} skipped=${stat.skipped}`);
      return stat.w + stat.s > 0;
    } catch (e) {
      db.execSync?.('ROLLBACK;'); console.warn('[syncFromSupabaseToDB] write fail:', e); return false;
    }
  } catch (e) {
    console.warn('[syncFromSupabaseToDB] connect fail:', e); return false;
  }
}
