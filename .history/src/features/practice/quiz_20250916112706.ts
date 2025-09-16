// src/features/practice/quiz.ts
import type { PoolQuestion } from '../../db/schema';

/** 由 PoolQuestion 砌出一題四選一的物件 */
export function makeQuestion(q: PoolQuestion) {
  // 正解
  const correct = q.choices.find(c => c.is_correct);
  // 三個錯
  const distractors = q.choices.filter(c => !c.is_correct);

  // 洗牌
  const shuffled = [...q.choices].sort(() => Math.random() - 0.5);

  return {
    exam_key: q.exam_key,
    question_number: q.question_number,
    section: q.section,
    stem: q.stem,
    passage: q.passage,
    options: shuffled, // {position, content, is_correct, explanation}

    isCorrect: (picked: { position: number }) =>
      !!correct && picked.position === correct.position,

    optionText: (c: { content: string }) => c.content,

    correctOption: correct,
  };
}
