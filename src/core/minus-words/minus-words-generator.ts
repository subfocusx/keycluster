import type { Phrase, Group } from '@/core/types';

const DEFAULT_MINUS_WORDS = new Set([
  'бесплатно', 'скачать', 'торрент', 'отзывы', 'отзыв',
  'фото', 'видео', 'картинка', 'картинки',
  'diy', 'своими_руками', 'handmade',
  'вакансии', 'вакансия', 'работа', 'резюме',
  'обучение', 'курс', 'тренинг', 'вебинар',
  'рецепт', 'рецепты',
  'игры', 'игра', 'геймплей',
  'знакомства', 'знакомство',
  'хобби', 'увлечение',
  'юмор', 'приколы', 'смешное',
  'погода', 'прогноз',
  'гороскоп', 'сонник',
  'поздравления', 'поздравление', 'тосты',
]);

const STOP_WORD_QUALITY_WORDS = new Set([
  'это', 'то', 'как', 'так', 'вот', 'все', 'весь',
  'сам', 'сама', 'само', 'сами', 'самый',
  'очень', 'слишком', 'также', 'тоже',
  'еще', 'уже', 'уже', 'даже', 'лишь',
  'только', 'просто', 'прямо', 'почти',
  'разве', 'неужели', 'вряд_ли', 'едва',
  'опять', 'снова', 'вновь', 'всегда',
  'иногда', 'часто', 'редко', 'обычно',
  'конечно', 'разумеется', 'безусловно',
  'вероятно', 'возможно', 'наверное',
  'действительно', 'правда', 'реально',
]);

export function extractWords(phrases: Phrase[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const p of phrases) {
    const words = p.text.toLowerCase()
      .replace(/[^\wа-яё\s-]/gi, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
    for (const w of words) {
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
  }
  return freq;
}

export interface MinusWordCandidate {
  word: string;
  frequency: number;
  groupSpread: number;
  reason: string;
  confidence: number;
}

export function findMinusWords(
  phrases: Phrase[],
  groups: Group[],
  filterGroupIds: Set<string> | null = null,
  topN: number = 20,
): MinusWordCandidate[] {
  const targetGroups = filterGroupIds
    ? groups.filter(g => filterGroupIds.has(g.id) && !g.isTrash)
    : groups.filter(g => !g.isTrash);

  if (targetGroups.length < 2) return [];

  const groupWordFreqs: Map<string, Map<string, number>> = new Map();
  const docCount = new Map<string, number>();

  for (const group of targetGroups) {
    const groupPhrases = phrases.filter(p => p.groupId === group.id);
    const freq = extractWords(groupPhrases);
    groupWordFreqs.set(group.id, freq);

    for (const word of freq.keys()) {
      docCount.set(word, (docCount.get(word) ?? 0) + 1);
    }
  }

  const totalGroups = targetGroups.length;
  const candidates: MinusWordCandidate[] = [];

  const seen = new Set<string>();

  for (const [groupId, freq] of groupWordFreqs) {
    const group = targetGroups.find(g => g.id === groupId);
    for (const [word, f] of freq) {
      if (seen.has(word)) continue;
      seen.add(word);
      if (DEFAULT_MINUS_WORDS.has(word)) continue;
      if (STOP_WORD_QUALITY_WORDS.has(word)) continue;
      if (word.length <= 2) continue;

      const df = docCount.get(word) ?? 1;
      const idf = Math.log(totalGroups / df);
      const tfIdf = f * idf;

      if (tfIdf > 0.1) {
        candidates.push({
          word,
          frequency: f,
          groupSpread: df,
          reason: df <= 1
            ? `Уникальное слово группы "${group?.name ?? groupId}"`
            : `Общее слово (${df} из ${totalGroups} групп)`,
          confidence: Math.min(1, tfIdf / 10),
        });
      }
    }
  }

  candidates.sort((a, b) => {
    if (a.groupSpread !== b.groupSpread) return a.groupSpread - b.groupSpread;
    return b.frequency - a.frequency;
  });

  return candidates.slice(0, topN);
}

export { DEFAULT_MINUS_WORDS };
