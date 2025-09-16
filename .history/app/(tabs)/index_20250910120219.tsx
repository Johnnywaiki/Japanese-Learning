// app/(tabs)/index.tsx
import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useQuiz } from '../../src/store/useQuiz';
import type { QuizItem, Topic } from '../../src/db/schema';
import { speakOneShot, stopSpeak } from '../../src/tts';
import type { PracticeFilter } from '../../src/db';

const LEVELS: (Topic | 'N2-N3-random' | 'all' | 'daily')[] = ['N1','N2','N3','N4','N5','N2-N3-random','daily','all'];
const YEARS_11_20 = Array.from({length: 9}, (_,i)=>2011+i); // 2011-2019
const YEARS_21_25 = Array.from({length: 5}, (_,i)=>2021+i); // 2021-2025
type Kind = 'language'|'reading'|'listening';

export default function PracticeScreen() {
  const { init, loading, current, answer, next, lastCorrect, score, total, error } = useQuiz();

  // ---- 篩選條件（預設：N2-N3隨機 + 言語知識 + 年份/期未選）----
  const [level, setLevel] = useState<Topic | 'N2-N3-random' | 'all'>('N2-N3-random');
  const [year, setYear] = useState<number | 'random' | undefined>(undefined);
  const [session, setSession] = useState<'July'|'December'|'random'|undefined>(undefined);
  const [kind, setKind] = useState<Kind>('language');

  // 提交/下一題本地狀態
  const [picked, setPicked] = useState<QuizItem | null>(null);
  const [warn, setWarn] = useState<string>('');

  // 第一次進來：自動根據預設條件開始（N2-N3 隨機）
  useEffect(() => {
    startPractice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => { stopSpeak(); }, []);

  function startPractice() {
    const filters: PracticeFilter = {
      level: level ?? 'N2-N3-random',
      kind,
      year: year ?? undefined,
      session: session ?? undefined,
    };
    init(filters);                // ← 你嘅 useQuiz.ts 需支持 init(filters)
    setPicked(null); setWarn('');
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

  /* ---------------- UI ---------------- */
  return (
    <View style={s.wrap}>
      <Text style={s.h1}>練習</Text>

      {/* 程序（級別） */}
      <Text style={s.label}>程序</Text>
      <View style={s.row}>
        {LEVELS.map(l => (
          <Pressable key={String(l)} onPress={() => setLevel(l as any)} style={[s.pill, level === l && s.pillActive]}>
            <Text style={[s.pillText, level === l && s.pillTextActive]}>
              {l === 'N2-N3-random' ? 'N2–N3 隨機' : l}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* 年份 + 期別 */}
      <Text style={s.label}>年份</Text>
      <View style={s.box}>
        <Text style={s.small}>2011–2020</Text>
        <View style={s.rowWrap}>
          {YEARS_11_20.map(y => (
            <Pressable key={y} onPress={() => setYear(y)} style={[s.pillSm, year===y && s.pillActive]}>
              <Text style={[s.pillTextSm, year===y && s.pillTextActive]}>{y}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[s.small,{marginTop:8}]}>2021–2025</Text>
        <View style={s.rowWrap}>
          {YEARS_21_25.map(y => (
            <Pressable key={y} onPress={() => setYear(y)} style={[s.pillSm, year===y && s.pillActive]}>
              <Text style={[s.pillTextSm, year===y && s.pillTextActive]}>{y}</Text>
            </Pressable>
          ))}
        </View>
        <View style={[s.row,{marginTop:8}]}>
          <Pressable onPress={() => setYear(undefined)} style={[s.pill, year===undefined && s.pillActive]}>
            <Text style={[s.pillText, year===undefined && s.pillTextActive]}>未選</Text>
          </Pressable>
          <Pressable onPress={() => setYear('random')} style={[s.pill, year==='random' && s.pillActive]}>
            <Text style={[s.pillText, year==='random' && s.pillTextActive]}>隨機</Text>
          </Pressable>
          {/* 期別 */}
          <View style={{width:12}} />
          <Pressable onPress={() => setSession('July')} style={[s.pill, session==='July' && s.pillActive]}>
            <Text style={[s.pillText, session==='July' && s.pillTextActive]}>7月</Text>
          </Pressable>
          <Pressable onPress={() => setSession('December')} style={[s.pill, session==='December' && s.pillActive]}>
            <Text style={[s.pillText, session==='December' && s.pillTextActive]}>12月</Text>
          </Pressable>
          <Pressable onPress={() => setSession(undefined)} style={[s.pill, !session && s.pillActive]}>
            <Text style={[s.pillText, !session && s.pillTextActive]}>未選</Text>
          </Pressable>
        </View>
      </View>

      {/* 類型 */}
      <Text style={s.label}>類型</Text>
      <View style={s.row}>
        {([
          {k:'language', label:'言語知識（文字‧語彙‧文法）'},
          {k:'reading', label:'讀解'},
          {k:'listening', label:'聽解（暫未支援）'},
        ] as const).map(x => (
          <Pressable key={x.k} onPress={() => setKind(x.k as Kind)} style={[s.pill, kind===x.k && s.pillActive]}>
            <Text style={[s.pillText, kind===x.k && s.pillTextActive]}>{x.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* 開始練習 */}
      <Pressable style={[s.next, {marginTop:8}]} onPress={startPractice}>
        <Text style={s.nextText}>開始練習</Text>
      </Pressable>

      {/* --- 題目區 --- */}
      {loading && (
        <View style={s.center}><ActivityIndicator /><Text style={s.mt8}>載入中…</Text></View>
      )}
      {!loading && error && (
        <Text style={[s.feedback,{color:'#d11'}]}>{error}</Text>
      )}
      {!loading && !error && current && (
        <>
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
                    s.btn, selected && s.btnSelected, (pressed && !disabled) && s.btnPressed
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
              <Pressable style={s.next} onPress={onNext}><Text style={s.nextText}>下一題</Text></Pressable>
            </>
          ) : (
            <Pressable onPress={onSubmit} style={[s.next, !picked && s.nextDisabled]} disabled={!picked}>
              <Text style={[s.nextText, !picked && s.nextTextDisabled]}>提交</Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 12 },
  h1: { fontSize: 20, fontWeight: '700' },
  label: { fontSize: 15, marginTop: 4 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 6 },
  rowWrap: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  box: { padding: 10, borderWidth: 1, borderColor: '#eee', borderRadius: 12, gap: 6 },

  pill: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: '#ddd' },
  pillSm: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: '#ddd' },
  pillActive: { backgroundColor: '#111', borderColor: '#111' },
  pillText: { fontSize: 14 },
  pillTextSm: { fontSize: 13 },
  pillTextActive: { color: '#fff', fontWeight: '700' },
  small: { fontSize: 12, opacity: 0.7 },

  center: { justifyContent: 'center', alignItems: 'center' },
  mt8: { marginTop: 8 },

  progress: { fontSize: 15, opacity: 0.7, marginTop: 8 },
  stem: { fontSize: 20, lineHeight: 28, flexShrink: 1 },
  speaker: { paddingHorizontal:10, paddingVertical:6, borderRadius:10, borderWidth:1, borderColor:'#ddd' },

  options: { gap: 10, marginTop: 8 },
  btn: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff' },
  btnPressed: { opacity: 0.6 },
  btnSelected: { borderColor: '#111', backgroundColor: '#111' },
  btnText: { fontSize: 17 },
  btnTextSelected: { color: '#fff', fontWeight: '600' },

  warn: { color: '#d11', marginTop: 4 },

  feedback: { fontSize: 15 },

  next: { marginTop: 10, padding: 14, borderRadius: 12, backgroundColor: '#111' },
  nextDisabled: { backgroundColor: '#ddd' },
  nextText: { color: '#fff', textAlign: 'center', fontSize: 17, fontWeight: '600' },
  nextTextDisabled: { color: '#999' },
});
