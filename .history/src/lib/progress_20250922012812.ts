// src/lib/progress.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export const LEVELS = ['N1','N2','N3','N4','N5'] as const;
export type Level = typeof LEVELS[number];
export type Category = 'grammar' | 'vocab';

const PICK_KEY   = 'user.pick';          // 可選：保存用戶最後一次選擇
const LEVEL_KEY  = 'user.level';         // 可選：保存用戶 Level

// 每個 level + category 各自一條解鎖線
const unlockedKey = (level: Level, cat: Category) => `progress.unlockedWeek.${level}.${cat}`;

// 完成紀錄（像 set）：`${level}|${category}|${week}|${day}`
const COMPLETED_KEY = 'progress.completed';

// 組 daily_key：N2-GRAMMAR-0001 / N2-VOCAB-0001
export function dailyKeyOf(level: Level, cat: Category, week: number, day: number) {
  const idx = (week - 1) * 7 + day; // 1-based
  const catUpper = cat === 'grammar' ? 'GRAMMAR' : 'VOCAB';
  return `${level}-${catUpper}-${String(idx).padStart(4, '0')}`;
}

export async function getUnlockedWeek(level: Level, cat: Category): Promise<number> {
  const val = await AsyncStorage.getItem(unlockedKey(level, cat));
  const n = Math.min(Math.max(1, Number(val ?? '1') || 1), 10);
  return n;
}
export async function setUnlockedWeek(level: Level, cat: Category, week: number) {
  await AsyncStorage.setItem(unlockedKey(level, cat), String(week));
}

const tokenOf = (lv: Level, cat: Category, week: number, day: number) =>
  `${lv}|${cat}|${week}|${day}`;

export async function getCompletedSet(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(COMPLETED_KEY);
  if (!raw) return new Set();
  try { return new Set(JSON.parse(raw) as string[]); } catch { return new Set(); }
}
async function saveCompletedSet(set: Set<string>) {
  await AsyncStorage.setItem(COMPLETED_KEY, JSON.stringify(Array.from(set)));
}

/** ✅ 練完某日後呼叫：標記完成；如該週 7/7，解鎖下一週 */
export async function markPracticeDone(params: {
  level: Level; category: Category; week: number; day: number; // day: 1..7
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

// （可選）暴露出來俾其他頁用
export { PICK_KEY, LEVEL_KEY, COMPLETED_KEY };
