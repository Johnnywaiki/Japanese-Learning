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
import { useFocusEffect } from 'expo-router';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';

import {
  LEVELS, type Level, type Category,
  LEVEL_KEY, PICK_KEY,
  getUnlockedWeek, getCompletedSet, dailyKeyOf,
} from '../../src/lib/progress';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuiz } from '../../src/store/useQuiz';

// 7 顆 icon
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

// Theme
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
    done: '#22c55e',
    pending: '#cbd5e1',
    accent: isDark ? '#93c5fd' : '#2563eb',
    dropdownBg: isDark ? '#0f172a' : '#ffffff',
    dropdownBorder: isDark ? '#1f2937' : '#e5e7eb',
    dropdownItemActiveBg: isDark ? '#111827' : '#f3f4f6',
    // 新增：可做橙、白色
    can: '#f59e0b',
    white: '#ffffff',
  };

  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    wrap: { flexGrow: 1, padding: 16, gap: 16, overflow: 'visible' },

    levelHeaderStack: { position: 'relative', zIndex: 1000, elevation: 1000 },
    levelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    levelBadge: {
      paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
      backgroundColor: C.badgeBg, borderWidth: 1, borderColor: C.accent,
    },
    levelBadgeText: { fontSize: 16, fontWeight: '900', color: C.accent },

    backdrop: { ...StyleSheet.absoluteFillObject, zIndex: 1001 },
    dropdown: {
      position: 'absolute', right: 0, top: 52, width: 160,
      backgroundColor: C.dropdownBg, borderWidth: 1, borderColor: C.dropdownBorder,
      borderRadius: 12, overflow: 'hidden', zIndex: 1002, elevation: 20,
      shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    },
    ddItem: {
      paddingVertical: 12, paddingHorizontal: 14,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    ddItemText: { fontSize: 15, color: C.text, fontWeight: '700' },

    row: { flexDirection: 'row', gap: 12, zIndex: 0 },
    bigBtn: {
      flex: 1, paddingVertical: 18, borderRadius: 12, borderWidth: 1, borderColor: C.border,
      backgroundColor: C.card, alignItems: 'center', justifyContent: 'center',
    },
    bigBtnActive: { borderColor: C.accent, backgroundColor: C.badgeBg },
    bigBtnText: { fontSize: 16, fontWeight: '700', color: C.text },

    card: { marginTop: 8, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, zIndex: 0 },
    cardLocked: { backgroundColor: C.lockedCard, borderColor: C.lockedCard },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    cardTitle: { fontSize: 16, fontWeight: '800', color: C.text },

    badge: {
      paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
      borderWidth: 1, borderColor: C.border, backgroundColor: isDark ? '#0f172a' : '#f8fafc',
    },
    badgeText: { fontSize: 12, color: C.soft },

    snakeWrap: { flexDirection: 'row', justifyContent: 'space-between' },
    col: { width: '48%' },
    offset: { marginTop: 36 },
    pill: {
      height: 72, borderRadius: 36, borderWidth: 2, borderColor: C.border,
      backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    },
    pillLocked: { backgroundColor: C.lockedCard, borderColor: C.lockedCard },
  });

  return { s, C };
}

// ---------- Icons ----------
function IconRender({ spec, color }: { spec: IconSpec; color: string }) {
  if (spec.lib === 'mci') return <MaterialCommunityIcons name={spec.name as any} size={28} color={color} />;
  return <FontAwesome5 name={spec.name as any} size={24} color={color} solid />;
}

// ---------- Week Card ----------
const tokenOf = (lv: Level, cat: Category, week: number, day: number) =>
  `${lv}|${cat}|${week}|${day}`;

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

  // 該週各日完成情況：done[1..7] => boolean
  const done: Record<number, boolean> = useMemo(() => {
    const m: Record<number, boolean> = {};
    for (let d = 1; d <= 7; d++) {
      const t = category ? tokenOf(level, category, week, d) : '';
      m[d] = !!(category && completedSet.has(t));
    }
    return m;
  }, [level, category, week, completedSet]);

  // 計算「可做」集合：
  // 1) 週未解鎖 -> 無任何可做
  // 2) 若 day1 & day2 未同時完成 -> 同時開放未完成的 day1 / day2
  // 3) 若 day1 & day2 都完成 -> 從 day3 起按順序逐日解鎖（永遠只有一顆可做）
  const canDoSet = useMemo(() => {
    const set = new Set<number>();
    if (!unlocked || !category) return set;

    const d1 = done[1], d2 = done[2];

    if (!(d1 && d2)) {
      if (!d1) set.add(1);
      if (!d2) set.add(2);
      return set;
    }

    for (let d = 3; d <= 7; d++) {
      if (!done[d]) { set.add(d); break; }
    }
    return set;
  }, [unlocked, category, done]);

  // 已完成數
  const doneCount = useMemo(
    () => (category ? Array.from({ length: 7 }, (_, i) => i + 1).filter((d) => done[d]).length : 0),
    [category, done]
  );

  // 產生 Pill
  const Pill = (i: number) => {
    const day = i + 1;

    // 週未解鎖 -> 鎖定（灰）
    if (!unlocked || !category) {
      return (
        <RNView key={ICONS[i].key} style={[s.pill, s.pillLocked]}>
          <IconRender spec={ICONS[i]} color={C.lockedText} />
        </RNView>
      );
    }

    const isDone = done[day];
    const isCan = canDoSet.has(day);
    const isLocked = !isDone && !isCan;

    // 背景 & 邊框 & icon 顏色
    const bgStyle = isDone
      ? { backgroundColor: C.done, borderColor: C.done }
      : isCan
        ? { backgroundColor: C.can, borderColor: C.can }
        : { backgroundColor: C.lockedCard, borderColor: C.lockedCard };

    const iconColor = isDone || isCan ? C.white : C.lockedText;

    const handlePress = () => {
      if (isLocked) {
        Alert.alert('請先完成未完成題目', '請依次序完成目前可做的練習，之後會自動解鎖下一日。');
        return;
      }
      onPickDay(week, i);
    };

    return (
      <RNPressable
        key={ICONS[i].key}
        onPress={handlePress}
        android_ripple={{ color: '#00000011', borderless: false }}
        style={({ pressed }) => [s.pill, bgStyle, pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 }]}
      >
        <IconRender spec={ICONS[i]} color={iconColor} />
      </RNPressable>
    );
  };

  return (
    <RNView style={[s.card, !unlocked && s.cardLocked]}>
      <RNView style={s.cardHeader}>
        <RNText style={s.cardTitle}>第 {week} 週</RNText>
        <RNView style={s.badge}><RNText style={s.badgeText}>{doneCount}/7</RNText></RNView>
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
  const [showLevelMenu, setShowLevelMenu] = useState(false);

  // 初始：讀 level、pick、解鎖週、完成記錄
  useEffect(() => {
    (async () => {
      const lvRaw = (await AsyncStorage.getItem(LEVEL_KEY)) as Level | null;
      const pkRaw = (await AsyncStorage.getItem(PICK_KEY)) as Category | null;

      const lv = (lvRaw ?? 'N2') as Level;
      const cat = (pkRaw ?? 'grammar') as Category;

      setLevel(lv);
      setPick(cat);
      setUnlocked(await getUnlockedWeek(lv, cat));
      setCompletedSet(await getCompletedSet());
    })();
  }, []);

  // 回到 Home 時，重新撈最新進度（顏色/解鎖即時更新）
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        if (level && pick) {
          const [u, set] = await Promise.all([
            getUnlockedWeek(level, pick),
            getCompletedSet(),
          ]);
          if (alive) {
            setUnlocked(u);
            setCompletedSet(set);
          }
        }
      })();
      return () => { alive = false; };
    }, [level, pick])
  );

  const selectPick = useCallback(async (cat: Category) => {
    setPick(cat);
    await AsyncStorage.setItem(PICK_KEY, cat);
    if (!level) return;
    setUnlocked(await getUnlockedWeek(level, cat));
  }, [level]);

  const selectLevel = useCallback(async (lv: Level) => {
    setLevel(lv);
    await AsyncStorage.setItem(LEVEL_KEY, lv);
    if (pick) setUnlocked(await getUnlockedWeek(lv, pick));
    setShowLevelMenu(false);
  }, [pick]);

  // 按某粒日 → 入練習（daily 模式）
  const onPickDay = useCallback(
    async (week: number, dayIndex: number) => {
      if (!level) { Alert.alert('尚未設定 Level', '請先回最初頁設定 Level'); return; }
      if (!pick)  { Alert.alert('請先選範疇',   '請揀「文法」或「字彙」'); return; }

      const day = dayIndex + 1;
      const daily_key = dailyKeyOf(level, pick, week, day);

      await useQuiz.getState().init({
        daily_key,
        level,
        kind: 'language',
        extra: { level, category: pick, week, day, dayKey: ICONS[dayIndex].key },
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
      {/* Level Header + Dropdown */}
      <RNView style={s.levelHeaderStack}>
        <RNView style={s.levelHeader}>
          <RNView>
            <RNText style={{ fontSize: 18, fontWeight: '800', color: C.text }}>學習進度</RNText>
            <RNText style={{ color: C.soft, marginTop: 4 }}>完成7個練習後自動解鎖下一週題目</RNText>
          </RNView>

          <RNPressable
            onPress={() => setShowLevelMenu(v => !v)}
            style={({ pressed }) => [s.levelBadge, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
            accessibilityRole="button"
            accessibilityLabel="切換 Level"
          >
            <RNText style={s.levelBadgeText}>Level：{level ?? '—'}</RNText>
          </RNPressable>
        </RNView>

        {showLevelMenu && (
          <>
            <RNPressable style={s.backdrop} onPress={() => setShowLevelMenu(false)} />
            <RNView style={s.dropdown} pointerEvents="box-none">
              {LEVELS.map((lv) => {
                const active = lv === level;
                return (
                  <RNPressable
                    key={lv}
                    onPress={() => selectLevel(lv)}
                    style={({ pressed }) => [
                      { paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between' },
                      (active || pressed) && { backgroundColor: C.dropdownItemActiveBg },
                    ]}
                  >
                    <RNText style={{ fontSize: 15, color: C.text, fontWeight: '700' }}>{lv}</RNText>
                    {active && <MaterialCommunityIcons name="check" size={18} color={C.accent} />}
                  </RNPressable>
                );
              })}
            </RNView>
          </>
        )}
      </RNView>

      {/* 類別（文法／字彙） */}
      <RNView style={{ flexDirection: 'row', gap: 12 }}>
        <RNPressable onPress={() => selectPick('grammar')}
          style={({ pressed }) => [s.bigBtn, pick === 'grammar' && s.bigBtnActive, pressed && { opacity: 0.9 }]}>
          <RNText style={s.bigBtnText}>文法</RNText>
        </RNPressable>
        <RNPressable onPress={() => selectPick('vocab')}
          style={({ pressed }) => [s.bigBtn, pick === 'vocab' && s.bigBtnActive, pressed && { opacity: 0.9 }]}>
          <RNText style={s.bigBtnText}>字彙</RNText>
        </RNPressable>
      </RNView>

      {/* 週卡 */}
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
