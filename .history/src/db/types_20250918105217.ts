// src/db/types.ts
import type { Topic } from './schema';
export type PracticeFilter = {
  level?: Topic | 'N2-N3-random' | 'daily' | 'all';
  kind?: 'language' | 'reading' | 'listening';
  year?: number | 'random' | null;
  session?: '07' | '12' | 'July' | 'December' | '7' | '12' | 'random' | null;
};
