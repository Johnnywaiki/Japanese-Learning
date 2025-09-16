// app/(tabs)/practice.tsx
import { useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuiz } from '../../src/store/useQuiz';
import type { QuizItem } from '../../src/db/schema';

export default function PracticeScreen() {
  const isDark = useColorScheme() === 'dark';
  const C = {
    bg: isDark ? '#000' : '#fff',
    text: isDark ? '#eee' : '#111',
    card: isDark ? '#111' : '#fff',
    border: isDark ? '#333' : '#ddd',
    accent: isDark ? '#fff' : '#111',
    danger: '#d11',
    success: '#1e9e58',
    mute: isDark ? '#9ca3af' : '#6b7280',
  };

  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    mt8: { marginTop: 8 },
    wrap: { flex: 1, padding: 16, gap: 16 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    progress: { fontSize: 15, color: C.text },
    totalAvail: { fontSize: 15, color: C.mute },
    stem: { fontSize: 22, lineHeight: 30, color: C.text },
    options: { gap: 12 },
    btn: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
    btnPressed: { opacity: 0.6 },
    btnText: { fontSize: 18, color: C.text },
    feedback: { fontSize: 16 },
    next: { marginTop: 'auto', padding: 14, borderRadius: 12, backgroundColor: C.accent },
    nextText: { color: isDark ? '#000' : '#fff', textAlign: 'center', fontSize: 18, fontWeight: '600' },
  });

  const { init, loading, current, answer, next, lastCorrect, score, total, totalAvailable } = useQuiz();

  useEffect(() => { init(); }, []);

  if (loading || !current) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.center}>
          <ActivityIndicator />
          <Text style={[s.mt8, { color: C.text }]}>載入中…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen} edges={['left','right']}>
      <View style={s.wrap}>
        {/* 頂部：分數 + 總題數 */}
        <View style={s.topRow}>
          <Text style={s.progress}>分數 {score}/{total}</Text>
          <Text style={s.totalAvail}>總題數 {totalAvailable}</Text>
        </View>

        {/* 題幹 */}
        <Text style={s.stem}>{current.stem}</Text>

        {/* 選項 */}
        <View style={s.options}>
          {current.options.map((opt: QuizItem, idx: number) => (
            <Pressable
              key={idx}
              style={({ pressed }) => [s.btn, pressed && s.btnPressed]}
              onPress={() => answer(opt)}
            >
              <Text style={s.btnText}>{current.optionText(opt)}</Text>
            </Pressable>
          ))}
        </View>

        {/* 回饋 */}
        {lastCorrect !== undefined && (
          <Text style={[s.feedback, { color: lastCorrect ? C.success : C.danger }]}>
            {lastCorrect ? '正確！' : `唔啱😅 正解：${current.optionText(current.answer)}`}
          </Text>
        )}

        {/* 下一題 */}
        <Pressable style={s.next} onPress={next}>
          <Text style={s.nextText}>下一題</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
