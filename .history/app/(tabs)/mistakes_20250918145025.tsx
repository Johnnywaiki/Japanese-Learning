// app/(tabs)/mistakes.tsx
import { useCallback, useMemo, useState } from 'react';
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
import { useFocusEffect } from 'expo-router';

import type { MistakeRow as DBMistakeRow } from '../../src/db/schema';
import { getMistakes, clearMistakes, getQuestionDetail } from '../../src/db';

type UIMistakeRow = DBMistakeRow;

function makeStyles(isDark: boolean) {
  const C = {
    bg: isDark ? '#000' : '#fff',
    text: isDark ? '#eee' : '#111',
    muted: isDark ? '#9ca3af' : '#6b7280',
    card: isDark ? '#111' : '#fff',
    border: isDark ? '#333' : '#e5e7eb',
    accent: isDark ? '#fff' : '#111',
  };

  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    wrap: { flex: 1, padding: 16 },

    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    title: { fontSize: 16, fontWeight: '600', color: C.text },
    pills: { flexDirection: 'row', gap: 8 },

    pill: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
    },
    pillText: { color: C.text, fontSize: 14 },

    emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: C.muted, fontSize: 16 },

    item: {
      backgroundColor: C.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      padding: 14,
      marginBottom: 10,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
        android: { elevation: 1 },
      }),
    },
    stem: { color: C.text, fontSize: 16, lineHeight: 22 },
    sub: { color: C.muted, marginTop: 6, fontSize: 13 },

    optionRow: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 10,
    },
    optionText: { color: C.text, fontSize: 14 },

    tagRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 },
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

  const load = useCallback(() => {
    setLoading(true);
    try {
      const list = getMistakes(); // Sync read
      setItems(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  }, []);

  // 進入/回來呢個 tab 都會 reload
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onClear = () => {
    const go = () => {
      clearMistakes();
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

  const renderItem = ({ item }: { item: UIMistakeRow }) => {
    const detail = getQuestionDetail(item.exam_key, item.question_number);
    const picked = detail.options.find(o => o.position === item.picked_position);
    const correct = detail.correct;

    const t = new Date(item.created_at);
    const timeStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;

    return (
      <View style={s.item}>
        <Text style={s.stem}>{detail.stem}</Text>
        {!!detail.passage && <Text style={s.sub}>{detail.passage}</Text>}

        <View style={s.optionRow}>
          <Text style={s.optionText}>你揀：{picked?.content ?? `#${item.picked_position}`}</Text>
          <Text style={s.optionText}>正解：{correct?.content ?? '-'}</Text>
          {!!correct?.explanation && (
            <Text style={[s.optionText, { marginTop: 6 }]}>{`解釋：${correct.explanation}`}</Text>
          )}
        </View>

        <View style={s.tagRow}>
          <View style={s.tag}><Text style={s.tagText}>{item.exam_key}</Text></View>
          <View style={s.tag}><Text style={s.tagText}>第 {item.question_number} 題</Text></View>
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
            keyExtractor={(it) => String(it.id)}
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
