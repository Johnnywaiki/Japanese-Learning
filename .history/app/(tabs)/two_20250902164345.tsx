import { View, Text, Switch, StyleSheet } from 'react-native';
import { useQuiz } from '../../src/store/useQuiz';
import { useEffect } from 'react';

export default function SettingsScreen() {
  const { mixMode, toggleMix, init } = useQuiz();

  // 確保第一次進入時已建立資料庫
  useEffect(()=>{ init(); }, []);

  return (
    <View style={s.wrap}>
      <Text style={s.h1}>設定</Text>
      <View style={s.row}>
        <Text style={s.label}>混合題（單字＋例句）</Text>
        <Switch value={mixMode} onValueChange={toggleMix} />
      </View>
      <Text style={s.hint}>MVP 階段：資料池已含兩類；切換會刷新下一題。</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:{ flex:1, padding:16, gap:16 },
  h1:{ fontSize:22, fontWeight:'700' },
  row:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:8 },
  label:{ fontSize:16 },
  hint:{ opacity:0.6 },
});