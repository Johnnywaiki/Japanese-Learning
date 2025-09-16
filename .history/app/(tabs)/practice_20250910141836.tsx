// app/(tabs)/practice.tsx
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Platform, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuiz } from '../../src/store/useQuiz';
import type { QuizItem } from '../../src/db/schema';
import { speakOneShot, stopSpeak } from '../../src/tts';

function makeStyles(isDark: boolean) {
  const C = {
    text: isDark ? '#eee' : '#111',
    muted: isDark ? '#9ca3af' : '#6b7280',
    bg: isDark ? '#000' : '#fff',
    card: isDark ? '#111' : '#fff',
    border: isDark ? '#333' : '#e5e7eb',
    soft: isDark ? '#121212' : '#f3f4f6',
    accent: isDark ? '#fff' : '#111', // 反差用
  };

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
      backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
      ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }, android: { elevation: 1 } }),
    },

    options: { gap: 10, marginTop: 6 },

    card: {
      backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border,
      paddingVertical: 14, paddingHorizontal: 14,
      ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }, android: { elevation: 1 } }),
    },
    cardPressed: { opacity: 0.7 },
    cardSelected: { borderColor: C.accent, backgroundColor: isDark ? '#1a1a1a' : '#eee' },
    cardAnswered: { borderColor: C.accent, backgroundColor: C.soft },
    cardDim: { opacity: 0.8 },

    cardInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    bullet: { width: 16, height: 16, borderRadius: 999, borderWidth: 2, borderColor: C.border, backgroundColor: C.card },
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
    bottomBtnDisabled: { backgroundColor: isDark ? '#2a2a2a' : '#d1d5db' },
    bottomBtnText: { color: isDark ? '#000' : '#fff', fontSize: 18, fontWeight: '700' },
    bottomBtnTextDisabled: { color: isDark ? '#555' : '#9ca3af' },
  });

  return { C, s };
}

export default function PracticePlayScreen() {
  const isDark = useColorScheme() === 'dark';
  const { C, s } = useMemo(() => makeStyles(isDark), [isDark]);

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
      <View style={s.topRow}>
        <Text style={s.progress}>分數 {score}/{total}</Text>
      </View>

      <View style={s.stemRow}>
        <Text style={s.stem} numberOfLines={5}>{current.stem}</Text>
        <Pressable onPress={() => speakOneShot(current.stem)} style={s.speaker} android_ripple={{ color: '#555', borderless: true }}>
          <Ionicons name="volume-high-outline" size={22} color={C.text} />
        </Pressable>
      </View>

      <View style={s.options}>
        {current.options.map((opt: QuizItem, idx: number) => {
          const selected = picked === opt;
          const answered = lastCorrect !== undefined;
          const isAnswer = opt === current.answer;

          const beforeSubmit = selected ? s.cardSelected : undefined;
          const afterSubmit =
            answered
              ? isAnswer
                ? s.cardAnswered
                : selected
                  ? s.cardAnswered
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
