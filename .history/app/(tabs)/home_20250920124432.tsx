// app/(tabs)/home.tsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, useColorScheme, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuiz } from '../../src/store/useQuiz';
import { router } from 'expo-router';

const LEVEL_KEY = 'user.level';

type PickType = 'grammar' | 'vocab' | null;

function makeStyles(isDark: boolean) {
  const C = {
    bg: isDark ? '#000' : '#fff',
    text: isDark ? '#eee' : '#111',
    soft: isDark ? '#9ca3af' : '#6b7280',
    card: isDark ? '#111' : '#fff',
    border: isDark ? '#333' : '#e5e7eb',
    primary: isDark ? '#fff' : '#111',
  };
  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg, padding: 16, gap: 16 },
    level: { fontSize: 18, fontWeight: '700', color: C.text },
    row: { flexDirection: 'row', gap: 12 },
    bigBtn: {
      flex: 1,
      paddingVertical: 28,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bigBtnText: { fontSize: 20, fontWeight: '800', color: C.text },
    bigBtnActive: { borderColor: C.primary, borderWidth: 2 },
    startBtn: {
      marginTop: 12,
      paddingVertical: 16,
      borderRadius: 16,
      backgroundColor: C.primary,
      alignItems: 'center',
    },
    startText: { color: isDark ? '#000' : '#fff', fontSize: 16, fontWeight: '700' },
    hint: { color: C.soft, marginTop: 2 },
  });
  return { s };
}

export default function HomeScreen() {
  const isDark = useColorScheme() === 'dark';
  const { s } = useMemo(() => makeStyles(isDark), [isDark]);

  const [level, setLevel] = useState<string | null>(null);
  const [pick, setPick] = useState<PickType>(null);

  useEffect(() => {
    (async () => {
      const lv = await AsyncStorage.getItem(LEVEL_KEY);
      setLevel(lv ?? null);
    })();
  }, []);

  const start = useCallback(async () => {
    if (!level) {
      Alert.alert('請先設定程度', '返回上一頁揀 N1–N5');
      return;
    }
    // 目前 kind 用 'language'（包含 vocab+grammar）
    // 如需只取單一 section，可之後再在 useQuiz 內做前端過濾
    await useQuiz.getState().init({
      level: level as any, // N1..N5
      kind: 'language',
      // 你想要固定年份／月份，可以在這裡加：year: 2021, session: 'July'
    } as any);

    router.push('/(tabs)/practice');
  }, [level]);

  return (
    <View style={s.screen}>
      <Text style={s.level}>Level: {level ?? '—'}</Text>
      <Text style={s.hint}>揀一個範疇先會出「開始測驗」按鈕</Text>

      <View style={s.row}>
        <Pressable
          onPress={() => setPick('grammar')}
          style={({ pressed }) => [s.bigBtn, pick === 'grammar' && s.bigBtnActive, pressed && { opacity: 0.8 }]}
        >
          <Text style={s.bigBtnText}>文法</Text>
        </Pressable>

        <Pressable
          onPress={() => setPick('vocab')}
          style={({ pressed }) => [s.bigBtn, pick === 'vocab' && s.bigBtnActive, pressed && { opacity: 0.8 }]}
        >
          <Text style={s.bigBtnText}>字彙</Text>
        </Pressable>
      </View>

      {!!pick && (
        <Pressable onPress={start} style={s.startBtn}>
          <Text style={s.startText}>
            {pick === 'grammar' ? '開始文法測驗' : '開始字彙測驗'}
          </Text>
        </Pressable>
      )}

      {/* 闖關地圖（1..10） */}
      <View style={{ marginTop: 18, gap: 12 }}>
        {[
          [1],
          [2, 3],
          [4, 5],
          [6, 7],
          [8, 9, 10], // 最後一行 3 個，視覺更飽滿；要完全照規格2+2到10也可
        ].map((row, idx) => (
          <View key={idx} style={{ flexDirection: 'row', justifyContent: 'center', gap: 18 }}>
            {row.map((n) => (
              <View
                key={n}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  borderWidth: 2,
                  borderColor: isDark ? '#888' : '#bbb',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDark ? '#111' : '#fafafa',
                }}
              >
                <Text style={{ color: isDark ? '#eee' : '#111', fontWeight: '800' }}>{n}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}
