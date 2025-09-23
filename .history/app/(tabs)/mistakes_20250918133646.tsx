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
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// 直接依賴你 db 導出的方法
import { getMistakes, clearMistakes } from '../../src/db';

// ---- 與 DB 對齊的最小型別（避免 NOT NULL 問題）----
type DBMistakeRow = {
  id: number;
  created_at: number | string;          // timestamp or ISO
  exam_key: string;                     // e.g. "N2-2021-07"
  question_number: number;              // 第幾題
  picked_position: number;              // 你揀嘅選項 position
};

// 展示用
function parseExamKey(ek?: string) {
  if (!ek) return null;
  const m = ek.match(/^(N[1-5])-(\d{4})-(\d{2})$/);
  if (!m) return null;
  const [, level, y, mm] = m;
  return {
    level,
    year: Number(y),
    monthLabel: mm === '07' ? '7月' : mm === '12' ? '12月' : mm,
  };
}

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

    emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
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
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    examText: { color: C.text, fontSize: 15, fontWeight: '600' },
    timeText: { color: C.muted, fontSize: 12 },

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

  const [items, setItems] = useState<DBMistakeRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const list = await getMistakes(); // 期望回傳 DB schema 的 mistakes rows
      // 做一次類型護欄
      const safe = (Array.isArray(list) ? list : []) as DBMistakeRow[];
      setItems(safe);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onClear = () => {
    const go = async () => {
      await clearMistakes();
      void load();
    };
    Alert.alert('清空錯題', '確定要清空所有錯題嗎？', [
      { text: '取消', style: 'cancel' },
      { text: '清空', style: 'destructive', onPress: () => void go() },
    ]);
  };

  const renderItem = ({ item }: { item: DBMistakeRow }) => {
    // 時間格式
    const t = new Date(
      typeof item.created_at === 'number' ? item.created_at : Date.parse(item.created_at)
    );
    const timeStr =
      isNaN(t.getTime())
        ? ''
        : `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(
            t.getDate()
          ).padStart(2, '0')} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;

    const meta = parseExamKey(item.exam_key);
    const title = meta
      ? `${meta.level} ${meta.year}年${meta.monthLabel}・第 ${item.question_number} 題`
      : `${item.exam_key}・第 ${item.question_number} 題`;

    return (
      <View style={s.item}>
        <View style={s.head}>
          <Text style={s.examText}>{title}</Text>
          {!!timeStr && <Text style={s.timeText}>{timeStr}</Text>}
        </View>
        <Text style={s.sub}>你所選：選項 {item.picked_position}</Text>
        <View style={s.tagRow}>
          <View style={s.tag}><Text style={s.tagText}>記錄 ID：{item.id}</Text></View>
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
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={() => void load()} />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
