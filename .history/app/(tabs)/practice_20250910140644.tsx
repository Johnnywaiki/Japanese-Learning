// app/(tabs)/practice.tsx
import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuiz } from '../../src/store/useQuiz';
import type { QuizItem } from '../../src/db/schema';
import { speakOneShot, stopSpeak } from '../../src/tts';

const C = {
  text: '#111',
  border: '#e5e7eb',
  card: '#fff',
  muted: '#6b7280',
  accent: '#111',   // 黑色做強調
  bg: '#f8fafc',
  soft: '#f3f4f6',
};

export default function PracticePlayScreen() {
  const { init, loading, current, answer, next, lastCorrect, score, total, error, lastFilters } = useQuiz();
  const [picked, setPicked] = useState<QuizItem | null>(null);
  const [warn, setWarn] = useState<string>('');

  useEffect(() => { if (!current) init(lastFilters); }, []); // eslint-disable-line
  useEffect(() => () => stopSpeak(), []);
  useEffect(() => { setPicked(null); setWarn(''); }, [current?.stem]);

  if (loading && !current) {
    return (
      <SafeAreaView style={s.center} edges={['left','right']}>
        <ActivityIndicator />
        <Text style={s.mt8}>載入中…</Text>
      </SafeAreaView>
    );
  }
  if (error && !current) {
    return (
      <SafeAreaView style={s.wrap} edges={['left','right']}>
        <Text style={[s.feedback]}>{error}</Text>
      </SafeAreaView>
    );
  }
  if (!current) {
    return (
      <SafeAreaView style={s.center} edges={['left','right']}>
        <Text>暫無題目。</Text>
      </SafeAreaView>
    );
  }

  const onSelect = (opt: QuizItem) => {
    if (lastCorrect !== undefined) return;
    setPicked(opt); setWarn('');
  };
  const onSubmit = () => {
    if (!picked) { setWarn('請先揀一個答案'); return; }
    setWarn(''); answer(picked); stopSpeak();
  };
  const onNext = () => { stopSpeak(); next(); setPicked(null); setWarn(''); };

  return (
    <SafeAreaView style={s.wrap} edges={['left','right']}>
      {/* 頂部進度 */}
      <View style={s.topRow}>
        <Text style={s.progress}>分數 {score}/{total}</Text>
      </View>

      {/* 題幹 + speaker */}
      <View style={s.stemRow}>
        <Text style={s.stem} numberOfLines={5}>{current.stem}</Text>
        <Pressable onPress={() => speakOneShot(current.stem)} style={s.speaker} android_ripple={{ color: '#ddd', borderless: true }}>
          <Ionicons name="volume-high-outline" size={22} color={C.text} />
        </Pressable>
      </View>

      {/* 選項（黑白） */}
      <View style={s.options}>
        {current.options.map((opt: QuizItem, idx: number) => {
          const selected = picked === opt;
          const answered = lastCorrect !== undefined;
          const isAnswer = opt === current.answer;

          // 黑白：提交後只用淺灰背景 + 粗邊框提示
          const beforeSubmit = selected ? s.cardSelected : undefined;
          const afterSubmit =
            answered
              ? isAnswer
                ? s.cardAnswered // 正解
                : selected
                  ? s.cardAnswered // 錯選同樣處理（黑白）
                  : s.cardDim
              : undefined;

          return (
            <Pressable
              key={idx}
              onPress={() => onSelect(opt)}
              disabled={answered}
              style={({ pressed }) => [s.card, beforeSubmit, afterSubmit, pressed && !answered && s.cardPressed]}
            >
              <View style={s.cardInner}>
                <View style={[
                  s.bullet,
                  selected && !answered && { borderColor: C.accent },
                  answered && isAnswer && { backgroundColor: C.accent, borderColor: C.accent },
                  answered && selected && !isAnswer && { borderColor: C.accent },
                ]} />
                <Text style={[
                  s.cardText,
                  selected && !answered && { color: C.accent, fontWeight: '700' },
                  answered && isAnswer && { fontWeight: '700' },
                ]}>
                  {current.optionText(opt)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {!!warn && lastCorrect === undefined && <Text style={s.warn}>{warn}</Text>}

      {lastCorrect !== undefined && (
        <View style={s.result}>
          <Ionicons name={lastCorrect ? 'checkmark-circle' : 'close-circle'} size={20} color={C.text} style={{ marginRight: 8 }} />
          <Text style={s.resultText}>
            {lastCorrect ? '正確！' : `唔啱，正解：${current.optionText(current.answer)}`}
          </Text>
        </View>
      )}

      {/* 底部操作 */}
      {lastCorrect !== undefined ? (
        <Pressable style={s.bottomBtn} onPress={onNext}>
          <Text style={s.bottomBtnText}>下一題</Text>
        </Pressable>
      ) : (
        <Pressable onPress={onSubmit} style={[s.bottomBtn, !picked && s.bottomBtnDisabled]} disabled={!picked}>
          <Text style={[s.bottomBtnText, !picked && s.bottomBtnTextDisabled]}>提交</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  mt8: { marginTop: 8 },

  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progress: { fontSize: 14, color: C.muted },

  stemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  stem: { flex: 1, fontSize: 20, lineHeight: 28, color: C.text },
  speaker: {
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12,
    backgroundColor: '#fff', borderWidth: 1, borderColor: C.border,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }, android: { elevation: 1 } }),
  },

  options: { gap: 10, marginTop: 6 },

  card: {
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    paddingVertical: 14, paddingHorizontal: 14,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }, android: { elevation: 1 } }),
  },
  cardPressed: { opacity: 0.7 },
  cardSelected: { borderColor: C.accent, backgroundColor: '#eee' },
  cardAnswered: { borderColor: C.accent, backgroundColor: C.soft },
  cardDim: { opacity: 0.75 },

  cardInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bullet: { width: 16, height: 16, borderRadius: 999, borderWidth: 2, borderColor: C.border, backgroundColor: '#fff' },
  cardText: { fontSize: 17, color: C.text },

  warn: { color: C.text, marginTop: 6, fontStyle: 'italic' },
  feedback: { fontSize: 15, color: C.text },

  result: {
    marginTop: 8, borderWidth: 1, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.soft, borderColor: C.border,
  },
  resultText: { fontSize: 15, color: C.text },

  bottomBtn: { marginTop: 'auto', paddingVertical: 14, borderRadius: 14, backgroundColor: C.accent, alignItems: 'center' },
  bottomBtnDisabled: { backgroundColor: '#d1d5db' },
  bottomBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  bottomBtnTextDisabled: { color: '#9ca3af' },
});
