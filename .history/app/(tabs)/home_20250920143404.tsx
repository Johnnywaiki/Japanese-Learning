// app/(tabs)/home.tsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, useColorScheme, ScrollView, Alert, Platform, LayoutChangeEvent,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useQuiz } from '../../src/store/useQuiz';

const LEVEL_KEY = 'user.level';
const UNLOCK_KEY = 'progress.unlockedWeek'; // 1..10
type PickType = 'grammar' | 'vocab' | null;

// 每週 7 個圈要顯示嘅字
const CHARS = ['が', 'ん', 'ば', 'っ', 'て', 'ね', 'え'] as const;

/** 以「百分比」定義嘅蛇形路徑（x / y 都係 0~1，卡片內相對位置）
 *  你可以微調 x/y 去貼近你想要嘅形狀。
 */
const PATH_PCT: Array<{ x: number; y: number }> = [
  { x: 0.50, y: 0.00 },
  { x: 0.30, y: 0.13 },
  { x: 0.20, y: 0.28 },
  { x: 0.38, y: 0.42 },
  { x: 0.58, y: 0.56 },
  { x: 0.66, y: 0.73 },
  { x: 0.53, y: 0.87 },
];

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

    // 週內蛇形容器（用絕對定位擺圓圈）
    pathWrap: {
      position: 'relative',
      width: '100%',
      // 高度要夠，先擺得落 7 個節點；你可以再微調
      height: 580,
      paddingVertical: 6,
    },

    // 圓圈（3D）
    node: {
      position: 'absolute',
      width: 78, height: 78, borderRadius: 38,
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

    // 小路徑點（裝飾）
    dot: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: isDark ? '#1f2937' : '#cbd5e1' },
  });

  return { s };
}

/** 練完某一週後可以 call 呢個解鎖下一週 */
export async function markSessionCompleted(week: number) {
  try {
    const cur = Number((await AsyncStorage.getItem(UNLOCK_KEY)) ?? '1');
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
      const u = Number((await AsyncStorage.getItem(UNLOCK_KEY)) ?? '1');
      setUnlocked(Math.min(Math.max(1, u || 1), 10));
    })();
  }, []);

  const startWeek = useCallback(async (week: number) => {
    if (!level) { Alert.alert('請先設定程度', '請到 Level 頁揀 N1～N5'); return; }
    if (!pick) { Alert.alert('請先選擇', '請揀「文法」或「字彙」'); return; }

    await useQuiz.getState().init({
      level: level as any,
      kind: 'language', // 先 language（含 vocab/grammar）
      // 你可以把 week pass 埋去 practice 用
      // @ts-ignore
      week,
    });

    router.push('/(tabs)/practice');
  }, [level, pick]);

  /** 一張週卡：標題 + 絕對定位蛇形路徑 */
  const WeekCard = ({ week }: { week: number }) => {
    const locked = week > unlocked;
    const isCurrent = week === unlocked;
    const done = week < unlocked;

    // 決定每粒圈圈底色：用週狀態（done/current/locked）
    const nodeBg = isCurrent ? s.nodeCurrentBg : done ? s.nodeDoneBg : s.nodeLockedBg;

    const [boxW, setBoxW] = useState(0);
    const [boxH, setBoxH] = useState(520);
    const onLayout = (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      setBoxW(width);
      setBoxH(height || 520);
    };

    // 幫助：計算兩點之間嘅中點，擺裝飾小點
    const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    });

    return (
      <View style={s.weekCard}>
        <View style={s.weekHeader}>
          <Text style={s.weekTitle}>第 {week} 週</Text>
          {locked ? <Text style={s.lockText}>未解鎖</Text> : <Text style={s.lockText}>可挑戰</Text>}
        </View>

        <View style={s.pathWrap} onLayout={onLayout}>
          {PATH_PCT.map((p, i) => {
            const left = p.x * (boxW - 68);
            const top = p.y * (boxH - 68);

            return (
              <Pressable
                key={i}
                disabled={locked}
                onPress={() => setTimeout(() => startWeek(week), 120)}
                style={({ pressed }) => ([
                  s.node,
                  nodeBg,
                  { left, top },
                  locked && s.nodeDisabled,
                  pressed && !locked && { transform: [{ scale: 0.95 }] },
                ])}
              >
                <Text style={s.nodeText}>{CHARS[i]}</Text>
              </Pressable>
            );
          })}

          {/* 裝飾：每兩粒之間加 3 粒小點，畫出路徑感 */}
          {PATH_PCT.slice(0, -1).map((p, i) => {
            const q = PATH_PCT[i + 1];
            const m1 = mid(p, q);
            const m0 = mid(p, m1);
            const m2 = mid(m1, q);
            const points = [m0, m1, m2];

            return points.map((pt, j) => {
              const left = pt.x * (boxW - 6);
              const top = pt.y * (boxH - 6);
              return <View key={`${i}-${j}`} style={[s.dot, { left, top }]} />;
            });
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

      {/* 10 個週卡 */}
      {Array.from({ length: 10 }, (_, i) => i + 1).map((w) => (
        <WeekCard key={w} week={w} />
      ))}
    </ScrollView>
  );
}
