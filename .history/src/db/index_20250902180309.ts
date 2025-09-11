// src/db/index.ts（只示範需要改的部分）
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { CREATE_TABLES_SQL, Word, Sentence, Topic } from './schema';
import { syncFromJsonToDB } from './remote'; // ⬅️ 改呢行

// ...其餘保持

export async function seedIfEmpty(): Promise<void> {
  const d = getDB();

  // 先試：從 JSON 同步到「已打開」的 db   ⬅️ 傳入 d
  const pulled = await syncFromJsonToDB(d);
  if (pulled) return;

  // 之後先檢查本地是否已有資料
  const row = d.getFirstSync?.<{ c: number }>('SELECT COUNT(*) AS c FROM words');
  const hasData = (row?.c ?? 0) > 0;
  if (hasData) return;

  // ...（保留你原本的 sample insert）
}
