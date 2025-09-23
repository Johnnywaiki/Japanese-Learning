// src/store/useProgressBus.ts
import { create } from 'zustand';

/** 簡單事件 bus：凡 bump() 一次，訂閱咗 ver 嘅畫面就可以做 re-fetch。 */
type Bus = {
  ver: number;
  bump: () => void;
};
export const useProgressBus = create<Bus>((set) => ({
  ver: 0,
  bump: () => set((s) => ({ ver: s.ver + 1 })),
}));
