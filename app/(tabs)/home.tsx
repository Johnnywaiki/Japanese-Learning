// app/(tabs)/home.tsx
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View as RNView,
  Text as RNText,
  Pressable as RNPressable,
  StyleSheet,
  useColorScheme,
  Alert,
  ScrollView as RNScrollView,
  LayoutChangeEvent,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';
import { useQuiz } from '../../src/store/useQuiz';
import {
  LEVEL_KEY, PICK_KEY,
  getUnlockedWeek, getCompletedSet, tokenOf,
  type Level, type Category,
} from '../../src/lib/progress';
import { useProgressBus } from '../../src/store/useProgressBus';

const LEVELS = ['N1','N2','N3','N4','N5'] as const;
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
    doneBg: '#22c55e',
    doneIcon: '#ffffff',
    availBg: '#f59e0b',
    availIcon: '#ffffff',
    lockBg: isDark ? '#1f2937' : '#e5e7eb',
    lockIcon: isDark ? '#6b7280' : '#9aa0a6',
    accent: isDark ? '#93c5fd' : '#2563eb',
    dropdownBg: isDark ? '#0f172a' : '#ffffff',
    dropdownBorder: isDark ? '#1f2937' : '#e5e7eb',
    dropdownItemActiveBg: isDark ? '#111827' : '#f3f4f6',
    shadowColor: '#000',
  };
  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    wrap: { flexGrow: 1, padding: 16, gap: 16, overflow: 'visible' },

    levelHeaderStack: { position: 'relative', zIndex: 1000, elevation: 1000 },
    levelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    levelBadge: {
      paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
      backgroundColor: C.badgeBg, borderWidth: 1, borderColor: C.accent,
      shadowColor: C.shadowColor, shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 4 }, elevation: 3,
    },
    levelBadgeText: { fontSize: 16, fontWeight: '900', color: C.accent },

    backdrop: { ...StyleSheet.absoluteFillObject, zIndex: 1001 },
    dropdown: {
      position: 'absolute', right: 0, top: 52, width: 160,
      backgroundColor: C.dropdownBg, borderWidth: 1, borderColor: C.dropdownBorder,
      borderRadius: 12, overflow: 'hidden', zIndex: 1002, elevation: 20,
      shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    },
    ddItem: { paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    ddItemText: { fontSize: 15, color: C.text, fontWeight: '700' },

    row: { flexDirection: 'row', gap: 12, zIndex: 0 },

    bigBtn: {
      flex: 1, paddingVertical: 18, borderRadius: 16, borderWidth: 1.5, borderColor: C.border,
      backgroundColor: C.card, alignItems: 'center', justifyContent: 'center',
      shadowColor: C.shadowColor, shadowOpacity: 0.20, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6,
    },
    bigBtnActive: { borderColor: C.accent, backgroundColor: C.badgeBg },
    bigBtnText: { fontSize: 16, fontWeight: '800', color: C.text, letterSpacing: 0.3 },

    card: {
      marginTop: 8, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, zIndex: 0,
      shadowColor: C.shadowColor, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 6 }, elevation: 4,
    },
    cardLocked: { backgroundColor: C.lockedCard, borderColor: C.lockedCard, shadowOpacity: 0.05, elevation: 1 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    unlockTag: {
      paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1,
      borderColor: C.border, backgroundColor: isDark ? '#0f172a' : '#f8fafc',
    },
    unlockTagText: { fontSize: 12, fontWeight: '700', color: C.soft },

    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: isDark ? '#0f172a' : '#f8fafc' },
    badgeText: { fontSize: 12, color: C.soft, fontWeight: '700' },

    snakeWrap: { flexDirection: 'row', justifyContent: 'space-between' },
    col: { width: '48%' },
    offset: { marginTop: 36 },

    pill: {
      height: 72, borderRadius: 36, borderWidth: 2, borderColor: C.border, backgroundColor: C.card,
      alignItems: 'center', justifyContent: 'center', marginBottom: 12,
      shadowColor: C.shadowColor, shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 6 }, elevation: 4,
    },
  });
  return { s, C };
}

function IconRender({ spec, color }: { spec: IconSpec; color: string }) {
  if (spec.lib === 'mci') return <MaterialCommunityIcons name={spec.name as any} size={28} color={color} />;
  return <FontAwesome5 name={spec.name as any} size={24} color={color} solid />;
}

type DayStatus = 'done' | 'available' | 'locked';

/** 單日解鎖；「第 1 週」初次兩粒橙（day1 & day2） */
function computeDayStatuses(params: {
  level: Level;
  category: Category | null;
  week: number;
  unlockedWeek: number;
  completedSet: Set<string>;
}): DayStatus[] {
  const { level, category, week, unlockedWeek, completedSet } = params;
  const res: DayStatus[] = Array(7).fill('locked');
  if (!category || week > unlockedWeek) return res;

  const isDone = (d: number) => completedSet.has(tokenOf(level, category, week, d));

  for (let d = 1; d <= 7; d++) if (isDone(d)) res[d - 1] = 'done';

  if (week === 1 && !isDone(1) && !isDone(2)) {
    res[0] = 'available';
    res[1] = 'available';
    return res;
  }
  const firstUndone = Array.from({ length: 7 }, (_, i) => i + 1).find(d => !isDone(d));
  if (firstUndone) res[firstUndone - 1] = 'available';
  return res;
}

/** 尋找「最新可做」週：優先最高週數內第一個有 available 的；否則回傳目前 unlocked 週 */
function findTargetWeek(args: {
  level: Level;
  category: Category | null;
  unlockedWeek: number;
  completedSet: Set<string>;
}): number {
  const { level, category, unlockedWeek, completedSet } = args;
  if (!category) return 1;
  for (let w = unlockedWeek; w >= 1; w--) {
    const sts = computeDayStatuses({ level, category, week: w, unlockedWeek, completedSet });
    if (sts.some(s => s === 'available')) return w;
  }
  return Math.max(1, Math.min(10, unlockedWeek));
}

type WeekCardProps = {
  level: Level;
  category: Category | null;
  week: number;
  unlockedWeek: number;
  completedSet: Set<string>;
  onTryPickDay: (week: number, dayIndex: number, status: DayStatus) => void;
  onLayoutWeek: (week: number, e: LayoutChangeEvent) => void;
  s: ReturnType<typeof makeStyles>['s'];
  C: ReturnType<typeof makeStyles>['C'];
};

function WeekCard({
  level, category, week, unlockedWeek, completedSet, onTryPickDay, onLayoutWeek, s, C,
}: WeekCardProps) {
  const left = [0, 2, 4, 6].filter((i) => i < ICONS.length);
  const right = [1, 3, 5].filter((i) => i < ICONS.length);
  const statuses = computeDayStatuses({ level, category, week, unlockedWeek, completedSet });
  const weekUnlocked = week <= unlockedWeek;

  const renderPill = (i: number) => {
    const st = statuses[i];
    let pillBg = C.lockBg, iconColor = C.lockIcon, borderColor = C.border, elev = 4;
    if (st === 'done') { pillBg = C.doneBg; iconColor = C.doneIcon; borderColor = C.doneBg; elev = 2; }
    else if (st === 'available') { pillBg = C.availBg; iconColor = C.availIcon; borderColor = C.availBg; elev = 6; }

    const inner = (
      <RNView
        key={ICONS[i].key}
        style={[
          s.pill,
          {
            backgroundColor: pillBg,
            borderColor,
            elevation: elev,
            shadowOpacity: st === 'locked' ? 0.08 : 0.18,
          },
        ]}
      >
        <IconRender spec={ICONS[i]} color={iconColor} />
      </RNView>
    );

    if (!weekUnlocked) return inner;

    return (
      <RNPressable
        key={ICONS[i].key}
        onPress={() => onTryPickDay(week, i, st)}
        android_ripple={{ color: '#00000011', borderless: false }}
        style={({ pressed }) => [
          { borderRadius: 36, transform: [{ scale: pressed ? 0.98 : 1 }] },
        ]}
      >
        {inner}
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
      onLayout={(e) => onLayoutWeek(week, e)}
      pointerEvents={weekUnlocked ? 'auto' : 'none'}
      style={[s.card, !weekUnlocked && s.cardLocked]}
    >
      <RNView style={s.cardHeader}>
        <RNView style={s.cardTitleRow}>
          <RNText style={{ fontSize: 16, fontWeight: '900', color: C.text }}>第 {week} 週</RNText>
          <RNView style={s.unlockTag}>
            <RNText style={s.unlockTagText}>{weekUnlocked ? '已解鎖' : '未解鎖'}</RNText>
          </RNView>
        </RNView>
        <RNView style={s.badge}><RNText style={s.badgeText}>{doneCount}/7</RNText></RNView>
      </RNView>

      <RNView style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <RNView style={s.col}>{left.map(renderPill)}</RNView>
        <RNView style={[s.col, s.offset]}>{right.map(renderPill)}</RNView>
      </RNView>
    </RNView>
  );
}

export default function HomeScreen() {
  const isDark = useColorScheme() === 'dark';
  const { s, C } = useMemo(() => makeStyles(isDark), [isDark]);

  const [level, setLevel] = useState<Level | null>(null);
  const [pick, setPick] = useState<Category | null>(null);
  const [unlocked, setUnlocked] = useState<number>(1);
  const [completedSet, setCompletedSet] = useState<Set<string>>(new Set());
  const [showLevelMenu, setShowLevelMenu] = useState(false);

  // ── Scroll refs & offsets
  const svRef = useRef<RNScrollView>(null);
  const weekOffsets = useRef<Record<number, number>>({});
  const layoutReady = useRef(false); // 等全部 onLayout 回來先捲
  const lastAutoWeek = useRef<number | null>(null);

  const onLayoutWeek = useCallback((week: number, e: LayoutChangeEvent) => {
    const y = e.nativeEvent.layout.y;
    weekOffsets.current[week] = y;
    // 簡單假設：十個週卡都有回來就 ready（或可以用 Object.keys 長度判斷）
    if (Object.keys(weekOffsets.current).length >= 10) {
      layoutReady.current = true;
    }
  }, []);

  const scrollToWeek = useCallback((week: number, animated = true) => {
    const y = weekOffsets.current[week];
    if (y == null) return;
    // 預留少少上邊距
    svRef.current?.scrollTo({ y: Math.max(0, y - 12), animated });
    lastAutoWeek.current = week;
  }, []);

  const loadProgress = useCallback(async () => {
    const lv = (await AsyncStorage.getItem(LEVEL_KEY)) as Level | null;
    const pk = (await AsyncStorage.getItem(PICK_KEY)) as Category | null;
    const lvEff = (lv ?? 'N2') as Level;
    const pkEff = (pk ?? 'grammar') as Category;
    setLevel(lvEff);
    setPick(pkEff);
    setUnlocked(await getUnlockedWeek(lvEff, pkEff));
    setCompletedSet(await getCompletedSet());
  }, []);

  useEffect(() => { void loadProgress(); }, [loadProgress]);

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      try {
        const lv = (await AsyncStorage.getItem(LEVEL_KEY)) as Level | null;
        const pk = (await AsyncStorage.getItem(PICK_KEY)) as Category | null;
        if (!lv || !pk) return;
        const u = await getUnlockedWeek(lv, pk);
        const cs = await getCompletedSet();
        if (alive) { setLevel(lv); setPick(pk); setUnlocked(u); setCompletedSet(cs); }
      } catch {}
    })();
    return () => { alive = false; };
  }, []));

  // 🔔 bus 即時刷新
  const busValue = useProgressBus(st => st.value);
  const [seen, setSeen] = useState(busValue);
  useEffect(() => {
    if (busValue !== seen) {
      setSeen(busValue);
      void loadProgress();
    }
  }, [busValue, seen, loadProgress]);

  // 🎯 自動捲到「最新可做」週（在 progress/level/pick 改變 或 layout ready 時）
  useEffect(() => {
    if (!level || !pick) return;
    if (!layoutReady.current) return;

    const target = findTargetWeek({ level, category: pick, unlockedWeek: unlocked, completedSet });
    if (target && target !== lastAutoWeek.current) {
      // 小延遲等 scrollView 完成排版
      requestAnimationFrame(() => scrollToWeek(target));
    }
  }, [level, pick, unlocked, completedSet, scrollToWeek]);

  const selectPick = useCallback(async (cat: Category) => {
    setPick(cat);
    await AsyncStorage.setItem(PICK_KEY, cat);
    if (!level) return;
    setUnlocked(await getUnlockedWeek(level, cat));
    setCompletedSet(await getCompletedSet());
    // 切換類別都自動捲
    requestAnimationFrame(() => {
      const target = findTargetWeek({ level, category: cat, unlockedWeek: unlocked, completedSet });
      if (target) scrollToWeek(target);
    });
  }, [level, unlocked, completedSet, scrollToWeek]);

  const selectLevel = useCallback(async (lv: Level) => {
    setLevel(lv);
    await AsyncStorage.setItem(LEVEL_KEY, lv);
    if (pick) {
      const u = await getUnlockedWeek(lv, pick);
      const cs = await getCompletedSet();
      setUnlocked(u);
      setCompletedSet(cs);
      requestAnimationFrame(() => {
        const target = findTargetWeek({ level: lv, category: pick, unlockedWeek: u, completedSet: cs });
        if (target) scrollToWeek(target);
      });
    }
    setShowLevelMenu(false);
  }, [pick, scrollToWeek]);

  const onTryPickDay = useCallback(
    async (week: number, dayIndex: number, status: DayStatus) => {
      if (!level || !pick) {
        Alert.alert('未設定', '請先設定程度(Level) 及 類別（文法/字彙）');
        return;
      }
      if (status === 'locked') {
        Alert.alert('未解鎖', '請先完成未完成題目，才能進入下一日。');
        return;
      }

      const ok = await useQuiz.getState().init({
        level,
        kind: 'language',
        extra: {
          level,
          category: pick,
          week,
          day: dayIndex + 1,
        },
      });
      if (ok) router.push('/(tabs)/practice-daily');
      else Alert.alert('題庫未準備', '呢日嘅每日練習未有題目，請選擇其他日子');
    },
    [level, pick]
  );

  return (
    <RNScrollView
      ref={svRef}
      style={s.screen}
      contentContainerStyle={[s.wrap, { paddingBottom: 40 }]}
      showsVerticalScrollIndicator
      onContentSizeChange={() => {
        // 初次 layout 完成後做一次自動捲
        if (!layoutReady.current || !level || !pick) return;
        const target = findTargetWeek({ level, category: pick, unlockedWeek: unlocked, completedSet });
        if (target) scrollToWeek(target, false);
      }}
    >
      {/* Level Header + Dropdown */}
      <RNView style={s.levelHeaderStack}>
        <RNView style={s.levelHeader}>
          <RNView>
            <RNText style={{ fontSize: 18, fontWeight: '800', color: C.text }}>學習進度</RNText>
            <RNText style={{ color: C.soft, marginTop: 4 }}>
              完成 7 個練習後自動解鎖下一週
            </RNText>
          </RNView>

          <RNPressable
            onPress={() => setShowLevelMenu(v => !v)}
            style={({ pressed }) => [
              s.levelBadge,
              pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel="切換 Level"
          >
            <RNText style={s.levelBadgeText}>Level：{level ?? '—'}</RNText>
          </RNPressable>
        </RNView>

        {showLevelMenu && (
          <>
            <RNPressable style={s.backdrop} onPress={() => setShowLevelMenu(false)} />
            <RNView style={s.dropdown}>
              {LEVELS.map((lv) => {
                const active = lv === level;
                return (
                  <RNPressable
                    key={lv}
                    onPress={() => selectLevel(lv as Level)}
                    style={({ pressed }) => [s.ddItem, (active || pressed) && { backgroundColor: C.dropdownItemActiveBg }]}
                  >
                    <RNText style={s.ddItemText}>{lv}</RNText>
                    {active && <MaterialCommunityIcons name="check" size={18} color={C.accent} />}
                  </RNPressable>
                );
              })}
            </RNView>
          </>
        )}
      </RNView>

      {/* 類別（文法／字彙） */}
      <RNView style={s.row}>
        <RNPressable
          onPress={() => selectPick('grammar')}
          style={({ pressed }) => [
            s.bigBtn,
            { transform: [{ translateY: pressed ? 1 : 0 }] },
            pick === 'grammar' && s.bigBtnActive,
          ]}
        >
          <RNText style={s.bigBtnText}>文法</RNText>
        </RNPressable>
        <RNPressable
          onPress={() => selectPick('vocab')}
          style={({ pressed }) => [
            s.bigBtn,
            { transform: [{ translateY: pressed ? 1 : 0 }] },
            pick === 'vocab' && s.bigBtnActive,
          ]}
        >
          <RNText style={s.bigBtnText}>字彙</RNText>
        </RNPressable>
      </RNView>

      {/* 10 週卡 */}
      {Array.from({ length: 10 }, (_, i) => i + 1).map((week) => (
        <WeekCard
          key={week}
          level={(level ?? 'N2') as Level}
          category={pick as Category | null}
          week={week}
          unlockedWeek={unlocked}
          completedSet={completedSet}
          onTryPickDay={onTryPickDay}
          onLayoutWeek={onLayoutWeek}
          s={s}
          C={C}
        />
      ))}
    </RNScrollView>
  );
}
