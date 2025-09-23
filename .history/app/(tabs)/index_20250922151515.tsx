// app/(tabs)/index.tsx
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, useColorScheme } from 'react-native';
import type { Href } from 'expo-router';
import { router } from 'expo-router';
import type { Topic } from '@/src/db';

type Kind = 'language' | 'reading' | 'listening';

const LEVEL_CHOICES: Array<Topic | 'N2-N3-random' | 'all'> = ['N1','N2','N3','N4','N5','N2-N3-random','all'];
const KIND_CHOICES: Kind[] = ['language', 'reading', 'listening'];
const MONTHS: Array<'07' | '12'> = ['07', '12'];
const SESSIONS: Array<'July' | 'December'> = ['July', 'December'];

function useStyles(isDark: boolean) {
  const C = {
    bg: isDark ? '#000' : '#fff',
    text: isDark ? '#eee' : '#111',
    muted: isDark ? '#9ca3af' : '#6b7280',
    card: isDark ? '#0b0b0b' : '#fff',
    border: isDark ? '#2a2a2a' : '#e5e7eb',
    accent: isDark ? '#93c5fd' : '#2563eb',
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
    input: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: C.text },
    btn: { alignSelf: 'flex-start', marginTop: 16, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, borderColor: C.accent },
    btnText: { color: C.accent, fontSize: 16, fontWeight: '900' },
  });
  return { s };
}

export default function PracticeFilterScreen() {
  const isDark = useColorScheme() === 'dark';
  const { s } = useStyles(isDark);

  const [level, setLevel] = useState<Topic | 'N2-N3-random' | 'all'>('N2-N3-random');
  const [kind, setKind] = useState<Kind>('language');
  const [year, setYear] = useState<string>('');
  const [month, setMonth] = useState<'07' | '12' | undefined>(undefined);
  const [session, setSession] = useState<'July' | 'December' | undefined>(undefined);

  const start = () => {
    const params: Record<string, string> = { level: String(level), kind };
    if (year.trim()) params.year = year.trim();
    if (month) params.month = month;
    if (session) params.session = session;

    const to: Href = { pathname: '/(tabs)/practice-exam', params };
    router.navigate(to);
  };

  return (
    <View style={s.screen}>
      <Text style={s.h1}>模擬試卷（Exam/Mock）</Text>

      <Text style={s.label}>程度</Text>
      <View className="row" style={s.row}>
        {LEVEL_CHOICES.map((lv) => {
          const active = lv === level;
          return (
            <Pressable key={lv} onPress={() => setLevel(lv)} style={[s.pill, active && s.pillActive]}>
              <Text style={[s.pillText, active && s.pillTextActive]}>{lv}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={s.label}>題型</Text>
      <View style={s.row}>
        {KIND_CHOICES.map((k) => {
          const active = k === kind;
          const label = k === 'language' ? '語言知識（詞彙/文法）' : k === 'reading' ? '讀解' : '聽解';
          return (
            <Pressable key={k} onPress={() => setKind(k)} style={[s.pill, active && s.pillActive]}>
              <Text style={[s.pillText, active && s.pillTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={s.card}>
        <Text style={s.label}>年份（可選）</Text>
        <TextInput
          value={year}
          onChangeText={setYear}
          keyboardType="number-pad"
          placeholder="例如：2021"
          placeholderTextColor="#999"
          style={s.input}
        />

        <Text style={s.label}>月份（可選）</Text>
        <View style={s.row}>
          {MONTHS.map((m) => {
            const active = m === month;
            return (
              <Pressable key={m} onPress={() => setMonth(active ? undefined : m)} style={[s.pill, active && s.pillActive]}>
                <Text style={[s.pillText, active && s.pillTextActive]}>{m}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={s.label}>Session（可選）</Text>
        <View style={s.row}>
          {SESSIONS.map((ss) => {
            const active = ss === session;
            return (
              <Pressable key={ss} onPress={() => setSession(active ? undefined : ss)} style={[s.pill, active && s.pillActive]}>
                <Text style={[s.pillText, active && s.pillTextActive]}>{ss}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={s.hint}>如同時指定 month 及 session，會以你提供的值為準；否則 store 端會自動從 session 推算 month。</Text>
      </View>

      <Pressable onPress={start} style={s.btn}>
        <Text style={s.btnText}>開始模擬練習</Text>
      </Pressable>
    </View>
  );
}
