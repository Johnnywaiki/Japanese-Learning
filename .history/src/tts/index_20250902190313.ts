// src/tts/index.ts
import * as Speech from 'expo-speech';

export type SpeakOpts = { rate?: number; pitch?: number; voiceId?: string };

export async function pickJaVoiceId(): Promise<string | undefined> {
  try {
    const voices = await Speech.getAvailableVoicesAsync?.();
    const ja = voices?.filter(v => (v.language?.toLowerCase() ?? '').startsWith('ja'));
    return ja && ja.length > 0 ? ja[0].identifier : undefined;
  } catch {
    return undefined;
  }
}

export async function speakJa(text: string, opts: SpeakOpts = {}) {
  try {
    Speech.stop();
    const voice = opts.voiceId ?? (await pickJaVoiceId());
    Speech.speak(text, {
      language: 'ja-JP',
      voice,
      rate: opts.rate ?? 1.0,
      pitch: opts.pitch ?? 1.0,
    });
  } catch {}
}

export function stopSpeak() {
  Speech.stop();
}
