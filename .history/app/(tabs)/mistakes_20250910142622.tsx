// app/(tabs)/mistakes.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  useColorScheme,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// ← 用你真正的型別，避免再出錯
import type { MistakeRow as DBMistakeRow } from '../../src/db/schema';

// 你本地 db 導出的方法
import { getMistakes, clearMistakes, insertMistake } from '../../src/db';

// UI 方便用：在 DB 型別上加幾個「可選」欄位（唔影響相容）
type UIMistakeRow = DBMistakeRow & {
  itemId?: number;        // 有啲實作叫 item_id（下方無必需用到，所以可選）
  createdAt?: string;     // 有啲實作叫 created_at（下方兩者都支援）
};

function makeStyles(isDark: boolean) {
  const C = {
    bg: isDark ? '#000' : '#fff',
    text: isDark ? '#eee' : '#111',
    muted: isDark ? '#9ca3af' : '#6b7280',
    card: isDark ? '#111' : '#fff',
    border: isDark ? '#333' : '#e5e7eb',
    accent: isDark ? '#fff' : '#111',
    soft: isDark ? '#121212' : '#f8fafc',
  };

  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    wrap: { flex: 1, padding: 16 },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    title: { fontSize: 16, fontWeight: '600', color: C.text },
    pills: { flexDirection: 'row', gap: 8 },

    pill: {
      paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
      borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
    },
    pillText: { color: C.text, fontSize: 14 },

    emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: C.muted, fontSize: 16 },

    item: {
      backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border,
      padding: 14, marginBottom: 10,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
        android: { elevation: 1 },
      }),
    },
    stem: { color: C.text, fontSize: 16, lineHeight: 22 },
    sub: { color: C.muted, marginTop: 6, fontSize: 13 },
    tagRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 6 },
    tag: { borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8 },
    tagText: { color: C.muted, fontSize: 12 },

    footerSpace: { height: 12 },
  });

  return { C, s };
}

export default function MistakesScreen() {
  const isDark = useColorScheme() === 'dark';
  const { s, C } = useMemo(() => makeStyles(isDark), [isDark]);

  const [items, setItems] = useState<UIMistakeRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const list = await getMistakes();          // ← 期望回傳 DBMistakeRow[]
      setItems(Array.isArray(list) ? (list as UIMistakeRow[]) : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onClear = async () => {
    const go = async () => {
      await clearMistakes();
      load();
    };
    if (Platform.OS === 'ios') {
      Alert.alert('清空錯題', '確定要清空所有錯題嗎？', [
        { text: '取消', style: 'cancel' },
        { text: '清空', style: 'destructive', onPress: go },
      ]);
    } else {
      go();
    }
  };

  const onAddDummy = async () => {
    // 加兩條測試記錄（如你的 insertMistake 需要其他欄位，對應改形狀）
    await insertMistake({
      kind: 'word',
      itemId: 1,
      stem: '予定（よてい）',
      picked: '影響',
      correct: '預定；行程',
      topic: 'daily',
    } as any);
    await insertMistake({
      kind: 'sentence',
      itemId: 2,
      stem: '駅まで歩きます。',
      picked: '我會坐車到車站。',
      correct: '我會行路去車站。',
      topic: 'N3',
    } as any);
    load();
  };

  const renderItem = ({ item }: { item: UIMistakeRow }) => {
    const t = new Date(
      (item as any).createdAt ?? (item as any).created_at ?? Date.now()
    );
    const timeStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(
      t.getDate()
    ).padStart(2, '0')} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;

    return (
      <View style={s.item}>
        <Text style={s.stem}>{(item as any).stem}</Text>
        <Text style={s.sub}>你的答案：{(item as any).picked}</Text>
        <Text style={s.sub}>正解：{(item as any).correct}</Text>
        <View style={s.tagRow}>
          {!!(item as any).topic && (
            <View style={s.tag}><Text style={s.tagText}>主題：{(item as any).topic}</Text></View>
          )}
          <View style={s.tag}>
            <Text style={s.tagText}>類型：{(item as any).kind === 'word' ? '單字' : '例句'}</Text>
          </View>
          <View style={s.tag}><Text style={s.tagText}>{timeStr}</Text></View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.screen} edges={['left','right']}>
      <View style={s.wrap}>
        {/* 頂部操作 */}
        <View style={s.topRow}>
          <Text style={s.title}>錯題數：{items.length}</Text>
          <View style={s.pills}>
            <Pressable onPress={onClear} style={s.pill}>
              <Text style={s.pillText}>
                <Ionicons name="trash-outline" size={14} color={C.text} /> 清空
              </Text>
            </Pressable>
            <Pressable onPress={onAddDummy} style={s.pill}>
              <Text style={s.pillText}>
                <Ionicons name="add-circle-outline" size={14} color={C.text} /> 加測試
              </Text>
            </Pressable>
          </View>
        </View>

        {/* 列表 / 空狀態 */}
        {items.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>暫時沒有錯題 🎉</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(it) => String((it as any).id)}
            renderItem={renderItem}
            contentContainerStyle={{ paddingTop: 4 }}
            ListFooterComponent={<View style={s.footerSpace} />}
            refreshing={loading}
            onRefresh={load}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
