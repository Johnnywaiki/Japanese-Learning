// app/(tabs)/practice.tsx
import { useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
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
    accentText: isDark ? '#000' : '#fff',
    danger: '#d11',
    success: '#1e9e58',
    mute: isDark ? '#9ca3af' : '#6b7280',
    selected: isDark ? '#1f2937' : '#f3f4f6',
  };

  const s = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: C.bg },
        center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
        mt8: { marginTop: 8 },
        wrap: { flex: 1, padding: 16, gap: 16 },
        topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        progress: { fontSize: 15, color: C.text },
        totalAvail: { fontSize: 15, color: C.mute },
        stem: { fontSize: 22, lineHeight: 30, color: C.text },
        options: { gap: 12 },
        btn: {
          padding: 14,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: C.border,
          backgroundColor: C.card,
        },
        btnSelected: {
          backgroundColor: C.selected,
          borderColor: C.border,
        },
        btnDisabled: { opacity: 0.6 },
        btnText: { fontSize: 18, color: C.text },
        feedback: { fontSize: 16 },
        submit: { marginTop: 'auto', padding: 14, borderRadius: 12, backgroundColor: C.accent },
        submitText: { color: C.accentText, textAlign: 'center', fontSize: 18, fontWeight: '600' },
        next: { marginTop: 10, padding: 14, borderRadius: 12, backgroundColor: C.accent },
        nextText: { color: C.accentText, textAlign: 'center', fontSize: 18, fontWeight: '600' },
        warn: { color: C.danger, marginTop: -6 },
        backToFilter: {
          marginTop: 12,
          padding: 12,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: C.border,
          backgroundColor: C.card,
        },
        backToFilterText: { color: C.text, fontSize: 16 },
      }),
    [isDark]
  );

  const { loading, current, lastCorrect, score, total, totalAvailable, error, answer, next } = useQuiz();

  // 本頁控制：未提交前必須揀一個
  const [picked, setPicked] = useState<QuizItem | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showWarn, setShowWarn] = useState(false);

  const onPressOption = (opt: QuizItem) => {
    if (submitted) return; // 已提交就唔再畀改
    setPicked(opt);
    setShowWarn(false);
  };

  const onSubmit = () => {
    if (!picked) {
      setShowWarn(true);
      return;
    }
    answer(picked);
    setSubmitted(true);
  };

  const onNext = () => {
    next();
    setPicked(null);
    setSubmitted(false);
    setShowWarn(false);
  };

  // 載入中
  if (loading) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.center}>
          <ActivityIndicator />
          <Text style={[s.mt8, { color: C.text }]}>載入中…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 未開始 / 題庫不足
  if (!current) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.center}>
          <Text style={{ color: C.text, fontSize: 16 }}>
            {error ? error : '未開始練習，請先到「篩選」頁挑選條件並按「開始練習」。'}
          </Text>
          <Pressable onPress={() => router.replace('/(tabs)')} style={s.backToFilter}>
            <Text style={s.backToFilterText}>返回篩選頁</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen} edges={['left', 'right']}>
      <View style={s.wrap}>
        {/* 分數 + 總題數 */}
        <View style={s.topRow}>
          <Text style={s.progress}>分數 {score}/{total}</Text>
          <Text style={s.totalAvail}>總題數 {totalAvailable}</Text>
        </View>

        {/* 題幹 */}
        <Text style={s.stem}>{current.stem}</Text>

        {/* 選項 */}
        <View style={s.options}>
          {current.options.map((opt: QuizItem, idx: number) => {
            const selected = picked ? opt === picked : false;
            return (
              <Pressable
                key={idx}
                disabled={submitted}
                onPress={() => onPressOption(opt)}
                style={({ pressed }) => [
                  s.btn,
                  selected && s.btnSelected,
                  submitted && s.btnDisabled,
                  pressed && !submitted ? { opacity: 0.7 } : null,
                ]}
              >
                <Text style={s.btnText}>{current.optionText(opt)}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* 未揀提示 */}
        {!submitted && showWarn && <Text style={s.warn}>請先揀一個答案再提交。</Text>}

        {/* 回饋（提交後） */}
        {submitted && lastCorrect !== undefined && (
          <Text style={[s.feedback, { color: lastCorrect ? C.success : C.danger }]}>
            {lastCorrect ? '正確！' : `唔啱😅 正解：${current.optionText(current.answer)}`}
          </Text>
        )}

        {/* 底部按鈕：未提交 → 提交；已提交 → 下一題 */}
        {!submitted ? (
          <Pressable style={s.submit} onPress={onSubmit}>
            <Text style={s.submitText}>提交</Text>
          </Pressable>
        ) : (
          <Pressable style={s.next} onPress={onNext}>
            <Text style={s.nextText}>下一題</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}
