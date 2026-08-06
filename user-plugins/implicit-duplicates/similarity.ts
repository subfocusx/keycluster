const STOP_WORDS_RU = new Set([
  'в', 'на', 'с', 'к', 'по', 'из', 'за', 'от', 'до', 'о', 'у', 'об',
  'для', 'при', 'про', 'без', 'через', 'между', 'над', 'под', 'из-за',
  'и', 'а', 'но', 'или', 'как', 'что', 'где', 'когда', 'зачем', 'чем',
  'это', 'вот', 'он', 'она', 'они', 'мы', 'вы', 'я', 'не', 'нет', 'да',
  'же', 'ли', 'бы', 'уже', 'ещё', 'тоже', 'также', 'только', 'даже',
  'все', 'всё', 'его', 'её', 'их', 'мой', 'ваш', 'наш', 'сам', 'свой',
  'который', 'которая', 'которое', 'которые', 'этот', 'эта', 'это', 'эти',
  'такой', 'такая', 'такое', 'такие', 'каждый', 'любой', 'другой',
  'купить', 'заказать', 'цена', 'стоимость', 'недорого', 'дешево',
  'московский', 'москва', 'спб', 'петербург',
]);

const STOP_WORDS_EN = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
  'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either', 'neither',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'this', 'that', 'these', 'those', 'it', 'its', 'i', 'me', 'my', 'we',
  'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they', 'them',
  'buy', 'price', 'cheap', 'order',
]);

const ALL_STOP_WORDS = new Set([...STOP_WORDS_RU, ...STOP_WORDS_EN]);

export function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function tokenize(text: string): string[] {
  return normalize(text).split(/\s+/).filter(w => w.length > 0);
}

export function removeStopWords(tokens: string[]): string[] {
  return tokens.filter(w => !ALL_STOP_WORDS.has(w));
}

export function wordSet(text: string, ignoreStopWords: boolean): Set<string> {
  let tokens = tokenize(text);
  if (ignoreStopWords) tokens = removeStopWords(tokens);
  return new Set(tokens);
}

export function sortedWords(text: string, ignoreStopWords: boolean): string[] {
  let tokens = tokenize(text);
  if (ignoreStopWords) tokens = removeStopWords(tokens);
  return [...tokens].sort();
}

export function sortedKey(text: string, ignoreStopWords: boolean): string {
  return sortedWords(text, ignoreStopWords).join(' ');
}

export function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

export function ngrams(text: string, n: number): Set<string> {
  const normalized = normalize(text);
  if (normalized.length < n) return new Set([normalized]);

  const result = new Set<string>();
  for (let i = 0; i <= normalized.length - n; i++) {
    result.add(normalized.substring(i, i + n));
  }
  return result;
}

export function diceCoefficient(textA: string, textB: string): number {
  const bigramsA = ngrams(textA, 2);
  const bigramsB = ngrams(textB, 2);

  if (bigramsA.size === 0 && bigramsB.size === 0) return 1;
  if (bigramsA.size === 0 || bigramsB.size === 0) return 0;

  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }

  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array(n + 1);
  let curr = new Array(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

export function normalizedLevenshtein(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

export interface SimilarityResult {
  score: number;
  details: {
    jaccard: number;
    dice: number;
    levenshtein: number;
    permutationMatch: boolean;
  };
}

const WEIGHTS = {
  jaccard: 0.35,
  dice: 0.25,
  levenshtein: 0.25,
  permutation: 0.15,
};

export function computeSimilarity(
  textA: string,
  textB: string,
  options: {
    ignoreStopWords?: boolean;
    compareWordOrder?: boolean;
  } = {},
): SimilarityResult {
  const { ignoreStopWords = true, compareWordOrder = false } = options;

  const keyA = compareWordOrder ? normalize(textA) : sortedKey(textA, ignoreStopWords);
  const keyB = compareWordOrder ? normalize(textB) : sortedKey(textB, ignoreStopWords);
  const permutationMatch = keyA === keyB;

  const setA = wordSet(textA, ignoreStopWords);
  const setB = wordSet(textB, ignoreStopWords);
  const jaccard = jaccardSimilarity(setA, setB);

  const dice = diceCoefficient(textA, textB);

  const normA = normalize(textA);
  const normB = normalize(textB);
  const levenshtein = normalizedLevenshtein(normA, normB);

  const permutationScore = permutationMatch ? 1 : 0;
  const score =
    WEIGHTS.jaccard * jaccard +
    WEIGHTS.dice * dice +
    WEIGHTS.levenshtein * levenshtein +
    WEIGHTS.permutation * permutationScore;

  return {
    score,
    details: {
      jaccard,
      dice,
      levenshtein,
      permutationMatch,
    },
  };
}
