// app/(tabs)/index.tsx
import { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, useColorScheme } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuiz } from '../../src/store/useQuiz';
import type { PracticeFilter } from '../../src/db';
import type { Topic } from '../../src/db/schema';

type Kind = 'language' | 'reading' | 'listening';
const YEARS_11_20 = Array.from({ length: 10 }, (_, i) => 2011 + i);
const YEARS_21_25 = Array.from({ length: 5 }, (_, i) => 2021 + i);

function makeStyles(isDark: boolean) {
  const C = {
    bg: isDark ? '#000' : '#fff',
    text: isDark ? '#eee' : '#111',
    border: isDark ? '#333' : '#ddd',
    borderSoft: isDark ? '#333' : '#eee',
    card: isDark ? '#111' : '#fff',
    activeBg: isDark ? '#fff' : '#111',
    activeText: isDark ? '#000' : '#fff',
  };
  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    wrap: { padding: 16, paddingTop: 8, gap: 12 },
    label: { fontSize: 15, marginTop: 2, color: C.text },
    row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
    rowWrap: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    boxHeader: {
      marginTop: 8, paddingVertical: 12, paddingHorizontal: 12,
      borderRadius: 12, borderWidth: 1, borderColor: C.borderSoft,
      backgroundColor: C.card, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    boxHeaderText: { fontSize: 14, fontWeight: '600', color: C.text },
    box: { padding: 10, borderWidth: 1, borderColor: C.borderSoft, borderRadius: 12, backgroundColor: C.card, gap: 6 },
    pill: {
      paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
      borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
    },
    pillSm: {
      paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999,
      borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
    },
    pillActive: { backgroundColor: C.activeBg, borderColor: C.activeBg },
    pillText: { fontSize: 14, color: C.text },
    pillTextSm: { fontSize: 13, color: C.text },
    pillTextActive: { color: C.activeText, fontWeight: '700' },
    next: { padding: 14, borderRadius: 12, backgroundColor: C.activeBg },
    nextText: { color: C.activeText, textAlign: 'center', fontSize: 17, fontWeight: '600' },
  });
  return { s };
}

export default function PracticeFilterScreen() {
  const isDark = useColorScheme() === 'dark';
  const { s } = useMemo(() => makeStyles(isDark), [isDark]);

  // ✅ 用 null 代表「未選」，避免 undefined
  const [level, setLevel] = useState<Topic | 'N2-N3-random' | 'all'>('N2-N3-random');
  const [year, setYear] = useState<number | 'random' | null>('random');
  const [session, setSession] = useState<'July' | 'December' | 'random'>('random');
  const [kind, setKind] = useState<Kind>('language');

  const [open1120, setOpen1120] = useState(false);
  const [open2125, setOpen2125] = useState(false);

  const { init } = useQuiz();

  const onStartPress = () => {
    const filters: PracticeFilter = { level, kind, year, session };
    void init(filters).then(() => router.navigate('/(tabs)/practice'));
  };

  return (
    <SafeAreaView style={s.screen} edges={['left','right']}>
      <ScrollView contentContainerStyle={s.wrap}>
        {/* 程度 */}
        <Text style={s.label}>程度</Text>

        {/* 第一行：N2–N3 隨機、日常生活題目 */}
        <View style={s.row}>
          {[
            { k: 'N2-N3-random', label: 'N2–N3 隨機' },
            { k: 'daily', label: '日常生活題目' },
          ].map(x => (
            <Pressable
              key={x.k}
              onPress={() => setLevel(x.k as any)}
              style={[s.pill, level === (x.k as any) && s.pillActive]}
            >
              <Text style={[s.pillText, level === (x.k as any) && s.pillTextActive]}>{x.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* 第二行：N1–N5 */}
        <View style={s.row}>
          {(['N1','N2','N3','N4','N5'] as const).map(k => (
            <Pressable
              key={k}
              onPress={() => setLevel(k)}
              style={[s.pill, level === k && s.pillActive]}
            >
              <Text style={[s.pillText, level === k && s.pillTextActive]}>{k}</Text>
            </Pressable>
          ))}
        </View>

        {/* 年份 */}
        <Text style={s.label}>年份</Text>
        <View style={s.row}>
          <Pressable onPress={() => setYear('random')} style={[s.pill, year === 'random' && s.pillActive]}>
            <Text style={[s.pillText, year === 'random' && s.pillTextActive]}>隨機</Text>
          </Pressable>
          {/* ✅ 「未選」用 null */}
          <Pressable onPress={() => setYear(null)} style={[s.pill, year === null && s.pillActive]}>
            <Text style={[s.pillText, year === null && s.pillTextActive]}>未選</Text>
          </Pressable>
        </View>

        {/* 2011–2020 下拉 */}
        <Pressable onPress={() => setOpen1120(v => !v)} style={s.boxHeader}>
          <Text style={s.boxHeaderText}>2011–2020</Text>
          <Text style={s.boxHeaderText}>{open1120 ? '▴' : '▾'}</Text>
        </Pressable>
        {open1120 && (
          <View style={[s.box, { marginTop: 6 }]}>
            <View style={s.rowWrap}>
              {YEARS_11_20.map(y => (
                <Pressable key={y} onPress={() => setYear(y)} style={[s.pillSm, year === y && s.pillActive]}>
                  <Text style={[s.pillTextSm, year === y && s.pillTextActive]}>{y}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* 2021–2025 下拉 */}
        <Pressable onPress={() => setOpen2125(v => !v)} style={s.boxHeader}>
          <Text style={s.boxHeaderText}>2021–2025</Text>
          <Text style={s.boxHeaderText}>{open2125 ? '▴' : '▾'}</Text>
        </Pressable>
        {open2125 && (
          <View style={[s.box, { marginTop: 6 }]}>
            <View style={s.rowWrap}>
              {YEARS_21_25.map(y => (
                <Pressable key={y} onPress={() => setYear(y)} style={[s.pillSm, year === y && s.pillActive]}>
                  <Text style={[s.pillTextSm, year === y && s.pillTextActive]}>{y}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* 月份 */}
        <Text style={s.label}>月份</Text>
        <View style={s.row}>
          {[
            { k: 'random', label: '隨機' },
            { k: 'July', label: '7月' },
            { k: 'December', label: '12月' },
          ].map(x => (
            <Pressable
              key={x.k}
              onPress={() => setSession(x.k as any)}
              style={[s.pill, session === (x.k as any) && s.pillActive]}
            >
              <Text style={[s.pillText, session === (x.k as any) && s.pillTextActive]}>{x.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* 類型 */}
        <Text style={s.label}>類型</Text>
        <View style={s.row}>
          {[
            { k: 'language', label: '言語知識（文字‧語彙‧文法）' },
            { k: 'reading', label: '讀解' },
            { k: 'listening', label: '聽解' },
          ].map(x => (
            <Pressable
              key={x.k}
              onPress={() => setKind(x.k as Kind)}
              style={[s.pill, kind === x.k && s.pillActive]}
            >
              <Text style={[s.pillText, kind === x.k && s.pillTextActive]}>{x.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* 開始練習 */}
        <Pressable style={[s.next, { marginTop: 10 }]} onPress={onStartPress}>
          <Text style={s.nextText}>開始練習</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
