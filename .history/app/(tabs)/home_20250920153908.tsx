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

const LEVEL_KEY = 'user.level';
const UNLOCK_KEY = 'progress.unlockedWeek'; // 1..10

// 以 icon 取代原本的 7 個文字
const ICONS = [
  { lib: 'mci', name: 'noodles' },      // MaterialCommunityIcons
  { lib: 'mci', name: 'flower' },     // MaterialCommunityIcons
  { lib: 'fa5', name: 'train' },         // FontAwesome5
  { lib: 'fa5', name: 'torii-gate' },  // FontAwesome5
  { lib: 'mci', name: 'rice' },        // MaterialCommunityIcons
  { lib: 'mci', name: 'game' },       // MaterialCommunityIcons
  { lib: 'mci', name: 'leaf' },        // MaterialCommunityIcons
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

    // Session list
    sectionTitle: { marginTop: 4, fontSize: 16, color: C.soft },

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
    cardState: { fontSize: 13, color: C.soft },

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
    // 用 icon 替代文字，所以呢個留作 icon 尺寸參考
    pillIconSize: { fontSize: 26 },

    // 右列首個往下半格，造成「上下蛇形」
    offset: { marginTop: 36 },

    // Locked 樣式
    cardLocked: { backgroundColor: C.locked, borderColor: C.locked },
    pillLocked: { backgroundColor: C.locked, borderColor: C.locked },
    textLocked: { color: C.lockedText },

    // 開始掣
    startBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
    },
    startBtnText: { fontSize: 13, fontWeight: '700', color: C.text },
  });

  return { s, C };
}

/** 完成測驗後可呼叫去解鎖下一週 */
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
  locked: boolean;
  onStart: (week: number) => void;
  s: ReturnType<typeof makeStyles>['s'];
  colorSet: ReturnType<typeof makeStyles>['C'];
};

function IconRender({ spec, color }: { spec: IconSpec; color: string }) {
  if (spec.lib === 'mci') {
    return <MaterialCommunityIcons name={spec.name as any} size={28} color={color} />;
  }
  return <FontAwesome5 name={spec.name as any} size={24} color={color} solid />;
}

function SessionCard({ week, locked, onStart, s, colorSet }: SessionCardProps) {
  // 左列放 index: 0,2,4,6；右列放 1,3,5
  const left = [0, 2, 4, 6].filter((i) => i < ICONS.length);
  const right = [1, 3, 5].filter((i) => i < ICONS.length);

  const iconColor = locked ? colorSet.lockedText : colorSet.text;

  return (
    <RNView
      // 鎖住嘅卡完全不吃手勢 → 讓 ScrollView 可以照滑
      pointerEvents={locked ? 'none' : 'auto'}
      style={[s.card, locked && s.cardLocked]}
    >
      <RNView style={s.cardHeader}>
        <RNText style={[s.cardTitle, locked && s.textLocked]}>第 {week} 週</RNText>
        <RNView style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <RNText style={[s.cardState, locked && s.textLocked]}>
            {locked ? '未解鎖' : '可開始'}
          </RNText>
          {!locked && (
            <RNPressable
              onPress={() => onStart(week)}
              style={({ pressed }) => [
                s.startBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <RNText style={s.startBtnText}>開始</RNText>
            </RNPressable>
          )}
        </RNView>
      </RNView>

      <RNView style={s.snakeWrap}>
        {/* 左列 */}
        <RNView style={s.col}>
          {left.map((i) => (
            <RNView key={i} style={[s.pill, locked && s.pillLocked]}>
              <IconRender spec={ICONS[i]} color={iconColor} />
            </RNView>
          ))}
        </RNView>
        {/* 右列（首個向下半格） */}
        <RNView style={[s.col, s.offset]}>
          {right.map((i) => (
            <RNView key={i} style={[s.pill, locked && s.pillLocked]}>
              <IconRender spec={ICONS[i]} color={iconColor} />
            </RNView>
          ))}
        </RNView>
      </RNView>
    </RNView>
  );
}

export default function HomeScreen() {
  const isDark = useColorScheme() === 'dark';
  const { s, C } = useMemo(() => makeStyles(isDark), [isDark]);

  const [level, setLevel] = useState<string | null>(null);
  const [pick, setPick] = useState<PickType>(null);
  const [unlocked, setUnlocked] = useState<number>(1); // 1..10

  // 讀 Level + 已解鎖週
  useEffect(() => {
    (async () => {
      const lv = await AsyncStorage.getItem(LEVEL_KEY);
      setLevel(lv ?? null);

      const u = Number((await AsyncStorage.getItem(UNLOCK_KEY)) ?? '1');
      setUnlocked(Math.min(Math.max(1, u || 1), 10));
    })();
  }, []);

  // 開始指定週的測驗
  const startSession = useCallback(
    async (week: number) => {
      if (!level) {
        Alert.alert('請先設定程度', '請到 Level 頁揀 N1～N5');
        return;
      }
      if (!pick) {
        Alert.alert('請先選範疇', '請揀「文法」或「字彙」');
        return;
      }

      await useQuiz.getState().init({
        level: level as any, // N1..N5
        kind: 'language',
        // extra: { week }, // 如需把週傳去 practice
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
      {/* 頂部：顯示程度 / 解鎖進度 */}
      <RNView>
        <RNText style={s.level}>Level: {level ?? '—'}</RNText>
        <RNText style={s.hint}>解鎖進度：第 {unlocked} / 10 週</RNText>
      </RNView>

      {/* 範疇兩大掣（要先揀，才可點 Session） */}
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

      {/* Session 區域 */}
      <RNText style={s.sectionTitle}>
        Session（每週 7 顆：sakura / noodles / fan / torii-gate / rice / ninja / wave）
      </RNText>

      {Array.from({ length: 10 }, (_, i) => i + 1).map((week) => (
        <SessionCard
          key={week}
          week={week}
          locked={week > unlocked}
          onStart={startSession}
          s={s}
          colorSet={C}
        />
      ))}
    </RNScrollView>
  );
}
