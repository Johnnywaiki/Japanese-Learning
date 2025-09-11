// src/store/useSettings.ts
import { create } from 'zustand';

type State = {
  autoSpeak: boolean;
  rate: number;   // 0.5 ~ 2.0（平台依實作）
  pitch: number;  // 0.5 ~ 2.0
  voiceId?: string;
  setAutoSpeak: (b: boolean) => void;
  setRate: (n: number) => void;
  setPitch: (n: number) => void;
  setVoiceId: (id?: string) => void;
};

export const useSettings = create<State>((set) => ({
  autoSpeak: true,
  rate: 1.0,
  pitch: 1.0,
  voiceId: undefined,
  setAutoSpeak: (b) => set({ autoSpeak: b }),
  setRate: (n) => set({ rate: n }),
  setPitch: (n) => set({ pitch: n }),
  setVoiceId: (id) => set({ voiceId: id }),
}));
