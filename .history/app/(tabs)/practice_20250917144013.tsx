// app/(tabs)/practice.tsx
import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, Pressable, ActivityIndicator, StyleSheet, useColorScheme,
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
    overlayBg: 'rgba(0,0,0,0.6)',
  };
  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    wrap: { flex: 1, paddingHorizontal: 12, paddingBottom: 12, paddingTop: 6, gap: 10 },

    metaBar: {
      paddingVertical: 8, paddingHorizontal: 12,
      borderRadius: 10, borderWidth: 1, borderColor: C.border,
      backgroundColor: isDark ? '#0f0f0f' : '#fafafa',
    },
    metaTitle: { fontSize: 15, fontWeight: '600', color: C.text },

    topRow: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    progress: { color: C.soft },
    totalHint: { color: C.soft },

    stem: { fontSize: 19, lineHeight: 26, color: C.text, marginTop: 4 },
    passage: { fontSize: 14, lineHeight: 20, color: C.soft, marginTop: 4 },

    options: { gap: 8, marginTop: 6 },
    opt: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
    optSelected: { borderColor: C.active, borderWidth: 2 },
    optText: { fontSize: 16, color: C.text },

    feedback: { fontSize: 15, marginTop: 8 },
    wrongText: { color: C.wrong },
    rightText: { color: C.right },
    explain: { marginTop: 6, color: C.soft },

    row: { flexDirection: 'row', gap: 10, marginTop: 12 },
    btn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
    btnPrimary: { backgroundColor: C.active, borderColor: C.active },
    btnText: { textAlign: 'center', fontSize: 16, color: C.text, fontWeight: '600' },
    btnPrimaryText: { color: isDark ? '#000' : '#fff' },

    navRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
    navBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
    navText: { textAlign: 'center', fontSize: 14, color: C.text },

    warn: { color: C.wrong, marginTop: 8 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    overlay: { position: 'absolute', inset: 0, backgroundColor: C.overlayBg, justifyContent: 'center', alignItems: 'center' },
    dialog: { width: '86%', borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, padding: 16, gap: 10 },
    dialogTitle: { fontSize: 18, fontWeight: '700', color: C.text },
    dialogText: { fontSize: 15, color: C.soft },
  });
  return { s };
}

export default function PracticeScreen() {
  // 1) 所有 hooks 都放最上面，任何情況都會被呼叫一次，避免次序改變
  const isDark = useColorScheme() === 'dark';
  const { s } = useMemo(() => makeStyles(isDark), [isDark]);

  const {
    loading, current, selected, answered, lastCorrect,
    score, total, totalAvailable, pick, submit, next, prev, isDone,
  } = useQuiz();

  const [needPickMsg, setNeedPickMsg] = useState(false);

  // Swipe 手勢 callbacks
  const doSwipeUp = useCallback(() => {
    if (answered) { next?.(); return; }
    if (selected) { submit(); return; }
    setNeedPickMsg(true);
  }, [answered, selected, submit, next]);

  const doSwipeDown = useCallback(() => { prev?.(); }, [prev]);

  // 組合手勢
  const gestures = useMemo(() => {
    const flingUp = Gesture.Fling().direction(Directions.UP).onStart(doSwipeUp);
    const flingDown = Gesture.Fling().direction(Directions.DOWN).onStart(doSwipeDown);
    return Gesture.Simultaneous(flingUp, flingDown);
  }, [doSwipeUp, doSwipeDown]);

  // 其他衍生值（即使 current 未有，計出來都安全）
  const meta = current ? parseExamKey(current.exam_key) : null;
  const correct = current?.correctOption;
  const correctText = correct ? correct.content : '';
  const onSubmit = useCallback(() => {
    if (!selected) { setNeedPickMsg(true); return; }
    setNeedPickMsg(false);
    submit();
  }, [selected, submit]);

  const done = isDone();
  const isLoading = loading || !current;

  // 2) 再根據 loading 先行渲染「載入中」，唔會影響 hooks 次序
  if (isLoading) {
    return (
      <SafeAreaView style={s.screen} edges={['left','right','bottom']}>
        <View style={s.center}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8, color: isDark ? '#ccc' : '#666' }}>載入中…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 3) 真正內容
  return (
    <SafeAreaView style={s.screen} edges={['left','right','bottom']}>
      <GestureDetector gesture={gestures}>
        <View style={s.wrap}>
          <View style={s.metaBar}>
            <Text style={s.metaTitle}>
              {meta
                ? `${meta.level} ${meta.year}年${meta.monthLabel} ・ 第 ${current!.question_number} 題`
                : `第 ${current!.question_number} 題`}
            </Text>
          </View>

          <View style={s.navRow}>
            <Pressable onPress={prev} style={s.navBtn}><Text style={s.navText}>← 上一題</Text></Pressable>
            <Pressable onPress={next} style={s.navBtn}><Text style={s.navText}>下一題 →</Text></Pressable>
          </View>

          <View style={s.topRow}>
            <Text style={s.progress}>分數 {score}/{total}</Text>
            <Text style={s.totalHint}>題庫 {totalAvailable} 題</Text>
          </View>

          <Text style={s.stem}>{current!.stem}</Text>
          {!!current!.passage && <Text style={s.passage}>{current!.passage}</Text>}

          <View style={s.options}>
            {current!.options.map((o) => {
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

          {!answered && needPickMsg && <Text style={s.warn}>請先揀一個選項再提交。</Text>}

          {answered && (
            <>
              <Text style={[s.feedback, lastCorrect ? s.rightText : s.wrongText]}>
                {lastCorrect ? '正確！' : `唔啱😅 正解：${correctText}`}
              </Text>
              {!lastCorrect && correct?.explanation && (
                <Text style={s.explain}>{correct.explanation}</Text>
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

      {done && (
        <View style={s.overlay}>
          <View style={s.dialog}>
            <Text style={s.dialogTitle}>本卷完成！🎉</Text>
            <Text style={s.dialogText}>你嘅分數：{score} / {totalAvailable}</Text>
            <View style={s.row}>
              <Pressable
                style={[s.btn, s.btnPrimary]}
                onPress={() => router.replace('/(tabs)')}
              >
                <Text style={[s.btnText, s.btnPrimaryText]}>揀新試卷</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
