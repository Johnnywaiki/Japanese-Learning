// app/result.tsx
import { useLocalSearchParams, router } from 'expo-router';
import type { Href } from 'expo-router';
import { View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';

export default function ResultModal() {
  const isDark = useColorScheme() === 'dark';
  const { correct = '0', total = '0', from = 'home' } = useLocalSearchParams<{
    correct?: string; total?: string; from?: 'home' | 'index';
  }>();

  const cNum = Number(correct || 0);
  const tNum = Number(total || 0);
  const wrong = Math.max(0, tNum - cNum);
  const rate = tNum > 0 ? Math.round((cNum / tNum) * 100) : 0;

  const C = {
    bg: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.35)',
    card: isDark ? '#111827' : '#fff',
    text: isDark ? '#e5e7eb' : '#111827',
    soft: isDark ? '#9ca3af' : '#6b7280',
    good: '#22c55e',
    bad: '#ef4444',
    primary: isDark ? '#93c5fd' : '#2563eb',
  };

  const HOME: Href = '/(tabs)/home';
  const INDEX: Href = '/(tabs)'; // ✅ 用 group 自身

  const goBack = () => {
    router.replace(from === 'home' ? HOME : INDEX);
  };

  return (
    <View style={[s.overlay, { backgroundColor: C.bg }]}>
      <View style={[s.card, { backgroundColor: C.card }]}>
        <Text style={[s.title, { color: C.text }]}>完成啦！</Text>

        <View style={s.row}>
          <Text style={[s.kpi, { color: C.good }]}>{cNum}</Text>
          <Text style={[s.kpiLabel, { color: C.soft }]}>正確</Text>
        </View>
        <View style={s.row}>
          <Text style={[s.kpi, { color: C.bad }]}>{wrong}</Text>
          <Text style={[s.kpiLabel, { color: C.soft }]}>錯誤</Text>
        </View>

        <View style={[s.rateBox, { borderColor: C.primary }]}>
          <Text style={[s.rateText, { color: C.primary }]}>正確率 {rate}%</Text>
        </View>

        <View style={s.btnRow}>
          <Pressable
            onPress={goBack}
            style={({ pressed }) => [
              s.btn,
              { borderColor: C.primary },
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={[s.btnText, { color: C.primary }]}>
              {from === 'home' ? '返回 Home' : '返回 Index'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: {
    width: '100%', borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  title: { fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 12 },
  row: { alignItems: 'center', marginVertical: 6 },
  kpi: { fontSize: 36, fontWeight: '900' },
  kpiLabel: { fontSize: 12, marginTop: 2 },
  rateBox: { marginTop: 10, paddingVertical: 10, borderRadius: 999, borderWidth: 1, alignItems: 'center' },
  rateText: { fontSize: 16, fontWeight: '800' },
  btnRow: { marginTop: 14, flexDirection: 'row', justifyContent: 'center' },
  btn: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1 },
  btnText: { fontSize: 16, fontWeight: '800' },
});
