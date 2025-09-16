// app/practice/index.tsx
import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useQuiz } from '../../src/store/useQuiz';
import type { QuizItem } from '../../src/db/schema';
import { speakOneShot, stopSpeak } from '../../src/tts';

export default function PracticePlayScreen() {
  const { init, loading, current, answer, next, lastCorrect, score, total, error, lastFilters } = useQuiz();

  const [picked, setPicked] = useState<QuizItem | null>(null);
  const [warn, setWarn] = useState<string>('');

  // 如果用戶直接打開本頁（未經「開始練習」），幫佢用預設條件初始化
  useEffect(() => {
    if (!current) init(lastFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => { stopSpeak(); }, []);
  useEffect(() => { setPicked(null); setWarn(''); }, [current?.stem]);

  if (loading && !current) {
    return (<View style={s.center}><ActivityIndicator /><Text style={s.mt8}>載入中…</Text></View>);
  }
  if (error && !current) {
    return (
      <View style={s.wrap}>
        <Text style={[s.feedback, { color: '#d11' }]}>{error}</Text>
      </View>
    );
  }
  if (!current) {
    return (<View style={s.center}><Text>暫無題目。</Text></View>);
  }

  const onSelect = (opt: QuizItem) => {
    if (lastCorrect !== undefined) return;
    setPicked(opt); setWarn('');
  };
  const onSubmit = () => {
    if (!picked) { setWarn('請先揀一個答案'); return; }
    setWarn(''); answer(picked); stopSpeak();
  };
  const onNext = () => { stopSpeak(); next(); setPicked(null); setWarn(''); };

  return (
    <View style={s.wrap}>
      <Text style={s.progress}>分數 {score}/{total}</Text>

      <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
        <Text style={s.stem}>{current.stem}</Text>
        <Pressable onPress={() => speakOneShot(current.stem)} style={s.speaker}>
          <Text style={{ fontSize:18 }}>🔊</Text>
        </Pressable>
      </View>

      <View style={s.options}>
        {current.options.map((opt: QuizItem, idx: number) => {
          const selected = picked ? current.optionText(picked) === current.optionText(opt) : false;
          const disabled = lastCorrect !== undefined;
          return (
            <Pressable
              key={idx}
              onPress={() => onSelect(opt)}
              disabled={disabled}
              style={({ pressed }) => [
                s.btn,
                selected && s.btnSelected,
                (pressed && !disabled) && s.btnPressed
              ]}
            >
              <Text style={[s.btnText, selected && s.btnTextSelected]}>
                {current.optionText(opt)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {!!warn && lastCorrect === undefined && <Text style={s.warn}>{warn}</Text>}

      {lastCorrect !== undefined ? (
        <>
          <Text style={[s.feedback, { color: lastCorrect ? '#1e9e58' : '#d11' }]}>
            {lastCorrect ? '正確！' : `唔啱😅 正解：${current.optionText(current.answer)}`}
          </Text>
          <Pressable style={s.next} onPress={onNext}>
            <Text style={s.nextText}>下一題</Text>
          </Pressable>
        </>
      ) : (
        <Pressable onPress={onSubmit} style={[s.next, !picked && s.nextDisabled]} disabled={!picked}>
          <Text style={[s.nextText, !picked && s.nextTextDisabled]}>提交</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mt8: { marginTop: 8 },
  wrap: { flex: 1, padding: 16, gap: 16 },
  progress: { fontSize: 16, opacity: 0.7 },
  stem: { fontSize: 22, lineHeight: 30, flexShrink: 1 },
  speaker: { paddingHorizontal:10, paddingVertical:6, borderRadius:10, borderWidth:1, borderColor:'#ddd' },

  options: { gap: 12 },
  btn: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff' },
  btnPressed: { opacity: 0.6 },
  btnSelected: { borderColor: '#111', backgroundColor: '#111' },
  btnText: { fontSize: 18 },
  btnTextSelected: { color: '#fff', fontWeight: '600' },

  warn: { color: '#d11', marginTop: -4 },

  feedback: { fontSize: 16 },

  next: { marginTop: 'auto', padding: 14, borderRadius: 12, backgroundColor: '#111' },
  nextDisabled: { backgroundColor: '#ddd' },
  nextText: { color: '#fff', textAlign: 'center', fontSize: 18, fontWeight: '600' },
  nextTextDisabled: { color: '#999' },
});
