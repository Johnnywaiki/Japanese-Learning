// src/db/remote.ts
import type { SQLiteDatabase } from 'expo-sqlite';
import Constants from 'expo-constants';
import type { Topic } from './schema';
import { supabase } from '../remote/supabase';

/* ---------- JSON 備援（原樣保留，可略） ---------- */
type RemoteWord = { jp: string; reading?: string | null; zh: string; topic: Topic };
type RemoteSentence = { jp: string; zh: string; topic: Topic };
type RemotePayload = { words: RemoteWord[]; sentences: RemoteSentence[]; meta?: unknown };

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
  if (!url) return false; // 靜默：未設就直接略過
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
      console.log(`[syncFromJsonToDB] 成功同步：words=${p.words.length}, sentences=${p.sentences.length}`);
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

/* ---------- Supabase：新表結構 → 舊介面（words/sentences） ---------- */

function normTopic(level: any): Topic {
  const s = String(level ?? '').toUpperCase();
  if (['N1','N2','N3','N4','N5'].includes(s)) return s as Topic;
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

// 從 question row 取日文題幹（兼容多種命名）
function pickJP(q: any, passageMap: Map<number, any>): string | null {
  const fromSelf =
    q.jp ?? q.ja ?? q.stem ?? q.prompt ?? q.text ?? q.content ?? null;
  const passage =
    (q.passage_id && passageMap.get(q.passage_id)) || null;
  const ptxt =
    passage?.jp ?? passage?.ja ?? passage?.text ?? passage?.body ?? null;

  // 若有長文 passage，可把題幹寫成「（段落）\n題目」；或只取題目本身
  if (fromSelf && ptxt) return `${fromSelf}`;
  return fromSelf ?? ptxt ?? null;
}

// 從 choice row 取選項文字（預期是中文釋義）
function pickZH(c: any): string | null {
  return c.zh ?? c.zh_tw ?? c.translation ?? c.translation_zh ?? c.text ?? c.label ?? null;
}
function isCorrect(c: any): boolean {
  const v = c.is_correct ?? c.correct ?? c.isRight ?? c.answer ?? null;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1;
  const s = String(v ?? '').toLowerCase();
  return s === 'true' || s === 't' || s === 'yes' || s === 'y';
}

export async function pingSupabaseSource(): Promise<{ ok: boolean; msg: string }> {
  if (!supabase) return { ok: false, msg: '未設定 EXPO_PUBLIC_SUPABASE_URL/ANON_KEY' };
  const { error } = await supabase.from('exams').select('id').limit(1);
  if (error) return { ok: false, msg: error.message };
  return { ok: true, msg: 'OK（連線成功）' };
}

export async function syncFromSupabaseToDB(db: SQLiteDatabase): Promise<boolean> {
  if (!supabase) return false;
  try {
    // 1) 讀核心表
    const [E, EQ, Q, C, P] = await Promise.all([
      supabase.from('exams').select('id,level,year,session,paper,exam_code').order('id'),
      supabase.from('exam_questions').select('exam_id,question_id').order('exam_id'),
      supabase.from('questions').select('*').order('id'),
      supabase.from('choices').select('*').order('question_id'),
      supabase.from('passages').select('*').order('id'),
    ]);
    if (E.error || EQ.error || Q.error || C.error || P.error) {
      console.warn('[syncFromSupabaseToDB] 讀取錯誤：', E.error ?? EQ.error ?? Q.error ?? C.error ?? P.error);
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

    // 2) 清空本地並寫入映射後的 words / sentences
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

        // 只處理有中文釋義的題（否則此版本暫時略過）
        if (!zh) continue;

        const topic = normTopic(exam.level);

        if (isVocabPaper(exam.paper)) {
          // 當作單字題：jp=日文詞，zh=正解中文
          db.runSync?.('INSERT INTO words (jp,reading,zh,topic) VALUES (?,?,?,?)', [
            jp, null, zh, topic,
          ]);
          wCount++;
        } else if (isReadingPaper(exam.paper)) {
          // 當作例句題：jp=句子/題幹，zh=正解中文
          db.runSync?.('INSERT INTO sentences (jp,zh,topic) VALUES (?,?,?)', [
            jp, zh, topic,
          ]);
          sCount++;
        } else {
          // listening / 其他：目前略過（將來可加音頻/四選一 UI）
          continue;
        }
      }

      db.execSync?.('COMMIT;');
      console.log(`[syncFromSupabaseToDB] 成功同步：words=${wCount}, sentences=${sCount}`);
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
