// src/features/practice/quiz.ts

/** 題庫 item 的最小需求型別（由 useQuiz 組出來傳入） */
export type QuizItemLike = {
  kind: 'word' | 'sentence';
  id: number;
  jp: string;
  zh: string;
  topic?: string | null;
  reading?: string | null;  // 字詞讀音（如有）
};

/** 出題後的結構 */
export type Question = {
  stem: string;                              // 題幹（顯示日文；字詞會帶讀音）
  options: QuizItemLike[];                   // 四個選項（通常顯示中文）
  answer: QuizItemLike;                      // 正解（其中一個 options）
  optionText: (opt: QuizItemLike) => string; // 顯示選項文字的方法
};

/** Fisher–Yates 洗牌 */
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickOne<T>(arr: T[]): T {
  return arr[(Math.random() * arr.length) | 0];
}

/** 從 pool 裏面抽 3 個不重覆的干擾項（盡量同 kind、不與答案同 id） */
function pickDistractors(pool: QuizItemLike[], answer: QuizItemLike, count = 3): QuizItemLike[] {
  const sameKind = pool.filter(x => x.kind === answer.kind && x.id !== answer.id);
  const rest = pool.filter(x => x.id !== answer.id);

  const chosen: QuizItemLike[] = [];
  const takeFrom = (src: QuizItemLike[]) => {
    for (const x of shuffle(src)) {
      if (chosen.length >= count) break;
      if (!chosen.some(c => c.id === x.id)) chosen.push(x);
    }
  };

  takeFrom(sameKind);
  if (chosen.length < count) takeFrom(rest);

  // 安全補位（極少數 pool < 4 時）
  while (chosen.length < count && pool.length > 0) {
    const r = pickOne(pool);
    if (r.id !== answer.id && !chosen.some(c => c.id === r.id)) chosen.push(r);
    else if (pool.length <= count) break;
  }
  return chosen.slice(0, count);
}

/** 由題庫 pool 生成一題四選一 */
export function makeQuestion(pool: QuizItemLike[]): Question {
  if (!pool || pool.length === 0) {
    // 極端情況，回傳一個空殼（上層已做 <4 的檢查）
    return {
      stem: '（題庫不足）',
      options: [],
      answer: { kind: 'word', id: -1, jp: '', zh: '' },
      optionText: (opt) => opt.zh ?? '',
    };
  }

  const answer = pickOne(pool);
  const distractors = pickDistractors(pool, answer, 3);
  const options = shuffle([answer, ...distractors]);

  // 題幹：字詞帶讀音；句子直接顯示日文原句
  const stem =
    answer.kind === 'word'
      ? (answer.reading ? `${answer.jp}（${answer.reading}）` : answer.jp)
      : answer.jp;

  return {
    stem,
    options,
    answer,
    optionText: (opt) => opt.zh ?? '',
  };
}
