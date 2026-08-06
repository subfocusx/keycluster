// MinusWordsEngine — algorithmic minus word detection
// Layers: DictionaryScanner → RegexScanner → AhoCorasickScanner → StemScanner
// AI is NOT used. This is pure deterministic/rule-based.

import type { Phrase, Group } from '@/core/types';
import { findMinusWords, extractWords, DEFAULT_MINUS_WORDS } from './minus-words-generator';

// ---- Types ----

export interface MinusWordResult {
  word: string;
  reason: string;
  confidence: number;
  source: 'dictionary' | 'tfidf' | 'regex' | 'stem' | 'frequency';
  frequency: number;
  groupSpread: number;
}

export interface MinusWordsEngineOptions {
  maxResults?: number;
  minFrequency?: number;
  minConfidence?: number;
  useDictionary?: boolean;
  useTfidf?: boolean;
  useRegex?: boolean;
  useStemming?: boolean;
}

// ---- Dictionaries ----

const PPC_DICTIONARY: Record<string, string> = {
  // Informational intent
  'бесплатно': 'Нецелевой informational intent',
  'скачать': 'Нецелевой download intent',
  'торрент': 'Пиратский контент',
  'отзывы': 'Отзывы — информационный интент',
  'отзыв': 'Отзывы — информационный интент',
  'фото': 'Медиа-запрос, некоммерческий',
  'видео': 'Медиа-запрос, некоммерческий',
  'картинка': 'Медиа-запрос, некоммерческий',
  'картинки': 'Медиа-запрос, некоммерческий',
  'diy': 'Handmade/DIY интент',
  'своими_руками': 'Handmade/DIY интент',
  'handmade': 'Handmade/DIY интент',

  // Job/recruitment
  'вакансии': 'Поиск работы, некоммерческий',
  'вакансия': 'Поиск работы, некоммерческий',
  'работа': 'Поиск работы, некоммерческий',
  'резюме': 'Поиск работы, некоммерческий',

  // Education
  'обучение': 'Образовательный интент',
  'курс': 'Образовательный интент',
  'тренинг': 'Образовательный интент',
  'вебинар': 'Образовательный интент',

  // Entertainment
  'игры': 'Развлекательный контент',
  'игра': 'Развлекательный контент',
  'геймплей': 'Игровой контент',
  'знакомства': 'Знакомства, некоммерческий',
  'знакомство': 'Знакомства, некоммерческий',
  'хобби': 'Хобби, некоммерческий',
  'увлечение': 'Увлечение, некоммерческий',
  'юмор': 'Развлекательный контент',
  'приколы': 'Развлекательный контент',
  'смешное': 'Развлекательный контент',
  'рецепт': 'Кулинария, информационный',
  'рецепты': 'Кулинария, информационный',

  // Utilities
  'погода': 'Прогноз погоды, некоммерческий',
  'прогноз': 'Прогноз, некоммерческий',
  'гороскоп': 'Гороскоп, некоммерческий',
  'сонник': 'Сонник, информационный',
  'поздравления': 'Поздравления, некоммерческий',
  'поздравление': 'Поздравления, некоммерческий',
  'тосты': 'Тосты, информационный',
  'курсы': 'Образовательный интент',

  // Transactional qualifiers
  'дешево': 'Ценовой модификатор',
  'дешёво': 'Ценовой модификатор',
  'недорого': 'Ценовой модификатор',
  'б/у': 'Б/у товар',
  'бу': 'Б/у товар',
  'б.у.': 'Б/у товар',
  'sale': 'Распродажа',
  'скидка': 'Скидочный запрос',
  'скидки': 'Скидочный запрос',
  'акция': 'Акционный запрос',
  'акции': 'Акционный запрос',
  'распродажа': 'Распродажа',
  'low price': 'Price qualifier',
  'cheap': 'Price qualifier',
  'discount': 'Discount query',
  'coupon': 'Coupon query',
  'promo': 'Promo query',
  'free': 'Free/intent qualifier',
  'download': 'Download intent',
};

// ---- Regex patterns ----

const REGEX_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /^(как|how|what|where|why|when|which)\s/i, reason: 'Question/informational intent' },
  { pattern: /\bforum\b/i, reason: 'Forum content' },
  { pattern: /\bwiki\b/i, reason: 'Wiki/reference content' },
  { pattern: /\bblog\b/i, reason: 'Blog content' },
  { pattern: /\bguide\b/i, reason: 'Guide/informational content' },
  { pattern: /\btutorial\b/i, reason: 'Tutorial content' },
  { pattern: /\bhow\s+to\b/i, reason: 'How-to informational intent' },
  { pattern: /\bwhat\s+is\b/i, reason: 'Definition/informational intent' },
  { pattern: /\bvs\b/i, reason: 'Comparison query' },
  { pattern: /\bor\b/i, reason: 'Comparison/alternative query' },
  { pattern: /[№#]\d+/i, reason: 'Model number — too specific' },
  { pattern: /\bphoto(graphy)?\b/i, reason: 'Media content' },
  { pattern: /\bpicture(s)?\b/i, reason: 'Media content' },
  { pattern: /\bimage(s)?\b/i, reason: 'Media content' },
  { pattern: /\bprice\b/i, reason: 'Price query' },
  { pattern: /\bcost\b/i, reason: 'Cost query' },
  { pattern: /\breview(s)?\b/i, reason: 'Review content' },
  { pattern: /\brating(s)?\b/i, reason: 'Rating/comparison query' },
  { pattern: /\btop\b/i, reason: 'Top/list query' },
  { pattern: /\bbest\b/i, reason: 'Best-of query' },
  { pattern: /\bnear\s+me\b/i, reason: 'Local intent query' },
  { pattern: /\bmap(s)?\b/i, reason: 'Map/navigation query' },
  { pattern: /\bdirection(s)?\b/i, reason: 'Direction/navigation query' },
  { pattern: /\bjob(s)?\b/i, reason: 'Job/employment query' },
  { pattern: /\bhiring\b/i, reason: 'Job/employment query' },
  { pattern: /\bcareer(s)?\b/i, reason: 'Career/employment query' },
  { pattern: /\bsalary\b/i, reason: 'Salary/employment query' },
  { pattern: /\bnews\b/i, reason: 'News content' },
  { pattern: /\barticle(s)?\b/i, reason: 'Article content' },
];

// ---- Stem approximation (basic Russian stemming) ----

const STEM_SUFFIXES = [
  'ов', 'ев', 'ёв', 'ий', 'ый', 'ой',
  'ая', 'яя', 'ое', 'ее',
  'ые', 'ие', 'ыми', 'ими',
  'ого', 'его', 'ому', 'ему',
  'ым', 'им', 'ом', 'ем',
  'у', 'ю', 'ой', 'ей',
  'ам', 'ям', 'ами', 'ями', 'ах', 'ях',
  'а', 'я', 'е', 'ё', 'и', 'ы', 'о',
  'ть', 'ти', 'чь',
  'ет', 'ют', 'ат', 'ят',
  'ал', 'ял', 'ла', 'ли', 'ло',
  'ав', 'яв', 'авши', 'явши',
  'в', 'вши', 'вшись',
  'ся', 'сь',
  'очк', 'ечк', 'оньк', 'еньк',
  'ик', 'ек', 'чик', 'ник',
  'ищ', 'ишк', 'ушк', 'юшк',
  'тель', 'ниц', 'льниц',
];

function approximateStem(word: string): string {
  let stem = word.toLowerCase();
  for (const suffix of STEM_SUFFIXES) {
    if (stem.length > 4 && stem.endsWith(suffix)) {
      stem = stem.slice(0, -suffix.length);
      break;
    }
  }
  return stem;
}

// ---- Aho-Corasick for dictionary scanning ----

type ACNode = { next: Map<string, ACNode>; output: string | null; fail: ACNode | null };

function buildAhoCorasick(patterns: Map<string, string>): { search: (text: string) => MinusWordResult[] } {
  const root: ACNode = { next: new Map(), output: null, fail: null };
  for (const [word, reason] of patterns) {
    let node = root;
    for (const ch of word.toLowerCase()) {
      if (!node.next.has(ch)) node.next.set(ch, { next: new Map(), output: null, fail: null });
      node = node.next.get(ch)!;
    }
    node.output = reason;
  }

  const queue: ACNode[] = [];
  for (const child of root.next.values()) {
    child.fail = root;
    queue.push(child);
  }
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const [ch, child] of cur.next) {
      let f = cur.fail;
      while (f !== null && !f.next.has(ch)) f = f.fail;
      child.fail = f !== null ? f.next.get(ch)! : root;
      if (!child.output && child.fail?.output) child.output = child.fail.output;
      queue.push(child);
    }
  }

  return {
    search: (text: string): MinusWordResult[] => {
      const results: MinusWordResult[] = [];
      let node = root;
      const lower = text.toLowerCase();
      for (let i = 0; i < lower.length; i++) {
        const ch = lower[i];
        while (node !== root && !node.next.has(ch)) node = node.fail!;
        if (node.next.has(ch)) node = node.next.get(ch)!;
        if (node.output) {
          results.push({
            word: lower.slice(i - node.output.length + 1, i + 1),
            reason: node.output,
            confidence: 0.9,
            source: 'dictionary',
            frequency: 1,
            groupSpread: 1,
          });
        }
      }
      return results;
    },
  };
}

const dictionaryMatcher = buildAhoCorasick(
  new Map(Object.entries(PPC_DICTIONARY))
);

// ---- Main Engine ----

export function suggestMinusWords(
  phrases: Phrase[],
  groups: Group[],
  options: MinusWordsEngineOptions = {}
): MinusWordResult[] {
  const {
    maxResults = 30,
    minFrequency = 1,
    minConfidence = 0.3,
    useDictionary = true,
    useTfidf = true,
    useRegex = true,
    useStemming = true,
  } = options;

  const results: MinusWordResult[] = [];
  const seen = new Set<string>();
  const wordFreq = extractWords(phrases);

  // Layer 1: Dictionary scan via Aho-Corasick
  if (useDictionary) {
    for (const phrase of phrases) {
      const matches = dictionaryMatcher.search(phrase.text);
      for (const match of matches) {
        const key = `${match.word}:dictionary`;
        if (!seen.has(key)) {
          seen.add(key);
          match.frequency = wordFreq.get(match.word) ?? 1;
          results.push(match);
        }
      }
    }
  }

  // Layer 2: Regex patterns
  if (useRegex) {
    for (const phrase of phrases) {
      for (const { pattern, reason } of REGEX_PATTERNS) {
        const match = phrase.text.match(pattern);
        if (match) {
          const word = match[0].toLowerCase().trim();
          const key = `${word}:regex:${reason}`;
          if (!seen.has(key) && word.length >= 2) {
            seen.add(key);
            results.push({
              word,
              reason,
              confidence: 0.7,
              source: 'regex',
              frequency: 1,
              groupSpread: 1,
            });
          }
        }
      }
    }
  }

  // Layer 3: TF-IDF based (from minus-words-generator)
  if (useTfidf) {
    const tfidfCandidates = findMinusWords(phrases, groups, null, maxResults);
    for (const c of tfidfCandidates) {
      const key = `${c.word}:tfidf`;
      if (!seen.has(key) && c.confidence >= minConfidence) {
        seen.add(key);
        results.push({
          word: c.word,
          reason: c.reason,
          confidence: c.confidence,
          source: 'tfidf',
          frequency: c.frequency,
          groupSpread: c.groupSpread,
        });
      }
    }
  }

  // Layer 4: Stem-based grouping (find words sharing stems with dictionary words)
  if (useStemming) {
    const dictStems = new Set<string>();
    for (const word of Object.keys(PPC_DICTIONARY)) {
      dictStems.add(approximateStem(word));
    }
    for (const [word, freq] of wordFreq) {
      if (freq < minFrequency) continue;
      const key = `${word}:stem`;
      if (seen.has(key)) continue;
      const stem = approximateStem(word);
      if (dictStems.has(stem) && word !== stem) {
        seen.add(key);
        results.push({
          word,
          reason: `Стем-совпадение со словарным словом "${stem}"`,
          confidence: 0.5,
          source: 'stem',
          frequency: freq,
          groupSpread: 1,
        });
      }
    }
  }

  // Sort and deduplicate
  results.sort((a, b) => {
    if (a.source === 'dictionary' && b.source !== 'dictionary') return -1;
    if (b.source === 'dictionary' && a.source !== 'dictionary') return 1;
    return b.confidence - a.confidence || b.frequency - a.frequency;
  });

  return results.slice(0, maxResults);
}

export { PPC_DICTIONARY, DEFAULT_MINUS_WORDS };
