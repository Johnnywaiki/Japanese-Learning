// app/(tabs)/two.tsx
import { View, Text, Pressable, StyleSheet, Platform, Switch } from 'react-native';
import { useQuiz } from '../src/store/useQuiz';
import { useState } from 'react';
import Constants from 'expo-constants';
import { pingJsonSource } from '../src/db/remote';
import { useSettings } from '../src/store/useSettings';
import { speakOneShot } from '../src/tts';

function getDataUrl(): string | undefined {
  return (
    process.env.EXPO_PUBLIC_DATA_URL ??
    (Constants.expoConfig?.extra as any)?.EXPO_PUBLIC_DATA_URL ??
    (Constants.manifest2 as any)?.extra?.EXPO_PUBLIC_DATA_URL
  );
}

export default function SettingsScreen() {
  const { init } = useQuiz();
  const { autoSpeak, setAutoSpeak, rate, setRate } = useSettings();
  const [testMsg, setTestMsg] = useState<string>('');
  const dataUrl = getDataUrl();

  const onTest = async () => {
    setTestMsg('測試中…');
    const r = await pingJsonSource();
    setTestMsg(`${r.ok ? '✅' : '❌'} ${r.msg}${r.url ? ` | ${r.url}` : ''}${r.status ? ` | HTTP ${r.status}` : ''}`);
  };

  const setRatePreset = (preset: 'slow'|'normal'|'fast') => {
    if (preset === 'slow') setRate(0.85);
    if (preset === 'normal') setRate(1.0);
    if (preset === 'fast') setRate(1.15);
  };

  return (
    <View style={s.wrap}>
      <Text style={s.h1}>設定</Text>

      {/* 資料來源（JSON）＋ 重新同步 */}
      <Text style={s.label}>資料來源 URL</Text>
      <Text style={s.mono}>{dataUrl ?? '(未設定 EXPO_PUBLIC_DATA_URL)'}</Text>
      <View style={{ flexDirection:'row', gap:8, marginTop:8, flexWrap:'wrap' }}>
        <Pressable onPress={() => init()} style={[s.pill, s.pillActive]}>
          <Text style={[s.pillText, s.pillTextActive]}>重新同步</Text>
        </Pressable>
        <Pressable onPress={onTest} style={[s.pill, { borderColor:'#888' }]}>
          <Text style={s.pillText}>測試 JSON 來源</Text>
        </Pressable>
      </View>
      {!!testMsg && <Text style={[s.hint, { marginTop:8 }]}>{testMsg}</Text>}

      {/* TTS 設定 */}
      <Text style={[s.label, { marginTop:16 }]}>發音（TTS）</Text>
      <View style={[s.row, { alignItems:'center', justifyContent:'space-between' }]}>
        <Text style={s.pillText}>自動朗讀題幹</Text>
        <Switch value={autoSpeak} onValueChange={setAutoSpeak} />
      </View>

      <Text style={s.pillText}>播速</Text>
      <View style={s.row}>
        {[
          { k: 'slow', label: '慢' },
          { k: 'normal', label: '正常' },
          { k: 'fast', label: '快' },
        ].map(p => (
          <Pressable
            key={p.k}
            onPress={() => setRatePreset(p.k as any)}
            style={[
              s.pill,
              (p.k === 'slow' && rate < 0.9) ||
              (p.k === 'normal' && rate >= 0.9 && rate <= 1.05) ||
              (p.k === 'fast' && rate > 1.05)
                ? s.pillActive
                : null
            ]}
          >
            <Text
              style={[
                s.pillText,
                (p.k === 'slow' && rate < 0.9) ||
                (p.k === 'normal' && rate >= 0.9 && rate <= 1.05) ||
                (p.k === 'fast' && rate > 1.05)
                  ? s.pillTextActive
                  : null
              ]}
            >
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection:'row', gap:8, marginTop:8 }}>
        <Pressable onPress={() => speakOneShot('駅まで歩きます。', { rate })} style={[s.pill, { borderColor:'#888' }]}>
          <Text style={s.pillText}>立即試播（日文）</Text>
        </Pressable>
      </View>

      <Text style={[s.hint, { marginTop:8 }]}>
        iOS/Android 需要安裝日文語音包；若無聲，請到系統語音設定下載日文語音。
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
