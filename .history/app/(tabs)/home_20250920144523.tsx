// app/(tabs)/home.tsx — 長方形 3D 綠色按鈕版本
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

// 每週 7 個按鈕要顯示嘅字（保留原本）
const CHARS = ['が', 'ん', 'ば', 'っ', 'て', 'ね', 'え'] as const;

// 🔶 長方形按鈕尺寸
const TILE_W = 180;
const TILE_H = 58;

/** 以「百分比」定義嘅蛇形路徑（x / y 都係 0~1，卡片內相對位置） */
const PATH_PCT: Array<{ x: number; y: number }> = [
  { x: 0.50, y: 0.00 },
  { x: 0.30, y: 0.13 },
  { x: 0.20, y: 0.28 },
  { x: 0.38, y: 0.42 },
  { x: 0.55, y: 0.58 },
  { x: 0.68, y: 0.74 },
  { x: 0.56, y: 0.90 },
];

function makeStyles(isDark: boolean) {
  const C = {
    bg: isDark ? '#0b0f14' : '#f8fafc',
    text: isDark ? '#eef2f6' : '#0f172a',
    muted: isDark ? '#94a3b8' : '#64748b',
    card: isDark ? '#0f1720' : '#ffffff',
    border: isDark ? '#1f2937' : '#e5e7eb',

    // 綠色系（locked / current / done）
    tileLocked: isDark ? '#274E13' : '#d1fae5', // 深/淺綠灰
    tileCurrent: isDark ? '#2ecc71' : '#22c55e', // 主綠
    tileDone: isDark ? '#1b5e20' : '#16a34a',   // 完成（更深）
    tileShadow: '#000',
  } as const;

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

    // 週內蛇形容器（用絕對定位擺長方形）
    pathWrap: {
      position: 'relative',
      width: '100%',
      height: 580, // 夠位擺 7 個節點
      paddingVertical: 6,
    },

    // 長方形 3D 按鈕
    tile: {
      position: 'absolute',
      width: TILE_W,
      height: TILE_H,
      borderRadius: 14, // 長邊型
      alignItems: 'center',
      justifyContent: 'center',
      // 立體邊線（高光/陰影）
      borderWidth: 3,
      borderTopColor: 'rgba(255,255,255,0.45)',
      borderLeftColor: 'rgba(255,255,255,0.22)',
      borderRightColor: 'rgba(0,0,0,0.18)',
      borderBottomColor: 'rgba(0,0,0,0.35)',
      ...Platform.select({
        ios: { shadowColor: C.tileShadow, shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 6 } },
        android: { elevation: 6 },
      }),
    },
    tileText: { fontSize: 20, fontWeight: '900', color: '#ffffff' },

    tileLockedBg: { backgroundColor: C.tileLocked },
    tileCurrentBg: { backgroundColor: C.tileCurrent },
    tileDoneBg: { backgroundColor: C.tileDone },
    tileDisabled: { opacity: 0.65 },
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
      kind: 'language',
      // 你可以把 week pass 埋去 practice 用
      // @ts-ignore
      week,
    });

    router.push('/(tabs)/practice');
  }, [level, pick]);

  /** 一張週卡：標題 + 絕對定位蛇形路徑（已改用長方形 3D 綠色按鈕） */
  const WeekCard = ({ week }: { week: number }) => {
    const locked = week > unlocked;
    const isCurrent = week === unlocked;
    const done = week < unlocked;

    const tileBg = isCurrent ? s.tileCurrentBg : done ? s.tileDoneBg : s.tileLockedBg;

    const [boxW, setBoxW] = useState(0);
    const [boxH, setBoxH] = useState(580);
    const onLayout = (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      setBoxW(width);
      setBoxH(height || 580);
    };

    return (
      <View style={s.weekCard}>
        <View style={s.weekHeader}>
          <Text style={s.weekTitle}>第 {week} 週</Text>
          {locked ? <Text style={s.lockText}>未解鎖</Text> : <Text style={s.lockText}>可挑戰</Text>}
        </View>

        <View style={s.pathWrap} onLayout={onLayout}>
          {PATH_PCT.map((p, i) => {
            // 將按鈕左上角對齊路徑百分比位置，並預留按鈕自身寬高
            const left = p.x * (boxW - TILE_W);
            const top = p.y * (boxH - TILE_H);

            return (
              <Pressable
                key={i}
                disabled={locked}
                onPress={() => setTimeout(() => startWeek(week), 120)}
                style={({ pressed }) => ([
                  s.tile,
                  tileBg,
                  { left, top },
                  locked && s.tileDisabled,
                  pressed && !locked && { transform: [{ scale: 0.97 }] },
                ])}
                accessibilityRole="button"
                accessibilityLabel={`第 ${week} 週 - ${CHARS[i]}`}
              >
                <Text style={s.tileText}>{CHARS[i]}</Text>
              </Pressable>
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
        <Text style={s.hint}>向下滑動可查看所有週（綠色=可挑戰／完成，淡綠=未解鎖）</Text>
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
