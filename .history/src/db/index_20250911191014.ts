// src/db/index.ts（只顯示 getAllForFilter 內改動重點）
import { fetchJLPTPool } from './remote'; // <-- 新增

export async function getAllForFilter(
  f: PracticeFilter
): Promise<{ words: Word[]; sentences: Sentence[]; pool?: any[] }> {
  const db = getDB();

  // ...（原有 topics / conds / params / where / joiner 不變）

  let words: Word[] = [];
  let sentences: Sentence[] = [];

  if (f.kind === 'language') {
    words = db.getAllSync?.<Word>(
      `SELECT * FROM words${where}${joiner}(paper IS NULL OR paper='' OR LOWER(paper) LIKE '%vocab%' OR LOWER(paper) LIKE '%language%')`,
      ...params
    ) ?? [];
    sentences = db.getAllSync?.<Sentence>(
      `SELECT * FROM sentences${where}${joiner}(LOWER(paper) LIKE '%grammar%' OR LOWER(paper) LIKE '%grammar_reading%' OR paper IS NULL OR paper='')`,
      ...params
    ) ?? [];
  } else if (f.kind === 'reading') {
    sentences = db.getAllSync?.<Sentence>(
      `SELECT * FROM sentences${where}${joiner}(paper IS NULL OR LOWER(paper) LIKE '%reading%' OR LOWER(paper) LIKE '%grammar_reading%')`,
      ...params
    ) ?? [];
  } else {
    words = []; sentences = [];
  }

  // ✅ 如果本地兩邊加起來仍為 0，嘗試由 JLPT schema 直讀
  if ((words?.length ?? 0) + (sentences?.length ?? 0) === 0) {
    try {
      const pool = await fetchJLPTPool(f);
      if (pool.length > 0) {
        // 回傳兼容物件；useQuiz 會優先用 any.pool
        return { words: [], sentences: [], pool };
      }
    } catch (e) {
      console.warn('[getAllForFilter] JLPT fallback error:', e);
    }
  }

  return { words, sentences };
}
