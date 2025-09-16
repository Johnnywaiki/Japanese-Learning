// src/db/index.ts（只示範關鍵部分）
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { CREATE_TABLES_SQL, Word, Sentence, Topic, MistakeRow } from './schema';
import { syncFromSupabaseToDB, syncFromJsonToDB } from './remote';

let _db: SQLiteDatabase | null = null;
export function getDB(): SQLiteDatabase {
  if (_db) return _db;
  const db = openDatabaseSync('jp_quiz.db');
  db.execSync?.(CREATE_TABLES_SQL);
  // 如舊資料庫未有新 topic 值，維持原結構即可
  _db = db; return _db!;
}

export async function seedIfEmpty(): Promise<void> {
  const db = getDB();
  if (await syncFromSupabaseToDB(db)) return;
  if (await syncFromJsonToDB(db)) return;
  // ……（保留你的樣本資料邏輯）
}
