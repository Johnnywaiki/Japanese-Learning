// app/(tabs)/index.tsx
import { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  useColorScheme,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuiz } from '../../src/store/useQuiz';
import type { PracticeFilter } from '../../src/db';
import type { Topic } from '../../src/db/schema';

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
    disabledBg: isDark ? '#1a1a1a' : '#e5e7eb',
    disabledText: isDark ? '#666' : '#9ca3af',
  };

  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    wrap: { padding: 16, paddingTop: 8, gap: 12 },

    sectionTitle: { fontSize: 15, marginTop: 2, color: C.text },
    row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 6 },
    rowWrap: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },

    pill: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
    },
    pillSm: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
    },
    pillActive: { backgroundColor: C.activeBg, borderColor: C.activeBg },
    pillText: { fontSize: 14, color: C.text },
    pillTextSm: { fontSize: 13, color: C.text },
    pillTextActive: { color: C.activeText, fontWeight: '700' },

    boxHeader: {
      marginTop: 4,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.borderSoft,
      backgroundColor: C.card,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    boxHeaderText: { fontSize: 14, fontWeight: '600', color: C.text },
    box: {
      padding: 10,
      borderWidth: 1,
      borderColor: C.borderSoft,
      borderRadius: 12,
      backgroundColor: C.card,
      gap: 6,
    },

    next: { padding: 14, borderRadius: 12, backgroundColor: C.activeBg, marginTop: 10 },
    nextDisabled: { backgroundColor: C.disabledBg },
    nextText: { color: C.activeText, textAlign: 'center', fontSize: 17, fontWeight: '600' },
    nextTextDisabled: { color: C.disabledText },
    hint: { fontSize: 12, color: C.disabledText, marginTop: 6 },
  });

  return { s };
}

export default function PracticeFilterScreen() {
  const isDark = useColorScheme() === 'dark';
  const { s } = useMemo(() => makeStyles(isDark), [isDark]);
  const { init } = useQuiz();

  // 預設：N2／2021／7月
  const [level, setLevel] = useState<Topic>('N2');
  const [year, setYear] = useState<number | null>(2021);
  const [month, setMonth] = useState<'07' | '12' | null>('07'); // 👈 直接用 month（不再用 session）
  const [open1120, setOpen1120] = useState(true);
  const [open2125, setOpen2125] = useState(true);

  const canStart = !!level && !!year && !!month;

  const onStartPress = async () => {
    if (!canStart || !year || !month) return;
    // 只做「言語 + 讀解」(language)。聽解之後先開。
    const base: PracticeFilter = {
      level,
      kind: 'language',
      year,
      month,        // ✅ 明確傳 month 給 DB（'07' or '12'）
    };

    const ok = await init(base);
    if (!ok) {
      Alert.alert('題庫未準備', '呢份卷暫時未有題目，請揀其他年份或月份。');
      return;
    }
    router.push('/(tabs)/practice-exam'); // ✅ 直入 Exam 練習頁
  };

  return (
    <SafeAreaView style={s.screen} edges={['left','right']}>
      <ScrollView contentContainerStyle={s.wrap}>
        {/* 程度 */}
        <Text style={s.sectionTitle}>程度</Text>
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
        <Text style={s.sectionTitle}>年份</Text>
        <Pressable onPress={() => setOpen1120(v => !v)} style={s.boxHeader}>
          <Text style={s.boxHeaderText}>2011–2020</Text>
          <Text style={s.boxHeaderText}>{open1120 ? '▴' : '▾'}</Text>
        </Pressable>
        {open1120 && (
          <View style={[s.box, { marginTop: 6 }]}>
            <View style={s.rowWrap}>
              {YEARS_11_20.map(y => (
                <Pressable
                  key={y}
                  onPress={() => setYear(y)}
                  style={[s.pillSm, year === y && s.pillActive]}
                >
                  <Text style={[s.pillTextSm, year === y && s.pillTextActive]}>{y}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <Pressable onPress={() => setOpen2125(v => !v)} style={s.boxHeader}>
          <Text style={s.boxHeaderText}>2021–2025</Text>
          <Text style={s.boxHeaderText}>{open2125 ? '▴' : '▾'}</Text>
        </Pressable>
        {open2125 && (
          <View style={[s.box, { marginTop: 6 }]}>
            <View style={s.rowWrap}>
              {YEARS_21_25.map(y => (
                <Pressable
                  key={y}
                  onPress={() => setYear(y)}
                  style={[s.pillSm, year === y && s.pillActive]}
                >
                  <Text style={[s.pillTextSm, year === y && s.pillTextActive]}>{y}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* 月份 */}
        <Text style={s.sectionTitle}>月份</Text>
        <View style={s.row}>
          {[
            { k: '07', label: '7月' as const },
            { k: '12', label: '12月' as const },
          ].map(x => (
            <Pressable
              key={x.k}
              onPress={() => setMonth(x.k as '07' | '12')}
              style={[s.pill, month === x.k && s.pillActive]}
            >
              <Text style={[s.pillText, month === x.k && s.pillTextActive]}>{x.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* 開始練習 */}
        {!canStart && <Text style={s.hint}>請揀齊「年份」同「月份」先可以開始。</Text>}
        <Pressable
          style={[s.next, !canStart && s.nextDisabled]}
          onPress={onStartPress}
          disabled={!canStart}
        >
          <Text style={[s.nextText, !canStart && s.nextTextDisabled]}>開始練習</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
