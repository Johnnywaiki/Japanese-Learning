import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, useColorScheme } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuiz } from '../../src/store/useQuiz';
import { seedIfEmpty, getAllForFilter } from '../../src/db';
import type { PoolQuestion } from '../../src/db/schema';

function parseExamKey(ek?: string) {
  if (!ek) return null;
  const m = ek.match(/^(N[1-5])-(\d{4})-(\d{2})$/);
  if (!m) return null;
  const [, level, y, mm] = m;
  return {
    level,
    year: Number(y),
    month: mm,
    monthLabel: mm === '07' ? '7月' : mm === '12' ? '12月' : mm,
  };
}

function makeStyles(isDark: boolean) {
  const C = {
    bg: isDark ? '#000' : '#fff',
    text: isDark ? '#eee' : '#111',
    soft: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#333' : '#e5e7eb',
    card: isDark ? '#111' : '#fff',
    accentBg: isDark ? '#fff' : '#111',
    accentText: isDark ? '#000' : '#fff',
  };
  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    wrap: { padding: 16, gap: 14 },
    h1: { fontSize: 22, fontWeight: '700', color: C.text },
    hint: { color: C.soft, fontSize: 13 },
    section: { marginTop: 8 },
    listCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 10, gap: 8 },
    pill: {
      paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12,
      borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
    },
    pillText: { color: C.text, fontSize: 15 },
    examItem: {
      padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    examTitle: { color: C.text, fontSize: 16, fontWeight: '600' },
    examSub: { color: C.soft, fontSize: 13 },
    startBtn: { marginTop: 6, backgroundColor: C.accentBg, borderColor: C.accentBg, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
    startText: { color: C.accentText, fontWeight: '700', textAlign: 'center' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  });
  return { s };
}

type ExamRow = { exam_key: string; level: string; year: number; monthLabel: string; count: number };

export default function ExamPickerScreen() {
  const isDark = useColorScheme() === 'dark';
  const { s } = useMemo(() => makeStyles(isDark), [isDark]);

  const { init } = useQuiz();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ExamRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await seedIfEmpty();
        // 拉一個最寬鬆的 pool，之後自己 group by exam_key
        const { pool } = getAllForFilter({ level: 'all', kind: 'language' } as any);
        const map = new Map<string, { count: number; meta: NonNullable<ReturnType<typeof parseExamKey>> }>();
        for (const q of pool as PoolQuestion[]) {
          const meta = parseExamKey(q.exam_key);
          if (!meta) continue;
          const prev = map.get(q.exam_key);
          map.set(q.exam_key, { count: (prev?.count ?? 0) + 1, meta });
        }
        const arr: ExamRow[] = Array.from(map.entries()).map(([exam_key, { count, meta }]) => ({
          exam_key, level: meta.level, year: meta.year, monthLabel: meta.monthLabel, count,
        }));
        // 排序：先 level（N1..N5），再年份 desc，再月份 12月 > 7月
        const levelOrder = { N1: 1, N2: 2, N3: 3, N4: 4, N5: 5 } as const;
        arr.sort((a, b) => {
          const la = (levelOrder as any)[a.level] ?? 99;
          const lb = (levelOrder as any)[b.level] ?? 99;
          if (la !== lb) return la - lb;
          if (a.year !== b.year) return b.year - a.year;
          const mA = a.monthLabel === '12月' ? 12 : 7;
          const mB = b.monthLabel === '12月' ? 12 : 7;
          return mB - mA;
        });
        if (!cancelled) setRows(arr);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const onPickExam = async (examKey: string) => {
    // ✅ 指定 examKey + 順序升冪，確保 1 → 尾
    await init({ examKey, order: 'asc' } as any);
    router.replace('/(tabs)/practice');
  };

  if (loading) {
    return (
      <SafeAreaView style={s.screen} edges={['left','right']}>
        <View style={s.center}>
          <ActivityIndicator />
          <Text style={s.hint}>載入試卷中…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen} edges={['left','right']}>
      <ScrollView contentContainerStyle={s.wrap}>
        <Text style={s.h1}>試卷</Text>
        <Text style={s.hint}>揀一份試卷開始順序練習（由第 1 題到最後）。</Text>

        <View style={[s.section, s.listCard]}>
          {rows.length === 0 && <Text style={s.hint}>暫時搵唔到試卷。</Text>}
          {rows.map((r) => (
            <Pressable key={r.exam_key} onPress={() => onPickExam(r.exam_key)} style={s.examItem}>
              <View>
                <Text style={s.examTitle}>{r.level}・{r.year}年{r.monthLabel}</Text>
                <Text style={s.examSub}>題數：{r.count}</Text>
              </View>
              <View style={s.startBtn}><Text style={s.startText}>開始</Text></View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
