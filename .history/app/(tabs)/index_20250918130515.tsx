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

  // ───────────────── state ─────────────────
  // level：N1~N5 或 'daily'
  const [level, setLevel] = useState<Topic | 'daily' | null>(null);

  // 年份／月份：移除「隨機／未選」→ 要揀實際年份 & 7/12
  const [year, setYear] = useState<number | null>(null);
  const [session, setSession] = useState<'July' | 'December' | null>(null);

  // 類型：合併成「言語+讀解」或「聽解」
  const [kindUI, setKindUI] = useState<KindUI>('lang_reading');

  // 年份展開
  const [open1120, setOpen1120] = useState(true);
  const [open2125, setOpen2125] = useState(true);

  // 開始按鈕是否可用：
  // - level = 'daily'：可以直接開始（唔需要年/月）
  // - level = N1~N5：必須揀齊 year + session
  const isNLevel = typeof level === 'string' && /^N[1-5]$/.test(level);
  const canStart = !!level && (!isNLevel || (year && session));

  const onStartPress = () => {
    if (!canStart) return;

    // 將 UI 選擇轉成 store 所需的 PracticeFilter
    // 注意：store 內部當 level=Nx + year + session 時會視為「整份卷」模式
    //       會讀取全卷（含讀解；如 DB 有聽解亦可能包含）。
    //       如果你想嚴格「言語+讀解（不含聽解）」要在 store 內調整查詢邏輯。
    const base: PracticeFilter = ((): PracticeFilter => {
      if (level === 'daily') {
        // 日常題目：唔跟卷期，只按類型
        return {
          level: 'daily' as any,
          kind: kindUI === 'listening' ? 'listening' : 'language',
        };
      }

      // N 級 + 年月：整份卷
      return {
        level: level as Topic,
        kind: kindUI === 'listening' ? 'listening' : 'language', // store 可能忽略 kind（整份卷）
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
          {/* 「日常生活題目」放同一行 */}
          <Pressable
            onPress={() => setLevel('daily')}
            style={[s.pill, level === 'daily' && s.pillActive]}
          >
            <Text style={[s.pillText, level === 'daily' && s.pillTextActive]}>日常生活題目</Text>
          </Pressable>
        </View>

        {/* 年份（移除 隨機 / 未選） */}
        <Text style={s.sectionTitle}>年份</Text>

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

        {/* 月份（移除 隨機） */}
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
          <Text style={s.hint}>請先揀齊「年份」同「月份」先可以開始。</Text>
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
