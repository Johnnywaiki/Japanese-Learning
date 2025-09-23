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

const ICONS = [
  { name: 'star', color: '#fff' },
  { name: 'book', color: '#fff' },
  { name: 'videocam', color: '#fff' },
  { name: 'barbell', color: '#fff' },
  { name: 'chatbubble-ellipses', color: '#fff' },
] as const;

function makeStyles(isDark: boolean) {
  const C = {
    bg: isDark ? '#0b0f14' : '#f8fafc',
    text: isDark ? '#eef2f6' : '#0f172a',
    muted: isDark ? '#94a3b8' : '#64748b',
    card: isDark ? '#0f1720' : '#ffffff',
    border: isDark ? '#1f2937' : '#e5e7eb',

    // 節點配色
    nodeLocked: isDark ? '#293241' : '#e2e8f0',
    nodeCurrent: '#f39c12',   // 橙
    nodeDone: '#2ecc71',      // 綠
    nodeShadow: isDark ? '#000' : '#000',
  };

  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    wrap: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 28 },

    top: { marginBottom: 10 },
    level: { fontSize: 18, fontWeight: '800', color: C.text },
    hint: { color: C.muted, marginTop: 2 },

    // 上面兩個大掣（文法／字彙）
    pickRow: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 2 },
    bigBtn: {
      flex: 1, paddingVertical: 18, borderRadius: 18,
      borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
      alignItems: 'center', justifyContent: 'center',
    },
    bigBtnActive: { borderWidth: 2, borderColor: C.text },
    bigBtnText: { fontSize: 18, fontWeight: '800', color: C.text },

    // 地圖容器
    map: { marginTop: 10 },

    // 一個節點行（左右交錯）
    row: { flexDirection: 'row', alignItems: 'center', height: 140 },
    spacer: { flex: 1 },
    nodeWrap: { width: 120, alignItems: 'center' },

    // 連接圓點（裝飾）
    dotsRow: { position: 'absolute', top: 100, width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 8 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: isDark ? '#1f2937' : '#cbd5e1' },

    // 3D node
    node: {
      width: 86, height: 86, borderRadius: 43,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 3,
      // 做出「上淺下深」嘅 3D 邊
      borderTopColor: 'rgba(255,255,255,0.35)',
      borderLeftColor: 'rgba(255,255,255,0.18)',
      borderRightColor: 'rgba(0,0,0,0.15)',
      borderBottomColor: 'rgba(0,0,0,0.35)',
      // 陰影
      ...Platform.select({
        ios: { shadowColor: C.nodeShadow, shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 8 } },
        android: { elevation: 8 },
      }),
    },
    nodeLabel: { marginTop: 6, fontSize: 12, color: C.muted },

    // 顏色
    nodeCurrentBg: { backgroundColor: C.nodeCurrent },
    nodeDoneBg: { backgroundColor: C.nodeDone },
    nodeLockedBg: { backgroundColor: C.nodeLocked },
    nodeDisabled: { opacity: 0.6 },
  });

  return { s, C };
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

  const startSession = useCallback(async (week: number) => {
    if (!level) { Alert.alert('請先設定程度', '請到 Level 頁揀 N1～N5'); return; }
    if (!pick) { Alert.alert('請先選擇', '請揀「文法」或「字彙」'); return; }

    // 目前傳 language（包含 vocab/grammar）；如要只取單一類型，可在 useQuiz 內再分流
    await useQuiz.getState().init({
      level: level as any,
      kind: 'language',
      // 你可以把 week 保存起來，practice 再用
      // @ts-ignore
      week,
    });

    router.push('/(tabs)/practice');
  }, [level, pick]);

  const Node = ({
    week,
  }: { week: number }) => {
    const locked = week > unlocked;
    const isCurrent = week === unlocked;
    const done = week < unlocked;
    const colorStyle = isCurrent ? s.nodeCurrentBg : done ? s.nodeDoneBg : s.nodeLockedBg;

    return (
      <View style={s.nodeWrap}>
        <Pressable
          disabled={locked}
          onPress={() => {
            // 先畀少少互動時間
            setTimeout(() => startSession(week), 120);
          }}
          style={({ pressed }) => ([
            s.node,
            colorStyle,
            locked && s.nodeDisabled,
            pressed && !locked && { transform: [{ scale: 0.96 }] },
          ])}
        >
          {/* Icon 隨週輪換，似 Duolingo */}
          <Ionicons
            name={ICONS[(week - 1) % ICONS.length].name as any}
            size={34}
            color={ICONS[(week - 1) % ICONS.length].color}
          />
        </Pressable>
        <Text style={s.nodeLabel}>第 {week} 週</Text>

        {/* 裝飾路徑小點（顯示在節點下方） */}
        {week < 10 && (
          <View style={s.dotsRow}>
            <View style={s.dot} />
            <View style={s.dot} />
            <View style={s.dot} />
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.wrap}>
      {/* 頂部狀態 */}
      <View style={s.top}>
        <Text style={s.level}>Level：{level ?? '—'}</Text>
        <Text style={s.hint}>向下滑動查看所有週數（灰色=未解鎖）</Text>
      </View>

      {/* 文法／字彙 兩個大掣（要先揀，然後點地圖節點） */}
      <View style={s.pickRow}>
        <Pressable onPress={() => setPick('grammar')} style={({ pressed }) => [s.bigBtn, pick === 'grammar' && s.bigBtnActive, pressed && { opacity: 0.9 }]}>
          <Text style={s.bigBtnText}>文法</Text>
        </Pressable>
        <Pressable onPress={() => setPick('vocab')} style={({ pressed }) => [s.bigBtn, pick === 'vocab' && s.bigBtnActive, pressed && { opacity: 0.9 }]}>
          <Text style={s.bigBtnText}>字彙</Text>
        </Pressable>
      </View>

      {/* 地圖（蛇形排版）：奇數週靠左、偶數週靠右；可一直向下捲 */}
      <View style={s.map}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((week) => {
          const left = week % 2 === 1;
          return (
            <View key={week} style={s.row}>
              {left ? (
                <>
                  <Node week={week} />
                  <View style={s.spacer} />
                </>
              ) : (
                <>
                  <View style={s.spacer} />
                  <Node week={week} />
                </>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
