// app/(tabs)/practice.tsx
import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, Pressable, ActivityIndicator, StyleSheet,
  useColorScheme, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, Directions } from 'react-native-gesture-handler';
import { router, type Href } from 'expo-router';
import { useQuiz } from '../../src/store/useQuiz';
import { markPracticeDone, type Level, type Category } from '../../src/lib/progress';

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
    gridDot: isDark ? '#bbb' : '#666',
  };
  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 12, paddingBottom: 12, paddingTop: 6, gap: 10 },
    centerContainer: { flexGrow: 1, justifyContent: 'center' },
    emptyWrap: { alignItems: 'center' },
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
    bottomWrap: {
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border,
      paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, gap: 10, backgroundColor: C.bg,
    },
    gridTitle: { fontSize: 13, color: C.soft },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    gridItem: { width: '10%', paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
    dot: {
      width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: C.border,
      backgroundColor: C.card, alignItems: 'center', justifyContent: 'center',
    },
    dotText: { fontSize: 12, color: C.gridDot, fontWeight: '600' },
    dotCurrent: { borderColor: C.active, borderWidth: 2 },
    dotAnsweredRight: { backgroundColor: '#1e9e5833', borderColor: '#1e9e58' },
    dotAnsweredWrong: { backgroundColor: '#d11a2a22', borderColor: '#d11a2a' },
    dotDisabled: { opacity: 0.6 },
    row: { flexDirection: 'row', gap: 10 },
    btn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
    btnPrimary: { backgroundColor: C.active, borderColor: C.active },
    btnText: { textAlign: 'center', fontSize: 16, color: C.text, fontWeight: '600' },
    btnPrimaryText: { color: isDark ? '#000' : '#fff' },
    warn: { color: C.wrong, marginTop: 8 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  });
  return { s };
}

export default function PracticeScreen() {
  const isDark = useColorScheme() === 'dark';
  const { s } = useMemo(() => makeStyles(isDark), [isDark]);

  const {
    loading, current, selected, answered, lastCorrect,
    score, total, totalAvailable, pick, submit, next, prev,
    pool, idx, answers, jumpTo,
    mode,  // 'daily' | 'mock'
    meta,  // daily meta 或 mock filter
  } = useQuiz();

  const [needPickMsg, setNeedPickMsg] = useState(false);
  const isLast = pool.length > 0 && idx >= pool.length - 1;

  const submitAndMaybeFinish = useCallback(async () => {
    if (!answered) {
      if (!selected) { setNeedPickMsg(true); return; }
      setNeedPickMsg(false);
      submit();
    }

    if (!isLast) { next?.(); return; }

    try {
      if (mode === 'daily' && meta && 'level' in meta && 'category' in meta) {
        await markPracticeDone({
          level: meta.level as Level,
          category: meta.category as Category,
          week: meta.week,
          day: meta.day,
        });
      }
    } finally {
      const backTo: Href =
        mode === 'daily' ? '/(tabs)/home' : '/(tabs)'; // **重點**：用 Href 固定型別
      router.replace(backTo);
    }
  }, [answered, selected, submit, isLast, next, mode, meta]);

  const doSwipeUp = useCallback(() => { submitAndMaybeFinish(); }, [submitAndMaybeFinish]);
  const doSwipeDown = useCallback(() => { prev?.(); }, [prev]);

  const gestures = useMemo(() => {
    const up = Gesture.Fling().direction(Directions.UP).onStart(doSwipeUp).runOnJS(true);
    const down = Gesture.Fling().direction(Directions.DOWN).onStart(doSwipeDown).runOnJS(true);
    return Gesture.Simultaneous(up, down);
  }, [doSwipeUp, doSwipeDown]);

  const metaMock = current ? parseExamKey(current.exam_key) : null;
  const correctText = current?.correctOption?.content ?? '';

  const onPickNewPaper = useCallback(() => {
    router.replace('/(tabs)' as Href);
  }, []);

  const showSummary = isLast && answered;
  const isEmpty = !loading && (pool.length === 0 || !current);
  const centerContent = isEmpty || showSummary;

  const answeredCount = Object.keys(answers).length;
  const correctCount = Object.values(answers).filter(a => a.correct).length;

  const EmptyState = () => (
    <View style={s.center}>
      <Text style={{ fontSize: 16, color: isDark ? '#eee' : '#111' }}>未有呢份卷嘅題目</Text>
      <Pressable onPress={onPickNewPaper} style={[s.btn, s.btnPrimary, { marginTop: 16, minWidth: 180 }]}>
        <Text style={[s.btnText, s.btnPrimaryText]}>返回試卷列表</Text>
      </Pressable>
    </View>
  );

  const Summary = () => (
    <View style={s.center}>
      <Text style={{ fontSize: 16, color: isDark ? '#eee' : '#111' }}>
        {metaMock ? `${metaMock.level} ${metaMock.year}年${metaMock.monthLabel}` : '本次練習'} 完成！
      </Text>
      <Text style={{ marginTop: 10, color: isDark ? '#bbb' : '#666' }}>
        正確 {correctCount}／{totalAvailable} 題（已作答 {answeredCount} 題）
      </Text>
      <Pressable onPress={onPickNewPaper} style={[s.btn, s.btnPrimary, { marginTop: 18, minWidth: 180 }]}>
        <Text style={[s.btnText, s.btnPrimaryText]}>揀新挑戰（返試卷）</Text>
      </Pressable>
    </View>
  );

  const QuestionBody = () => (
    <>
      <View style={s.metaBar}>
        <Text style={s.metaTitle}>
          {metaMock
            ? `${metaMock.level} ${metaMock.year}年${metaMock.monthLabel} ・ 第 ${current!.question_number} 題`
            : `第 ${current!.question_number} 題`}
        </Text>
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
          {!lastCorrect && current?.correctOption?.explanation && (
            <Text style={s.explain}>{current.correctOption.explanation}</Text>
          )}
        </>
      )}

      <View style={s.bottomWrap}>
        <Text style={s.gridTitle}>題目選擇（可跳題，已提交唔可更改答案）</Text>
        <View style={s.grid}>
          {pool.map((_, i) => {
            const past = answers[i];
            const isCurrent = i === idx;
            const dotStyle = [
              s.dot,
              isCurrent && s.dotCurrent,
              past && (past.correct ? s.dotAnsweredRight : s.dotAnsweredWrong),
              past && s.dotDisabled,
            ];
            return (
              <Pressable key={i} style={s.gridItem} onPress={() => jumpTo(i)}>
                <View style={dotStyle as any}>
                  <Text style={s.dotText}>{i + 1}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={s.row}>
          <Pressable onPress={submitAndMaybeFinish} style={[s.btn, s.btnPrimary]}>
            <Text style={[s.btnText, s.btnPrimaryText]}>
              {!answered ? '提交' : (isLast ? (mode === 'daily' ? '完成並返回 Home' : '完成並返回列表') : '下一題')}
            </Text>
          </Pressable>
        </View>
      </View>
    </>
  );

  const Body = () => {
    if (loading) {
      return (
        <View style={s.center}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8, color: isDark ? '#ccc' : '#666' }}>載入中…</Text>
        </View>
      );
    }
    if (isEmpty) return <EmptyState />;
    if (showSummary && mode !== 'daily') return <Summary />; // daily 直接跳
    return <QuestionBody />;
  };

  return (
    <SafeAreaView style={s.screen} edges={['left','right','bottom']}>
      <GestureDetector gesture={gestures}>
        <ScrollView
          style={s.scroll}
          contentContainerStyle={[s.content, (!current || isEmpty) && s.centerContainer]}
        >
          <Body />
        </ScrollView>
      </GestureDetector>
    </SafeAreaView>
  );
}
