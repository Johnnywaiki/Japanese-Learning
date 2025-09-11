import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useQuiz } from '../../src/store/useQuiz';
import { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import { pingJsonSource } from '../../src/db/remote';
import type { Topic } from '../../src/db/schema';

const modes = [
  { key: 'mix', label: '混合' },
  { key: 'words', label: '只單字' },
  { key: 'sentences', label: '只例句' },
] as const;

type TopicKey = Topic | 'all';
const topics: ReadonlyArray<{ key: TopicKey; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'N3', label: 'N3' },
  { key: 'N2', label: 'N2' },
  { key: 'daily', label: '日常' },
];

function getDataUrl(): string | undefined {
  return (
    process.env.EXPO_PUBLIC_DATA_URL ??
    (Constants.expoConfig?.extra as any)?.EXPO_PUBLIC_DATA_URL ??
    (Constants.manifest2 as any)?.extra?.EXPO_PUBLIC_DATA_URL
  );
}

export default function SettingsScreen() {
  const { init, mode, setMode, topic, setTopic } = useQuiz();
  const [testMsg, setTestMsg] = useState<string>('');
  const dataUrl = getDataUrl();

  useEffect(() => { init(); }, []);

  const onTest = async () => {
    setTestMsg('測試中…');
    const r = await pingJsonSource();
    setTestMsg(`${r.ok ? '✅' : '❌'} ${r.msg}${r.url ? ` | ${r.url}` : ''}${r.status ? ` | HTTP ${r.status}` : ''}`);
  };

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
          <Pressable key={t.key} onPress={() => setTopic(t.key)} style={[s.pill, topic === t.key && s.pillActive]}>
            <Text style={[s.pillText, topic === t.key && s.pillTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.label}>資料來源 URL</Text>
      <Text style={s.mono}>{dataUrl ?? '(未設定 EXPO_PUBLIC_DATA_URL)'}</Text>

      <View style={{ flexDirection:'row', gap:8, marginTop:8, flexWrap:'wrap' }}>
        <Pressable onPress={init} style={[s.pill, s.pillActive]}>
          <Text style={[s.pillText, s.pillTextActive]}>重新同步</Text>
        </Pressable>
        <Pressable onPress={onTest} style={[s.pill, { borderColor:'#888' }]}>
          <Text style={s.pillText}>測試 JSON 來源</Text>
        </Pressable>
      </View>

      {!!testMsg && <Text style={[s.hint, { marginTop:8 }]}>{testMsg}</Text>}
      <Text style={[s.hint, { marginTop:8 }]}>
        提示：GitHub Gist 請使用「Raw」連結（raw.githubusercontent.com/...），必須是 HTTPS。
      </Text>
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
  hint: { opacity: 0.7 },
  mono: { fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }), opacity: 0.8 }
});
