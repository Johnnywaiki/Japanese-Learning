// src/db/remote.ts
import type { SQLiteDatabase } from 'expo-sqlite';
import Constants from 'expo-constants';
import type { Topic } from './schema';

type RemoteWord = { jp: string; reading?: string | null; zh: string; topic: Topic };
type RemoteSentence = { jp: string; zh: string; topic: Topic };
type RemotePayload = { words: RemoteWord[]; sentences: RemoteSentence[]; meta?: unknown };

function isTopic(x: any): x is Topic {
  return x === 'N2' || x === 'N3' || x === 'daily';
}

function getDataUrl(): string | undefined {
  // 優先讀 EXPO_PUBLIC_（打包時會注入）；再 fallback 去 app.json 的 extra
  return (
    process.env.EXPO_PUBLIC_DATA_URL ??
    (Constants.expoConfig?.extra as any)?.EXPO_PUBLIC_DATA_URL ??
    (Constants.manifest2 as any)?.extra?.EXPO_PUBLIC_DATA_URL // Web/舊版本 fallback
  );
}

/** 只測試來源是否可讀、是否有效 JSON（不寫 DB），用於 UI 按鈕顯示結果 */
export async function pingJsonSource(): Promise<{
  ok: boolean;
  url?: string;
  status?: number;
  msg: string;
}> {
  const url = getDataUrl();
  if (!url) return { ok: false, msg: '未設定 EXPO_PUBLIC_DATA_URL', url: undefined };

  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const status = res.status;
    if (!res.ok) {
      return { ok: false, url, status, msg: `HTTP ${status}` };
    }
    const text = await res.text();
    try {
      const json = JSON.parse(text) as RemotePayload;
      const okArrays = Array.isArray(json?.words) && Array.isArray(json?.sentences);
      if (!okArrays) {
        return { ok: false, url, status, msg: 'JSON 結構不正確：需要 words[] 與 sentences[]' };
      }
      return { ok: true, url, status, msg: `OK（words:${json.words.length}，sentences:${json.sentences.length}）` };
    } catch (e: any) {
      return { ok: false, url, status, msg: `JSON 解析失敗：${e?.message ?? e}` };
    }
  } catch (e: any) {
    return { ok: false, url, msg: `fetch 失敗：${e?.message ?? e}` };
  }
}

/** 從 EXPO_PUBLIC_DATA_URL 下載 JSON，並覆蓋寫入傳入的 db。成功返回 true；否則 false。 */
export async function syncFromJsonToDB(db: SQLiteDatabase): Promise<boolean> {
  const url = getDataUrl();
  if (!url) {
    console.warn('[syncFromJsonToDB] 未設定 EXPO_PUBLIC_DATA_URL');
    return false;
  }

  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      console.warn(`[syncFromJsonToDB] HTTP ${res.status} 於 ${url}`);
      return false;
    }
    const text = await res.text();
    let payload: RemotePayload;
    try {
      payload = JSON.parse(text);
    } catch (e) {
      console.warn('[syncFromJsonToDB] JSON 解析失敗，前 200 字：', text.slice(0, 200));
      return false;
    }

    if (!Array.isArray(payload?.words) || !Array.isArray(payload?.sentences)) {
      console.warn('[syncFromJsonToDB] JSON 結構不正確：缺少 words[] 或 sentences[]');
      return false;
    }

    db.execSync?.('BEGIN;');
    try {
      db.execSync?.('DELETE FROM words;');
      db.execSync?.('DELETE FROM sentences;');

      for (const w of payload.words) {
        const topic = isTopic(w.topic) ? w.topic : 'daily';
        db.runSync?.('INSERT INTO words (jp,reading,zh,topic) VALUES (?,?,?,?)', [
          w.jp,
          w.reading ?? null,
          w.zh,
          topic,
        ]);
      }
      for (const s of payload.sentences) {
        const topic = isTopic(s.topic) ? s.topic : 'daily';
        db.runSync?.('INSERT INTO sentences (jp,zh,topic) VALUES (?,?,?)', [s.jp, s.zh, topic]);
      }

      db.execSync?.('COMMIT;');
      console.log(`[syncFromJsonToDB] 成功同步：words=${payload.words.length}, sentences=${payload.sentences.length}`);
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
