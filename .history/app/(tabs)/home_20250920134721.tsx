// app/(tabs)/home.tsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, useColorScheme, ScrollView, Alert, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuiz } from '../../src/store/useQuiz';

const LEVEL_KEY = 'user.level';
const UNLOCK_KEY = 'progress.unlockedWeek'; // 1..10
type PickType = 'grammar' | 'vocab' | null;

// 每週 7 個圈要顯示嘅字
const CHARS = ['が', 'ん', 'ば', 'っ', 'て', 'ね', 'え'] as const;

function makeStyles(isDark: boolean) {
  const C = {
    bg: isDark ? '#0b0f14' : '#f8fafc',
    text: isDark ? '#eef2f6' : '#0f172a',
    muted: isDark ? '#94a3b8' : '#64748b',
    card: isDark ? '#0f1720' : '#ffffff',
    border: isDark ? '#1f2937' : '#e5e7eb',

    nodeLocked: isDark ? '#293241' : '#e2e8f0',
    nodeCurrent: '#f39c12',
    nodeDone: '#2ecc71',
    nodeShadow: '#000',
  };

  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    wrap: { padding: 16, paddingBottom: 32 },

    // 頂部
    levelRow: { marginBottom: 6 },
    levelText: { fontSize: 18, fontWeight: '800', color: C.text },
    hint: { color: C.muted, marginTop: 2 },

    // 文法／字彙
    pickRow: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 10 },
    bigBtn: {
      flex: 1, paddingVertical: 18, borderRadius: 18,
      borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
      alignItems: 'center', justifyContent: 'center',
    },
    bigBtnActive: { borderWidth: 2, borderColor: C.text },
    bigBtnText: { fontSize: 18, fontWeight: '800', color: C.text },

    // 週卡
    weekCard: {
      backgroundColor: C.card,
      borderRadius: 16,
      borderWidth: 1, borderColor: C.border,
      padding: 14,
      marginBottom: 14,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
        android: { elevation: 1 },
      }),
    },
    weekHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    weekTitle: { fontSize: 16, fontWeight: '800', color: C.text },
    lockText: { color: C.muted, fontSize: 12 },

    // 週內蛇形
    snakeWrap: { paddingVertical: 6 },
    snakeRow: { height: 86, justifyContent: 'center' }, // 每粒之間距離
    snakeInner: { width: '100%', flexDirection: 'row', alignItems: 'center' },
    left: { justifyContent: 'flex-start' },
    right: { justifyContent: 'flex-end' },

    // 圓圈（3D）
    node: {
      width: 68, height: 68, borderRadius: 34,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 3,
      borderTopColor: 'rgba(255,255,255,0.35)',
      borderLeftColor: 'rgba(255,255,255,0.18)',
      borderRightColor: 'rgba(0,0,0,0.15)',
      borderBottomColor: 'rgba(0,0,0,0.35)',
      ...Platform.select({
        ios: { shadowColor: C.nodeShadow, shadowOpacity: 0.24, shadowRadius: 8, shadowOffset: { width: 0, height: 6 } },
        android: { elevation: 6 },
      }),
    },
    nodeText: { fontSize: 20, fontWeight: '900', color: '#fff' },
    nodeLockedBg: { backgroundColor: C.nodeLocked },
    nodeCurrentBg: { backgroundColor: C.nodeCurrent },
    nodeDoneBg: { backgroundColor: C.nodeDone },
    nodeDisabled: { opacity: 0.6 },

    // 裝飾路徑小點
    dots: { position: 'absolute', bottom: 6, width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 8 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: isDark ? '#1f2937' : '#cbd5e1' },
  });

  return { s };
}

/** 練完某一週後可以 call 呢個解鎖下一週 */
export async function markSessionCompleted(week: number) {
  try {
    const cur = Number(await AsyncStorage.getItem(UNLOCK_KEY) ?? '1');
    if (week >= cur && week < 10) await AsyncStorage.setItem(UNLOCK_KEY, String(week + 1));
  } catch {}
}

export default function HomeScreen() {
  const isDark = useColorScheme() === 'dark';
  const { s } = useMemo(() => makeStyles(isDark), [isDark]);

  const [level, setLevel] = useState<string | null>(null);
  const [pick, setPick] = useState<PickType>(null);
  const [unlocked, setUnlocked] = useState<number>(1); // 1..10

  useEffect(() => {
    (async () => {
      setLevel((await AsyncStorage.getItem(LEVEL_KEY)) ?? null);
      const u = Number(await AsyncStorage.getItem(UNLOCK_KEY) ?? '1');
      setUnlocked(Math.min(Math.max(1, u || 1), 10));
    })();
  }, []);

  const startWeek = useCallback(async (week: number) => {
    if (!level) { Alert.alert('請先設定程度', '請到 Level 頁揀 N1～N5'); return; }
    if (!pick) { Alert.alert('請先選擇', '請揀「文法」或「字彙」'); return; }

    await useQuiz.getState().init({
      level: level as any,
      kind: 'language', // 先 language（含 vocab/grammar），之後要拆可再調整
      // @ts-ignore 想帶過去的上下文（可在 practice 調用）
      week,
    });

    router.push('/(tabs)/practice');
  }, [level, pick]);

  /** 一張週卡：標題 + 7 粒蛇形圈圈（顯示「がんばってねえ」） */
  const WeekCard = ({ week }: { week: number }) => {
    const locked = week > unlocked;
    const isCurrent = week === unlocked;
    const done = week < unlocked;

    // 決定每粒圈圈底色：用週狀態（done/current/locked）
    const nodeBg = isCurrent ? s.nodeCurrentBg : done ? s.nodeDoneBg : s.nodeLockedBg;

    return (
      <View style={s.weekCard}>
        <View style={s.weekHeader}>
          <Text style={s.weekTitle}>第 {week} 週</Text>
          {locked ? <Text style={s.lockText}>未解鎖</Text> : <Text style={s.lockText}>可挑戰</Text>}
        </View>

        <View style={s.snakeWrap}>
          {CHARS.map((ch, i) => {
            const alignRight = i % 2 === 1; // 左右交錯
            return (
              <View key={i} style={[s.snakeRow]}>
                <View style={[s.snakeInner, alignRight ? s.right : s.left]}>
                  <Pressable
                    disabled={locked}
                    onPress={() => setTimeout(() => startWeek(week), 120)}
                    style={({ pressed }) => ([
                      s.node,
                      nodeBg,
                      locked && s.nodeDisabled,
                      pressed && !locked && { transform: [{ scale: 0.95 }] },
                    ])}
                  >
                    <Text style={s.nodeText}>{ch}</Text>
                  </Pressable>
                </View>

                {/* 裝飾的路徑點（每粒下面一行小點） */}
                {i < CHARS.length - 1 && (
                  <View style={s.dots}>
                    <View style={s.dot} />
                    <View style={s.dot} />
                    <View style={s.dot} />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.wrap}>
      {/* 頂部：Level 狀態 */}
      <View style={s.levelRow}>
        <Text style={s.levelText}>Level：{level ?? '—'}</Text>
        <Text style={s.hint}>向下滑動可查看所有週（灰色=未解鎖）</Text>
      </View>

      {/* 文法／字彙 */}
      <View style={s.pickRow}>
        <Pressable onPress={() => setPick('grammar')} style={({ pressed }) => [s.bigBtn, pick === 'grammar' && s.bigBtnActive, pressed && { opacity: 0.9 }]}>
          <Text style={s.bigBtnText}>文法</Text>
        </Pressable>
        <Pressable onPress={() => setPick('vocab')} style={({ pressed }) => [s.bigBtn, pick === 'vocab' && s.bigBtnActive, pressed && { opacity: 0.9 }]}>
          <Text style={s.bigBtnText}>字彙</Text>
        </Pressable>
      </View>

      {/* 多個週卡（保留你原來「第1週／第2週…」嘅概念） */}
      {Array.from({ length: 10 }, (_, i) => i + 1).map((w) => (
        <WeekCard key={w} week={w} />
      ))}
    </ScrollView>
  );
}
