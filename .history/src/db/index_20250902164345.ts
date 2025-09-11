import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES_SQL, Word, Sentence } from './schema';

let _db: SQLite.SQLiteDatabase | null = null;

export function getDB() {
  if (_db) return _db;
  _db = SQLite.openDatabaseSync?.('jp_quiz.db') ?? SQLite.openDatabase('jp_quiz.db');
  _db.exec?.(CREATE_TABLES_SQL);
  return _db;
}

export async function seedIfEmpty() {
  const db = getDB();
  // 檢查是否已 seed
  const wordsCount = db.getFirstSync?.<{ c:number }>('SELECT COUNT(*) as c FROM words')?.c
    ?? (await new Promise<number>((resolve) => {
      db.readTransaction(tx=>{
        tx.executeSql('SELECT COUNT(*) as c FROM words', [], (_,rs)=>resolve((rs.rows.item(0) as any).c));
      });
    }));

  if (wordsCount && wordsCount > 0) return;

  const sampleWords: Omit<Word,'id'>[] = [
    { jp:'水', reading:'みず', zh:'水' },
    { jp:'犬', reading:'いぬ', zh:'狗' },
    { jp:'学校', reading:'がっこう', zh:'學校' },
    { jp:'先生', reading:'せんせい', zh:'老師' },
    { jp:'電車', reading:'でんしゃ', zh:'電車' },
  ];
  const sampleSentences: Omit<Sentence,'id'>[] = [
    { jp:'水をください。', zh:'請給我水。' },
    { jp:'犬が好きです。', zh:'我喜歡狗。' },
    { jp:'学校へ行きます。', zh:'我要去學校。' },
    { jp:'先生に聞いてください。', zh:'請問老師。' },
    { jp:'電車で会社に行きます。', zh:'我坐電車去公司。' },
  ];

  db.transaction(tx=>{
    sampleWords.forEach(w=>{
      tx.executeSql('INSERT INTO words (jp,reading,zh) VALUES (?,?,?)', [w.jp, w.reading ?? null, w.zh]);
    });
    sampleSentences.forEach(s=>{
      tx.executeSql('INSERT INTO sentences (jp,zh) VALUES (?,?)', [s.jp, s.zh]);
    });
  });
}

export type PoolOptions = {
  mix: boolean;        // 是否混合題（單字+例句）
  wordsOnly?: boolean; // 只出單字（覆蓋 mix）
  sentencesOnly?: boolean; // 只出例句（覆蓋 mix）
};

export function getAllForPool(opts: PoolOptions) : Promise<{words:Word[]; sentences:Sentence[]}> {
  const db = getDB();
  return new Promise((resolve, reject)=>{
    db.readTransaction(tx=>{
      tx.executeSql('SELECT * FROM words', [], (_w, wrs)=>{
        const words: Word[] = [];
        for (let i=0;i<wrs.rows.length;i++) words.push(wrs.rows.item(i) as Word);

        tx.executeSql('SELECT * FROM sentences', [], (_s, srs)=>{
          const sentences: Sentence[] = [];
          for (let i=0;i<srs.rows.length;i++) sentences.push(srs.rows.item(i) as Sentence);
          resolve({ words, sentences });
        });
      }, (_,_e)=>{ reject(_e); return true; });
    });
  });
}
