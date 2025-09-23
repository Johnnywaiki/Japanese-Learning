// app/(tabs)/practice.tsx
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// ⬇️ 新增
import { router } from 'expo-router';
import { markPracticeDone, type Level, type Category } from '../../src/lib/progress';
import { useQuiz } from '../../src/store/useQuiz';

export default function PracticeScreen() {
  const isDark = useColorScheme() === 'dark';
  const s = useMemo(() => StyleSheet.create({ /* …你原本的樣式… */ }), [isDark]);

  const {
    pool, idx, current, selected, answered, answers,
    submit, next, total, totalAvailable, pick,
    // ⬇️ 新增：來自 useQuiz.init 的 metadata
    mode,        // 'daily' | 'mock' | undefined
    dailyMeta,   // { level, category, week, day } | undefined
  } = useQuiz();

  const isLast = idx >= (pool.length - 1);
  const [needPickMsg, setNeedPickMsg] = useState(false);

  // ⬇️ 新增：統一處理提交 / 下一題 / 完成 & 返回 Home
  const submitAndMaybeFinish = useCallback(async () => {
    // 未揀選項就提示
    if (!answered && !selected) {
      setNeedPickMsg(true);
      return;
    }
    setNeedPickMsg(false);

    // 先交卷（會記錄正誤、錯題）
    if (!answered) submit();

    // 仲有下一題 → 直接下一題
    if (!isLast) {
      next();
      return;
    }

    // ✅ 最後一題：若為 daily，更新完成進度
    try {
      if (mode === 'daily' && dailyMeta) {
        await markPracticeDone({
          level: dailyMeta.level as Level,
          category: dailyMeta.category as Category,
          week: dailyMeta.week,
          day: dailyMeta.day,
        });
      }
    } finally {
      // 一律返回 Home（不使用舊結果頁）
      router.replace('/(tabs)/home');
    }
  }, [answered, selected, isLast, next, submit, mode, dailyMeta]);

  // …你原本的載入/空狀態/題目渲染邏輯…

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 12 }}>
        {/* …題幹、選項… */}
        {needPickMsg && !answered && <Text style={{ color: '#d11' }}>請先揀一個選項再提交。</Text>}

        <View style={{ marginTop: 12 }}>
          {/* ⬇️ 把原本 onPress 換成 submitAndMaybeFinish */}
          <Pressable onPress={submitAndMaybeFinish} style={{ padding: 14, borderRadius: 12, backgroundColor: '#111' }}>
            <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>
              {!answered ? '提交' : (isLast ? '完成並返回 Home' : '下一題')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
