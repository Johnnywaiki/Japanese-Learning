import { create } from 'zustand';
import { getAllForPool, seedIfEmpty } from '../db';
import { QuizItem, Word, Sentence } from '../db/schema';
import { makeQuestion } from '../features/practice/quiz';

type State = {
  loading: boolean;
  mixMode: boolean;      // true = 混合
  current?: ReturnType<typeof makeQuestion>;
  score: number;
  total: number;
  lastCorrect?: boolean;
  pool: QuizItem[];
  init: () => Promise<void>;
  toggleMix: (v:boolean)=>void;
  next: () => void;
  answer: (picked: QuizItem) => void;
};

export const useQuiz = create<State>((set, get)=>({
  loading: false,
  mixMode: true,
  score: 0,
  total: 0,
  pool: [],
  async init() {
    set({ loading:true });
    await seedIfEmpty();
    const { words, sentences } = await getAllForPool({ mix:true });
    const pool: QuizItem[] = [
      ...words.map<QuizItem>(w=>({ kind:'word', ...w })),
      ...sentences.map<QuizItem>(s=>({ kind:'sentence', ...s })),
    ];
    const current = makeQuestion(pool);
    set({ pool, current, loading:false, score:0, total:0, lastCorrect:undefined });
  },
  toggleMix(v) {
    const { pool } = get();
    // 今個 MVP：資料池已經包含兩類，切換只影響未來擴展；先刷新一條題
    set({ mixMode: v, current: makeQuestion(pool), lastCorrect: undefined });
  },
  next() {
    const { pool } = get();
    set({ current: makeQuestion(pool), lastCorrect: undefined });
  },
  answer(picked) {
    const { current } = get();
    if (!current) return;
    const correct = picked === current.answer;
    set(s=>({ 
      score: s.score + (correct?1:0),
      total: s.total + 1,
      lastCorrect: correct,
    }));
  },
}));

