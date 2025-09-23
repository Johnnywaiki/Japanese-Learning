// app/(tabs)/practice-exam.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, Pressable, ActivityIndicator, StyleSheet,
  useColorScheme, ScrollView, Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Gesture, GestureDetector, Directions } from 'react-native-gesture-handler';
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

export default function PracticeExamScreen() {
  const isDark = useColorScheme() === 'dark';
  const { s } = useMemo(() => makeStyles(isDark), [isDark]);

  const params = useLocalSearchParams<{
    level?: 'N1'|'N2'|'N3'|'N4'|'N5';
    kind?: 'language'|'reading'|'listening';
    year?: string;
    session?: 'July'|'December';
    month?: '07'|'12';
  }>();

  const {
    loading, current, selected, answered, lastCorrect,
    score, total, totalAvailable,
    pool, idx, answers, jumpTo, pick, submit, next, prev,
  } = useQuiz();

  const [needPickMsg, setNeedPickMsg] = useState(false);

  // 首次進入：用 params 初始化
  useEffect(() => {
    const level = params.level ?? 'N2';
    const month = params.month ?? (params.session === 'July' ? '07' : '12');
    const year = params.year ? Number(params.year) : undefined;
    const kind = (params.kind ?? 'language') as 'language'|'reading'|'listening';

    (async () => {
      const ok = await useQuiz.getState().init({
        level,
        kind,
        year,
        month,                    // ✅ 關鍵：明確傳 month
        session: params.session,  // 可有可無
      });
      if (!ok) {
        Alert.alert('未有題目', '呢份卷未有資料，請返回試卷頁再揀其他年月。', [
          { text: '返回', onPress: () => router.replace('/(tabs)') },
        ]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swipe
  const doSwipeUp = useCallback(() => {
    if (answered) { next?.(); return; }
    if (selected) { submit(); return; }
    setNeedPickMsg(true);
  }, [answered, selected, submit, next]);

  const doSwipeDown = useCallback(() => { prev?.(); }, [prev]);
  const gestures = useMemo(() => {
    const flingUp = Gesture.Fling().direction(Directions.UP).onStart(doSwipeUp).runOnJS(true);
    const flingDown = Gesture.Fling().direction(Directions.DOWN).onStart(doSwipeDown).runOnJS(true);
    return Gesture.Simultaneous(flingUp, flingDown);
  }, [doSwipeUp, doSwipeDown]);

  const meta = current ? parseExamKey(current.exam_key) : null;
  const correctText = current?.correctOption?.content ?? '';

  const onSubmit = useCallback(() => {
    if (!selected) { setNeedPickMsg(true); return; }
    setNeedPickMsg(false);
    submit();
  }, [selected, submit]);

  const onBack = useCallback(() => { router.replace('/(tabs)'); }, []);

  const isLast = pool.length > 0 && idx >= pool.length - 1;
  const showSummary = isLast && answered;

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const correctCount = useMemo(
    () => Object.values(answers).filter(a => a.correct).length,
    [answers]
  );

  const EmptyState = () => (
    <View style={s.center}>
      <ActivityIndicator />
      <Text style={{ marginTop: 8, color: isDark ? '#ccc' : '#666' }}>載入中…</Text>
    </View>
  );

  const Summary = () => (
    <View style={{ alignItems: 'center' }}>
      <Text style={[s.stem, { textAlign: 'center' }]}>
        {meta ? `${meta.level} ${meta.year}年${meta.monthLabel}` : '本次練習'} 完成！
      </Text>
      <Text style={[s.passage, { textAlign: 'center', marginTop: 10 }]}>
        正確 {correctCount}／{totalAvailable} 題（已作答 {answeredCount} 題）
      </Text>
      <Pressable onPress={onBack} style={[s.btn, s.btnPrimary, { marginTop: 18, minWidth: 180 }]}>
        <Text style={[s.btnText, s.btnPrimaryText]}>返回試卷</Text>
      </Pressable>
    </View>
  );

  const QuestionBody = () => (
    <>
      <View style={s.metaBar}>
        <Text style={s.metaTitle}>
          {meta
            ? `${meta.level} ${meta.year}年${meta.monthLabel} ・ 第 ${current!.question_number} 題`
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
              onPress={() => useQuiz.getState().pick(o)}
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
          {!lastCorrect && (current as any)?.correctOption?.explanation && (
            <Text style={s.explain}>{(current as any).correctOption.explanation}</Text>
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

        <View className="row" style={s.row as any}>
          {!answered ? (
            <Pressable onPress={onSubmit} style={[s.btn, s.btnPrimary]}>
              <Text style={[s.btnText, s.btnPrimaryText]}>提交</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={isLast ? onBack : next}
              style={[s.btn, s.btnPrimary]}
            >
              <Text style={[s.btnText, s.btnPrimaryText]}>
                {isLast ? '完成試卷' : '下一題'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </>
  );

  const Body = () => {
    if (loading || !current) return <EmptyState />;
    if (showSummary) return <Summary />;
    return <QuestionBody />;
  };

  return (
    <SafeAreaView style={s.screen} edges={['left','right','bottom']}>
      <GestureDetector gesture={gestures}>
        <ScrollView
          style={s.scroll}
          contentContainerStyle={[s.content, (loading || !current) && s.centerContainer]}
        >
          <Body />
        </ScrollView>
      </GestureDetector>
    </SafeAreaView>
  );
}
