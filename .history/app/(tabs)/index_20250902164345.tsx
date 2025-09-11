import { useEffect, useMemo } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useQuiz } from '../../src/store/useQuiz';

export default function PracticeScreen() {
  const { init, loading, current, answer, next, lastCorrect, score, total } = useQuiz();

  useEffect(()=>{ init(); }, []);

  if (loading || !current) {
    return (<View style={s.center}><ActivityIndicator /><Text style={s.mt8}>載入中…</Text></View>);
  }

  return (
    <View style={s.wrap}>
      <Text style={s.progress}>分數 {score}/{total}</Text>
      <Text style={s.stem}>{current.stem}</Text>

      <View style={s.options}>
        {current.options.map((opt, idx)=>(
          <Pressable key={idx} style={({pressed})=>[s.btn, pressed && s.btnPressed]} onPress={()=>answer(opt)}>
            <Text style={s.btnText}>{current.optionText(opt)}</Text>
          </Pressable>
        ))}
      </View>

      {lastCorrect!==undefined && (
        <Text style={[s.feedback, { color: lastCorrect ? '#1e9e58' : '#d11' }]}>
          {lastCorrect ? '正確！' : `唔啱😅 正解：${current.optionText(current.answer)}`}
        </Text>
      )}

      <Pressable style={s.next} onPress={next}>
        <Text style={s.nextText}>下一題</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  center:{ flex:1, justifyContent:'center', alignItems:'center' },
  mt8:{ marginTop:8 },
  wrap:{ flex:1, padding:16, gap:16 },
  progress:{ fontSize:16, opacity:0.7 },
  stem:{ fontSize:22, lineHeight:30 },
  options:{ gap:12 },
  btn:{ padding:14, borderRadius:12, borderWidth:1, borderColor:'#ddd' },
  btnPressed:{ opacity:0.6 },
  btnText:{ fontSize:18 },
  feedback:{ fontSize:16 },
  next:{ marginTop:'auto', padding:14, borderRadius:12, backgroundColor:'#111' },
  nextText:{ color:'#fff', textAlign:'center', fontSize:18, fontWeight:'600' },
});
