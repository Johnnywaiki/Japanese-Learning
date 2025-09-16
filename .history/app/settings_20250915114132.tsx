// app/settings.tsx
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Switch, Platform, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system';

import { useQuiz } from '../src/store/useQuiz';
import { useSettings } from '../src/store/useSettings';
import { speakOneShot, stopSpeak } from '../src/tts';

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
    pill: {
      paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999,
      borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
    },
    pillActive: { backgroundColor: C.accent, borderColor: C.accent },
    pillText: { fontSize: 16, color: C.text },
    pillTextActive: { color: isDark ? '#000' : '#fff', fontWeight: '700' },
    card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, gap: 8 },
    btnRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  });
  return { s };
}

export default function SettingsScreen() {
  const isDark = useColorScheme() === 'dark';
  const { s } = useMemo(() => makeStyles(isDark), [isDark]);

  const { init } = useQuiz();
  const { autoSpeak, setAutoSpeak, rate, setRate } = useSettings();

  const [fsMsg, setFsMsg] = useState<string>('');

  const onResync = () => { void init({ /* 如果想每次都重拉：forceReload:true */ } as any); };

  const onListDbFiles = () => {
    void (async () => {
      const dir = FileSystem.documentDirectory + 'SQLite/';
      const files = await FileSystem.readDirectoryAsync(dir).catch(() => []);
      setFsMsg(`SQLite dir: ${dir}\nfiles: ${files.join(', ') || '(none)'}`);
      console.log('SQLite dir =', dir, files);
    })();
  };

  const onWipeLocalDbAndResync = () => {
    void (async () => {
      const base = FileSystem.documentDirectory + 'SQLite/';
      const files = ['jp_quiz.db','jp_quiz.db-wal','jp_quiz.db-shm','jp_quiz.db-journal'];
      for (const f of files) await FileSystem.deleteAsync(base + f, { idempotent: true }).catch(() => {});
      setFsMsg('已刪除本地 DB 檔，正在重新同步…');
      await init({} as any);
      setFsMsg(prev => prev + '\n完成重新同步。');
    })();
  };

  const setRatePreset = (preset: 'slow' | 'normal' | 'fast') => {
    if (preset === 'slow') setRate(0.85);
    if (preset === 'normal') setRate(1.0);
    if (preset === 'fast') setRate(1.15);
  };

  return (
    <SafeAreaView style={s.screen} edges={['left','right']}>
      <View style={s.wrap}>
        <Text style={s.h1}>設定</Text>

        <View style={s.card}>
          <Text style={s.label}>離線資料（本地 DB）</Text>
          <View style={s.row}>
            <Pressable onPress={onListDbFiles} style={s.pill}>
              <Text style={s.pillText}>列出 DB 檔</Text>
            </Pressable>
            <Pressable onPress={onWipeLocalDbAndResync} style={[s.pill, s.pillActive]}>
              <Text style={[s.pillText, s.pillTextActive]}>清除本地 DB 並重拉</Text>
            </Pressable>
            <Pressable onPress={onResync} style={[s.pill]}>
              <View style={s.btnRow}>
                <Ionicons name="refresh" size={16} />
                <Text style={s.pillText}>重新同步</Text>
              </View>
            </Pressable>
          </View>
          {!!fsMsg && <Text style={s.hint}>{fsMsg}</Text>}
        </View>

        <View style={s.card}>
          <Text style={s.label}>發音（TTS）</Text>
          <View style={[s.row, { alignItems: 'center', justifyContent: 'space-between' }]}>
            <Text style={s.pillText}>自動朗讀題幹</Text>
            <Switch value={autoSpeak} onValueChange={(v) => { if (!v) stopSpeak(); setAutoSpeak(v); }} />
          </View>
          <Text style={s.pillText}>播速</Text>
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
          <View style={s.row}>
            <Pressable onPress={() => { void speakOneShot('駅まで歩きます。', { rate }); }} style={s.pill}>
              <Text style={s.pillText}>立即試播（日文）</Text>
            </Pressable>
          </View>
        </View>

        <Pressable onPress={() => router.replace('/(tabs)')} style={[s.pill, s.pillActive, { alignSelf: 'flex-start' }]}>
          <Text style={[s.pillText, s.pillTextActive]}>返回主頁</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
