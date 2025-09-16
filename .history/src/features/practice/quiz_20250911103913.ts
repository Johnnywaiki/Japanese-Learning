import { QuizItem } from '../../db/schema';

function shuffle<T>(arr: T[]): T[] {
  return arr.map(v => [Math.random(), v] as const)
            .sort((a, b) => a[0] - b[0])
            .map(x => x[1]);
}

export function makeQuestion(pool: QuizItem[]) {
  if (pool.length < 4) throw new Error('題庫不足，至少需要 4 題');
  const items = shuffle(pool);
  const answer = items[0];
  const sameKind = items.filter(x => x.kind === answer.kind && x !== answer);
  const others = items.filter(x => x !== answer);
  const distractors = (sameKind.length >= 3 ? sameKind.slice(0, 3) : others.slice(0, 3));
  const options = shuffle([answer, ...distractors]);

  const stem = answer.kind === 'word'
    ? (answer.jp + (answer.reading ? `（${answer.reading}）` : ''))
    : answer.jp;

  const optionText = (x: QuizItem) => x.zh;
  return { answer, stem, options, optionText };
}
