// src/tts/index.ts
import * as Speech from 'expo-speech';
export type SpeakOpts = { rate?: number; pitch?: number; voiceId?: string };

let lastPress = 0;

export async function speakOneShot(text: string, opts: SpeakOpts = {}) {
  const now = Date.now();
  if (now - lastPress < 500) return; // 節流：半秒內重按忽略
  lastPress = now;
  try { Speech.stop(); } catch {}
  await new Promise(r => setTimeout(r, 80)); // iOS 停播後稍等，避免雙播
  Speech.speak(text, {
    language: 'ja-JP',
    rate: opts.rate ?? 1.0,
    pitch: opts.pitch ?? 1.0,
    voice: opts.voiceId,
  });
}

export function stopSpeak() {
  try { Speech.stop(); } catch {}
}
