// app/(tabs)/practice-daily.tsx
import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, Pressable, ActivityIndicator, StyleSheet,
  useColorScheme, ScrollView, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, Directions } from 'react-native-gesture-handler';
import { router } from 'expo-router';
import { useQuiz } from '../../src/store/useQuiz';
import { markPracticeDone, getCompletedSet, getUnlockedWeek, tokenOf, type Level, type Category } from '../../src/lib/progress';
import { useProgressBus } from '../../src/store/useProgressBus';

function makeStyles(isDark: boolean) {
  const C = {
    bg: isDark ? '#000' : '#fff',
    text: isDark ? '#eee' : '#111',
    soft: isDark ? '#9ca3af' : '#6b7280',
    card: isDark ? '#111' : '#fff',
    border: isDark ? '#333' : '#e5e7eb',
    active: isDark ? '#fff' : '#111',
    wrong: '#d11a2a',
    right: '#1e9e58',
    overlay: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.35)',
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
    row: { flexDirection: 'row', gap: 10 },
    btn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
    btnPrimary: { backgroundColor: C.active, borderColor: C.active },
    btnText: { textAlign: 'center', fontSize: 16, color: C.text, fontWeight: '600' },
    btnPrimaryText: { color: isDark ? '#000' : '#fff' },

    // 結果彈窗
    modalOverlay: { flex: 1, backgroundColor: C.overlay, alignItems: 'center', justifyContent: 'center', padding: 20 },
    modalCard: {
      width: '100%', borderRadius: 16, padding: 18, backgroundColor: C.card,
      shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8,
      borderWidth: 1, borderColor: C.border, gap: 10,
    },
    modalTitle: { fontSize: 18, fontWeight: '900', color: C.text, textAlign: 'center' },
    modalLine: { fontSize: 15, color: C.text, textAlign: 'center' },
    modalHint: { fontSize: 13, color: C.soft, textAlign: 'center' },
    modalBtnRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    pillBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
    pillPrimary: { backgroundColor: C.active, borderColor: C.active },
    pillText: { textAlign: 'center', fontWeight: '800', fontSize: 15, color: C.text },
    pillPrimaryText: { color: isDark ? '#000' : '#fff' },
  });
  return { s };
}

export default function PracticeDailyScreen() {
  const isDark = useColorScheme() === 'dark';
  const { s } = useMemo(() => makeStyles(isDark), [isDark]);

  const {
    loading, current, selected, answered, lastCorrect,
    score, total, totalAvailable, pick, submit, next, prev,
    pool, idx, answers, jumpTo, mode, meta,
  } = useQuiz();

  const [needPickMsg, setNeedPickMsg] = useState(false);
  const [showResult, setShowResult] = useState(false);

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

  const correctText = current?.correctOption?.content ?? '';

  const onSubmit = useCallback(() => {
    if (!selected) { setNeedPickMsg(true); return; }
    setNeedPickMsg(false);
    submit();
  }, [selected, submit]);

  const isLast = pool.length > 0 && idx >= pool.length - 1;
  const isEmpty = !loading && (pool.length === 0 || !current);

  // 完成一日：提交最後一題後 → 記錄進度 + 彈窗
  const afterAnswerBlock = useMemo(() => {
    if (!isLast || !answered) return null;
    return (
      <View />
    );
  }, [isLast, answered]);

  // 當最後一題剛剛回答完：打開結果彈窗 & 記錄進度
  React.useEffect(() => {
    if (isLast && answered) {
      (async () => {
        // 記錄每日完成（解鎖下一日／可能下週）
        const dMeta = (meta as any) as { level: Level; category: Category; week: number; day: number };
        if (dMeta?.level && dMeta?.category && dMeta?.week && dMeta?.day) {
          await markPracticeDone({
            level: dMeta.level,
            category: dMeta.category,
            week: dMeta.week,
            day: dMeta.day,
          });
          // 通知 Home 即時刷新
          useProgressBus.getState().bump();
        }
        setShowResult(true);
      })();
    }
  }, [isLast, answered, meta]);

  const answeredCount = React.useMemo(() => Object.keys(answers).length, [answers]);
  const correctCount = React.useMemo(
    () => Object.values(answers).filter(a => a.correct).length,
    [answers]
  );
  const percent = totalAvailable > 0 ? Math.round((correctCount / totalAvailable) * 100) : 0;
  const praise =
    percent >= 80 ? '好勁！Keep it up 💪'
    : percent >= 50 ? '唔錯呀，繼續加油！✨'
    : '未達標，但唔緊要～逐步嚟就得！📈';

  // 「繼續下一日」
  const onContinueNextDay = useCallback(async () => {
    const dMeta = (meta as any) as { level: Level; category: Category; week: number; day: number };
    if (!dMeta?.level || !dMeta?.category || !dMeta?.week || !dMeta?.day) {
      setShowResult(false);
      router.replace('/(tabs)/home');
      return;
    }

    // 計下一個 day（若 day < 7 → +1；否則 week+1, day=1）
    let nextWeek = dMeta.week;
    let nextDay = dMeta.day < 7 ? dMeta.day + 1 : 1;
    if (dMeta.day === 7) nextWeek = dMeta.week + 1;

    // 試下有無題／已解鎖
    const ok = await useQuiz.getState().init({
      level: dMeta.level,
      kind: 'language',
      extra: {
        level: dMeta.level,
        category: dMeta.category,
        week: nextWeek,
        day: nextDay,
      },
    });

    if (ok) {
      setShowResult(false);
      router.replace('/(tabs)/practice-daily');
    } else {
      // 可能未解鎖或無題
      setShowResult(false);
      router.replace('/(tabs)/home');
    }
  }, [meta]);

  const onGoHome = useCallback(() => {
    setShowResult(false);
    router.replace('/(tabs)/home');
  }, []);

  const onGoMistakes = useCallback(() => {
    setShowResult(false);
    router.replace('/(tabs)/mistakes');
  }, []);

  const Body = () => {
    if (loading) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8, color: isDark ? '#ccc' : '#666' }}>載入中…</Text>
        </View>
      );
    }
    if (isEmpty) {
      return (
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 18, color: isDark ? '#eee' : '#111' }}>今日題庫未準備</Text>
          <Pressable onPress={() => router.replace('/(tabs)/home')} style={[s.btn, s.btnPrimary, { marginTop: 14, minWidth: 180 }]}>
            <Text style={[s.btnText, s.btnPrimaryText]}>返回 Home</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <>
        <View style={s.metaBar}>
          <Text style={s.metaTitle}>第 { (current?.question_number ?? 0) } 題</Text>
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

        {!answered && needPickMsg && (
          <Text style={{ color: '#d11a2a', marginTop: 8 }}>請先揀一個選項再提交。</Text>
        )}

        {answered && (
          <>
            <Text style={[s.feedback, lastCorrect ? s.rightText : s.wrongText]}>
              {lastCorrect ? '正確！' : `唔啱😅 正解：${current?.correctOption?.content ?? ''}`}
            </Text>
            {!lastCorrect && current?.correctOption?.explanation && (
              <Text style={s.explain}>{current.correctOption.explanation}</Text>
            )}
          </>
        )}

        <View style={s.bottomWrap}>
          <View style={s.row}>
            {!answered ? (
              <Pressable onPress={onSubmit} style={[s.btn, s.btnPrimary]}>
                <Text style={[s.btnText, s.btnPrimaryText]}>提交</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={isLast ? undefined : useQuiz.getState().next}
                style={[s.btn, s.btnPrimary]}
              >
                <Text style={[s.btnText, s.btnPrimaryText]}>
                  {isLast ? '已到最後一題' : '下一題'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {afterAnswerBlock}
      </>
    );
  };

  return (
    <SafeAreaView style={s.screen} edges={['left','right','bottom']}>
      <GestureDetector gesture={gestures}>
        <ScrollView
          style={s.scroll}
          contentContainerStyle={[s.content, (!current || (isLast && answered)) && s.centerContainer]}
        >
          <Body />
        </ScrollView>
      </GestureDetector>

      {/* 結果彈窗 */}
      <Modal visible={showResult} transparent animationType="fade" onRequestClose={() => setShowResult(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>完成今日練習！</Text>
            <Text style={s.modalLine}>正確 {correctCount}／{totalAvailable} 題（已作答 {answeredCount} 題）</Text>
            <Text style={s.modalLine}>正確率 {percent}%</Text>
            <Text style={s.modalHint} numberOfLines={2}>{praise}</Text>

            <View style={s.modalBtnRow}>
              <Pressable onPress={onContinueNextDay} style={[s.pillBtn, s.pillPrimary]}>
                <Text style={[s.pillText, s.pillPrimaryText]}>繼續下一日</Text>
              </Pressable>
              <Pressable onPress={onGoHome} style={s.pillBtn}>
                <Text style={s.pillText}>返 Home</Text>
              </Pressable>
            </View>
            <Pressable onPress={onGoMistakes} style={[s.pillBtn, { marginTop: 6 }]}>
              <Text style={s.pillText}>去錯題本重溫</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
