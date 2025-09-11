import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useQuiz } from '../../src/store/useQuiz';
import { useEffect } from 'react';

const modes = [
  { key: 'mix', label: '混合' },
  { key: 'words', label: '只單字' },
  { key: 'sentences', label: '只例句' },
] as const;

export default function SettingsScreen() {
  const { init, mode, setMode } = useQuiz();

  // 確保第一次進入時建立資料庫
  useEffect(() => { init(); }, []);

  return (
    <View style={s.wrap}>
      <Text style={s.h1}>設定</Text>

      <Text style={s.label}>題型模式</Text>
      <View style={s.row}>
        {modes.map(m => (
          <Pressable
            key={m.key}
            onPress={() => setMode(m.key)}
            style={[s.pill, mode === m.key && s.pillActive]}
          >
            <Text style={[s.pillText, mode === m.key && s.pillTextActive]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.hint}>切換模式會即時換一條新題，並避免連續抽到同一題。</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 16 },
  h1: { fontSize: 22, fontWeight: '700' },
  label: { fontSize: 16, marginTop: 8 },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  pill: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: '#ddd' },
  pillActive: { backgroundColor: '#111', borderColor: '#111' },
  pillText: { fontSize: 16 },
  pillTextActive: { color: '#fff', fontWeight: '700' },
  hint: { opacity: 0.6, marginTop: 8 },
})