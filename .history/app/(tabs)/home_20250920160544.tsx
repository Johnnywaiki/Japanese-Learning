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

const LEVEL_KEY = 'user.level'; // string: N1..N5
const PICK_KEY = 'user.pick';   // 'grammar' | 'vocab'

// unlocked 以「每個 level + category」獨立計算，key: progress.unlockedWeek.<level>.<category>
// value: number (1..10)
const unlockedKey = (level: Level, cat: Category) =>
  `progress.unlockedWeek.${level}.${cat}`;

// 完成記錄：用 set-like 結構，key: progress.completed
// value: string[] of tokens: `${level}|${category}|${week}|${day}`
const COMPLETED_KEY = 'progress.completed';

type IconSpec = { key: `day${1|2|3|4|5|6|7}`, lib: 'mci' | 'fa5', name: string };

// 7 顆 icon（你指定嘅序）
const ICONS: IconSpec[] = [
  { key: 'day1', lib: 'mci', name: 'flower' },
  { key: 'day2', lib: 'mci', name: 'leaf' },
  { key: 'day3', lib: 'fa5', name: 'torii-gate' },
  { key: 'day4', lib: 'mci', name: 'rice' },
  { key: 'day5', lib: 'mci', name: 'noodles' },
  { key: 'day6', lib: 'mci', name: 'airplane' },
  { key: 'day7', lib: 'fa5', name: 'train' },
];

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
    // 狀態色
    done: '#22c55e',     // 綠：完成
    pending: '#cbd5e1',  // 灰：未做
    accent: isDark ? '#93c5fd' : '#2563eb', // Level/選擇高亮
  };

  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    wrap: { flexGrow: 1, padding: 16, gap: 16 },

    // 頂部：Level 選擇（大格仔）
    levelWrap: { flexDirection: 'row', gap: 8 },
    levelTile: {
      flex: 1,
      paddingVertical: 16,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    levelTileActive: {
      borderColor: C.accent,
      backgroundColor: isDark ? '#0f172a' : '#eef2ff',
    },
    levelText: { fontSize: 16, fontWeight: '800', color: C.text },

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
      backgroundColor: isDark ? '#111827' : '#f5faff',
    },
    bigBtnText: { fontSize: 16, fontWeight: '700', color: C.text },

    // 卡片
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
    progressText: { fontSize: 13, color: C.soft },

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

    hint: { color: C.soft },
    topLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    topLeft: { gap: 4 },
    topRight: { alignItems: 'flex-end' },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
    },
    badgeText: { fontSize: 12, color: C.soft },
  });

  return { s, C };
}

// ---------- Helpers (Storage) ----------
async function getUnlockedWeek(level: Level, cat: Category): Promise<number> {
  const val = await AsyncStorage.getItem(unlockedKey(level, cat));
  const n = Math.min(Math.max(1, Number(val ?? '1') || 1), 10);
  return n;
}

async function setUnlockedWeek(level: Level, cat: Category, week: number) {
  await AsyncStorage.setItem(unlockedKey(level, cat), String(week));
}

// 完成 token
const tokenOf = (lv: Level, cat: Category, week: number, day: number) =>
  `${lv}|${cat}|${week}|${day}`;

async function getCompletedSet(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(COMPLETED_KEY);
  if (!raw) return new Set();
  try {
    const arr: string[] = JSON.parse(raw);
    return new Set(arr);
  } catch {
    return new Set();
  }
}

async function saveCompletedSet(set: Set<string>) {
  await AsyncStorage.setItem(COMPLETED_KEY, JSON.stringify(Array.from(set)));
}

// 對外暴露：讓 practice 完成後呼叫，標記完成 & 可能解鎖下一週
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

  // 如果該週 7 粒都完成 → 解鎖下一週
  const allDaysDone = Array.from({ length: 7 }, (_, i) => i + 1).every((d) =>
    set.has(tokenOf(level, category, week, d))
  );
  const curUnlocked = await getUnlockedWeek(level, category);
  if (allDaysDone && week >= curUnlocked && week < 10) {
    await setUnlockedWeek(level, category, week + 1);
  }
}

// ---------- Icons ----------
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

    const bgColor = !unlocked ? C.lockedCard : isDone ? undefined : undefined;
    const borderColor = !unlocked ? C.lockedCard : undefined;
    const iconColor = !unlocked ? C.lockedText : isDone ? C.done : C.pending;

    const baseStyle = [
      s.pill,
      !unlocked && s.pillLocked,
      bgColor && { backgroundColor: bgColor },
      borderColor && { borderColor },
    ];

    // 未解鎖週完全唔可按；已解鎖可以按 → 去練習
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
    <RNView
      pointerEvents={unlocked ? 'auto' : 'none'}
      style={[s.card, !unlocked && s.cardLocked]}
    >
      <RNView style={s.cardHeader}>
        <RNText style={s.cardTitle}>第 {week} 週</RNText>
        <RNView style={s.badge}>
          <RNText style={s.badgeText}>
            {doneCount}/7
          </RNText>
        </RNView>
      </RNView>

      <RNView style={s.snakeWrap}>
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
  const [unlocked, setUnlocked] = useState<number>(1); // current Level+Category 的解鎖週
  const [completedSet, setCompletedSet] = useState<Set<string>>(new Set());

  // 初始讀取：level、pick、進度
  useEffect(() => {
    (async () => {
      const lvRaw = (await AsyncStorage.getItem(LEVEL_KEY)) as Level | null;
      const pkRaw = (await AsyncStorage.getItem(PICK_KEY)) as Category | null;

      setLevel(lvRaw ?? 'N2'); // 預設 N2
      setPick(pkRaw ?? 'grammar'); // 預設 grammar

      const lv = (lvRaw ?? 'N2') as Level;
      const cat = (pkRaw ?? 'grammar') as Category;
      setUnlocked(await getUnlockedWeek(lv, cat));

      setCompletedSet(await getCompletedSet());
    })();
  }, []);

  // 每當 level / pick 變 → 讀對應解鎖週
  useEffect(() => {
    (async () => {
      if (!level || !pick) return;
      setUnlocked(await getUnlockedWeek(level, pick));
    })();
  }, [level, pick]);

  // Level 選擇（大格仔）
  const selectLevel = useCallback(async (lv: Level) => {
    setLevel(lv);
    await AsyncStorage.setItem(LEVEL_KEY, lv);
    if (pick) setUnlocked(await getUnlockedWeek(lv, pick));
  }, [pick]);

  // 選擇類別
  const selectPick = useCallback(async (cat: Category) => {
    setPick(cat);
    await AsyncStorage.setItem(PICK_KEY, cat);
    if (level) setUnlocked(await getUnlockedWeek(level, cat));
  }, [level]);

  // 按某粒 day → 直入練習（帶上 level/category/week/day）
  const onPickDay = useCallback(
    async (week: number, dayIndex: number) => {
      if (!level) { Alert.alert('請先揀 Level', '例如 N2'); return; }
      if (!pick) { Alert.alert('請先選範疇', '請揀「文法」或「字彙」'); return; }

      await useQuiz.getState().init({
        level,                 // 'N1' | ... （你 practice 內部使用）
        kind: 'language',      // 你現時 practice 用嘅 kind
        extra: {
          level,
          category: pick,
          week,                // 1..10
          day: dayIndex + 1,   // 1..7
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
      {/* 頂部：Level 大格仔 */}
      <RNView style={s.topLine}>
        <RNView style={s.topLeft}>
          <RNText style={{ fontSize: 18, fontWeight: '800', color: C.text }}>
            Level
          </RNText>
          <RNText style={s.hint}>完成該週全部 7 題會自動解鎖下一週</RNText>
        </RNView>
        {level && pick && (
          <RNView style={s.topRight}>
            <RNView style={s.badge}>
              <RNText style={s.badgeText}>
                目前：{level}／{pick === 'grammar' ? '文法' : '字彙'}／解鎖至 第 {unlocked} 週
              </RNText>
            </RNView>
          </RNView>
        )}
      </RNView>

      <RNView style={s.levelWrap}>
        {LEVELS.map((lv) => (
          <RNPressable
            key={lv}
            onPress={() => selectLevel(lv)}
            style={({ pressed }) => [
              s.levelTile,
              level === lv && s.levelTileActive,
              pressed && { opacity: 0.85 },
            ]}
          >
            <RNText style={s.levelText}>{lv}</RNText>
          </RNPressable>
        ))}
      </RNView>

      {/* 類別兩大掣（文法 / 字彙） */}
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

      {/* 每週卡片（按粒日 icon → 入練習） */}
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
