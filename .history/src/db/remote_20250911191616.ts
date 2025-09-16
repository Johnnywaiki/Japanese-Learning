// src/db/remote.ts
import Constants from 'expo-constants';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { PracticeFilter, Topic, Word, Sentence } from './schema';

/* ---------------- Env helpers ---------------- */
function readExtra(key: string): string | undefined {
  return (
    (process.env as any)[key] ??
    (Constants.expoConfig?.extra as any)?.[key] ??
    (Constants.manifest2 as any)?.extra?.[key]
  );
}

const SUPA_URL = readExtra('EXPO_PUBLIC_SUPABASE_URL');
const SUPA_ANON = readExtra('EXPO_PUBLIC_SUPABASE_ANON_KEY');

let _supa: SupabaseClient | null = null;
export function getSupabaseClient(): SupabaseClient {
  if (_supa) return _supa;
  if (!SUPA_URL || !SUPA_ANON) {
    throw new Error('Supabase 未設定（EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY）');
  }
  _supa = createClient(SUPA_URL, SUPA_ANON, { auth: { persistSession: false } });
  return _supa!;
}

/* ---------------- JSON 後備來源 ---------------- */
export type PingResult = { ok: boolean; msg: string; status?: number; url?: string };

function getDataUrl(): string | undefined {
  return readExtra('EXPO_PUBLIC_DATA_URL');
}

type RemotePayload = {
  words?: Array<Partial<Word> & { jp: string; zh: string; topic: Topic }>;
  sentences?: Array<Partial<Sentence> & { jp: string; zh: string; topic: Topic }>;
};

export async function pingJsonSource(): Promise<PingResult> {
  const url = getDataUrl();
  if (!url) return { ok: false, msg: '未設定 EXPO_PUBLIC_DATA_URL' };
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, msg: 'HTTP 錯誤', status: res.status, url };
    const data = (await res.json()) as RemotePayload;
    if (!Array.isArray(data?.words) && !Array.isArray(data?.sentences)) {
      return { ok: false, msg: '格式不正確（缺 words/sentences）', status: res.status, url };
    }
    return { ok: true, msg: 'JSON 可讀', status: res.status, url };
  } catch (e: unknown) {
    return { ok: false, msg: String(e), url };
  }
}

export async function syncFromJsonToDB(
  db: SQLiteDatabase
): Promise<{ ok: boolean; words: number; sentences: number } | false> {
  const url = getDataUrl();
  if (!url) {
    console.warn('[syncFromJsonToDB] 未設定 EXPO_PUBLIC_DATA_URL');
    return false;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('[syncFromJsonToDB] HTTP', res.status);
      return false;
    }
    const payload = (await res.json()) as RemotePayload;
    if (!Array.isArray(payload?.words) && !Array.isArray(payload?.sentences)) {
      console.warn('[syncFromJsonToDB] 格式不正確');
      return false;
    }

    let w = 0, s = 0;

    for (const it of payload.words ?? []) {
      db.runSync?.(
        'INSERT INTO words (jp, zh, reading, topic, year, session, paper) VALUES (?,?,?,?,?,?,?)',
        [
          it.jp,
          it.zh,
          it.reading ?? null,
          it.topic,
          it.year ?? null,
          it.session ?? null,
          it.paper ?? null,
        ]
      );
      w++;
    }
    for (const it of payload.sentences ?? []) {
      db.runSync?.(
        'INSERT INTO sentences (jp, zh, topic, year, session, paper, audio_url, image_url) VALUES (?,?,?,?,?,?,?,?)',
        [
          it.jp,
          it.zh,
          it.topic,
          it.year ?? null,
          it.session ?? null,
          it.paper ?? null,
          (it as any).audio_url ?? null,
          (it as any).image_url ?? null,
        ]
      );
      s++;
    }

    console.log('[syncFromJsonToDB] ok words=', w, 'sentences=', s);
    return { ok: true, words: w, sentences: s };
  } catch (e: unknown) {
    console.warn('[syncFromJsonToDB] error', e);
    return false;
  }
}

/* ---------------- Supabase → 本地 SQLite ---------------- */
export async function syncFromSupabaseToDB(db: SQLiteDatabase): Promise<boolean> {
  if (!SUPA_URL || !SUPA_ANON) return false;
  const supa = getSupabaseClient();
  try {
    const { data: w, error: we } = await supa.from('words').select('*').limit(2000);
    if (we) throw we;
    const { data: s, error: se } = await supa.from('sentences').select('*').limit(2000);
    if (se) throw se;

    let wc = 0, sc = 0;
    for (const it of (w ?? [])) {
      db.runSync?.(
        'INSERT INTO words (jp, zh, reading, topic, year, session, paper) VALUES (?,?,?,?,?,?,?)',
        [it.jp, it.zh, it.reading ?? null, it.topic, it.year ?? null, it.session ?? null, it.paper ?? null]
      );
      wc++;
    }
    for (const it of (s ?? [])) {
      db.runSync?.(
        'INSERT INTO sentences (jp, zh, topic, year, session, paper, audio_url, image_url) VALUES (?,?,?,?,?,?,?,?)',
        [it.jp, it.zh, it.topic, it.year ?? null, it.session ?? null, it.paper ?? null, it.audio_url ?? null, it.image_url ?? null]
      );
      sc++;
    }
    console.log('[syncFromSupabaseToDB] ok words=', wc, 'sentences=', sc);
    return wc + sc > 0;
  } catch (e: unknown) {
    console.warn('[syncFromSupabaseToDB] error', e);
    return false;
  }
}

/* ---------------- JLPT 正規表（線上直讀 Pool） ---------------- */
export type JLPTChoice = {
  id: number;
  question_id: number;
  position: number | null;
  content: string;
  is_correct: boolean | null;
};

export type JLPTPoolItem = {
  kind: 'jlpt';
  id: number; // question id
  level: Topic;
  year?: number | null;
  session?: string | null;
  section: string; // vocab / grammar / reading / listening
  stem: string;
  explanation?: string | null;
  passage_id?: number | null;
  audio_url?: string | null;
  image_url?: string | null;
  choices: JLPTChoice[];
};

function kindToSections(kind: PracticeFilter['kind']): string[] {
  if (kind === 'language') return ['vocab', 'grammar', 'grammar_reading', 'language_reading'];
  if (kind === 'reading') return ['reading', 'grammar_reading'];
  if (kind === 'listening') return ['listening'];
  return [];
}
function kindToPapers(kind: PracticeFilter['kind']): string[] {
  if (kind === 'language') return ['vocab', 'grammar_reading', 'language_reading'];
  if (kind === 'reading') return ['reading', 'grammar_reading'];
  if (kind === 'listening') return ['listening'];
  return [];
}

export async function fetchJLPTPool(filters: PracticeFilter): Promise<JLPTPoolItem[]> {
  if (!SUPA_URL || !SUPA_ANON) return [];
  const supa = getSupabaseClient();
  const sections = kindToSections(filters.kind);
  const papers = kindToPapers(filters.kind);

  // exams
  let qExams = supa.from('exams').select('id, level, year, session, paper').in('paper', papers);
  if (filters.level === 'N2-N3-random') qExams = qExams.in('level', ['N2', 'N3']);
  else if (filters.level !== 'all') qExams = qExams.eq('level', filters.level as Topic);
  if (filters.year && filters.year !== 'random') qExams = qExams.eq('year', filters.year as number);
  if (filters.session && filters.session !== 'random') qExams = qExams.ilike('session', String(filters.session));

  const { data: exams, error: exErr } = await qExams;
  if (exErr || !exams?.length) return [];

  // exam_questions
  const { data: eqs, error: eqErr } = await supa
    .from('exam_questions')
    .select('exam_id, question_id, order_no')
    .in('exam_id', exams.map((e) => e.id))
    .order('order_no', { ascending: true });
  if (eqErr || !eqs?.length) return [];

  const qIds = Array.from(new Set(eqs.map((x) => x.question_id)));

  // questions
  const { data: qs, error: qErr } = await supa
    .from('questions')
    .select('id, level, section, question_type, stem, explanation, passage_id, audio_url, image_url')
    .in('id', qIds);
  if (qErr || !qs?.length) return [];

  // choices
  const { data: ch, error: cErr } = await supa
    .from('choices')
    .select('id, question_id, position, content, is_correct')
    .in('question_id', qIds);
  if (cErr) return [];

  const byQ = new Map<number, JLPTChoice[]>();
  (ch ?? []).forEach((c: JLPTChoice) => {
    const list = byQ.get(c.question_id) ?? [];
    list.push(c);
    byQ.set(c.question_id, list);
  });

  const allow = sections.map((s) => s.toLowerCase());
  const pool: JLPTPoolItem[] = [];

  for (const q of qs as any[]) {
    const sec = String(q.section || '').toLowerCase();
    if (!allow.includes(sec)) continue;

    const choices = (byQ.get(q.id) ?? []).sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0)
    );
    if (choices.length < 2) continue;

    const examId = (eqs.find((x) => x.question_id === q.id) as any)?.exam_id;
    const exam = (exams as any[]).find((e) => e.id === examId);

    pool.push({
      kind: 'jlpt',
      id: q.id,
      level: q.level as Topic,
      year: exam?.year ?? null,
      session: exam?.session ?? null,
      section: String(q.section),
      stem: q.stem,
      explanation: q.explanation,
      passage_id: q.passage_id,
      audio_url: q.audio_url,
      image_url: q.image_url,
      choices,
    });
  }

  return pool;
}
