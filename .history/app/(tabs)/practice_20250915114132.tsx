// app/(tabs)/practice.tsx
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuiz } from '../../src/store/useQuiz';

function makeStyles(isDark: boolean) {
  const C = {
    bg: isDark ? '#000' : '#fff',
    text: isDark ? '#eee' : '#111',
    muted: isDark ? '#9ca3af' : '#6b7280',
    card: isDark ? '#111' : '#fff',
    border: isDark ? '#333' : '#e5e7eb',
    accent: isDark ? '#fff' : '#111',
    danger: '#d11',
    success: '#1e9e58',
  };
  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    wrap: { flex: 1, padding: 16, gap: 16 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    progress: { fontSize: 14, color: C.muted },
    totalAvail: { fontSize: 14, color: C.muted },

    stemBox: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14 },
    stem: { fontSize: 22, lineHeight: 30, color: C.text },

    options: { gap: 10 },
    btn: {
      padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
    },
    btnSelected: {
      borderColor: C.accent, borderWidth: 2,
    },
    btnText: { fontSize: 18, color: C.text },

    feedback: { fontSize: 16, color: C.muted },
    feedbackOk: { color: C.success, fontWeight: '700' },
    feedbackNg: { color: C.danger, fontWeight: '700' },

    bottomRow: { marginTop: 'auto', gap: 10 },
    submit: { padding: 14, borderRadius: 12, backgroundColor: C.accent },
    submitDisabled: { opacity: 0.5 },
    submitText: { color: isDark ? '#000' : '#fff', textAlign: 'center', fontSize: 18, fontWeight: '700' },

    hint: { color: C.danger, fontSize: 14 },
  });
  return { s };
}

export default function PracticeScreen() {
  const isDark = useColorScheme() === 'dark';
  const { s } = useMemo(() => makeStyles(isDark), [isDark]);

  const { init, loading, current, answer, next, lastCorrect, score, total, totalAvailable, error } = useQuiz();

  // 本頁控制：所選 index、已提交與否、提示
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [mustPickMsg, setMustPickMsg] = useState<string>('');

  useEffect(() => { void init(); }, []);

  // 每次出新題，要 reset 本地狀態
  useEffect(() => {
    setSelectedIdx(null);
    setSubmitted(false);
    setMustPickMsg('');
  }, [current?.stem, total]); // total 變動（答完出下一題）都重置

  if (loading || !current) {
    return (
      <SafeAreaView style={s.screen} edges={['left','right']}>
        <View style={s.center}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8, color: isDark ? '#eee' : '#111' }}>
            {error ? '正在載入…' : '載入中…'}
          </Text>
          {!!error && <Text style={[{ marginTop: 8 }, { color: '#d11' }]}>{error}</Text>}
        </View>
      </SafeAreaView>
    );
  }

  const onPressSubmitOrNext = () => {
    if (!submitted) {
      if (selectedIdx === null) {
        setMustPickMsg('請先揀一個答案再提交。');
        return;
      }
      setMustPickMsg('');
      // 提交：交畀 store 判斷正誤 & 記分/錯題
      const picked = current.options[selectedIdx];
      answer(picked);
      setSubmitted(true);
    } else {
      // 下一題
      next();
    }
  };

  const isSubmitPhase = !submitted;
  const bottomLabel = isSubmitPhase ? '提交' : '下一題';
  const submitDisabled = isSubmitPhase && selectedIdx === null;

  return (
    <SafeAreaView style={s.screen} edges={['left','right']}>
      <View style={s.wrap}>
        {/* 頂部狀態列 */}
        <View style={s.topRow}>
          <Text style={s.progress}>分數 {score}/{total}</Text>
          <Text style={s.totalAvail}>總題數 {totalAvailable}</Text>
        </View>

        {/* 題幹 */}
        <View style={s.stemBox}>
          <Text style={s.stem}>{current.stem}</Text>
        </View>

        {/* 選項 */}
        <View style={s.options}>
          {current.options.map((opt, idx) => {
            const selected = selectedIdx === idx;
            return (
              <Pressable
                key={idx}
                style={[s.btn, selected && s.btnSelected]}
                onPress={() => setSelectedIdx(idx)}
              >
                <Text style={s.btnText}>{current.optionText(opt)}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* 提示／回饋 */}
        {!submitted && !!mustPickMsg && <Text style={s.hint}>{mustPickMsg}</Text>}
        {submitted && (
          <Text style={[s.feedback, lastCorrect ? s.feedbackOk : s.feedbackNg]}>
            {lastCorrect ? '正確！' : `唔啱😅 正解：${current.optionText(current.answer)}`}
          </Text>
        )}

        {/* 提交／下一題 */}
        <View style={s.bottomRow}>
          <Pressable
            onPress={onPressSubmitOrNext}
            disabled={submitDisabled}
            style={[s.submit, submitDisabled && s.submitDisabled]}
          >
            <Text style={s.submitText}>{bottomLabel}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
