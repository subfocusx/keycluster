// ============================================================
// Implicit Duplicates Web Worker — findImplicitDuplicates в отдельном потоке
// ============================================================

interface WorkerPhrase {
  id: string;
  text: string;
  frequency?: number;
}

interface FindDuplicatesOptions {
  threshold: number;
  ignoreStopWords: boolean;
  compareWordOrder: boolean;
  keepHigherFrequency: boolean;
}

interface StartMessage {
  type: 'FIND_DUPLICATES';
  phrases: WorkerPhrase[];
  options: FindDuplicatesOptions;
}

interface ResultMessage {
  type: 'FIND_DUPLICATES_RESULT';
  groups: ImplicitDuplicateGroup[];
  duration: number;
}

interface ProgressMessage {
  type: 'FIND_DUPLICATES_PROGRESS';
  percent: number;
}

interface ImplicitDuplicateGroup {
  groupId: string;
  phrases: Array<{ id: string; text: string; frequency?: number }>;
  mainPhrase: { id: string; text: string; frequency?: number };
  avgSimilarity: number;
}

// ---- UnionFind ----

class UnionFind {
  private parent = new Map<string, string>();
  private rank = new Map<string, number>();

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
    if (this.parent.get(x) !== x) {
      this.parent.set(x, this.find(this.parent.get(x)!));
    }
    return this.parent.get(x)!;
  }

  union(x: string, y: string): void {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX === rootY) return;
    const rankX = this.rank.get(rootX) ?? 0;
    const rankY = this.rank.get(rootY) ?? 0;
    if (rankX < rankY) {
      this.parent.set(rootX, rootY);
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX);
    } else {
      this.parent.set(rootY, rootX);
      this.rank.set(rootX, rankX + 1);
    }
  }

  getGroups(): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    for (const key of this.parent.keys()) {
      const root = this.find(key);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root)!.push(key);
    }
    return groups;
  }
}

// ---- Similarity ----

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

function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

function tokenize(text: string): string[] {
  return normalize(text).split(/\s+/).filter(w => w.length > 0);
}

function removeStopWords(tokens: string[]): string[] {
  return tokens.filter(w => !ALL_STOP_WORDS.has(w));
}

function wordSet(text: string, ignoreStopWords: boolean): Set<string> {
  let tokens = tokenize(text);
  if (ignoreStopWords) tokens = removeStopWords(tokens);
  return new Set(tokens);
}

function sortedKey(text: string, ignoreStopWords: boolean): string {
  let tokens = tokenize(text);
  if (ignoreStopWords) tokens = removeStopWords(tokens);
  return [...tokens].sort().join(' ');
}

function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

function ngrams(text: string, n: number): Set<string> {
  const norm = normalize(text);
  if (norm.length < n) return new Set([norm]);
  const result = new Set<string>();
  for (let i = 0; i <= norm.length - n; i++) {
    result.add(norm.substring(i, i + n));
  }
  return result;
}

function diceCoefficient(textA: string, textB: string): number {
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

function levenshteinDistance(a: string, b: string): number {
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

function normalizedLevenshtein(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

interface SimilarityResult {
  score: number;
  details: {
    jaccard: number;
    dice: number;
    levenshtein: number;
    permutationMatch: boolean;
  };
}

const WEIGHTS = { jaccard: 0.35, dice: 0.25, levenshtein: 0.25, permutation: 0.15 };

function computeSimilarity(
  textA: string, textB: string,
  options: { ignoreStopWords?: boolean; compareWordOrder?: boolean } = {},
): SimilarityResult {
  const { ignoreStopWords = true, compareWordOrder = false } = options;
  const keyA = compareWordOrder ? normalize(textA) : sortedKey(textA, ignoreStopWords);
  const keyB = compareWordOrder ? normalize(textB) : sortedKey(textB, ignoreStopWords);
  const permutationMatch = keyA === keyB;
  const setA = wordSet(textA, ignoreStopWords);
  const setB = wordSet(textB, ignoreStopWords);
  const jaccard = jaccardSimilarity(setA, setB);
  const dice = diceCoefficient(textA, textB);
  const levenshtein = normalizedLevenshtein(normalize(textA), normalize(textB));
  const permutationScore = permutationMatch ? 1 : 0;
  const score =
    WEIGHTS.jaccard * jaccard +
    WEIGHTS.dice * dice +
    WEIGHTS.levenshtein * levenshtein +
    WEIGHTS.permutation * permutationScore;
  return { score, details: { jaccard, dice, levenshtein, permutationMatch } };
}

// ---- Main algorithm ----

function findImplicitDuplicates(
  phrases: WorkerPhrase[],
  options: FindDuplicatesOptions,
  onProgress: (percent: number) => void,
): ImplicitDuplicateGroup[] {
  const thresholdFraction = options.threshold / 100;
  if (phrases.length === 0) return [];

  const normalizedData = phrases.map(p => ({
    id: p.id,
    text: p.text,
    frequency: p.frequency,
    normText: normalize(p.text),
    sortedKeyVal: sortedKey(p.text, options.ignoreStopWords),
    wordSetVal: wordSet(p.text, options.ignoreStopWords),
  }));

  const uf = new UnionFind();
  const totalPairs = (phrases.length * (phrases.length - 1)) / 2;
  let processed = 0;

  for (let i = 0; i < normalizedData.length; i++) {
    uf.find(normalizedData[i].id);
    for (let j = i + 1; j < normalizedData.length; j++) {
      const setA = normalizedData[i].wordSetVal;
      const setB = normalizedData[j].wordSetVal;
      let hasOverlap = false;
      for (const w of setA) {
        if (setB.has(w)) { hasOverlap = true; break; }
      }
      if (!hasOverlap) { processed++; continue; }

      const result = computeSimilarity(
        normalizedData[i].text, normalizedData[j].text,
        { ignoreStopWords: options.ignoreStopWords, compareWordOrder: options.compareWordOrder },
      );

      if (result.score >= thresholdFraction) {
        uf.union(normalizedData[i].id, normalizedData[j].id);
      }
      processed++;
      if (processed % 500 === 0) {
        onProgress(Math.min(99, Math.round((processed / totalPairs) * 100)));
      }
    }
  }

  onProgress(100);

  const ufGroups = uf.getGroups();
  const phraseById = new Map(phrases.map(p => [p.id, p]));
  const result: ImplicitDuplicateGroup[] = [];

  for (const [, memberIds] of ufGroups) {
    if (memberIds.length < 2) continue;
    const groupPhrases = memberIds.map(id => {
      const p = phraseById.get(id)!;
      return { id: p.id, text: p.text, frequency: p.frequency };
    });
    let mainPhrase: typeof groupPhrases[0];
    if (options.keepHigherFrequency) {
      mainPhrase = groupPhrases.reduce((best, p) =>
        (p.frequency ?? 0) > (best.frequency ?? 0) ? p : best,
        groupPhrases[0]);
    } else {
      mainPhrase = groupPhrases[0];
    }

    let totalSim = 0;
    let count = 0;
    for (const p of groupPhrases) {
      if (p.id === mainPhrase.id) continue;
      const sim = computeSimilarity(mainPhrase.text, p.text, {
        ignoreStopWords: options.ignoreStopWords,
        compareWordOrder: options.compareWordOrder,
      });
      totalSim += sim.score;
      count++;
    }
    const avgSimilarity = count > 0 ? totalSim / count : 1;

    result.push({
      groupId: mainPhrase.id,
      phrases: groupPhrases.sort((a, b) => (b.frequency ?? 0) - (a.frequency ?? 0)),
      mainPhrase,
      avgSimilarity,
    });
  }

  result.sort((a, b) => b.avgSimilarity - a.avgSimilarity);
  return result;
}

// ---- Worker Message Handler ----

self.onmessage = function (e: MessageEvent<StartMessage>) {
  const data = e.data;
  if (data.type === 'FIND_DUPLICATES') {
    const { phrases, options } = data;
    const startTime = performance.now();
    const groups = findImplicitDuplicates(phrases, options, (percent) => {
      const progressMsg: ProgressMessage = { type: 'FIND_DUPLICATES_PROGRESS', percent };
      self.postMessage(progressMsg);
    });
    const duration = performance.now() - startTime;
    const resultMsg: ResultMessage = {
      type: 'FIND_DUPLICATES_RESULT',
      groups,
      duration,
    };
    self.postMessage(resultMsg);
  }
};
