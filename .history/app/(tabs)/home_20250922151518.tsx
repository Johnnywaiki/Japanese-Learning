// app/(tabs)/home.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useColorScheme, Alert } from 'react-native';
import type { Href } from 'expo-router';
import { router } from 'expo-router';
import type { Topic } from '@/src/db';
import { getUnlockedWeek } from '@/src/lib/progress';

type Category = 'grammar' | 'vocab';

const LEVELS: Topic[] = ['N1', 'N2', 'N3', 'N4', 'N5'];
const CATS: Category[] = ['grammar', 'vocab'];
const WEEKS = Array.from({ length: 10 }, (_, i) => i + 1);
const DAYS = Array.from({ length: 7 }, (_, i) => i + 1);

function useStyles(isDark: boolean) {
  const C = {
    bg: isDark ? '#000' : '#fff',
    text: isDark ? '#eee' : '#111',
    muted: isDark ? '#9ca3af' : '#6b7280',
    card: isDark ? '#0b0b0b' : '#fff',
    border: isDark ? '#2a2a2a' : '#e5e7eb',
    accent: isDark ? '#93c5fd' : '#2563eb',
    invert: isDark ? '#000' : '#fff',
  };
  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg, padding: 16 },
    h1: { color: C.text, fontSize: 20, fontWeight: '800', marginBottom: 10 },
    label: { color: C.text, fontSize: 15, fontWeight: '700', marginTop: 12 },
    hint: { color: C.muted, fontSize: 12, marginTop: 4 },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    pill: {
      paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999,
      borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
    },
    pillActive: { borderColor: C.accent, backgroundColor: isDark ? '#0f172a' : '#eff6ff' },
    pillText: { color: C.text, fontSize: 15 },
    pillTextActive: { color: C.accent, fontWeight: '800' },
    card: { borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 12, padding: 12, marginTop: 8 },
    btn: { alignSelf: 'flex-start', marginTop: 16, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, borderColor: C.accent },
    btnText: { color: C.accent, fontSize: 16, fontWeight: '900' },
    lock: { opacity: 0.4 },
  });
  return { s, C };
}

export default function HomeScreen() {
  const isDark = useColorScheme() === 'dark';
  const { s } = useStyles(isDark);

  const [level, setLevel] = useState<Topic>('N2');
  const [category, setCategory] = useState<Category>('grammar');
  const [unlockedWeek, setUnlockedWeekState] = useState<number>(1);
  const [week, setWeek] = useState<number>(1);
  const [day, setDay] = useState<number>(1);

  // 讀本地解鎖周數（如未用上雲 RPC 也可運作）
  useEffect(() => {
    let mounted = true;
    (async () => {
      const wk = await getUnlockedWeek(level as any, category as any).catch(() => 1);
      if (mounted) {
        setUnlockedWeekState(wk);
        setWeek((prev) => Math.min(prev, wk));
      }
    })();
    return () => { mounted = false; };
  }, [level, category]);

  const start = () => {
    if (week > unlockedWeek) {
      Alert.alert('未解鎖', `第 ${week} 週未解鎖（目前：第 ${unlockedWeek} 週）。`);
      return;
    }
    const to: Href = {
      pathname: '/(tabs)/practice-daily',
      params: {
        level,
        category,
        week: String(week),
        day: String(day),
      },
    };
    router.push(to);
  };

  return (
    <View style={s.screen}>
      <Text style={s.h1}>每日練習（Daily）</Text>

      <Text style={s.label}>程度</Text>
      <View style={s.row}>
        {LEVELS.map((lv) => {
          const active = lv === level;
          return (
            <Pressable key={lv} onPress={() => setLevel(lv)} style={[s.pill, active && s.pillActive]}>
              <Text style={[s.pillText, active && s.pillTextActive]}>{lv}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={s.label}>類別</Text>
      <View style={s.row}>
        {CATS.map((cat) => {
          const active = cat === category;
          const label = cat === 'grammar' ? '文法' : '詞彙';
          return (
            <Pressable key={cat} onPress={() => setCategory(cat)} style={[s.pill, active && s.pillActive]}>
              <Text style={[s.pillText, active && s.pillTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={s.hint}>已解鎖週數：第 {unlockedWeek} 週</Text>

      <View style={s.card}>
        <Text style={s.label}>第幾週</Text>
        <View style={s.row}>
          {WEEKS.map((w) => {
            const active = w === week;
            const locked = w > unlockedWeek;
            return (
              <Pressable
                key={w}
                onPress={() => !locked && setWeek(w)}
                style={[s.pill, active && s.pillActive, locked && s.lock]}
              >
                <Text style={[s.pillText, active && s.pillTextActive]}>
                  第 {w} 週{locked ? ' 🔒' : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={s.label}>第幾日</Text>
        <View style={s.row}>
          {DAYS.map((d) => {
            const active = d === day;
            return (
              <Pressable key={d} onPress={() => setDay(d)} style={[s.pill, active && s.pillActive]}>
                <Text style={[s.pillText, active && s.pillTextActive]}>Day {d}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable onPress={start} style={s.btn}>
        <Text style={s.btnText}>開始每日練習</Text>
      </Pressable>
    </View>
  );
}
