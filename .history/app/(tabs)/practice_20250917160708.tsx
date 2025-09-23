import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  useColorScheme,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, Directions } from 'react-native-gesture-handler';
import { router } from 'expo-router';
import { useQuiz } from '../../src/store/useQuiz';

function parseExamKey(ek?: string) {
  if (!ek) return null;
  const m = ek.match(/^(N[1-5])-(\d{4})-(\d{2})$/);
  if (!m) return null;
  const [, level, y, mm] = m;
  return { level, year: Number(y), monthLabel: mm === '07' ? '7月' : mm === '12' ? '12月' : mm };
}

function makeStyles(isDark: boolean) {
  const C = {
    bg: isDark ? '#000' : '#fff',
    text: isDark ? '#eee' : '#111',
    soft: isDark ? '#9ca3af' : '#6b7280',
    card: isDark ? '#111' : '#fff',
    border: isDark ? '#333' : '#e5e7eb',
    active: isDark ? '#fff' : '#111',
    wrong: '#d11',
    right: '#1e9e58',
    chipBg: isDark ? '#0f0f0f' : '#f8f8f8',
  };
  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    wrap: { flex: 1, paddingHorizontal: 12, paddingBottom: 12, paddingTop: 6, gap: 10 },

    // 頂部 meta / 進度
    metaBar: {
      paddingVertical: 8, paddingHorizontal: 12,
      borderRadius: 10, borderWidth: 1, borderColor: C.border,
      backgroundColor: isDark ? '#0f0f0f' : '#fafafa',
    },
    metaTitle: { fontSize: 15, fontWeight: '600', color: C.text },
    topRow: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    progress: { color: C.soft },
    totalHint: { color: C.soft },

    // 題幹
    stem: { fontSize: 19, lineHeight: 26, color: C.text, marginTop: 4 },
    passage: { fontSize: 14, lineHeight: 20, color: C.soft, marginTop: 4 },

    // 選項
    options: { gap: 8, marginTop: 6 },
    opt: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
    optSelected: { borderColor: C.active, borderWidth: 2 },
    optText: { fontSize: 16, color: C.text },

    // 回饋
    feedback: { fontSize: 15, marginTop: 8 },
    wrongText: { color: C.wrong },
    rightText: { color: C.right },
    explain: { marginTop: 6, color: C.soft },
    locked: { marginTop: 6, color: C.soft, fontStyle: 'italic' },

    // 底部按鈕
    row: { flexDirection: 'row', gap: 10, marginTop: 12 },
    btn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
    btnPrimary: { backgroundColor: C.active, borderColor: C.active },
    btnText: { textAlign: 'center', fontSize: 16, color: C.text, fontWeight: '600' },
    btnPrimaryText: { color: isDark ? '#000' : '#fff' },

    // 其他
    warn: { color: C.wrong, marginTop: 8 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // 題號跳轉 chips
    chipsBar: {
      paddingVertical: 6, paddingHorizontal: 6,
      borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
    },
    chipsWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    chip: {
      paddingVertical: 6, paddingHorizontal: 10,
      borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.chipBg,
    },
    chipCurrent: { borderColor: C.active, borderWidth: 2 },
    chipAnswered: { opacity: 0.9 },
    chipCorrect: { backgroundColor: isDark ? '#0d2b1a' : '#e8f7ee', borderColor: isDark ? '#1e9e58' : '#1e9e58' },
    chipWrong: { backgroundColor: isDark ? '#2b0d0d' : '#fde8e8', borderColor: isDark ? '#d11' : '#d11' },
    chipText: { fontSize: 12, color: C.text, fontWeight: '600' },

    // 完卷 summary
    doneCard: { marginTop: 12, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, gap: 10 },
    doneTitle: { fontSize: 18, fontWeight: '700', color: C.text },
    doneText: { fontSize: 15, color: C.text },
  });
  return { s };
}

export default function PracticeScreen() {
  const isDark = useColorScheme() === 'dark';
  const { s } = useMemo(() => makeStyles(isDark), [isDark]);

  // ⚠️ 所有 hooks 放最頂，避免跳 hooks
  const {
    loading, current, selected, answered, lastCorrect,
    score, total, totalAvailable, pick, submit, next, prev,
    idx, answers, jumpTo,
  } = useQuiz();

  const [needPickMsg, setNeedPickMsg] = useState(false);

  // ---- Swipe（只處理提交/換題，不允許改已答）----
  const doSwipeUp = useCallback(() => {
    if (answered) { next?.(); return; }
    if (selected) { submit(); return; }
    setNeedPickMsg(true);
  }, [answered, selected, submit, next]);

  const doSwipeDown = useCallback(() => { prev?.(); }, [prev]);

  const gestures = useMemo(() => {
    const up = Gesture.Fling()
      .direction(Directions.UP)
      .onStart(() => { doSwipeUp(); })
      .runOnJS(true);
    const down = Gesture.Fling()
      .direction(Directions.DOWN)
      .onStart(() => { doSwipeDown(); })
      .runOnJS(true);
    return Gesture.Simultaneous(up, down);
  }, [doSwipeUp, doSwipeDown]);

  const onSubmit = useCallback(() => {
    if (!selected) { setNeedPickMsg(true); return; }
    setNeedPickMsg(false);
    submit();
  }, [selected, submit]);

  const meta = current ? parseExamKey(current.exam_key) : null;
  const correctText = current?.correctOption?.content ?? '';

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const isDone = !loading && totalAvailable > 0 && answeredCount === totalAvailable;

  const EmptyState = (
    <View style={s.center}>
      <Text style={{ color: isDark ? '#ccc' : '#444', fontSize: 16, marginBottom: 12 }}>
        呢份卷暫時未有題目，請揀返其他條件。
      </Text>
      <Pressable style={[s.btn, s.btnPrimary]} onPress={() => router.replace('/(tabs)')}>
        <Text style={[s.btnText, s.btnPrimaryText]}>返回選卷</Text>
      </Pressable>
    </View>
  );

  const LoadingState = (
    <View style={s.center}>
      <ActivityIndicator />
      <Text style={{ marginTop: 8, color: isDark ? '#ccc' : '#666' }}>載入中…</Text>
    </View>
  );

  const DoneState = (
    <View style={s.wrap}>
      <View style={s.doneCard}>
        <Text style={s.doneTitle}>本卷完成 🎉</Text>
        <Text style={s.doneText}>總題數：{totalAvailable}</Text>
        <Text style={s.doneText}>答對：{score}／{totalAvailable}</Text>
      </View>
      <View style={s.row}>
        <Pressable style={[s.btn, s.btnPrimary]} onPress={() => router.replace('/(tabs)')}>
          <Text style={[s.btnText, s.btnPrimaryText]}>揀新挑戰</Text>
        </Pressable>
      </View>
    </View>
  );

  const ChipsBar = (
    <View style={s.chipsBar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsWrap}>
        {Array.from({ length: totalAvailable }, (_, i) => {
          const rec = answers[i];
          const isCurrent = i === idx;
          const isAnswered = !!rec;
          const isCorrect = rec?.correct;
          return (
            <Pressable
              key={i}
              onPress={() => jumpTo(i)}
              style={[
                s.chip,
                isCurrent && s.chipCurrent,
                isAnswered && s.chipAnswered,
                isAnswered && (isCorrect ? s.chipCorrect : s.chipWrong),
              ]}
            >
              <Text style={s.chipText}>{i + 1}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={s.screen} edges={['left','right','bottom']}>
      {loading ? LoadingState
        : !current ? EmptyState
        : isDone ? DoneState
        : (
          <GestureDetector gesture={gestures}>
            <View style={s.wrap}>
              {/* 題號跳轉（可睇返已答，但唔可改） */}
              {ChipsBar}

              {/* 置頂題號 */}
              <View style={s.metaBar}>
                <Text style={s.metaTitle}>
                  {meta
                    ? `${meta.level} ${meta.year}年${meta.monthLabel} ・ 第 ${current.question_number} 題`
                    : `第 ${current.question_number} 題`}
                </Text>
              </View>

              {/* 分數／題庫 */}
              <View style={s.topRow}>
                <Text style={s.progress}>分數 {score}/{total}</Text>
                <Text style={s.totalHint}>題庫 {totalAvailable} 題</Text>
              </View>

              {/* 題幹／讀解 */}
              <Text style={s.stem}>{current.stem}</Text>
              {!!current.passage && <Text style={s.passage}>{current.passage}</Text>}

              {/* 選項（已答就 disable） */}
              <View style={s.options}>
                {current.options.map((o) => {
                  const isSelected = selected?.position === o.position;
                  return (
                    <Pressable
                      key={o.position}
                      disabled={!!answered}
                      onPress={() => pick(o)}
                      style={[s.opt, isSelected && s.optSelected]}
                    >
                      <Text style={s.optText}>{o.content}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {answered && <Text style={s.locked}>已作答，不能更改。</Text>}
              {!answered && needPickMsg && <Text style={s.warn}>請先揀一個選項再提交。</Text>}

              {answered && (
                <>
                  <Text style={[s.feedback, lastCorrect ? s.rightText : s.wrongText]}>
                    {lastCorrect ? '正確！' : `唔啱😅 正解：${correctText}`}
                  </Text>
                  {!lastCorrect && current.correctOption?.explanation && (
                    <Text style={s.explain}>{current.correctOption.explanation}</Text>
                  )}
                </>
              )}

              <View style={s.row}>
                {!answered ? (
                  <Pressable onPress={onSubmit} style={[s.btn, s.btnPrimary]}>
                    <Text style={[s.btnText, s.btnPrimaryText]}>提交</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={next} style={[s.btn, s.btnPrimary]}>
                    <Text style={[s.btnText, s.btnPrimaryText]}>下一題</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </GestureDetector>
        )}
    </SafeAreaView>
  );
}
