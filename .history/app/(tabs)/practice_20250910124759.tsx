// app/(tabs)/practice.tsx
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuiz } from '../../src/store/useQuiz';
import type { QuizItem } from '../../src/db/schema';
import { speakOneShot, stopSpeak } from '../../src/tts';

const C = {
  primary: '#0A84FF',
  text: '#111',
  border: '#e5e7eb',
  card: '#fff',
  success: '#16a34a',
  danger: '#e11d48',
  muted: '#6b7280',
};

export default function PracticePlayScreen() {
  const {
    init,
    loading,
    current,
    answer,
    next,
    lastCorrect,
    score,
    total,
    error,
    lastFilters,
  } = useQuiz();

  const [picked, setPicked] = useState<QuizItem | null>(null);
  const [warn, setWarn] = useState<string>('');

  // 如果直接進入本頁，幫手用上次/預設條件初始化
  useEffect(() => {
    if (!current) init(lastFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 卸載時停 TTS
  useEffect(() => () => stopSpeak(), []);
  // 換題時重置
  useEffect(() => {
    setPicked(null);
    setWarn('');
  }, [current?.stem]);

  if (loading && !current) {
    return (
      <View style={s.center}>
        <ActivityIndicator />
        <Text style={s.mt8}>載入中…</Text>
      </View>
    );
  }
  if (error && !current) {
    return (
      <View style={s.wrap}>
        <Text style={[s.feedback, { color: C.danger }]}>{error}</Text>
      </View>
    );
  }
  if (!current) {
    return (
      <View style={s.center}>
        <Text>暫無題目。</Text>
      </View>
    );
  }

  const onSelect = (opt: QuizItem) => {
    if (lastCorrect !== undefined) return; // 已提交就唔俾再改
    setPicked(opt);
    setWarn('');
  };

  const onSubmit = () => {
    if (!picked) {
      setWarn('請先揀一個答案');
      return;
    }
    setWarn('');
    answer(picked);
    stopSpeak();
  };

  const onNext = () => {
    stopSpeak();
    next();
    setPicked(null);
    setWarn('');
  };

  return (
    <View style={s.wrap}>
      {/* 頂部進度 */}
      <View style={s.topRow}>
        <Text style={s.progress}>分數 {score}/{total}</Text>
      </View>

      {/* 題幹 + speaker */}
      <View style={s.stemRow}>
        <Text style={s.stem} numberOfLines={5}>
          {current.stem}
        </Text>
        <Pressable
          onPress={() => speakOneShot(current.stem)}
          style={s.speaker}
          android_ripple={{ color: '#ddd', borderless: true }}
        >
          <Ionicons name="volume-high-outline" size={22} color={C.text} />
        </Pressable>
      </View>

      {/* 選項 */}
      <View style={s.options}>
        {current.options.map((opt: QuizItem, idx: number) => {
          const selected = picked === opt;
          const answered = lastCorrect !== undefined;
          const isAnswer = opt === current.answer;

          const beforeSubmitStyle = selected ? s.cardSelected : undefined;
          const afterSubmitStyle = answered
            ? isAnswer
              ? s.cardCorrect
              : selected
                ? s.cardWrong
                : s.cardDim
            : undefined;

          return (
            <Pressable
              key={idx}
              onPress={() => onSelect(opt)}
              disabled={answered}
              style={({ pressed }) => [
                s.card,
                beforeSubmitStyle,
                afterSubmitStyle,
                pressed && !answered && s.cardPressed,
              ]}
            >
              <View style={s.cardInner}>
                <View
                  style={[
                    s.bullet,
                    selected && !answered && { borderColor: C.primary },
                    answered && isAnswer && { backgroundColor: C.success, borderColor: C.success },
                    answered && selected && !isAnswer && { backgroundColor: C.danger, borderColor: C.danger },
                  ]}
                />
                <Text
                  style={[
                    s.cardText,
                    selected && !answered && { color: C.primary, fontWeight: '700' },
                    answered && isAnswer && { color: C.success, fontWeight: '700' },
                    answered && selected && !isAnswer && { color: C.danger, fontWeight: '700' },
                  ]}
                >
                  {current.optionText(opt)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* 提示／結果 */}
      {!!warn && lastCorrect === undefined && (
        <Text style={s.warn}>{warn}</Text>
      )}

      {lastCorrect !== undefined && (
        <View
          style={[
            s.result,
            {
              backgroundColor: lastCorrect ? '#e8f7ee' : '#fde8ea',
              borderColor: lastCorrect ? '#b8e6c8' : '#fccbd2',
            },
          ]}
        >
          <Ionicons
            name={lastCorrect ? 'checkmark-circle' : 'close-circle'}
            size={20}
            color={lastCorrect ? C.success : C.danger}
            style={{ marginRight: 8 }}
          />
          <Text
            style={[
              s.resultText,
              { color: lastCorrect ? C.success : C.danger },
            ]}
          >
            {lastCorrect
              ? '正確！'
              : `唔啱😅 正解：${current.optionText(current.answer)}`}
          </Text>
        </View>
      )}

      {/* 底部操作 */}
      {lastCorrect !== undefined ? (
        <Pressable style={s.bottomBtn} onPress={onNext}>
          <Text style={s.bottomBtnText}>下一題</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={onSubmit}
          style={[s.bottomBtn, !picked && s.bottomBtnDisabled]}
          disabled={!picked}
        >
          <Text style={[s.bottomBtnText, !picked && s.bottomBtnTextDisabled]}>
            提交
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mt8: { marginTop: 8 },

  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progress: { fontSize: 14, color: C.muted },

  stemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  stem: { flex: 1, fontSize: 20, lineHeight: 28, color: C.text },
  speaker: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: C.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 1 },
    }),
  },

  options: { gap: 10, marginTop: 6 },

  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 14,
    paddingHorizontal: 14,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 1 },
    }),
  },
  cardPressed: { opacity: 0.7 },
  cardSelected: { borderColor: C.primary, backgroundColor: '#eef5ff' },
  cardCorrect: { borderColor: C.success, backgroundColor: '#e8f7ee' },
  cardWrong: { borderColor: C.danger, backgroundColor: '#fde8ea' },
  cardDim: { opacity: 0.7 },

  cardInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bullet: {
    width: 16, height: 16, borderRadius: 999,
    borderWidth: 2, borderColor: C.border, backgroundColor: '#fff',
  },
  cardText: { fontSize: 17, color: C.text },

  warn: { color: C.danger, marginTop: 6 },

  // ★ 加返呢個，解 "feedback 不存在" 的錯
  feedback: { fontSize: 15, color: C.text },

  result: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultText: { fontSize: 15 },

  bottomBtn: {
    marginTop: 'auto',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: C.primary,
    alignItems: 'center',
  },
  bottomBtnDisabled: { backgroundColor: '#d1d5db' },
  bottomBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  bottomBtnTextDisabled: { color: '#9ca3af' },
});
