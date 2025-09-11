// src/db/remote.ts
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Topic } from './schema';

type RemoteWord = { jp: string; reading?: string | null; zh: string; topic: Topic };
type RemoteSentence = { jp: string; zh: string; topic: Topic };
type RemotePayload = { words: RemoteWord[]; sentences: RemoteSentence[]; meta?: unknown };

function isTopic(x: any): x is Topic {
  return x === 'N2' || x === 'N3' || x === 'daily';
}

/**
 * 從環境變數 EXPO_PUBLIC_DATA_URL 下載 JSON，並覆蓋寫入傳入的 db。
 * 成功返回 true；否則 false（index 會 fallback）。
 */
export async function syncFromJsonToDB(db: SQLiteDatabase): Promise<boolean> {
  const url = process.env.EXPO_PUBLIC_DATA_URL;
  if (!url) return false;

  const res = await fetch(url);
  if (!res.ok) return false;

  const payload = (await res.json()) as RemotePayload;
  if (!Array.isArray(payload?.words) || !Array.isArray(payload?.sentences)) return false;

  db.execSync?.('BEGIN;');
  try {
    db.execSync?.('DELETE FROM words;');
    db.execSync?.('DELETE FROM sentences;');

    for (const w of payload.words) {
      const topic = isTopic(w.topic) ? w.topic : 'daily';
      db.runSync?.('INSERT INTO words (jp,reading,zh,topic) VALUES (?,?,?,?)', [
        w.jp, w.reading ?? null, w.zh, topic,
      ]);
    }
    for (const s of payload.sentences) {
      const topic = isTopic(s.topic) ? s.topic : 'daily';
      db.runSync?.('INSERT INTO sentences (jp,zh,topic) VALUES (?,?,?)', [
        s.jp, s.zh, topic,
      ]);
    }

    db.execSync?.('COMMIT;');
    return true;
  } catch {
    db.execSync?.('ROLLBACK;');
    return false;
  }
}