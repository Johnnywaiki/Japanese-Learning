// app/(tabs)/practice.tsx
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuiz } from '../../src/store/useQuiz';

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
  };
  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    wrap: { flex: 1, padding: 16, gap: 14 },

    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    progress: { color: C.soft },
    totalHint: { color: C.soft },

    stem: { fontSize: 20, lineHeight: 28, color: C.text },
    passage: { fontSize: 14, lineHeight: 20, color: C.soft },

    options: { gap: 10, marginTop: 4 },
    opt: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
    optSelected: { borderColor: C.active, borderWidth: 2 },
    optText: { fontSize: 16, color: C.text },

    feedback: { fontSize: 15, marginTop: 6 },
    wrongText: { color: C.wrong },
    rightText: { color: C.right },
    explain: { marginTop: 4, color: C.soft },

    row: { flexDirection: 'row', gap: 10, marginTop: 12 },
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

  const { init, loading, current, pool, selected, answered, lastCorrect, score, total, totalAvailable, pick, submit, next } = useQuiz() as any;
  const [needPickMsg, setNeedPickMsg] = useState(false);

  // 如果你要喺打開頁面就用上次篩選重載，可以保留；否則可移除：
  useEffect(() => { /* void init(); */ }, []);

  if (loading || !current) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.center}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8, color: isDark ? '#ccc' : '#666' }}>載入中…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const onSubmit = () => {
    if (!selected) { setNeedPickMsg(true); return; }
    setNeedPickMsg(false);
    submit();
  };

  const correct = current.correctOption;
  const correctText = correct ? correct.content : '';

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.wrap}>
        {/* 頂部狀態 */}
        <View style={s.topRow}>
          <Text style={s.progress}>分數 {score}/{total}</Text>
          <Text style={s.totalHint}>題庫 {totalAvailable} 題</Text>
        </View>

        {/* 題幹 / 讀解 */}
        <Text style={s.stem}>{current.stem}</Text>
        {!!current.passage && <Text style={s.passage}>{current.passage}</Text>}

        {/* 選項 */}
        <View style={s.options}>
          {current.options.map((o: any) => {
            const isSelected = selected?.position === o.position;
            return (
              <Pressable
                key={o.position}
                disabled={answered} // 提交後唔俾再轉
                onPress={() => pick(o)}
                style={[s.opt, isSelected && s.optSelected]}
              >
                <Text style={s.optText}>{o.content}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* 未揀時提示 */}
        {!answered && needPickMsg && <Text style={s.warn}>請先揀一個選項再提交。</Text>}

        {/* 回饋 */}
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

        {/* 按鈕區 */}
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
    </SafeAreaView>
  );
}
