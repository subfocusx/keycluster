// ============================================================
// KeyCluster Text Preprocessing — shared utilities
// ============================================================
//
// Simple Russian lemmatization + preprocessing pipeline
// Used by clustering, group-analysis, ngrams, tfidf modules
// ============================================================

// Simple Russian lemmatization using suffix stripping rules.
// This is a BASIC lemmatizer — not as accurate as pymorphy2, but works offline with no dependencies.
//
// Key principles:
// 1. Longest suffix rules first (more specific → less aggressive)
// 2. Never reduce a word to fewer than 3 characters
// 3. Infinitive verbs (ending in -ть) are already in dictionary form — keep them
// 4. Use a small dictionary of common exception words

const EXCEPTIONS: Record<string, string> = {
  // Words that should NOT be modified or have specific lemma forms
  'москва': 'москва',
  'россия': 'россия',
  'купить': 'купить',
  'продать': 'продать',
  'сделать': 'сделать',
  'найти': 'найти',
  'знать': 'знать',
  'быть': 'быть',
  'идти': 'идти',
  'жить': 'жить',
  'дать': 'дать',
  'есть': 'есть',
  'сказать': 'сказать',
  'хотеть': 'хотеть',
  'видеть': 'видеть',
  'слышать': 'слышать',
  'работать': 'работать',
  'строить': 'строить',
  'носить': 'носить',
  'ходить': 'ходить',
  'возить': 'возить',
  'водить': 'водить',
  'видит': 'видеть',
  'слышит': 'слышать',
  'пишет': 'писать',
  'работу': 'работа',
  'книга': 'книга',
  'книги': 'книга',
  'книг': 'книга',
  'книгам': 'книга',
  'книгами': 'книга',
  'книгой': 'книга',
  'душечка': 'душа',
  'душа': 'душа',
  'москве': 'москва',
  'рублей': 'рубль',
  'машины': 'машина',
  'машину': 'машина',
};

// Rules ordered from longest suffix to shortest (more specific first)
// Each rule: [regex, replacement, minStemLength]
const LEMMATIZATION_RULES: [RegExp, string, number][] = [
  // Verbs — long suffixes first (past tense feminine → infinitive)
  // NOTE: Only rules where we can reliably determine the infinitive suffix
  [/евала$/, 'евать', 2],
  [/овала$/, 'овать', 2],
  [/ывала$/, 'ывать', 2],
  [/илась$/, 'ить', 2],
  [/елся$/, 'еть', 2],
  [/ался$/, 'ать', 2],
  [/ился$/, 'ить', 2],
  [/елась$/, 'еть', 2],
  [/алась$/, 'ать', 2],
  [/ила$/, 'ить', 2],
  [/ела$/, 'еть', 2],
  [/ала$/, 'ать', 2],

  // Verbs — present tense 3rd person
  [/уют$/, 'ть', 2],
  [/ают$/, 'ть', 2],
  [/яют$/, 'ть', 2],
  [/ает$/, 'ать', 2],
  [/ит$/, 'ить', 2],
  [/ет$/, 'еть', 2],

  // Verbs — past tense masculine
  [/ил$/, 'ить', 2],
  [/ел$/, 'еть', 2],
  [/ал$/, 'ать', 2],
  [/ыл$/, 'ыть', 2],

  // Adjectives — full paradigm (longest suffixes first)
  [/ыми$/, 'ый', 2],
  [/ими$/, 'ий', 2],
  [/ого$/, 'ый', 2],
  [/его$/, 'ий', 2],
  [/ому$/, 'ый', 2],
  [/ему$/, 'ий', 2],
  [/ые$/, 'ый', 2],
  [/ие$/, 'ий', 2],
  [/ую$/, 'ый', 2],
  [/юю$/, 'ий', 2],
  [/ым$/, 'ый', 2],
  [/ое$/, 'ый', 2],
  [/ом$/, 'ый', 2],
  [/им$/, 'ий', 2],
  [/ой$/, 'ый', 2],
  [/ей$/, 'ий', 2],
  [/ая$/, 'ый', 2],
  [/яя$/, 'ий', 2],

  // Nouns — plural suffixes (longest first)
  [/цами$/, 'ц', 2],
  [/ками$/, 'ка', 2],
  [/ами$/, '', 3],
  [/ями$/, '', 3],
  [/ов$/, '', 3],
  [/ев$/, '', 3],
  [/ах$/, 'а', 2],
  [/ях$/, 'я', 2],
  [/ам$/, '', 3],
  [/ям$/, '', 3],
  [/ей$/, 'я', 2],
  [/ём$/, 'я', 2],

  // Diminutives
  [/очка$/, '', 3],
  [/ечка$/, 'ека', 2],
  [/ушка$/, 'ука', 2],
  [/юшка$/, 'юка', 2],

  // Nouns — simple plural (shortest, least specific — apply last)
  [/цы$/, 'ц', 2],
  [/ки$/, 'ка', 2],
  [/ы$/, '', 3],
  [/и$/, '', 3],
  [/а$/, '', 3],
  [/я$/, '', 3],
];

export function simpleLemmatize(word: string): string {
  if (word.length <= 3) return word.toLowerCase();

  const lower = word.toLowerCase();

  // Check exception dictionary first
  if (lower in EXCEPTIONS) return EXCEPTIONS[lower];

  // Try rules in order (longest suffix first)
  for (const [pattern, replacement, minStem] of LEMMATIZATION_RULES) {
    if (pattern.test(lower)) {
      const result = lower.replace(pattern, replacement);
      // Only apply if the result is not too short
      if (result.length >= minStem) {
        return result;
      }
    }
  }

  return lower;
}

export interface PreprocessingOptions {
  lemmatize?: boolean;
  ignoreNumbers?: boolean;
  synonyms?: Map<string, string>; // word → replacement word
  stopWords?: Set<string>;
}

/**
 * Preprocess a phrase text according to the given options.
 * Returns the processed array of words (for use in comparison algorithms).
 */
export function preprocessPhrase(text: string, options: PreprocessingOptions = {}): string[] {
  let words = text.toLowerCase().split(/\s+/);

  // Ignore numbers
  if (options.ignoreNumbers) {
    words = words.filter(w => !/^\d+$/.test(w));
  }

  // Apply lemmatization
  if (options.lemmatize) {
    words = words.map(w => simpleLemmatize(w));
  }

  // Apply synonyms
  if (options.synonyms && options.synonyms.size > 0) {
    words = words.map(w => options.synonyms!.get(w) ?? w);
  }

  // Remove stop words
  if (options.stopWords && options.stopWords.size > 0) {
    words = words.filter(w => !options.stopWords!.has(w));
  }

  // Remove empty/1-char
  words = words.filter(w => w.length > 0);

  return words;
}

/** Default Russian stop words */
export const DEFAULT_STOP_WORDS = new Set([
  'в', 'на', 'с', 'и', 'по', 'из', 'за', 'к', 'у', 'о', 'от',
  'для', 'как', 'не', 'но', 'а', 'это', 'то', 'все', 'он', 'она',
  'оно', 'они', 'мы', 'вы', 'ты', 'я',
  'тут', 'где', 'там', 'когда', 'что', 'кто', 'чем',
  'какой', 'какая',
  'мой', 'твой', 'его', 'её', 'их',
  'при', 'через', 'между', 'над', 'под', 'без', 'до', 'со', 'об',
  'или',
  'ей', 'им', 'нас', 'вам', 'вас',
]);
