// --- 在 src/db/remote.ts 內新增（或合併到現有程式）---
import type { PracticeFilter } from './index';
import type { Topic } from './schema';
import Constants from 'expo-constants';
// 假設你已經有 getSupabaseClient，如沒有請自行用 createClient 建立
import { getSupabaseClient } from './remoteClient'; // <- 如果你本來不是這個名字，請改成你的

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
function kindToPaper(kind: PracticeFilter['kind']): string[] {
  if (kind === 'language') return ['vocab', 'grammar_reading', 'language_reading'];
  if (kind === 'reading') return ['reading', 'grammar_reading'];
  if (kind === 'listening') return ['listening'];
  return [];
}

/** 直接由 Supabase JLPT 正規 schema 取問題，組成「內置選項」的題庫 */
export async function fetchJLPTPool(filters: PracticeFilter): Promise<JLPTPoolItem[]> {
  const supa = getSupabaseClient();
  const sections = kindToSections(filters.kind);
  const papers = kindToPaper(filters.kind);

  // 1) 找符合條件的 exams（year/session/level/paper）
  let qExams = supa.from('exams')
    .select('id, level, year, session, paper')
    .in('paper', papers);

  if (filters.level !== 'all' && filters.level !== 'N2-N3-random') {
    qExams = qExams.eq('level', filters.level as Topic);
  } else if (filters.level === 'N2-N3-random') {
    qExams = qExams.in('level', ['N2','N3']);
  }

  if (filters.year && filters.year !== 'random') qExams = qExams.eq('year', filters.year as number);
  if (filters.session && filters.session !== 'random') qExams = qExams.ilike('session', String(filters.session));

  const { data: exams, error: exErr } = await qExams;
  if (exErr) {
    console.warn('[JLPT] exams error:', exErr);
    return [];
  }
  if (!exams || exams.length === 0) return [];

  const examIds = exams.map(e => e.id);

  // 2) exam_questions → 取到 question_id
  const { data: eqs, error: eqErr } = await supa
    .from('exam_questions')
    .select('exam_id, question_id, order_no')
    .in('exam_id', examIds)
    .order('order_no', { ascending: true });
  if (eqErr) {
    console.warn('[JLPT] exam_questions error:', eqErr);
    return [];
  }
  if (!eqs || eqs.length === 0) return [];

  const questionIds = Array.from(new Set(eqs.map(x => x.question_id)));

  // 3) questions
  const { data: qs, error: qErr } = await supa
    .from('questions')
    .select('id, level, section, question_type, stem, explanation, passage_id, audio_url, image_url')
    .in('id', questionIds);
  if (qErr) {
    console.warn('[JLPT] questions error:', qErr);
    return [];
  }
  if (!qs || qs.length === 0) return [];

  // 4) choices
  const { data: ch, error: cErr } = await supa
    .from('choices')
    .select('id, question_id, position, content, is_correct')
    .in('question_id', questionIds);
  if (cErr) {
    console.warn('[JLPT] choices error:', cErr);
    return [];
  }
  const byQ = new Map<number, JLPTChoice[]>();
  (ch ?? []).forEach(c => {
    const list = byQ.get(c.question_id) ?? [];
    list.push(c);
    byQ.set(c.question_id, list);
  });

  const allow = sections.map(s => s.toLowerCase());
  const pool: JLPTPoolItem[] = [];

  for (const q of qs) {
    const sec = String(q.section || '').toLowerCase();
    if (!allow.includes(sec)) continue;

    const choices = (byQ.get(q.id) ?? []).sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0)
    );
    if (choices.length < 2) continue; // 至少兩個選項先算題

    // 補 year/session：從其所屬 exam 找
    const theExamId = eqs.find(x => x.question_id === q.id)?.exam_id;
    const theExam = exams.find(e => e.id === theExamId);

    pool.push({
      kind: 'jlpt',
      id: q.id,
      level: q.level as any,
      year: theExam?.year ?? null,
      session: theExam?.session ?? null,
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
