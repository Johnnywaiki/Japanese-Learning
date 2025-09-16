// src/db/remote.ts
import type { SQLiteDatabase } from 'expo-sqlite';
import Constants from 'expo-constants';
import type { Topic } from './schema';
import { supabase } from '../remote/supabase';

/* =================== JSON 後備來源（可選） =================== */

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

/** 測試 JSON 來源（設定頁使用） */
export async function pingJsonSource(): Promise<{ ok: boolean; url?: string; status?: number; msg: string }> {
  const url = getDataUrl();
  if (!url) return { ok: false, msg: '未設定 EXPO_PUBLIC_DATA_URL' };
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const status = res.status;
    if (!res.ok) return { ok: false, url, status, msg: `HTTP ${status}` };
    const payload = (await res.json()) as RemotePayload;
    if (!Array.isArray(payload?.words) || !Array.isArray(payload?.sentences)) {
