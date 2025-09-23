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
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useQuiz } from '../../src/store/useQuiz';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';
import {
  LEVEL_KEY, PICK_KEY,
  getUnlockedWeek, getCompletedSet, tokenOf,
  type Level, type Category,
} from '../../src/lib/progress';

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
type DayState = 'done' | 'avail' | 'locked';

function makeStyles(isDark: boolean) {
  const C = {
    bg: isDark ? '#0b0b0b' : '#ffffff',
    text: isDark ? '#f3f4f6' : '#111827',
    soft: isDark ? '#9ca3af' : '#6b7280',
    card: isDark ? '#141414' : '#ffffff',
    border: isDark ? '#222' : '#e5e7eb',
    lockedBg: isDark ? '#1f2937' : '#e5e7eb',
    lockedIcon: isDark ? '#6b7280' : '#9aa0a6',
    badgeBg: isDark ? '#0f172a' : '#eef2ff',
    done: '#16a34a',        // 綠
    avail: '#f59e0b',       // 橙
    accent: isDark ? '#93c5fd' : '#2563eb',
    dropdownBg: isDark ? '#0f172a' : '#ffffff',
    dropdownBorder: isDark ? '#1f2937' : '#e5e7eb',
    dropdownItemActiveBg: isDark ? '#111827' : '#f3f4f6',
  };
  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    wrap: { flexGrow: 1, padding: 16, gap: 16, overflow: 'visible' },

    levelHeaderStack: { position: 'relative', zIndex: 1000, elevation: 1000 },
    levelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    levelBadge: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: C.badgeBg, borderWidth: 1, borderColor: C.accent },
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
      flex: 1, paddingVertical: 18, borderRadius: 12, borderWidth: 1, borderColor: C.border,
      backgroundColor: C.card, alignItems: 'center', justifyContent: 'center',
    },
    bigBtnActive: { borderColor: C.accent, backgroundColor: C.badgeBg },
    bigBtnText: { fontSize: 16, fontWeight: '700', color: C.text },

    card: { marginTop: 8, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, zIndex: 0 },
    cardLocked: { backgroundColor: isDark ? '#0e0e0e' : '#f8fafc', borderColor: isDark ? '#0e0e0e' : '#f8fafc' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    cardTitle: { fontSize: 16, fontWeight: '800', color: C.text },

    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: isDark ? '#0f172a' : '#f8fafc' },
    badgeText: { fontSize: 12, color: C.soft },

    snakeWrap: { flexDirection: 'row', justifyContent: 'space-between' },
    col: { width: '48%' },
    offset: { marginTop: 36 },

    pill: {
      height: 72, borderRadius: 36, borderWidth: 2,
      alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    },
    pillDone:   { backgroundColor: C.done,   borderColor: C.done },
    pillAvail:  { backgroundColor: C.avail,  borderColor: C.avail },
    pillLocked: { backgroundColor: C.lockedBg, borderColor: C.lockedBg },
  });
  return { s, C };
}

function IconRender({ spec, color }: { spec: IconSpec; color: string }) {
  if (spec.lib === 'mci') return <MaterialCommunityIcons name={spec.name as any} size={28} color={color} />;
  return <FontAwesome5 name={spec.name as any} size={24} color={color} solid />;
}

/** 判斷單日狀態（完成／可做／鎖定）
 * 規則：
 * - 完成：該日已在 completedSet
 * - 可做：day1 / day2 固定可做；day>=3 要求「1..(day-1) 全部完成」
 * - 鎖定：其他情況
 * 另：整週未解鎖 -> 一律鎖定
 */
function getDayState(params: {
  unlocked: boolean;
  completedSet: Set<string>;
  level: Level;
  category: Category;
  week: number;
  day: number; // 1..7
}): DayState {
  const { unlocked, completedSet, level, category, week, day } = params;
  if (!unlocked) return 'locked';
  const tok = tokenOf(level, category, week, day);
  if (completedSet.has(tok)) return 'done';
  if (day <= 2) return 'avail';
  // day >= 3 → 要 1..(day-1) 全完成
  for (let d = 1; d < day; d++) {
    if (!completedSet.has(tokenOf(level, category, week, d))) return 'locked';
  }
  return 'avail';
}

/* ---------------- WeekCard ---------------- */
type WeekCardProps = {
  level: Level;
  category: Category | null;
  week: number;
  unlocked: boolean;
  completedSet: Set<string>;
  onPickDay: (week: number, dayIndex: number, state: DayState) => void;
  s: ReturnType<typeof makeStyles>['s'];
  C: ReturnType<typeof makeStyles>['C'];
};

function WeekCard({
  level, category, week, unlocked, completedSet, onPickDay, s, C,
}: WeekCardProps) {
  const left = [0, 2, 4, 6].filter((i) => i < ICONS.length);
  const right = [1, 3, 5].filter((i) => i < ICONS.length);

  const renderPill = (i: number) => {
    const day = i + 1;

    // 無 category 時一律鎖定（未選範疇）
    const state: DayState = !category
      ? 'locked'
      : getDayState({
          unlocked,
          completedSet,
          level,
          category,
          week,
          day,
        });

    const styleByState =
      state === 'done' ? s.pillDone :
      state === 'avail' ? s.pillAvail : s.pillLocked;

    const iconColor = state === 'locked' ? C.lockedIcon : '#fff';

    const base = [s.pill, styleByState];

    if (state === 'locked') {
      return (
        <RNView key={ICONS[i].key} style={base}>
          <IconRender spec={ICONS[i]} color={iconColor} />
        </RNView>
      );
    }

    return (
      <RNPressable
        key={ICONS[i].key}
        onPress={() => onPickDay(week, i, state)}
        android_ripple={{ color: '#00000011', borderless: false }}
        style={({ pressed }) => [
          ...base,
          pressed && { transform: [{ scale: 0.98 }], opacity: 0.95 },
        ]}
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
        <RNView style={s.badge}><RNText style={s.badgeText}>{doneCount}/7</RNText></RNView>
      </RNView>
      <RNView style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <RNView style={s.col}>{left.map(renderPill)}</RNView>
        <RNView style={[s.col, s.offset]}>{right.map(renderPill)}</RNView>
      </RNView>
    </RNView>
  );
}

/* ---------------- Screen ---------------- */
export default function HomeScreen() {
  const isDark = useColorScheme() === 'dark';
  const { s, C } = useMemo(() => makeStyles(isDark), [isDark]);

  const [level, setLevel] = useState<Level | null>(null);
  const [pick, setPick] = useState<Category | null>(null);
  const [unlocked, setUnlocked] = useState<number>(1);
  const [completedSet, setCompletedSet] = useState<Set<string>>(new Set());
  const [showLevelMenu, setShowLevelMenu] = useState(false);

  // 初次載入
  useEffect(() => {
    (async () => {
      const lv = (await AsyncStorage.getItem(LEVEL_KEY)) as Level | null;
      const pk = (await AsyncStorage.getItem(PICK_KEY)) as Category | null;
      const lvEff = (lv ?? 'N2') as Level;
      const pkEff = (pk ?? 'grammar') as Category;
      setLevel(lvEff);
      setPick(pkEff);
      setUnlocked(await getUnlockedWeek(lvEff, pkEff));
      setCompletedSet(await getCompletedSet());
    })();
  }, []);

  // 回頁即 reload（每日完成 → 變色／解鎖）
  useFocusEffect(
    useCallback(() => {
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
    }, [])
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

  const onPickDay = useCallback(
    async (week: number, dayIndex: number, stateFromCard?: DayState) => {
      if (!level) { Alert.alert('尚未設定 Level', '請先回最初頁設定 Level'); return; }
      if (!pick) { Alert.alert('請先選範疇', '請揀「文法」或「字彙」'); return; }

      const day = dayIndex + 1;

      // 二次保險：即場再算一次狀態，避免 race condition
      const state = getDayState({
        unlocked: week <= unlocked,
        completedSet,
        level,
        category: pick,
        week,
        day,
      });

      if (state === 'locked') {
        Alert.alert('請先完成未完成題目', '你需要按順序完成目前可做的練習，先完成再解鎖下一個。');
        return;
      }

      const ok = await useQuiz.getState().init({
        level,
        kind: 'language',
        extra: {
          level,
          category: pick,
          week,               // 1..10
          day,                // 1..7
        },
      });
      if (ok) router.push('/(tabs)/practice-daily');
      else Alert.alert('題庫未準備', '呢日嘅每日練習未有題目，請選擇其他日子');
    },
    [level, pick, unlocked, completedSet]
  );

  return (
    <RNScrollView
      style={s.screen}
      contentContainerStyle={[s.wrap, { paddingBottom: 40 }]}
      showsVerticalScrollIndicator
    >
      {/* Level Header + Dropdown */}
      <RNView style={s.levelHeaderStack}>
        <RNView style={s.levelHeader}>
          <RNView>
            <RNText style={{ fontSize: 18, fontWeight: '800', color: C.text }}>學習進度</RNText>
            <RNText style={{ color: C.soft, marginTop: 4 }}>完成 7 個練習後自動解鎖下一週</RNText>
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
        <RNPressable onPress={() => selectPick('grammar')}
          style={({ pressed }) => [s.bigBtn, pick === 'grammar' && s.bigBtnActive, pressed && { opacity: 0.9 }]}
        >
          <RNText style={s.bigBtnText}>文法</RNText>
        </RNPressable>
        <RNPressable onPress={() => selectPick('vocab')}
          style={({ pressed }) => [s.bigBtn, pick === 'vocab' && s.bigBtnActive, pressed && { opacity: 0.9 }]}
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
