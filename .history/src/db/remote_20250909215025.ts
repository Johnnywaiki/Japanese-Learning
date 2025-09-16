// src/db/remote.ts
import type { SQLiteDatabase } from 'expo-sqlite';
import Constants from 'expo-constants';
import type { Topic } from './schema';
import { supabase } from '../remote/supabase';

/* ============ JSON 後備（可留作備援） ============ */
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

export async function pingJsonSource(): Promise<{ ok: boolean; url?: string; status?: number; msg: string }> {
  const url = getDataUrl();
  if (!url) return { ok: false, msg: 'EXPO_PUBLIC_DATA_URL not set' };
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const status = res.status;
    if (!res.ok) return { ok: false, url, status, msg: `HTTP ${status}` };
    const p = (await res.json()) as RemotePayload;
    if (!Array.isArray(p?.words) || !Array.isArray(p?.sentences)) {
      return { ok: false, url, status, msg: 'Invalid JSON: missing words[] or sentences[]' };
    }
    return { ok: true, url, status, msg: `OK (words:${p.words.length}, sentences:${p.sentences.length})` };
  } catch (e: any) { return { ok: false, msg: `fetch failed: ${e?.message ?? e}` }; }
}

export async function syncFromJsonToDB(db: SQLiteDatabase): Promise<boolean> {
  const url = getDataUrl();
  if (!url) return false;
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
    } catch (e) {
      db.execSync?.('ROLLBACK;'); console.warn('[syncFromJsonToDB] write fail:', e); return false;
    }
  } catch (e) { console.warn('[syncFromJsonToDB] fetch fail:', e); return false; }
}

/* ============ Supabase（主用） ============ */
function normTopic(level: any): Topic {
  const s = String(level ?? '').toUpperCase();
  return (['N1','N2','N3','N4','N5'] as const).includes(s as any) ? (s as Topic) : 'daily';
}

function isVocabLabel(x: any) {
  const s = String(x ?? '').toLowerCase();
  return s.includes('vocab') || s.includes('vocabulary');
}
function isReadingLabel(x: any) {
  const s = String(x ?? '').toLowerCase();
  // 兼容 grammar_reading / reading / language_reading
  return s.includes('grammar_reading') || s.includes('reading') || s.includes('language_reading') || s === 'grammar';
}
function isListeningLabel(x: any) {
  const s = String(x ?? '').toLowerCase();
  return s.includes('listening');
}

/** 題幹：優先 questions.stem；無則取 passage.body */
function pickJP(q: any, passageMap: Map<number, any>): string | null {
  const self = q.stem ?? q.jp ?? q.ja ?? q.text ?? q.prompt ?? q.content ?? q.title ?? null;
  const p = q.passage_id ? passageMap.get(q.passage_id) : null;
  const ptxt = p?.body ?? p?.jp ?? p?.ja ?? p?.text ?? null;
  return self ?? ptxt ?? null;
}

/** 正解文字：你的 schema 是 choices.content */
function pickChoiceText(c: any): string | null {
  return c.content ?? c.text ?? c.label ?? c.zh ?? c.translation ?? null;
}
function isChoiceCorrect(c: any): boolean {
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
  return error ? { ok: false, msg: error.message } : { ok: true, msg: 'OK' };
}

/** 讀 exams（固定欄位） */
async function selectExams() {
  return await supabase!.from('exams').select('id,level,year,session,paper').order('id');
}

/** 同步：把 exams/* → 本地 words/sentences */
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
      console.warn('[syncFromSupabaseToDB] read error:',
        E.error ?? EQ.error ?? Q.error ?? C.error ?? P.error);
      return false;
    }

    const exams = new Map<number, any>((E.data ?? []).map(r => [r.id, r]));
    const passageMap = new Map<number, any>((P.data ?? []).map(r => [r.id, r]));
    const qMap = new Map<number, any>((Q.data ?? []).map(r => [r.id, r]));
    const choicesByQ = new Map<number, any[]>();
    (C.data ?? []).forEach(row => {
      const arr = choicesByQ.get(row.question_id) ?? [];
      arr.push(row); choicesByQ.set(row.question_id, arr);
    });

    const stat = { links:(EQ.data??[]).length, w:0, s:0, noExam:0, noQ:0, noJP:0, noChoices:0, noCorrect:0, noText:0, skipped:0 };

    db.execSync?.('BEGIN;');
    try {
      db.execSync?.('DELETE FROM words;');
      db.execSync?.('DELETE FROM sentences;');

      for (const link of (EQ.data ?? [])) {
        const exam = exams.get(link.exam_id);
        if (!exam) { stat.noExam++; continue; }
        const q = qMap.get(link.question_id);
        if (!q) { stat.noQ++; continue; }

        // 先用 exam.paper 判斷，不明就看 question.section
        const paper = String(exam.paper ?? '').toLowerCase();
        const section = String(q.section ?? '').toLowerCase();

        const asVocab   = isVocabLabel(paper)   || (!paper && isVocabLabel(section));
        const asReading = isReadingLabel(paper) || (!paper && isReadingLabel(section));
        const asListen  = isListeningLabel(paper) || (!paper && isListeningLabel(section));

        if (!asVocab && !asReading && asListen) { stat.skipped++; continue; } // 聽解暫不處理

        const stem = pickJP(q, passageMap);
        if (!stem) { stat.noJP++; continue; }

        const chs = choicesByQ.get(q.id) ?? [];
        if (chs.length === 0) { stat.noChoices++; continue; }

        const correct = chs.find(isChoiceCorrect);
        if (!correct) { stat.noCorrect++; continue; }

        const ansText = pickChoiceText(correct);
        if (!ansText) { stat.noText++; continue; }

        const topic = normTopic(exam.level);

        if (asVocab) {
          // 單字題：stem = 日文詞，ansText = 中文釋義/答案
          db.runSync?.('INSERT INTO words (jp,reading,zh,topic) VALUES (?,?,?,?)',
            [stem, null, ansText, topic]);
          stat.w++;
        } else if (asReading) {
          // 讀解／文法讀解：stem = 問題句/段落句，ansText = 正解文字（可能是日文/中文）
          db.runSync?.('INSERT INTO sentences (jp,zh,topic) VALUES (?,?,?)',
            [stem, ansText, topic]);
          stat.s++;
        } else {
          // 如果兩者都不是（未知 paper/section），暫時略過
          stat.skipped++; continue;
        }
      }

      db.execSync?.('COMMIT;');
      console.log(`[syncFromSupabaseToDB] ok words=${stat.w} sentences=${stat.s} | links=${stat.links} skipped=${stat.skipped} miss={exam:${stat.noExam}, q:${stat.noQ}, stem:${stat.noJP}, choices:${stat.noChoices}, correct:${stat.noCorrect}, text:${stat.noText}}`);
      return stat.w + stat.s > 0;
    } catch (e) {
      db.execSync?.('ROLLBACK;'); console.warn('[syncFromSupabaseToDB] write fail:', e); return false;
    }
  } catch (e) {
    console.warn('[syncFromSupabaseToDB] connect fail:', e); return false;
  }
}
