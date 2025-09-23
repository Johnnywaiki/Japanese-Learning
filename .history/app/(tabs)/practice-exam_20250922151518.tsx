// app/(tabs)/practice-exam.tsx
import { useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import PracticeCommon from '@/components/PracticeCommon';
import { useQuiz } from '@/src/store/useQuiz';
import type { PracticeFilter, Topic } from '@/src/db';

export default function PracticeExamScreen() {
  const { level, kind, year, month, session } = useLocalSearchParams<{
    level?: Topic | 'N2-N3-random' | 'all';
    kind?: 'language' | 'reading' | 'listening';
    year?: string;
    month?: '07' | '12';
    session?: 'July' | 'December';
  }>();

  useEffect(() => {
    const f: PracticeFilter = {
      level: (level ?? 'N2-N3-random') as any,
      kind: (kind ?? 'language') as any,
      year: year ? Number(year) : undefined,
      month: month as any,
      session: session as any,
    };
    void useQuiz.getState().init(f);
  }, [level, kind, year, month, session]);

  return <PracticeCommon from="index" />;
}