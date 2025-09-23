// src/lib/progress.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Level = 'N1' | 'N2' | 'N3' | 'N4' | 'N5';
export type Category = 'grammar' | 'vocab';

export const LEVEL_KEY = 'user.level';
export const PICK_KEY = 'user.pick';
const COMPLETED_KEY = 'progress.completed'; // string[] tokens
const unlockedKey = (level: Level, cat: Category) =>
  `progress.unlockedWeek.${level}.${cat}`;

export const tokenOf = (lv: Level, cat: Category, week: number, day: number) =>
  `${lv}|${cat}|${week}|${day}`;

export async function getUnlockedWeek(level: Level, cat: Category): Promise<number> {
  const val = await AsyncStorage.getItem(unlockedKey(level, cat));
  const n = Math.min(Math.max(1, Number(val ?? '1') || 1), 10);
  return n;
}
export async function setUnlockedWeek(level: Level, cat: Category, week: number) {
  await AsyncStorage.setItem(unlockedKey(level, cat), String(week));
}

export async function getCompletedSet(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(COMPLETED_KEY);
  if (!raw) return new Set();
  try { return new Set(JSON.parse(raw) as string[]); } catch { return new Set(); }
}
export async function saveCompletedSet(set: Set<string>) {
  await AsyncStorage.setItem(COMPLETED_KEY, JSON.stringify(Array.from(set)));
}

/** 每日題完成：標記某日、若 7/7 就解鎖下一週 */
export async function markPracticeDone(params: {
  level: Level;
  category: Category;
  week: number; // 1..10
  day: number;  // 1..7
}) {
  const { level, category, week, day } = params;
  const set = await getCompletedSet();
  set.add(tokenOf(level, category, week, day));
  await saveCompletedSet(set);

  const allDaysDone = Array.from({ length: 7 }, (_, i) => i + 1)
    .every((d) => set.has(tokenOf(level, category, week, d)));

  const curUnlocked = await getUnlockedWeek(level, category);
  if (allDaysDone && week >= curUnlocked && week < 10) {
    await setUnlockedWeek(level, category, week + 1);
  }
}
