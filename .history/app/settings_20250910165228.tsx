import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Switch, Platform, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';

import { useQuiz } from '../src/store/useQuiz';
import { useSettings } from '../src/store/useSettings';
import { pingJsonSource } from '../src/db/remote';
import { speakOneShot, stopSpeak } from '../src/tts';

function getDataUrl(): string | undefined {
  return (
    process.env.EXPO_PUBLIC_DATA_URL ??
    (Constants.expoConfig?.extra as any)?.EXPO_PUBLIC_DATA_URL ??
    (Constants.manifest2 as any)?.extra?.EXPO_PUBLIC_DATA_URL
  );
}

function makeStyles(isDark: boolean) {
  const C = {
    bg: isDark ? '#000' : '#fff',
    text: isDark ? '#eee' : '#111',
    muted: isDark ? '#9ca3af' : '#6b7280',
    card: isDark ? '#111' : '#fff',
    border: isDark ? '#333' : '#e5e7eb',
    accent: isDark ? '#fff' : '#111',
  };
  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    wrap: { padding: 16, gap: 14 },
    h1: { fontSize: 22, fontWeight: '700', color: C.text },
    label: { fontSize: 16, color: C.text, marginTop: 6 },
    hint: { fontSize: 13, color: C.muted },
    row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 },
    pill: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
    pillActive: { backgroundColor: C.accent, borderColor: C.accent },
    pillText: { fontSize: 16, color: C.text },
    pillTextActive: { color: isDark ? '#000' : '#fff', fontWeight: '700' },
    mono: { fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }), color: C.muted },
    card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12 },
  });
  return { C, s };
}

export default function SettingsScreen() {
  const isDark = useColorScheme() === 'dark';
  const { s, C } = useMemo(() => makeStyles(isDark), [isDark]);

  const { init } = useQuiz();
  const { autoSpeak, setAutoSpeak, rate, setRate } = useSettings();

  const [testMsg, setTestMsg] = useState<string>('');
  const dataUrl = getDataUrl();

  // ✅ 包同步 handler，onPress 型別就正確
  const onResync = () => { void init(); };

  const onTestJson = () => {
    setTestMsg('測試中…');
    void pingJsonSource().then(r => {
      setTestMsg(`${r.ok ? '✅' : '❌'} ${r.msg}${r.url ? ` | ${r.url}` : ''}${r.status ? ` | HTTP ${r.status}` : ''}`);
    });
  };

  const setRatePreset = (preset: 'slow'|'normal'|'fast') => {
    if (preset === 'slow') setRate(0.85);
    if (preset === 'normal') setRate(1.0);
    if (preset === 'fast') setRate(1.15);
  };

  return (
    <SafeAreaView style={s.screen} edges={['left','right']}>
      <View style={s.wrap}>
        <Text style={s.h1}>設定</Text>

        {/* 資料來源 */}
        <View style={s.card}>
          <Text style={s.label}>資料來源 URL</Text>
          <Text style={s.mono}>{dataUrl ?? '(未設定 EXPO_PUBLIC_DATA_URL)'}</Text>

          <View style={[s.row, { marginTop: 10 }]}>
            <Pressable onPress={onResync} style={[s.pill, s.pillActive]}>
              <Text style={[s.pillText, s.pillTextActive]}>
                <Ionicons name="refresh" size={16} color={isDark ? '#000' : '#fff'} /> 重新同步
              </Text>
            </Pressable>
            <Pressable onPress={onTestJson} style={s.pill}>
              <Text style={s.pillText}>測試 JSON 來源</Text>
            </Pressable>
          </View>

          {!!testMsg && <Text style={[s.hint, { marginTop: 8 }]}>{testMsg}</Text>}
          <Text style={[s.hint, { marginTop: 6 }]}>
            提示：GitHub Gist 請使用「Raw」連結（raw.githubusercontent.com/...），必須是 HTTPS。
          </Text>
        </View>

        {/* TTS */}
        <View style={s.card}>
          <Text style={s.label}>發音（TTS）</Text>

          <View style={[s.row, { alignItems: 'center', justifyContent: 'space-between' }]}>
            <Text style={s.pillText}>自動朗讀題幹</Text>
            <Switch value={autoSpeak} onValueChange={(v) => { if (!v) stopSpeak(); setAutoSpeak(v); }} />
          </View>

          <Text style={[s.pillText, { marginTop: 8 }]}>播速</Text>
          <View style={s.row}>
            {[
              { k: 'slow', label: '慢', active: rate < 0.9 },
              { k: 'normal', label: '正常', active: rate >= 0.9 && rate <= 1.05 },
              { k: 'fast', label: '快', active: rate > 1.05 },
            ].map(p => (
              <Pressable key={p.k} onPress={() => setRatePreset(p.k as any)} style={[s.pill, p.active && s.pillActive]}>
                <Text style={[s.pillText, p.active && s.pillTextActive]}>{p.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={[s.row, { marginTop: 8 }]}>
            <Pressable onPress={() => { void speakOneShot('駅まで歩きます。', { rate }); }} style={s.pill}>
              <Text style={s.pillText}>立即試播（日文）</Text>
            </Pressable>
          </View>

          <Text style={[s.hint, { marginTop: 8 }]}>
            iOS/Android 需要安裝日文語音包；若無聲，請到系統語音設定下載日文語音。
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
