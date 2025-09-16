// src/db/remote.ts
import { createClient } from '@supabase/supabase-js';
import type { SQLiteDatabase } from 'expo-sqlite';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
export const supabase = createClient(url, anon);

/** 只用 Supabase 同步到本地 SQLite */
export async function syncFromSupabaseToDB(db: SQLiteDatabase): Promise<boolean> {
  try {
    // 1) 取遠端資料
    const ex = await supabase
      .from('exams')
      .select('exam_key, level, year, month, title')
      .limit(5000);
    if (ex.error) throw ex.error;

    const qs = await supabase
      .from('questions')
      .select('exam_key, question_number, section, stem, passage')
      .limit(20000);
    if (qs.error) throw qs.error;

    const ch = await supabase
      .from('choices')
      .select('exam_key, question_number, position, content, is_correct, explanation')
      .limit(80000);
    if (ch.error) throw ch.error;

    console.log('[sync] using', {
      exams: 'public.exams',
      questions: 'public.questions',
      choices: 'public.choices',
    });

    // 2) 清表重灌（簡單可靠）
    db.execSync?.('BEGIN');
    db.execSync?.('DELETE FROM choices;');
    db.execSync?.('DELETE FROM questions;');
    db.execSync?.('DELETE FROM exams;');

    // 3) 寫 exams（把 exam_key 映射到本地 key）
    const exams = ex.data ?? [];
    for (const row of exams) {
      const key = (row as any).exam_key ?? (row as any).key; // 兼容
      const month = (row as any).month ?? null;
      db.runSync?.(
        'INSERT OR REPLACE INTO exams (key, level, year, month, title) VALUES (?,?,?,?,?)',
        [key, row.level, row.year, month, row.title],
      );
    }

    // 4) 寫 questions（本地欄名就係 exam_key）
    const questions = qs.data ?? [];
    for (const row of questions) {
      db.runSync?.(
        `INSERT OR REPLACE INTO questions
         (exam_key, question_number, section, stem, passage)
         VALUES (?,?,?,?,?)`,
        [row.exam_key, row.question_number, row.section, row.stem, row.passage ?? null],
      );
    }

    // 5) 寫 choices（boolean 轉 0/1）
    const choices = ch.data ?? [];
    for (const row of choices) {
      db.runSync?.(
        `INSERT OR REPLACE INTO choices
         (exam_key, question_number, position, content, is_correct, explanation)
         VALUES (?,?,?,?,?,?)`,
        [
          row.exam_key,
          row.question_number,
          row.position,
          row.content,
          row.is_correct ? 1 : 0,
          row.explanation,
        ],
      );
    }

    db.execSync?.('COMMIT');
    console.log('[syncFromSupabaseToDB] ok exams=', exams.length, 'questions=', questions.length, 'choices=', choices.length);
    return true;
  } catch (e) {
    console.warn('[syncFromSupabaseToDB] error:', e);
    try { db.execSync?.('ROLLBACK'); } catch {}
    return false;
  }
}
