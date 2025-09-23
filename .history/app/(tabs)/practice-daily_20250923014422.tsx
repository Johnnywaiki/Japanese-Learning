// app/(tabs)/practice-daily.tsx
import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  useColorScheme,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, Directions } from 'react-native-gesture-handler';
import { router } from 'expo-router';
import { useQuiz, type DailyMeta } from '../../src/store/useQuiz';
import { markPracticeDone, type Level } from '../../src/lib/progress';

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

    // ScrollView
    scroll: { flex: 1 },
    content: { paddingHorizontal: 12, paddingBottom: 12, paddingTop: 6, gap: 10 },
    // 置中容器（空狀態／總結）
    centerContainer: { flexGrow: 1, justifyContent: 'center' },
    emptyWrap: { alignItems: 'center' },

    // 頂部資訊
    metaBar: {
      paddingVertical: 8, paddingHorizontal: 12,
      borderRadius: 10, borderWidth: 1, borderColor: C.border,
      backgroundColor: isDark ? '#0f0f0f' : '#fafafa',
    },
    metaTitle: { fontSize: 15, fontWeight: '600', color: C.text },
    topRow: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    progress: { color: C.soft },
    totalHint: { color: C.soft },

    // 題幹/段落
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

    // 底部區域：題號 grid + 按鈕
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

    // 按鈕
    row: { flexDirection: 'row', gap: 10 },
    btn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
    btnPrimary: { backgroundColor: C.active, borderColor: C.active },
    btnText: { textAlign: 'center', fontSize: 16, color: C.text, fontWeight: '600' },
    btnPrimaryText: { color: isDark ? '#000' : '#fff' },

    // 其他
    warn: { color: C.wrong, marginTop: 8 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  });
  return { s };
}

// 🔎 type guard：把 meta 窄化為 DailyMeta
function isDailyMeta(x: unknown): x is DailyMeta {
  if (!x || typeof x !== 'object') return false;
  const m = x as Record<string, unknown>;
  return (
    'level' in m &&
    'category' in m &&
    'week' in m &&
    'day' in m
  );
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

  // 只在 Daily 模式下才取用 meta（型別安全）
  const dm: DailyMeta | null = mode === 'daily' && isDailyMeta(meta) ? meta : null;

  const metaTitle = useMemo(() => {
    if (!dm) return '每日練習';
    const cat = dm.category === 'grammar' ? '文法' : '字彙';
    return `${dm.level}・${cat}・第${dm.week}週・第${dm.day}日`;
  }, [dm]);

  // ---- Swipe 手勢（僅導航，不改答案）----
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

  const correctText = (current as any)?.correctOption?.content ?? '';

  const onSubmit = useCallback(() => {
    if (!selected) { setNeedPickMsg(true); return; }
    setNeedPickMsg(false);
    submit();
  }, [selected, submit]);

  const onPickHome = useCallback(() => {
    router.replace('/(tabs)/home');
  }, []);

  // 完卷條件：喺最後一條而且已提交
  const isLast = pool.length > 0 && idx >= pool.length - 1;
  const showSummary = isLast && answered;

  // 置中 ScrollView 內容：空狀態 / 總結
  const isEmpty = !loading && (pool.length === 0 || !current);
  const centerContent = isEmpty || showSummary;

  // 分數統計（總結用）
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const correctCount = useMemo(
    () => Object.values(answers).filter(a => a.correct).length,
    [answers]
  );

  // ✅ 完成今日（寫入完成 → 跳返 Home 解鎖下一日）
  const onFinishToday = useCallback(async () => {
    try {
      if (!dm) {
        router.replace('/(tabs)/home');
        return;
      }
      await markPracticeDone({
        level: dm.level as Level,   // Topic → Level（等價枚舉）
        category: dm.category,
        week: dm.week,
        day: dm.day,
      });
      router.replace('/(tabs)/home');
    } catch (e) {
      console.warn('[practice-daily] markPracticeDone error', e);
      Alert.alert('保存進度失敗', '請稍後再試或重開應用程式。', [
        { text: '返回主頁', onPress: () => router.replace('/(tabs)/home') },
      ]);
    }
  }, [dm]);

  // --- 小組件：空狀態（置中） ---
  const EmptyState = () => (
    <View style={s.emptyWrap}>
      <Text style={s.stem}>今日尚未準備題目</Text>
      <Text style={[s.passage, { textAlign: 'center', marginTop: 8 }]}>
        請返回每日練習首頁揀其他日子。
      </Text>
      <Pressable
        onPress={onPickHome}
        style={[s.btn, s.btnPrimary, { marginTop: 16, minWidth: 180 }]}
      >
        <Text style={[s.btnText, s.btnPrimaryText]}>返回每日練習</Text>
      </Pressable>
    </View>
  );

  // --- 小組件：完卷總結（置中） ---
  const Summary = () => (
    <View style={s.emptyWrap}>
      <Text style={[s.stem, { textAlign: 'center' }]}>{metaTitle} 完成！</Text>
      <Text style={[s.passage, { textAlign: 'center', marginTop: 10 }]}>
        正確 {correctCount}／{totalAvailable} 題（已作答 {answeredCount} 題）
      </Text>
      <Pressable
        onPress={onFinishToday}
        style={[s.btn, s.btnPrimary, { marginTop: 18, minWidth: 200 }]}
      >
        <Text style={[s.btnText, s.btnPrimaryText]}>完成今日練習</Text>
      </Pressable>
    </View>
  );

  // --- 正常題目內容 ---
  const QuestionBody = () => (
    <>
      <View style={s.metaBar}>
        <Text style={s.metaTitle}>
          {metaTitle} ・ 第 {current!.question_number} 題
        </Text>
      </View>

      <View style={s.topRow}>
        <Text style={s.progress}>分數 {score}/{total}</Text>
        <Text style={s.totalHint}>題庫 {totalAvailable} 題</Text>
      </View>

      <Text style={s.stem}>{current!.stem}</Text>
      {!!current!.passage && <Text style={s.passage}>{current!.passage}</Text>}

      <View style={s.options}>
        {(current as any).options.map((o: any) => {
          const isSelected = (selected as any)?.position === o.position;
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
          {!lastCorrect && (current as any)?.correctOption?.explanation && (
            <Text style={s.explain}>{(current as any).correctOption.explanation}</Text>
          )}
        </>
      )}

      {/* 底部：題號 grid + 動作 */}
      <View style={s.bottomWrap}>
        <Text style={s.gridTitle}>題目選擇（可跳題，已提交唔可更改答案）</Text>
        <View style={s.grid}>
          {pool.map((_, i) => {
            const past = (answers as any)[i];
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
          {!answered ? (
            <Pressable onPress={onSubmit} style={[s.btn, s.btnPrimary]}>
              <Text style={[s.btnText, s.btnPrimaryText]}>提交</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={isLast ? onFinishToday : next}
              style={[s.btn, s.btnPrimary]}
            >
              <Text style={[s.btnText, s.btnPrimaryText]}>
                {isLast ? '完成今日練習' : '下一題'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </>
  );

  // --- 主體：Loading / 空 / 總結 / 正常題目 ---
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
    if (showSummary) return <Summary />;
    return <QuestionBody />;
  };

  return (
    <SafeAreaView style={s.screen} edges={['left','right','bottom']}>
      <GestureDetector gesture={gestures}>
        <ScrollView
          style={s.scroll}
          contentContainerStyle={[s.content, centerContent && s.centerContainer]}
        >
          <Body />
        </ScrollView>
      </GestureDetector>
    </SafeAreaView>
  );
}
