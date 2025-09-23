// app/(tabs)/practice-daily.tsx
import { useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import PracticeCommon from '@/components/PracticeCommon';
import { useQuiz } from '@/src/store/useQuiz';
import type { Topic } from '@/src/db';

export default function PracticeDailyScreen() {
  const { level, category, week, day } = useLocalSearchParams<{
    level?: Topic; category?: 'grammar' | 'vocab'; week?: string; day?: string;
  }>();

  useEffect(() => {
    const lv = (level ?? 'N2') as Topic;
    const cat = (category ?? 'grammar') as 'grammar' | 'vocab';
    const wk = Number(week ?? '1') || 1;
    const dy = Number(day ?? '1') || 1;

    void useQuiz.getState().init({ extra: { level: lv, category: cat, week: wk, day: dy } });
  }, [level, category, week, day]);

  return <PracticeCommon from="home" />;
}