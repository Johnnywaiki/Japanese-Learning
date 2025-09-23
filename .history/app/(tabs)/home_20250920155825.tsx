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

// Expo 內置 icons（@expo/vector-icons）
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';

// （可選）短震動回饋
let Haptics: any;
try {
  // @ts-ignore
  Haptics = require('expo-haptics');
} catch { /* noop */ }

const LEVEL_KEY = 'user.level';
const UNLOCK_KEY = 'progress.unlockedWeek'; // 1..10（目前不限制，只作顯示用）

// 7 顆 icon（已按你最新次序 + 命名 day1~day7）
const ICONS = [
  { key: 'day1', lib: 'mci', name: 'flower' },      // MaterialCommunityIcons
  { key: 'day2', lib: 'mci', name: 'leaf' },        // MaterialCommunityIcons
  { key: 'day3', lib: 'fa5', name: 'torii-gate' },  // FontAwesome5
  { key: 'day4', lib: 'mci', name: 'rice' },        // MaterialCommunityIcons
  { key: 'day5', lib: 'mci', name: 'noodles' },     // MaterialCommunityIcons
  { key: 'day6', lib: 'mci', name: 'airplane' },    // MaterialCommunityIcons
  { key: 'day7', lib: 'fa5', name: 'train' },       // FontAwesome5
] as const;

type IconSpec = typeof ICONS[number];
type PickType = 'grammar' | 'vocab' | null;

function makeStyles(isDark: boolean) {
  const C = {
    bg: isDark ? '#000' : '#fff',
    text: isDark ? '#eee' : '#111',
    soft: isDark ? '#9ca3af' : '#6b7280',
    card: isDark ? '#0f0f0f' : '#ffffff',
    border: isDark ? '#2a2a2a' : '#e5e7eb',
    primary: isDark ? '#fff' : '#111',
    locked: isDark ? '#1b1b1b' : '#f1f5f9',
    lockedText: isDark ? '#666' : '#9aa0a6',
  };

  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    wrap: { flexGrow: 1, padding: 16, gap: 14 },

    // 頂部
    level: { fontSize: 18, fontWeight: '700', color: C.text },
    hint: { color: C.soft, marginTop: 2 },

    // 範疇兩大掣
    row: { flexDirection: 'row', gap: 12 },
    bigBtn: {
      flex: 1,
      paddingVertical: 22,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bigBtnText: { fontSize: 20, fontWeight: '800', color: C.text },
    bigBtnActive: { borderColor: C.primary, borderWidth: 2 },

    // 卡片
    card: {
      marginTop: 12,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    cardTitle: { fontSize: 16, fontWeight: '700', color: C.text },

    // 七粒大圓（蛇形）
    snakeWrap: { flexDirection: 'row', justifyContent: 'space-between' },
    col: { width: '48%' },

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

    // 右列首個往下半格，造成「上下蛇形」
    offset: { marginTop: 36 },
  });

  return { s, C };
}

/** 完成測驗後可呼叫去解鎖下一週（保留：之後用得著） */
export async function markSessionCompleted(week: number) {
  try {
    const cur = Number((await AsyncStorage.getItem(UNLOCK_KEY)) ?? '1');
    if (week >= cur && week < 10) {
      await AsyncStorage.setItem(UNLOCK_KEY, String(week + 1));
    }
  } catch {}
}

type SessionCardProps = {
  week: number;
  onPickDay: (week: number, dayIndex: number, spec: IconSpec) => void;
  s: ReturnType<typeof makeStyles>['s'];
  colorSet: ReturnType<typeof makeStyles>['C'];
};

function IconRender({ spec, color }: { spec: IconSpec; color: string }) {
  if (spec.lib === 'mci') {
    return <MaterialCommunityIcons name={spec.name as any} size={28} color={color} />;
  }
  return <FontAwesome5 name={spec.name as any} size={24} color={color} solid />;
}

function SessionCard({ week, onPickDay, s, colorSet }: SessionCardProps) {
  // 左列：0,2,4,6；右列：1,3,5
  const left = [0, 2, 4, 6].filter((i) => i < ICONS.length);
  const right = [1, 3, 5].filter((i) => i < ICONS.length);

  const iconColor = colorSet.text;

  const Pill = (i: number) => (
    <RNPressable
      key={ICONS[i].key}
      onPress={() => onPickDay(week, i, ICONS[i])}
      android_ripple={{ color: '#00000011', borderless: false }}
      style={({ pressed }) => [
        s.pill,
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

  return (
    <RNView style={s.card}>
      <RNView style={s.cardHeader}>
        <RNText style={s.cardTitle}>第 {week} 週</RNText>
        {/* 已按你要求：不再顯示「可開始 / 未解鎖」或任何狀態／按鈕 */}
      </RNView>

      <RNView style={s.snakeWrap}>
        {/* 左列 */}
        <RNView style={s.col}>{left.map(Pill)}</RNView>
        {/* 右列（首個向下半格） */}
        <RNView style={[s.col, s.offset]}>{right.map(Pill)}</RNView>
      </RNView>
    </RNView>
  );
}

export default function HomeScreen() {
  const isDark = useColorScheme() === 'dark';
  const { s, C } = useMemo(() => makeStyles(isDark), [isDark]);

  const [level, setLevel] = useState<string | null>(null);
  const [pick, setPick] = useState<PickType>(null);
  const [unlocked, setUnlocked] = useState<number>(1); // 1..10（暫不限制）

  // 讀 Level + 已解鎖週（目前只顯示用）
  useEffect(() => {
    (async () => {
      const lv = await AsyncStorage.getItem(LEVEL_KEY);
      setLevel(lv ?? null);

      const u = Number((await AsyncStorage.getItem(UNLOCK_KEY)) ?? '1');
      setUnlocked(Math.min(Math.max(1, u || 1), 10));
    })();
  }, []);

  // 用戶按某顆 day pill → 直接去練習
  const onPickDay = useCallback(
    async (week: number, dayIndex: number, spec: IconSpec) => {
      if (!level) {
        Alert.alert('請先設定程度', '請到 Level 頁揀 N1～N5');
        return;
      }
      if (!pick) {
        Alert.alert('請先選範疇', '請揀「文法」或「字彙」');
        return;
      }

      try {
        // 輕量觸覺回饋（可選）
        if (Haptics?.selectionAsync) await Haptics.selectionAsync();
      } catch { /* noop */ }

      // 之後 DB 準備好可以用 extra 做 filter：level, week, day
      await useQuiz.getState().init({
        level: level as any,        // 'N1' | 'N2' | ...
        kind: 'language',           // 你現時 practice 用嘅 kind
        extra: {
          week,                     // 1..10
          day: dayIndex + 1,        // 1..7
          dayKey: spec.key,         // 'day1'..'day7'
          icon: { lib: spec.lib, name: spec.name }, // 如要記錄 icon 配置
          // 將來可配合：N1 week1 day2 / N3 week2 day3 等等
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
      {/* 頂部：顯示程度 / 解鎖進度（保留顯示，無限制行為） */}
      <RNView>
        <RNText style={s.level}>Level: {level ?? '—'}</RNText>
        <RNText style={s.hint}>解鎖進度：第 {unlocked} / 10 週</RNText>
      </RNView>

      {/* 範疇兩大掣（要先揀，才可進入練習） */}
      <RNView style={s.row}>
        <RNPressable
          onPress={() => setPick('grammar')}
          style={({ pressed }) => [
            s.bigBtn,
            pick === 'grammar' && s.bigBtnActive,
            pressed && { opacity: 0.85 },
          ]}
        >
          <RNText style={s.bigBtnText}>文法</RNText>
        </RNPressable>
        <RNPressable
          onPress={() => setPick('vocab')}
          style={({ pressed }) => [
            s.bigBtn,
            pick === 'vocab' && s.bigBtnActive,
            pressed && { opacity: 0.85 },
          ]}
        >
          <RNText style={s.bigBtnText}>字彙</RNText>
        </RNPressable>
      </RNView>

      {/* 每週卡片（每張 7 粒 icon，可按即跳練習） */}
      {Array.from({ length: 10 }, (_, i) => i + 1).map((week) => (
        <SessionCard
          key={week}
          week={week}
          onPickDay={onPickDay}
          s={s}
          colorSet={C}
        />
      ))}
    </RNScrollView>
  );
}
