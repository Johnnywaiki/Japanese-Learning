// src/tts/index.ts
import * as Speech from 'expo-speech';

export type SpeakOpts = { rate?: number; pitch?: number; voiceId?: string };

let token = 0;           // 每次播放的唯一標記
let lastPress = 0;       // 用於節流
let lastText = '';       // 避免同一文字被短時間連播

/** 單次播放：自帶停止上一次 + 節流 + iOS 安全延遲 */
export async function speakOneShot(text: string, opts: SpeakOpts = {}) {
  const now = Date.now();
  if (text === lastText && now - lastPress < 500) return; // 500ms 內重按同一段，忽略
  lastPress = now;
  lastText = text;

  // 停掉任何正在播放
  try { Speech.stop(); } catch {}

  // 🔑 避免 stop 之後 iOS 立即 speak 會偶爾重播：小延遲
  await new Promise((r) => setTimeout(r, 80));

  const my = ++token;

  try {
    Speech.speak(text, {
      language: 'ja-JP',
      voice: opts.voiceId,
      rate: opts.rate ?? 1.0,
      pitch: opts.pitch ?? 1.0,
      onDone: () => { /* no-op */ },
      onStopped: () => { /* no-op */ },
      onError: () => { /* no-op */ },
    });
  } catch {
    // 忽略
  }

  // 若之後又有新 token，被覆蓋的這次自然失效
}

/** 強制停止當前播放 */
export function stopSpeak() {
  try { Speech.stop(); } finally { token++; }
}
