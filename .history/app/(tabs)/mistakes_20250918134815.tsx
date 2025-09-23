// app/(tabs)/mistakes.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, Pressable, FlatList, StyleSheet, useColorScheme,
  Platform, Alert, RefreshControl, DeviceEventEmitter,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { getMistakes, clearMistakes, getQuestionDetail } from '../../src/db';

type DBMistakeRow = {
  id: number;
  created_at: number | string;
  exam_key: string;
  question_number: number;
  picked_position: number;
};

type UIMistake = DBMistakeRow & {
  stem?: string;
  passage?: string | null;
  picked_content?: string;
  correct_content?: string;
  explanation?: string | null;
  correct_position?: number;
};

function parseExamKey(ek?: string) {
  if (!ek) return null;
  const m = ek.match(/^(N[1-5])-(\d{4})-(\d{2})$/);
  if (!m) return null;
  const [, level, y, mm] = m;
  return { level, year: Number(y), monthLabel: mm === '07' ? '7月' : mm === '12' ? '12月' : mm };
}

function makeStyles(isDark: boolean) {
  const C = {
    bg: isDark ? '#000' : '#fff',
    text: isDark ? '#eee' : '#111',
    muted: isDark ? '#9ca3af' : '#6b7280',
    card: isDark ? '#111' : '#fff',
    border: isDark ? '#333' : '#e5e7eb',
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

    emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
    emptyText: { color: C.muted, fontSize: 16 },

    item: {
      backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border,
      padding: 14, marginBottom: 10,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
        android: { elevation: 1 },
      }),
    },
    headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    examText: { color: C.text, fontSize: 15, fontWeight: '600' },
    timeText: { color: C.muted, fontSize: 12 },

    stem: { color: C.text, fontSize: 16, lineHeight: 22, marginTop: 6 },
    sub: { color: C.muted, marginTop: 6, fontSize: 13 },
    explain: { color: C.muted, marginTop: 4, fontSize: 13 },
  });

  return { C, s };
}

export default function MistakesScreen() {
  const isDark = useColorScheme() === 'dark';
  const { s, C } = useMemo(() => makeStyles(isDark), [isDark]);

  const [items, setItems] = useState<UIMistake[]>([]);
  const [loading, setLoading] = useState(false);

  const enrich = useCallback(async (rows: DBMistakeRow[]): Promise<UIMistake[]> => {
    const enriched = await Promise.all(rows.map(async (r) => {
      try {
        const detail = await getQuestionDetail(r.exam_key, r.question_number);
        const correct = detail.choices.find(c => (c.is_correct === 1 || c.is_correct === true));
        const picked = detail.choices.find(c => c.position === r.picked_position);
        return {
          ...r,
          stem: detail.stem,
          passage: detail.passage ?? null,
          picked_content: picked?.content,
          correct_content: correct?.content,
          explanation: correct?.explanation ?? null,
          correct_position: correct?.position,
        };
      } catch {
        return r as UIMistake;
      }
    }));
    return enriched;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const base = await getMistakes();
      const list = Array.isArray(base) ? (base as DBMistakeRow[]) : [];
      const withInfo = await enrich(list);
      setItems(withInfo);
    } finally {
      setLoading(false);
    }
  }, [enrich]);

  useEffect(() => { void load(); }, [load]);

  // ✅ 聚焦自動刷新
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('mistake-added', () => { void load(); });
    return () => { sub.remove(); };
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

  const renderItem = ({ item }: { item: UIMistake }) => {
    const t = new Date(typeof item.created_at === 'number' ? item.created_at : Date.parse(item.created_at));
    const timeStr = isNaN(t.getTime()) ? '' :
      `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')} ${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;

    const meta = parseExamKey(item.exam_key);
    const title = meta
      ? `${meta.level} ${meta.year}年${meta.monthLabel}・第 ${item.question_number} 題`
      : `${item.exam_key}・第 ${item.question_number} 題`;

    return (
      <View style={s.item}>
        <View style={s.headRow}>
          <Text style={s.examText}>{title}</Text>
          {!!timeStr && <Text style={s.timeText}>{timeStr}</Text>}
        </View>

        {!!item.stem && <Text style={s.stem}>{item.stem}</Text>}

        <Text style={s.sub}>你揀：{item.picked_content ?? `選項 ${item.picked_position}`}</Text>
        <Text style={s.sub}>正解：{item.correct_content ?? `選項 ${item.correct_position ?? '?'}`}</Text>
        {!!item.explanation && <Text style={s.explain}>解釋：{item.explanation}</Text>}
      </View>
    );
  };

  return (
    <SafeAreaView style={s.screen} edges={['left','right']}>
      <View style={s.wrap}>
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

        {items.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>暫時沒有錯題 🎉</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(it) => String(it.id)}
            renderItem={renderItem}
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={() => void load()} />
            }
            contentContainerStyle={{ paddingTop: 4, paddingBottom: 8 }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
