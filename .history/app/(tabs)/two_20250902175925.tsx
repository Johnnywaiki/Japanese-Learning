import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useQuiz } from '../../src/store/useQuiz';
import { useEffect } from 'react';

const modes = [
  { key: 'mix', label: '混合' },
  { key: 'words', label: '只單字' },
  { key: 'sentences', label: '只例句' },
] as const;

const topics = [
  { key: 'all', label: '全部' },
  { key: 'N3', label: 'N3' },
  { key: 'N2', label: 'N2' },
  { key: 'daily', label: '日常' },
] as const;

export default function SettingsScreen() {
  const { init, mode, setMode, topic, setTopic } = useQuiz();

  useEffect(() => { init(); }, []);

  return (
    <View style={s.wrap}>
      <Text style={s.h1}>設定</Text>

      <Text style={s.label}>題型模式</Text>
      <View style={s.row}>
        {modes.map(m => (
          <Pressable key={m.key} onPress={() => setMode(m.key)} style={[s.pill, mode === m.key && s.pillActive]}>
            <Text style={[s.pillText, mode === m.key && s.pillTextActive]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.label}>主題（Topic）</Text>
      <View style={s.row}>
        {topics.map(t => (
          <Pressable key={t.key} onPress={() => setTopic(t.key as any)} style={[s.pill, topic === t.key && s.pillActive]}>
            <Text style={[s.pillText, topic === t.key && s.pillTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.hint}>切換會即時換新題；「重新同步」會從雲端 JSON 覆蓋本地資料。</Text>

      <Pressable onPress={init} style={[s.pill, s.pillActive, { alignSelf: 'flex-start', marginTop: 12 }]}>
        <Text style={[s.pillText, s.pillTextActive]}>重新同步</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 16 },
  h1: { fontSize: 22, fontWeight: '700' },
  label: { fontSize: 16, marginTop: 8 },
  row: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  pill: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: '#ddd' },
  pillActive: { backgroundColor: '#111', borderColor: '#111' },
  pillText: { fontSize: 16 },
  pillTextActive: { color: '#fff', fontWeight: '700' },
  hint: { opacity: 0.6, marginTop: 8 },
});
