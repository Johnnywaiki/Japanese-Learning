// src/store/useProgressBus.ts
import { create } from 'zustand';

type Bus = {
  /** 改變一次就 +1，用嚟通知有更新（例如完成每日題目） */
  value: number;
  /** 發送一個「有更新」事件（Home 會監聽住 value） */
  bump: () => void;
  /** 可選：重置 */
  reset: () => void;
};

export const useProgressBus = create<Bus>((set, get) => ({
  value: 0,
  bump: () => set({ value: get().value + 1 }),
  reset: () => set({ value: 0 }),
}));
