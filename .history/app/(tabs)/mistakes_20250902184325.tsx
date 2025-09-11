import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { getMistakes, clearMistakes } from '../../src/db';
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

  const load = () => setItems(getMistakes());

  useEffect(() => {
    load();
  }, []);

  const onClear = () => {
    clearMistakes();
    load();
  };

  return (
    <View style={s.wrap}>
      <View style={s.rowHeader}>
        <Text style={s.h1}>錯題本</Text>
        <Pressable onPress={onClear} style={s.clearBtn}>
          <Text style={s.clearBtnText}>清空</Text>
        </Pressable>
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
  clearBtn: { paddingHorizontal:12, paddingVertical:8, borderRadius:999, borderWidth:1, borderColor:'#ddd' },
  clearBtnText: { fontSize:16 },
  card: { padding:12, borderRadius:12, borderWidth:1, borderColor:'#eee', backgroundColor:'#fff' },
  badgeRow: { flexDirection:'row', alignItems:'center', marginBottom:6 },
  badge: { fontSize:12, paddingHorizontal:8, paddingVertical:2, borderRadius:999, borderWidth:1, borderColor:'#ddd' },
  dot: { marginHorizontal:6, opacity:0.5 },
  time: { fontSize:12, opacity:0.6 },
  stem: { fontSize:18, marginBottom:6 },
  line: { fontSize:16, marginTop:2 },
});
