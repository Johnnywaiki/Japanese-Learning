// app/(tabs)/index.tsx
import { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  useColorScheme,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuiz } from '../../src/store/useQuiz';
import type { PracticeFilter } from '../../src/db';
import type { Topic } from '../../src/db/schema';

type KindUI = 'lang_reading' | 'listening';

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

  // ────────────── 預設值（如「咩都無揀」）──────────────
  // 預設：N2／2021年／7月
  const [level, setLevel] = useState<Topic | 'daily' | null>('N2');
  const [year, setYear] = useState<number | null>(2021);
  const [session, setSession] = useState<'July' | 'December' | null>('July');

  // 類型：合併「言語+讀解」或「聽解」
  const [kindUI, setKindUI] = useState<KindUI>('lang_reading');

  // 年份展開
  const [open1120, setOpen1120] = useState(true);
  const [open2125, setOpen2125] = useState(true);

  const isNLevel = typeof level === 'string' && /^N[1-5]$/.test(level);
  const canStart = !!level && (!isNLevel || (year && session));

  const onStartPress = () => {
    if (!canStart) return;

    const base: PracticeFilter = ((): PracticeFilter => {
      if (level === 'daily') {
        // 日常題目：唔跟卷期
        return {
          level: 'daily' as any,
          kind: kindUI === 'listening' ? 'listening' : 'language',
        };
      }
      // N 級 + 年月：整份卷
      return {
        level: level as Topic,
        kind: kindUI === 'listening' ? 'listening' : 'language',
        year: year ?? undefined,
        session: session ?? undefined,
      } as PracticeFilter;
    })();

    void init(base).then(() => router.navigate('/(tabs)/practice'));
  };

  return (
    <SafeAreaView style={s.screen} edges={['left','right']}>
      <ScrollView contentContainerStyle={s.wrap}>
        {/* 程度 */}
        <Text style={s.sectionTitle}>程度</Text>
        {/* 第一行：N1–N5 */}
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
        {/* 第二行：日常生活題目（放到 N1–N5 下面） */}
        <View style={s.row}>
          <Pressable
            onPress={() => { setLevel('daily'); /* 可選：清空年/月 */ /* setYear(null); setSession(null); */ }}
            style={[s.pill, level === 'daily' && s.pillActive]}
          >
            <Text style={[s.pillText, level === 'daily' && s.pillTextActive]}>日常生活題目</Text>
          </Pressable>
        </View>

        {/* 年份（只保留實際年份） */}
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

        {/* 月份（只保留 7 / 12） */}
        <Text style={s.sectionTitle}>月份</Text>
        <View style={s.row}>
          {[
            { k: 'July', label: '7月' },
            { k: 'December', label: '12月' },
          ].map(x => (
            <Pressable
              key={x.k}
              onPress={() => setSession(x.k as 'July' | 'December')}
              style={[s.pill, session === (x.k as any) && s.pillActive]}
            >
              <Text style={[s.pillText, session === (x.k as any) && s.pillTextActive]}>{x.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* 類型（合併「言語+讀解」成一個按鈕） */}
        <Text style={s.sectionTitle}>類型</Text>
        <View style={s.row}>
          <Pressable
            onPress={() => setKindUI('lang_reading')}
            style={[s.pill, kindUI === 'lang_reading' && s.pillActive]}
          >
            <Text style={[s.pillText, kindUI === 'lang_reading' && s.pillTextActive]}>
              言語 + 讀解
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setKindUI('listening')}
            style={[s.pill, kindUI === 'listening' && s.pillActive]}
          >
            <Text style={[s.pillText, kindUI === 'listening' && s.pillTextActive]}>
              聽解
            </Text>
          </Pressable>
        </View>

        {/* 開始練習 */}
        {!canStart && isNLevel && (
          <Text style={s.hint}>請揀齊「年份」同「月份」先可以開始。</Text>
        )}
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
