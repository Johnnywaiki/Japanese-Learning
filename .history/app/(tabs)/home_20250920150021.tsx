// app/(tabs)/home.tsx — 圓形按鈕 + 日本文化 icon
import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, useColorScheme, ScrollView, Alert, Platform, LayoutChangeEvent,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useQuiz } from '../../src/store/useQuiz';
import { MaterialCommunityIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';

const LEVEL_KEY = 'user.level';
const UNLOCK_KEY = 'progress.unlockedWeek'; // 1..10

type PickType = 'grammar' | 'vocab' | null;

// 每週 7 個圈要顯示嘅 icon
const ICONS = [
  { lib: 'MaterialCommunityIcons', name: 'samurai', label: '侍' },
  { lib: 'FontAwesome5', name: 'fan', label: '扇子' },
  { lib: 'Ionicons', name: 'leaf', label: '葉' },
  { lib: 'MaterialCommunityIcons', name: 'noodles', label: '麵' },
  { lib: 'FontAwesome5', name: 'pagoda', label: '寺' },
  { lib: 'MaterialCommunityIcons', name: 'japanese-yen', label: '円' },
  { lib: 'Ionicons', name: 'fish', label: '魚' },
] as const;

// 圈圈尺寸
const NODE = 78;

/** 以「百分比」定義嘅蛇形路徑 */
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

    nodeLocked: isDark ? '#3f4754' : '#e2e8f0', // 灰色
    nodeCurrent: '#22c55e', // 當前 = 亮綠
    nodeDone: '#16a34a', // 完成 = 深綠
    nodeShadow: '#000',
  } as const;

  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    wrap: { padding: 16, paddingBottom: 32 },

    levelRow: { marginBottom: 6 },
    levelText: { fontSize: 18, fontWeight: '800', color: C.text },
    hint: { color: C.muted, marginTop: 2 },

    pickRow: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 10 },
    bigBtn: {
      flex: 1, paddingVertical: 18, borderRadius: 18,
      borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
      alignItems: 'center', justifyContent: 'center',
    },
    bigBtnActive: { borderWidth: 2, borderColor: C.text },
    bigBtnText: { fontSize: 18, fontWeight: '800', color: C.text },

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

    pathWrap: { position: 'relative', width: '100%', height: 580, paddingVertical: 6 },

    node: {
      position: 'absolute',
      width: NODE, height: NODE, borderRadius: NODE / 2,
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
    nodeLockedBg: { backgroundColor: C.nodeLocked },
    nodeCurrentBg: { backgroundColor: C.nodeCurrent },
    nodeDoneBg: { backgroundColor: C.nodeDone },
    nodeDisabled: { opacity: 0.6 },
    icon: { color: '#fff', fontSize: 28 },
  });

  return { s };
}

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
  const [unlocked, setUnlocked] = useState<number>(1);

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
      // @ts-ignore
      week,
    });

    router.push('/(tabs)/practice');
  }, [level, pick]);

  const WeekCard = ({ week }: { week: number }) => {
    const locked = week > unlocked;
    const isCurrent = week === unlocked;
    const done = week < unlocked;

    const nodeBg = isCurrent ? s.nodeCurrentBg : done ? s.nodeDoneBg : s.nodeLockedBg;

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
            const left = p.x * (boxW - NODE);
            const top = p.y * (boxH - NODE);
            const iconConf = ICONS[i];

            let IconComp: any = null;
            if (iconConf.lib === 'MaterialCommunityIcons') IconComp = MaterialCommunityIcons;
            if (iconConf.lib === 'FontAwesome5') IconComp = FontAwesome5;
            if (iconConf.lib === 'Ionicons') IconComp = Ionicons;

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
                {IconComp ? <IconComp name={iconConf.name} style={s.icon} /> : <Text style={s.icon}>{iconConf.label}</Text>}
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.wrap}>
      <View style={s.levelRow}>
        <Text style={s.levelText}>Level：{level ?? '—'}</Text>
        <Text style={s.hint}>向下滑動可查看所有週（灰=未解鎖，亮綠=當前，深綠=已完成）</Text>
      </View>

      <View style={s.pickRow}>
        <Pressable onPress={() => setPick('grammar')} style={({ pressed }) => [s.bigBtn, pick === 'grammar' && s.bigBtnActive, pressed && { opacity: 0.9 }]}>
          <Text style={s.bigBtnText}>文法</Text>
        </Pressable>
        <Pressable onPress={() => setPick('vocab')} style={({ pressed }) => [s.bigBtn, pick === 'vocab' && s.bigBtnActive, pressed && { opacity: 0.9 }]}>
          <Text style={s.bigBtnText}>字彙</Text>
        </Pressable>
      </View>

      {Array.from({ length: 10 }, (_, i) => i + 1).map((w) => (
        <WeekCard key={w} week={w} />
      ))}
    </ScrollView>
  );
}