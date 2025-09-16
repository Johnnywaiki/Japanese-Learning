// src/features/practice/quiz.ts
import type { PoolQuestion } from '../../db/schema';

export type MCQOption = { key: string; text: string; correct: boolean };

export type RuntimeQuestion = {
  id: string;               // 'N2-2022#8'
  level: string | null;
  stem: string;
  options: MCQOption[];
  answer: MCQOption;
  optionText: (o: MCQOption) => string;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function makeQuestion(pool: PoolQuestion[]): RuntimeQuestion {
  const q = pool[Math.floor(Math.random() * pool.length)];
  const id = `${q.exam_key}#${q.question_number}`;

  const opts: MCQOption[] = shuffle(
    q.choices.map(c => ({
      key: `${id}:${c.position}`,
      text: c.content,
      correct: c.is_correct === 1,
    }))
  );

  const answer = opts.find(o => o.correct)!;

  return {
    id,
    level: q.level,
    stem: q.stem,
    options: opts,
    answer,
    optionText: (o: MCQOption) => o.text,
  };
}
