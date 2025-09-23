// app/(tabs)/home.tsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, useColorScheme, Alert, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuiz } from '../../src/store/useQuiz';
import { router } from 'expo-router';

const LEVEL_KEY = 'user.level';
const UNLOCK_KEY = 'progress.unlockedWeek';   // 1..10
const CHARS = ['が', 'ん', 'ば', 'っ', 'て', 'ね', 'え'] as const;

type PickType = 'grammar' | 'vocab' | null;

function makeStyles(isDark: boolean) {
  const C = {
    bg: isDark ? '#000' : '#fff',
    text: isDark ? '#eee' : '#111',
    soft: isDark ? '#9ca3af' : '#6b7280',
    card: isDark ? '#0f0f0f' : '#ffffff',
    border: isDark ? '#2a2a2a' : '#e5e7eb',
    primary: isDark ? '#fff' : '#111',
    locked: isDark ? '#222' : '#f1f5f9',
    lockedText: isDark ? '#666' : '#b0b0b0',
  };

  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    wrap: { flex: 1, padding: 16, gap: 14 },

    // 頂部
    level: { fontSize: 18, fontWeight: '700', color: C.text },
    hint: { color: C.soft, marginTop: 2 },

    // 範疇兩大掣
    row: { flexDirection: 'row', gap: 12 },
    bigBtn: {
      flex: 1, paddingVertical: 22, borderRadius: 18,
      borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
      alignItems: 'center', justifyContent: 'center',
    },
    bigBtnText: { fontSize: 20, fontWeight: '800', color: C.text },
    bigBtnActive: { borderColor: C.primary, borderWidth: 2 },

    // Session list
    sectionTitle: { marginTop: 4, fontSize: 16, color: C.soft },

    card: {
      marginTop: 12, padding: 14, borderRadius: 16,
      borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: C.text },
    cardState: { fontSize: 13, color: C.soft },

    // 七粒大圓（蛇形）
    snakeWrap: { flexDirection: 'row', justifyContent: 'space-between' },
    col: { width: '48%' },

    pill: {
      height: 72, borderRadius: 36, borderWidth: 2, borderColor: C.border,
      backgroundColor: C.card, alignItems: 'center', justifyContent: 'center',
      marginBottom: 12,
    },
    pillText: { fontSize: 22, fontWeight: '900', color: C.text },

    // 右列首個往下半格，造成「上下蛇形」
    offset: { marginTop: 36 },

    // Locked 樣式
    cardLocked: { backgroundColor: C.locked, borderColor: C.locked },
    pillLocked: { backgroundColor: C.locked, borderColor: C.locked },
    textLocked: { color: C.lockedText },
  });

  return { s };
}

/** 你可以在完成測驗時呼叫呢個 helper 去解鎖下一週 */
export async function markSessionCompleted(week: number) {
  try {
    const cur = Number(await AsyncStorage.getItem(UNLOCK_KEY) ?? '1');
    if (week >= cur && week < 10) {
      await AsyncStorage.setItem(UNLOCK_KEY, String(week + 1));
    }
  } catch {}
}

export default function HomeScreen() {
  const isDark = useColorScheme() === 'dark';
  const { s } = useMemo(() => makeStyles(isDark), [isDark]);

  const [level, setLevel] = useState<string | null>(null);
  const [pick, setPick] = useState<PickType>(null);
  const [unlocked, setUnlocked] = useState<number>(1); // 1..10

  // 讀 Level + 已解鎖週
  useEffect(() => {
    (async () => {
      const lv = await AsyncStorage.getItem(LEVEL_KEY);
      setLevel(lv ?? null);

      const u = Number(await AsyncStorage.getItem(UNLOCK_KEY) ?? '1');
      setUnlocked(Math.min(Math.max(1, u || 1), 10));
    })();
  }, []);

  // 開始指定週的測驗
  const startSession = useCallback(async (week: number) => {
    if (!level) {
      Alert.alert('請先設定程度', '請到 Level 頁揀 N1～N5');
      return;
    }
    if (!pick) {
      Alert.alert('請先選範疇', '請揀「文法」或「字彙」');
      return;
    }
    // 目前用 kind: 'language'（含 vocab+grammar）。之後你要只取單一 section，
    // 可在 useQuiz.init 完成後再 filter（q.section === 'grammar' | 'vocab'）
    await useQuiz.getState().init({
      level: level as any,      // N1..N5
      kind: 'language',
      // 亦可在這裡把「週」一樣傳去 practice（如果你有支援）
      // extra: { week }
    } as any);

    router.push('/(tabs)/practice');
  }, [level, pick]);

  const SessionCard = ({
    week, locked,
  }: { week: number; locked: boolean }) => {
    // 左列放 index: 0,2,4,6；右列放 1,3,5；右列整體向下半格造成蛇形
    const left = [0, 2, 4, 6].filter(i => i < CHARS.length);
    const right = [1, 3, 5].filter(i => i < CHARS.length);

    const onPress = () => {
      if (locked) return;
      startSession(week);
    };

    return (
      <Pressable
        onPress={onPress}
        disabled={locked}
        style={({ pressed }) => [
          s.card,
          locked && s.cardLocked,
          !locked && pressed && { opacity: 0.9 },
        ]}
      >
        <View style={s.cardHeader}>
          <Text style={[s.cardTitle, locked && s.textLocked]}>第 {week} 週</Text>
          <Text style={[s.cardState, locked && s.textLocked]}>
            {locked ? '未解鎖' : '可開始'}
          </Text>
        </View>

        <View style={s.snakeWrap}>
          {/* 左列 */}
          <View style={s.col}>
            {left.map((i) => (
              <View key={i} style={[s.pill, locked && s.pillLocked]}>
                <Text style={[s.pillText, locked && s.textLocked]}>{CHARS[i]}</Text>
              </View>
            ))}
          </View>
          {/* 右列（首個向下半格） */}
          <View style={[s.col, s.offset]}>
            {right.map((i) => (
              <View key={i} style={[s.pill, locked && s.pillLocked]}>
                <Text style={[s.pillText, locked && s.textLocked]}>{CHARS[i]}</Text>
              </View>
            ))}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.wrap}>
      {/* 頂部：顯示程度 / 解鎖進度 */}
      <View>
        <Text style={s.level}>Level: {level ?? '—'}</Text>
        <Text style={s.hint}>解鎖進度：第 {unlocked} / 10 週</Text>
      </View>

      {/* 範疇兩大掣（要先揀，才可點 Session） */}
      <View style={s.row}>
        <Pressable
          onPress={() => setPick('grammar')}
          style={({ pressed }) => [s.bigBtn, pick === 'grammar' && s.bigBtnActive, pressed && { opacity: 0.85 }]}
        >
          <Text style={s.bigBtnText}>文法</Text>
        </Pressable>
        <Pressable
          onPress={() => setPick('vocab')}
          style={({ pressed }) => [s.bigBtn, pick === 'vocab' && s.bigBtnActive, pressed && { opacity: 0.85 }]}
        >
          <Text style={s.bigBtnText}>字彙</Text>
        </Pressable>
      </View>

      {/* Session 區域 */}
      <Text style={s.sectionTitle}>Session（每週 7 題：が / ん / ば / っ / て / ね / え）</Text>

      {Array.from({ length: 10 }, (_, i) => i + 1).map((week) => (
        <SessionCard key={week} week={week} locked={week > unlocked} />
      ))}
    </ScrollView>
  );
}

