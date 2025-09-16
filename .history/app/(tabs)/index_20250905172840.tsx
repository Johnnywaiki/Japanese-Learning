// app/(tabs)/index.tsx
import { useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useQuiz } from '../../src/store/useQuiz';
import type { QuizItem } from '../../src/db/schema';
import { useSettings } from '../../src/store/useSettings';
import { speakOneShot, stopSpeak } from '../../src/tts';

export default function PracticeScreen() {
  const { init, loading, current, answer, next, lastCorrect, score, total, error } = useQuiz();
  const { rate, pitch, voiceId } = useSettings(); // 只用播速/聲線；唔自動播

  useEffect(() => { init(); }, []);

  // 離開頁面時停播，避免殘留
  useEffect(() => {
    return () => { stopSpeak(); };
  }, []);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator />
        <Text style={s.mt8}>載入中…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.wrap}>
        <Text style={[s.feedback, { color: '#d11' }]}>{error}</Text>
        <Pressable style={s.next} onPress={init}>
          <Text style={s.nextText}>重新嘗試</Text>
        </Pressable>
      </View>
    );
  }

  if (!current) {
    return (<View style={s.center}><Text>暫無題目。</Text></View>);
  }

  return (
    <View style={s.wrap}>
      <Text style={s.progress}>分數 {score}/{total}</Text>

      {/* 題幹 + 手動發音按鈕（每按只讀一次） */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={s.stem}>{current.stem}</Text>
        <Pressable
          onPress={() => speakOneShot(current.stem, { rate, pitch, voiceId })}
          style={s.speaker}
        >
          <Text style={{ fontSize: 18 }}>🔊</Text>
        </Pressable>
      </View>

      {/* 四選一 */}
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
        <Text style={[s.feedback, { color: lastCorrect ? '#1e9e58' : '#d11' }]}>
          {lastCorrect ? '正確！' : `唔啱😅 正解：${current.optionText(current.answer)}`}
        </Text>
      )}

      {/* 下一題：先停播再出題，避免殘留/重播 */}
      <Pressable
        style={s.next}
        onPress={() => { stopSpeak(); next(); }}
      >
        <Text style={s.nextText}>下一題</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mt8: { marginTop: 8 },
  wrap: { flex: 1, padding: 16, gap: 16 },
  progress: { fontSize: 16, opacity: 0.7 },
  stem: { fontSize: 22, lineHeight: 30, flexShrink: 1 },
  speaker: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#ddd' },
  options: { gap: 12 },
  btn: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#ddd' },
  btnPressed: { opacity: 0.6 },
  btnText: { fontSize: 18 },
  feedback: { fontSize: 16 },
  next: { marginTop: 'auto', padding: 14, borderRadius: 12, backgroundColor: '#111' },
  nextText: { color: '#fff', textAlign: 'center', fontSize: 18, fontWeight: '600' },
});
