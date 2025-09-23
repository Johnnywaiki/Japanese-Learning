// app/level.tsx
import { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const LEVEL_KEY = 'user.level';
const LEVELS = ['N1', 'N2', 'N3', 'N4', 'N5'] as const;

function makeStyles(isDark: boolean) {
  const C = {
    bg: isDark ? '#000' : '#fff',
    text: isDark ? '#eee' : '#111',
    border: isDark ? '#333' : '#e5e7eb',
    active: isDark ? '#fff' : '#111',
  };
  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg, padding: 20, gap: 16, justifyContent: 'center' },
    title: { fontSize: 22, fontWeight: '700', color: C.text, textAlign: 'center', marginBottom: 8 },
    grid: { gap: 12 },
    btn: {
      paddingVertical: 18,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: 'center',
      backgroundColor: C.bg,
    },
    btnText: { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: 1 },
    btnPressing: { backgroundColor: isDark ? '#111' : '#f5f5f5' },
  });
  return { s };
}

export default function LevelScreen() {
  const isDark = useColorScheme() === 'dark';
  const { s } = makeStyles(isDark);

  const onPick = useCallback(async (lv: string) => {
    await AsyncStorage.setItem(LEVEL_KEY, lv);
    router.replace('/(tabs)/home');
  }, []);

  return (
    <View style={s.screen}>
      <Text style={s.title}>揀你嘅程度</Text>
      <View style={s.grid}>
        {LEVELS.map((lv) => (
          <Pressable
            key={lv}
            onPress={() => onPick(lv)}
            style={({ pressed }) => [s.btn, pressed && s.btnPressing]}
          >
            <Text style={s.btnText}>{lv}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
