// components/PracticeCommon.tsx
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { router } from 'expo-router';
import { useQuiz } from '@/src/store/useQuiz';

type Props = { from: 'home' | 'index' };

export default function PracticeCommon({ from }: Props) {
  const isDark = useColorScheme() === 'dark';
  const C = {
    bg: isDark ? '#000' : '#fff',
    card: isDark ? '#0b0b0b' : '#fff',
    text: isDark ? '#eee' : '#111',
    soft: isDark ? '#9ca3af' : '#6b7280',
    primary: isDark ? '#93c5fd' : '#2563eb',
    border: isDark ? '#2a2a2a' : '#e5e7eb',
  };

  const { current, idx, totalAvailable, selected, answered, lastCorrect, score, total,
          pick, submit, next, prev } = useQuiz();

  const s = useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg, padding: 16, gap: 12 },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { color: C.text, fontSize: 16, fontWeight: '700' },
    sub: { color: C.soft, fontSize: 12 },
    card: { backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, gap: 10 },
    stem: { color: C.text, fontSize: 16, fontWeight: '700' },
    passage: { color: C.soft, fontSize: 14 },
    opt: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: C.border, marginTop: 8 },
    optActive: { borderColor: C.primary, backgroundColor: isDark ? '#0f172a' : '#eff6ff' },
    optText: { color: C.text, fontSize: 15 },
    row: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
    btn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
    btnPri: { borderColor: C.primary },
    btnText: { color: C.text, fontWeight: '700' },
    btnPriText: { color: C.primary },
    result: { textAlign: 'center', color: C.soft, marginTop: 6 },
  }), [isDark]);

  if (!current) {
    return (
      <View style={s.screen}>
        <Text style={s.title}>載入緊題目…</Text>
        <Text style={s.sub}>如長時間未顯示，可能係你所選條件未有題目。</Text>
      </View>
    );
  }

  const atLast = idx >= totalAvailable - 1;

  const onSubmit = () => { if (!answered) submit(); };
  const onNext = () => {
    if (!answered) return;
    if (atLast) {
      router.replace({ pathname: '/result', params: { correct: String(score), total: String(total), from } });
    } else {
      next();
    }
  };

  return (
    <View style={s.screen}>
      <View style={s.head}>
        <Text style={s.title}>第 {idx + 1} / {totalAvailable} 題</Text>
        <Text style={s.sub}>得分 {score} / 作答 {total}</Text>
      </View>

      <View style={s.card}>
        <Text style={s.stem}>{current.stem}</Text>
        {!!current.passage && <Text style={s.passage}>{current.passage}</Text>}

        {current.options.map((o) => {
          const active = selected?.position === o.position;
          return (
            <Pressable
              key={o.position}
              onPress={() => !answered && pick(o)}
              style={({ pressed }) => [s.opt, active && s.optActive, pressed && { opacity: 0.9 }]}
            >
              <Text style={s.optText}>{o.content}</Text>
              {answered && active && (
                <Text style={[s.sub, { marginTop: 4 }]}>
                  {o.is_correct ? '✅ 正確' : '❌ 錯誤'} {o.explanation ? `｜${o.explanation}` : ''}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {!!answered && <Text style={s.result}>{lastCorrect ? '答啱！' : '再接再厲～'}</Text>}

      <View style={s.row}>
        <Pressable onPress={prev} style={s.btn}><Text style={s.btnText}>上一題</Text></Pressable>
        {!answered ? (
          <Pressable onPress={onSubmit} style={[s.btn, s.btnPri]}>
            <Text style={[s.btnText, s.btnPriText]}>提交</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onNext} style={[s.btn, s.btnPri]}>
            <Text style={[s.btnText, s.btnPriText]}>{atLast ? '完成' : '下一題'}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
