import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getMistakes, clearMistakes, insertMistake } from '../../src/db';
import type { MistakeRow } from '../../src/db/schema';

function timeAgo(ms: number) {
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export default function MistakesScreen() {
  const [items, setItems] = useState<MistakeRow[]>([]);

  const load = useCallback(() => {
    setItems(getMistakes());
  }, []);

  // 初次進入頁面載入一次
  useEffect(() => {
    load();
  }, [load]);

  // ⭐️ 每次 Tab 重新獲得焦點時刷新（關鍵）
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onClear = () => {
    clearMistakes();
    load();
  };

  // （可選）測試鍵：手動塞一條假錯題，方便檢查寫入是否正常
  const onAddDummy = () => {
    insertMistake({
      kind: 'word',
      itemId: 9999,
      stem: 'テスト（てすと）',
      correct: '測試',
      picked: '錯誤答案',
      topic: 'daily',
    });
    load();
  };

  return (
    <View style={s.wrap}>
      <View style={s.rowHeader}>
        <Text style={s.h1}>錯題本（{items.length}）</Text>
        <View style={{ flexDirection:'row', gap:8 }}>
          <Pressable onPress={load} style={s.btn}>
            <Text style={s.btnText}>刷新</Text>
          </Pressable>
          <Pressable onPress={onClear} style={s.btn}>
            <Text style={s.btnText}>清空</Text>
          </Pressable>
          <Pressable onPress={onAddDummy} style={s.btnGhost}>
            <Text style={s.btnGhostText}>加測試</Text>
          </Pressable>
        </View>
      </View>

      {items.length === 0 ? (
        <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
          <Text>暫時未有錯題 🎉</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => String(x.id)}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.badgeRow}>
                <Text style={s.badge}>{item.kind === 'word' ? '單字' : '例句'}</Text>
                <Text style={s.dot}>·</Text>
                <Text style={s.badge}>{item.topic.toUpperCase()}</Text>
                <Text style={[s.time]}>{'  '}{timeAgo(item.created_at)} 前</Text>
              </View>
              <Text style={s.stem}>{item.stem}</Text>
              <Text style={s.line}>你的答案：<Text style={{ color:'#d11' }}>{item.picked}</Text></Text>
              <Text style={s.line}>正確答案：<Text style={{ color:'#1e9e58' }}>{item.correct}</Text></Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  rowHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom: 8 },
  h1: { fontSize: 22, fontWeight: '700' },
  btn: { paddingHorizontal:12, paddingVertical:8, borderRadius:999, borderWidth:1, borderColor:'#ddd' },
  btnText: { fontSize:16 },
  btnGhost: { paddingHorizontal:12, paddingVertical:8, borderRadius:999, borderWidth:1, borderColor:'#bbb', backgroundColor:'#f8f8f8' },
  btnGhostText: { fontSize:16, color:'#333' },
  card: { padding:12, borderRadius:12, borderWidth:1, borderColor:'#eee', backgroundColor:'#fff' },
  badgeRow: { flexDirection:'row', alignItems:'center', marginBottom:6 },
  badge: { fontSize:12, paddingHorizontal:8, paddingVertical:2, borderRadius:999, borderWidth:1, borderColor:'#ddd' },
  dot: { marginHorizontal:6, opacity:0.5 },
  time: { fontSize:12, opacity:0.6 },
  stem: { fontSize:18, marginBottom:6 },
  line: { fontSize:16, marginTop:2 },
});
