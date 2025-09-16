// app/(tabs)/index.tsx
import { useState, useMemo, useLayoutEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  useColorScheme,
  Image,
} from 'react-native';
import { router, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuiz } from '../../src/store/useQuiz';
import type { PracticeFilter } from '../../src/db';
import type { Topic } from '../../src/db/schema';

type Kind = 'language' | 'reading' | 'listening';
const YEARS_11_20 = Array.from({ length: 9 }, (_, i) => 2011 + i); // 2011–2019
const YEARS_21_25 = Array.from({ length: 5 }, (_, i) => 2021 + i); // 2021–2025

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
      paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1,
      borderColor: C.border, backgroundColor: C.card,
    },
    pillSm: {
      paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1,
      borderColor: C.border, backgroundColor: C.card,
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

  // 這裏直接在頁面層設定 header：左 logo、右設定
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({
      title: '篩選',
      headerLeft: () => (
        <Image
          source={require('../../assets/images/icon.png')}
          style={{ width: 24, height: 24, marginLeft: 12, borderRadius: 6 }}
          resizeMode="contain"
        />
      ),
      headerRight: () => (
        <Pressable onPress={() => router.push('/settings')} style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
          <Ionicons name="settings-outline" size={22} color={isDark ? '#fff' : '#111'} />
        </Pressable>
      ),
    });
  }, [navigation, isDark]);

  // 預設：程度=N2–N3隨機；年份=隨機；月份=隨機；類型=言語知識
  const [level, setLevel] = useState<Topic | 'N2-N3-random' | 'all'>('N2-N3-random');
  const [year, setYear] = useState<number | 'random' | undefined>('random');
  const [session, setSession] = useState<'July' | 'December' | 'random' | undefined>('random');
  const [kind, setKind] = useState<Kind>('language');

  const [open1120, setOpen1120] = useState(false);
  const [open2125, setOpen2125] = useState(false);

  const { init } = useQuiz();

  const start = async () => {
    const filters: PracticeFilter = { level, kind, year, session };
    await init(filters);
    router.navigate('/(tabs)/practice'); // 跳去 Tabs 裏面的「練習」
  };

  return (
    <SafeAreaView style={s.screen} edges={['left','right']}>
      <ScrollView contentContainerStyle={s.wrap}>
        {/* 程度 */}
        <Text style={s.label}>程度</Text>
        <View style={s.row}>
          {[
            { k: 'N2-N3-random', label: 'N2–N3 隨機' },
            { k: 'daily', label: '日常生活題目' },
            { k: 'N1', label: 'N1' },
            { k: 'N2', label: 'N2' },
            { k: 'N3', label: 'N3' },
            { k: 'N4', label: 'N4' },
            { k: 'N5', label: 'N5' },
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

        {/* 年份 */}
        <Text style={s.label}>年份</Text>
        <View style={s.row}>
          <Pressable onPress={() => setYear('random')} style={[s.pill, year === 'random' && s.pillActive]}>
            <Text style={[s.pillText, year === 'random' && s.pillTextActive]}>隨機</Text>
          </Pressable>
          <Pressable onPress={() => setYear(undefined)} style={[s.pill, year === undefined && s.pillActive]}>
            <Text style={[s.pillText, year === undefined && s.pillTextActive]}>未選</Text>
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
        <Pressable style={[s.next, { marginTop: 10 }]} onPress={start}>
          <Text style={s.nextText}>開始練習</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
