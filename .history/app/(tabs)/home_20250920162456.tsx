// app/(tabs)/home.tsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View as RNView,
  Text as RNText,
  Pressable as RNPressable,
  StyleSheet,
  useColorScheme,
  Alert,
  ScrollView as RNScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useQuiz } from '../../src/store/useQuiz';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';

// ---------- Keys & Types ----------
const LEVELS = ['N1', 'N2', 'N3', 'N4', 'N5'] as const;
type Level = typeof LEVELS[number];
type Category = 'grammar' | 'vocab';

const LEVEL_KEY = 'user.level'; // string: N1..N5（由開頭頁設定）
const PICK_KEY = 'user.pick';   // 'grammar' | 'vocab'

// 每個 level+category 獨立解鎖週
const unlockedKey = (level: Level, cat: Category) =>
  `progress.unlockedWeek.${level}.${cat}`;

// 完成記錄（像 set）
const COMPLETED_KEY = 'progress.completed'; // string[]: `${level}|${category}|${week}|${day}`

// 7 顆 icon（已按你之前指定與命名 day1~day7）
const ICONS = [
  { key: 'day1', lib: 'mci', name: 'flower' },
  { key: 'day2', lib: 'mci', name: 'leaf' },
  { key: 'day3', lib: 'fa5', name: 'torii-gate' },
  { key: 'day4', lib: 'mci', name: 'rice' },
  { key: 'day5', lib: 'mci', name: 'noodles' },
  { key: 'day6', lib: 'mci', name: 'airplane' },
  { key: 'day7', lib: 'fa5', name: 'train' },
] as const;

type IconSpec = typeof ICONS[number];

// ---------- Theme ----------
function makeStyles(isDark: boolean) {
  const C = {
    bg: isDark ? '#0b0b0b' : '#ffffff',
    text: isDark ? '#f3f4f6' : '#111827',
    soft: isDark ? '#9ca3af' : '#6b7280',
    card: isDark ? '#141414' : '#ffffff',
    border: isDark ? '#222' : '#e5e7eb',
    lockedCard: isDark ? '#1a1a1a' : '#f3f4f6',
    lockedText: isDark ? '#6b7280' : '#9aa0a6',
    badgeBg: isDark ? '#0f172a' : '#eef2ff',
    done: '#22c55e',    // 綠：完成
    pending: '#cbd5e1', // 灰：未做
    accent: isDark ? '#93c5fd' : '#2563eb',
  };

  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    wrap: { flexGrow: 1, padding: 16, gap: 16 },

    // 頂部：只顯示當前 Level（大 Badge）
    levelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    levelBadge: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: C.badgeBg,
      borderWidth: 1,
      borderColor: C.accent,
    },
    levelBadgeText: { fontSize: 16, fontWeight: '900', color: C.accent },

    // 類別兩大掣
    row: { flexDirection: 'row', gap: 12 },
    bigBtn: {
      flex: 1,
      paddingVertical: 18,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bigBtnActive: {
      borderColor: C.accent,
      backgroundColor: C.badgeBg,
    },
    bigBtnText: { fontSize: 16, fontWeight: '700', color: C.text },

    // 週卡
    card: {
      marginTop: 8,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
    },
    cardLocked: { backgroundColor: C.lockedCard, borderColor: C.lockedCard },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    cardTitle: { fontSize: 16, fontWeight: '800', color: C.text },

    // 進度徽章
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
    },
    badgeText: { fontSize: 12, color: C.soft },

    // 七粒大圓（蛇形）
    snakeWrap: { flexDirection: 'row', justifyContent: 'space-between' },
    col: { width: '48%' },
    offset: { marginTop: 36 },
    pill: {
      height: 72,
      borderRadius: 36,
      borderWidth: 2,
      borderColor: C.border,
      backgroundColor: C.card,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    pillLocked: { backgroundColor: C.lockedCard, borderColor: C.lockedCard },
  });

  return { s, C };
}

// ---------- Storage helpers ----------
const unlockedKeyOf = (level: Level, cat: Category) => unlockedKey(level, cat);

async function getUnlockedWeek(level: Level, cat: Category): Promise<number> {
  const val = await AsyncStorage.getItem(unlockedKeyOf(level, cat));
  const n = Math.min(Math.max(1, Number(val ?? '1') || 1), 10);
  return n;
}
async function setUnlockedWeek(level: Level, cat: Category, week: number) {
  await AsyncStorage.setItem(unlockedKeyOf(level, cat), String(week));
}

const tokenOf = (lv: Level, cat: Category, week: number, day: number) =>
  `${lv}|${cat}|${week}|${day}`;

async function getCompletedSet(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(COMPLETED_KEY);
  if (!raw) return new Set();
  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}
async function saveCompletedSet(set: Set<string>) {
  await AsyncStorage.setItem(COMPLETED_KEY, JSON.stringify(Array.from(set)));
}

// 給 practice 用：標記完成 &（若7/7）解鎖下一週
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

  const allDaysDone = Array.from({ length: 7 }, (_, i) => i + 1).every((d) =>
    set.has(tokenOf(level, category, week, d))
  );
  const curUnlocked = await getUnlockedWeek(level, category);
  if (allDaysDone && week >= curUnlocked && week < 10) {
    await setUnlockedWeek(level, category, week + 1);
  }
}

// ---------- Icon render ----------
function IconRender({ spec, color }: { spec: IconSpec; color: string }) {
  if (spec.lib === 'mci') {
    return <MaterialCommunityIcons name={spec.name as any} size={28} color={color} />;
  }
  return <FontAwesome5 name={spec.name as any} size={24} color={color} solid />;
}

// ---------- Week Card ----------
type WeekCardProps = {
  level: Level;
  category: Category | null;
  week: number;
  unlocked: boolean;
  completedSet: Set<string>;
  onPickDay: (week: number, dayIndex: number) => void;
  s: ReturnType<typeof makeStyles>['s'];
  C: ReturnType<typeof makeStyles>['C'];
};

function WeekCard({
  level, category, week, unlocked, completedSet, onPickDay, s, C,
}: WeekCardProps) {
  const left = [0, 2, 4, 6].filter((i) => i < ICONS.length);
  const right = [1, 3, 5].filter((i) => i < ICONS.length);

  const Pill = (i: number) => {
    const day = i + 1;
    const isDone = category
      ? completedSet.has(tokenOf(level, category, week, day))
      : false;

    const iconColor = !unlocked ? C.lockedText : isDone ? C.done : C.pending;
    const baseStyle = [s.pill, !unlocked && s.pillLocked];

    if (!unlocked) {
      return (
        <RNView
          key={ICONS[i].key}
          style={baseStyle}
          testID={`pill-${ICONS[i].key}`}
          accessible
          accessibilityLabel={`${ICONS[i].key}-locked`}
        >
          <IconRender spec={ICONS[i]} color={iconColor} />
        </RNView>
      );
    }

    return (
      <RNPressable
        key={ICONS[i].key}
        onPress={() => onPickDay(week, i)}
        android_ripple={{ color: '#00000011', borderless: false }}
        style={({ pressed }) => [
          ...baseStyle,
          pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
        ]}
        testID={`pill-${ICONS[i].key}`}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${ICONS[i].key}`}
      >
        <IconRender spec={ICONS[i]} color={iconColor} />
      </RNPressable>
    );
  };

  const doneCount = category
    ? Array.from({ length: 7 }, (_, d) => d + 1).filter((d) =>
        completedSet.has(tokenOf(level, category, week, d))
      ).length
    : 0;

  return (
    <RNView pointerEvents={unlocked ? 'auto' : 'none'} style={[s.card, !unlocked && s.cardLocked]}>
      <RNView style={s.cardHeader}>
        <RNText style={s.cardTitle}>第 {week} 週</RNText>
        <RNView style={s.badge}>
          <RNText style={s.badgeText}>{doneCount}/7</RNText>
        </RNView>
      </RNView>

      <RNView style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <RNView style={s.col}>{left.map(Pill)}</RNView>
        <RNView style={[s.col, s.offset]}>{right.map(Pill)}</RNView>
      </RNView>
    </RNView>
  );
}

// ---------- Screen ----------
export default function HomeScreen() {
  const isDark = useColorScheme() === 'dark';
  const { s, C } = useMemo(() => makeStyles(isDark), [isDark]);

  const [level, setLevel] = useState<Level | null>(null);
  const [pick, setPick] = useState<Category | null>(null);
  const [unlocked, setUnlocked] = useState<number>(1);
  const [completedSet, setCompletedSet] = useState<Set<string>>(new Set());

  // 初始：讀 level（由開頭頁已寫好）、pick（若未有就預設 grammar）、進度、完成記錄
  useEffect(() => {
    (async () => {
      const lvRaw = (await AsyncStorage.getItem(LEVEL_KEY)) as Level | null;
      const pkRaw = (await AsyncStorage.getItem(PICK_KEY)) as Category | null;

      const lv = (lvRaw ?? 'N2') as Level;  // 顯示用
      const cat = (pkRaw ?? 'grammar') as Category;

      setLevel(lv);
      setPick(cat);
      setUnlocked(await getUnlockedWeek(lv, cat));
      setCompletedSet(await getCompletedSet());
    })();
  }, []);

  // 切換類別 → 重讀對應解鎖週
  const selectPick = useCallback(async (cat: Category) => {
    setPick(cat);
    await AsyncStorage.setItem(PICK_KEY, cat);
    if (!level) return;
    setUnlocked(await getUnlockedWeek(level, cat));
  }, [level]);

  // 按某粒日 → 入練習
  const onPickDay = useCallback(
    async (week: number, dayIndex: number) => {
      if (!level) { Alert.alert('尚未設定 Level', '請先回最初頁設定 Level'); return; }
      if (!pick) { Alert.alert('請先選範疇', '請揀「文法」或「字彙」'); return; }

      await useQuiz.getState().init({
        level,
        kind: 'language',
        extra: {
          level,
          category: pick,
          week,               // 1..10
          day: dayIndex + 1,  // 1..7
          dayKey: ICONS[dayIndex].key,
        },
      } as any);

      router.push('/(tabs)/practice');
    },
    [level, pick]
  );

  return (
    <RNScrollView
      style={s.screen}
      contentContainerStyle={[s.wrap, { paddingBottom: 40 }]}
      scrollEventThrottle={16}
      directionalLockEnabled
      showsVerticalScrollIndicator
      nestedScrollEnabled
    >
      {/* 只顯示當前 Level（由最初頁選擇） */}
      <RNView style={s.levelHeader}>
        <RNView>
          <RNText style={{ fontSize: 18, fontWeight: '800', color: C.text }}>學習進度</RNText>
          <RNText style={{ color: C.soft, marginTop: 4 }}>
            完成7個練習後自動解鎖下一週題目 
          </RNText>
        </RNView>
        <RNView style={s.levelBadge}>
          <RNText style={s.levelBadgeText}>
            Level：{level ?? '—'}
          </RNText>
        </RNView>
      </RNView>

      {/* 類別（文法／字彙） */}
      <RNView style={s.row}>
        <RNPressable
          onPress={() => selectPick('grammar')}
          style={({ pressed }) => [
            s.bigBtn,
            pick === 'grammar' && s.bigBtnActive,
            pressed && { opacity: 0.9 },
          ]}
        >
          <RNText style={s.bigBtnText}>文法</RNText>
        </RNPressable>
        <RNPressable
          onPress={() => selectPick('vocab')}
          style={({ pressed }) => [
            s.bigBtn,
            pick === 'vocab' && s.bigBtnActive,
            pressed && { opacity: 0.9 },
          ]}
        >
          <RNText style={s.bigBtnText}>字彙</RNText>
        </RNPressable>
      </RNView>

      {/* 週卡（未解鎖灰、不可按；已解鎖可按日 icon） */}
      {Array.from({ length: 10 }, (_, i) => i + 1).map((week) => (
        <WeekCard
          key={week}
          level={(level ?? 'N2') as Level}
          category={pick}
          week={week}
          unlocked={week <= unlocked}
          completedSet={completedSet}
          onPickDay={onPickDay}
          s={s}
          C={C}
        />
      ))}
    </RNScrollView>
  );
}
