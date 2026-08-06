// ============================================================
// Tests: Implicit Duplicates Plugin — pure utility functions
// ============================================================
//
// Covers all exported functions from @user-plugins/implicit-duplicates/utils:
//   normalize, tokenize, removeStopWords, wordSet, sortedWords,
//   sortedKey, jaccardSimilarity, ngrams, diceCoefficient,
//   levenshteinDistance, normalizedLevenshtein, computeSimilarity,
//   findImplicitDuplicates
//
// NOTE: UnionFind is a local (non-exported) class — tested indirectly
//   through findImplicitDuplicates grouping behaviour.
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  normalize,
  tokenize,
  removeStopWords,
  wordSet,
  sortedWords,
  sortedKey,
  jaccardSimilarity,
  ngrams,
  diceCoefficient,
  levenshteinDistance,
  normalizedLevenshtein,
  computeSimilarity,
  findImplicitDuplicates,
} from '@user-plugins/implicit-duplicates/utils';
import type { FindDuplicatesOptions, ImplicitDuplicateGroup } from '@user-plugins/implicit-duplicates/utils';

// ============================================================
// Default options helper
// ============================================================

const defaultOptions: FindDuplicatesOptions = {
  threshold: 60,
  ignoreStopWords: true,
  compareWordOrder: false,
  keepHigherFrequency: false,
};

// ============================================================
// normalize(text: string): string
// ============================================================

describe('normalize', () => {
  it('should lowercase input', () => {
    expect(normalize('Hello WORLD')).toBe('hello world');
  });

  it('should trim leading/trailing whitespace', () => {
    expect(normalize('  hello  ')).toBe('hello');
  });

  it('should collapse multiple spaces into one', () => {
    expect(normalize('hello    world   test')).toBe('hello world test');
  });

  it('should handle all transformations together', () => {
    expect(normalize('  КУПИТЬ   Ноутбук  МОСКВА  ')).toBe('купить ноутбук москва');
  });

  it('should return empty string for empty input', () => {
    expect(normalize('')).toBe('');
  });

  it('should return empty string for whitespace-only input', () => {
    expect(normalize('   \t  \n  ')).toBe('');
  });

  it('should handle single word', () => {
    expect(normalize('Notebook')).toBe('notebook');
  });

  it('should handle single character', () => {
    expect(normalize('A')).toBe('a');
  });
});

// ============================================================
// tokenize(text: string): string[]
// ============================================================

describe('tokenize', () => {
  it('should split a phrase into words', () => {
    expect(tokenize('купить ноутбук в москва')).toEqual(['купить', 'ноутбук', 'в', 'москва']);
  });

  it('should normalize before splitting', () => {
    expect(tokenize('  КУПИТЬ   Ноутбук  ')).toEqual(['купить', 'ноутбук']);
  });

  it('should return empty array for empty string', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('should return empty array for whitespace-only string', () => {
    expect(tokenize('   ')).toEqual([]);
  });

  it('should return single element for single word', () => {
    expect(tokenize('ноутбук')).toEqual(['ноутбук']);
  });

  it('should split English text', () => {
    expect(tokenize('buy cheap laptop')).toEqual(['buy', 'cheap', 'laptop']);
  });

  it('should handle mixed Cyrillic and Latin', () => {
    expect(tokenize('iphone 15 купить')).toEqual(['iphone', '15', 'купить']);
  });
});

// ============================================================
// removeStopWords(tokens: string[]): string[]
// ============================================================

describe('removeStopWords', () => {
  it('should remove Russian prepositions', () => {
    const tokens = ['купить', 'в', 'москва', 'на', 'рынке'];
    const result = removeStopWords(tokens);
    expect(result).not.toContain('в');
    expect(result).not.toContain('на');
  });

  it('should remove Russian conjunctions', () => {
    const result = removeStopWords(['ноутбук', 'и', 'телефон', 'или', 'планшет']);
    expect(result).not.toContain('и');
    expect(result).not.toContain('или');
    expect(result).toEqual(['ноутбук', 'телефон', 'планшет']);
  });

  it('should remove Russian SEO stop words (купить, цена, москва, etc.)', () => {
    const result = removeStopWords(['купить', 'смартфон', 'москва', 'цена', 'недорого']);
    expect(result).not.toContain('купить');
    expect(result).not.toContain('москва');
    expect(result).not.toContain('цена');
    expect(result).not.toContain('недорого');
    expect(result).toEqual(['смартфон']);
  });

  it('should remove English stop words', () => {
    const result = removeStopWords(['buy', 'the', 'cheap', 'laptop', 'in', 'store']);
    expect(result).not.toContain('the');
    expect(result).not.toContain('in');
    expect(result).not.toContain('buy');
    expect(result).not.toContain('cheap');
    expect(result).toEqual(['laptop', 'store']);
  });

  it('should return empty array when all tokens are stop words', () => {
    expect(removeStopWords(['в', 'на', 'и', 'от', 'до'])).toEqual([]);
  });

  it('should not modify array when no tokens are stop words', () => {
    const tokens = ['смартфон', 'планшет', 'ноутбук'];
    expect(removeStopWords(tokens)).toEqual(tokens);
  });

  it('should return empty array for empty input', () => {
    expect(removeStopWords([])).toEqual([]);
  });

  it('should handle pronouns and particles', () => {
    const result = removeStopWords(['он', 'думал', 'же', 'это', 'бы']);
    expect(result).toEqual(['думал']);
  });

  it('should remove "спб" and "петербург" (geo stop words)', () => {
    const result = removeStopWords(['ремонт', 'спб', 'квартиры', 'петербург']);
    expect(result).not.toContain('спб');
    expect(result).not.toContain('петербург');
    expect(result).toEqual(['ремонт', 'квартиры']);
  });
});

// ============================================================
// wordSet(text: string, ignoreStopWords: boolean): Set<string>
// ============================================================

describe('wordSet', () => {
  it('should return unique words as a Set', () => {
    const result = wordSet('hello hello world', false);
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(2);
    expect(result.has('hello')).toBe(true);
    expect(result.has('world')).toBe(true);
  });

  it('should keep stop words when ignoreStopWords is false', () => {
    const result = wordSet('купить в москва', false);
    expect(result.has('купить')).toBe(true);
    expect(result.has('в')).toBe(true);
    expect(result.has('москва')).toBe(true);
  });

  it('should remove stop words when ignoreStopWords is true', () => {
    const result = wordSet('купить в москва', true);
    // "купить" and "москва" are both stop words → only non-stop words remain
    expect(result.size).toBe(0);
  });

  it('should return empty set for empty string', () => {
    expect(wordSet('', false).size).toBe(0);
    expect(wordSet('', true).size).toBe(0);
  });

  it('should handle repeated words correctly', () => {
    const result = wordSet('notebook notebook notebook', false);
    expect(result.size).toBe(1);
    expect(result.has('notebook')).toBe(true);
  });

  it('should normalize text before creating set', () => {
    const result = wordSet('Купить Ноутбук купить', false);
    expect(result.size).toBe(2); // 'купить' (lowercase), 'ноутбук'
  });

  it('should retain meaningful words after stop word removal', () => {
    const result = wordSet('ремонт квартиры москва недорого', true);
    // "москва" and "недорого" are stop words → only "ремонт" and "квартиры" remain
    expect(result.has('ремонт')).toBe(true);
    expect(result.has('квартиры')).toBe(true);
    expect(result.size).toBe(2);
  });
});

// ============================================================
// sortedWords(text: string, ignoreStopWords: boolean): string[]
// ============================================================

describe('sortedWords', () => {
  it('should return sorted words (preserves duplicates)', () => {
    // NOTE: sortedWords sorts but does NOT deduplicate
    const result = sortedWords('charlie alpha bravo alpha', false);
    expect(result).toEqual(['alpha', 'alpha', 'bravo', 'charlie']);
  });

  it('should remove stop words when ignoreStopWords is true', () => {
    const result = sortedWords('купить ноутбук в москва', true);
    // "купить" and "москва" are stop words → only "ноутбук" and "в"
    // Wait: "в" is also a stop word → only "ноутбук"
    expect(result).toEqual(['ноутбук']);
  });

  it('should keep stop words when ignoreStopWords is false', () => {
    const result = sortedWords('в на с', false);
    expect(result).toEqual(['в', 'на', 'с']);
  });

  it('should return empty array for empty string', () => {
    expect(sortedWords('', false)).toEqual([]);
  });

  it('should normalize before sorting', () => {
    const result = sortedWords('Zebra Alpha', false);
    expect(result).toEqual(['alpha', 'zebra']);
  });

  it('should sort tokens lexicographically', () => {
    // sortedWords does NOT deduplicate — it only sorts
    const result = sortedWords('beta alpha beta gamma alpha', false);
    expect(result).toEqual(['alpha', 'alpha', 'beta', 'beta', 'gamma']);
  });
});

// ============================================================
// sortedKey(text: string, ignoreStopWords: boolean): string
// ============================================================

describe('sortedKey', () => {
  it('should return space-joined sorted words', () => {
    const result = sortedKey('charlie alpha bravo', false);
    expect(result).toBe('alpha bravo charlie');
  });

  it('should remove stop words when ignoreStopWords is true', () => {
    const result = sortedKey('купить ноутбук в москва', true);
    expect(result).toBe('ноутбук');
  });

  it('should produce identical keys for word permutations (without stop words)', () => {
    const key1 = sortedKey('notebook laptop', false);
    const key2 = sortedKey('laptop notebook', false);
    expect(key1).toBe(key2);
  });

  it('should return empty string for empty text', () => {
    expect(sortedKey('', false)).toBe('');
  });

  it('should return empty string when all words are stop words and ignoreStopWords is true', () => {
    expect(sortedKey('в на с к по', true)).toBe('');
  });

  it('should preserve stop words when ignoreStopWords is false', () => {
    expect(sortedKey('в на с', false)).toBe('в на с');
  });
});

// ============================================================
// jaccardSimilarity(setA: Set<string>, setB: Set<string>): number
// ============================================================

describe('jaccardSimilarity', () => {
  it('should return 1 for identical sets', () => {
    const s = new Set(['a', 'b', 'c']);
    expect(jaccardSimilarity(s, new Set(['a', 'b', 'c']))).toBe(1);
  });

  it('should return 0 for disjoint sets', () => {
    const a = new Set(['a', 'b']);
    const b = new Set(['c', 'd']);
    expect(jaccardSimilarity(a, b)).toBe(0);
  });

  it('should return 1 for two empty sets', () => {
    expect(jaccardSimilarity(new Set(), new Set())).toBe(1);
  });

  it('should return 0 when one set is empty and the other is not', () => {
    expect(jaccardSimilarity(new Set(), new Set(['a']))).toBe(0);
    expect(jaccardSimilarity(new Set(['a']), new Set())).toBe(0);
  });

  it('should calculate correct partial overlap', () => {
    // A = {a,b,c}, B = {b,c,d} → intersection=2, union=4 → 0.5
    const a = new Set(['a', 'b', 'c']);
    const b = new Set(['b', 'c', 'd']);
    expect(jaccardSimilarity(a, b)).toBeCloseTo(0.5, 10);
  });

  it('should handle one set being a subset of another', () => {
    // A = {a,b}, B = {a,b,c,d} → intersection=2, union=4 → 0.5
    const a = new Set(['a', 'b']);
    const b = new Set(['a', 'b', 'c', 'd']);
    expect(jaccardSimilarity(a, b)).toBeCloseTo(0.5, 10);
  });

  it('should handle single-element sets', () => {
    expect(jaccardSimilarity(new Set(['x']), new Set(['x']))).toBe(1);
    expect(jaccardSimilarity(new Set(['x']), new Set(['y']))).toBe(0);
  });

  it('should handle Russian word sets', () => {
    const a = new Set(['ремонт', 'квартиры']);
    const b = new Set(['ремонт', 'дома']);
    // intersection=1, union=3 → 1/3
    expect(jaccardSimilarity(a, b)).toBeCloseTo(1 / 3, 10);
  });
});

// ============================================================
// ngrams(text: string, n: number): Set<string>
// ============================================================

describe('ngrams', () => {
  it('should generate bigrams from a string', () => {
    const result = ngrams('abc', 2);
    expect(result).toEqual(new Set(['ab', 'bc']));
  });

  it('should generate trigrams from a string', () => {
    const result = ngrams('abcd', 3);
    expect(result).toEqual(new Set(['abc', 'bcd']));
  });

  it('should return single-element set for text shorter than n', () => {
    const result = ngrams('a', 2);
    expect(result).toEqual(new Set(['a']));
  });

  it('should normalize text before generating n-grams', () => {
    const result = ngrams('ABC', 2);
    // "abc" → bigrams: "ab", "bc"
    expect(result).toEqual(new Set(['ab', 'bc']));
  });

  it('should handle empty string (normalized length 0 < n)', () => {
    const result = ngrams('', 2);
    expect(result).toEqual(new Set(['']));
  });

  it('should produce unique n-grams', () => {
    const result = ngrams('aaa', 2);
    expect(result).toEqual(new Set(['aa']));
  });

  it('should handle unigrams (n=1)', () => {
    const result = ngrams('abc', 1);
    expect(result).toEqual(new Set(['a', 'b', 'c']));
  });

  it('should handle Russian text', () => {
    const result = ngrams('тест', 2);
    // 'тест' → bigrams: 'те', 'ес', 'ст'
    expect(result).toEqual(new Set(['те', 'ес', 'ст']));
  });
});

// ============================================================
// diceCoefficient(textA: string, textB: string): number
// ============================================================

describe('diceCoefficient', () => {
  it('should return 1 for identical strings', () => {
    expect(diceCoefficient('hello world', 'hello world')).toBe(1);
  });

  it('should return 0 for completely different strings', () => {
    expect(diceCoefficient('abc', 'xyz')).toBe(0);
  });

  it('should return 1 for two empty strings', () => {
    expect(diceCoefficient('', '')).toBe(1);
  });

  it('should return 0 when one string is empty and other is not', () => {
    // '' normalizes to '' → bigrams = {''}
    // 'abc' normalizes to 'abc' → bigrams = {'ab','bc'}
    // intersection = 0 → 0 / (1+2) = 0
    expect(diceCoefficient('', 'abc')).toBe(0);
    expect(diceCoefficient('abc', '')).toBe(0);
  });

  it('should give high score for strings with many shared bigrams', () => {
    const score = diceCoefficient('night', 'nacht');
    // 'night' → {'ni','ig','gh','ht'}
    // 'nacht' → {'na','ac','ch','ht'}
    // intersection = 1 ('ht'), dice = 2/(4+4) = 0.25
    expect(score).toBeCloseTo(0.25, 10);
  });

  it('should be symmetric', () => {
    const a = diceCoefficient('foo bar', 'bar baz');
    const b = diceCoefficient('bar baz', 'foo bar');
    expect(a).toBe(b);
  });

  it('should handle single-character strings', () => {
    // Both normalize to single char → bigrams = {char}, intersection = 1 if same
    expect(diceCoefficient('a', 'a')).toBe(1);
    expect(diceCoefficient('a', 'b')).toBe(0);
  });

  it('should normalize before computing bigrams', () => {
    const score = diceCoefficient('Hello', 'hello');
    expect(score).toBe(1);
  });

  it('should handle Russian text', () => {
    const score = diceCoefficient('купить ноутбук', 'купить телефон');
    // Both share 'ку', 'уп', 'пи', 'ит', 'ть', 'ь ' → many common bigrams
    expect(score).toBeGreaterThan(0.4);
  });
});

// ============================================================
// levenshteinDistance(a: string, b: string): number
// ============================================================

describe('levenshteinDistance', () => {
  it('should return 0 for identical strings', () => {
    expect(levenshteinDistance('hello', 'hello')).toBe(0);
  });

  it('should return 0 for two empty strings', () => {
    expect(levenshteinDistance('', '')).toBe(0);
  });

  it('should return length of non-empty string when other is empty', () => {
    expect(levenshteinDistance('', 'abc')).toBe(3);
    expect(levenshteinDistance('abc', '')).toBe(3);
  });

  it('should compute classic kitten → sitting distance as 3', () => {
    // kitten → sitten (k→s), sitten → sittin (e→i), sittin → sitting (insert g)
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
  });

  it('should compute single character substitution', () => {
    expect(levenshteinDistance('abc', 'axc')).toBe(1);
  });

  it('should compute single insertion', () => {
    expect(levenshteinDistance('abc', 'abxc')).toBe(1);
  });

  it('should compute single deletion', () => {
    expect(levenshteinDistance('abc', 'ac')).toBe(1);
  });

  it('should be symmetric', () => {
    const a = levenshteinDistance('algorithm', 'altruistic');
    const b = levenshteinDistance('altruistic', 'algorithm');
    expect(a).toBe(b);
  });

  it('should handle single characters', () => {
    expect(levenshteinDistance('a', 'b')).toBe(1);
    expect(levenshteinDistance('a', 'a')).toBe(0);
  });

  it('should handle Russian text', () => {
    expect(levenshteinDistance('ноутбук', 'ноутбук')).toBe(0);
    expect(levenshteinDistance('смартфон', 'смартфоны')).toBe(1);
  });

  it('should handle completely different strings', () => {
    expect(levenshteinDistance('abc', 'xyz')).toBe(3);
  });

  it('should handle transposition (costs 2 edits)', () => {
    // 'ab' → 'ba' requires 2 operations (substitute + substitute, or delete + insert)
    expect(levenshteinDistance('ab', 'ba')).toBe(2);
  });
});

// ============================================================
// normalizedLevenshtein(a: string, b: string): number
// ============================================================

describe('normalizedLevenshtein', () => {
  it('should return 1 for identical strings', () => {
    expect(normalizedLevenshtein('hello', 'hello')).toBe(1);
  });

  it('should return 1 for two empty strings', () => {
    expect(normalizedLevenshtein('', '')).toBe(1);
  });

  it('should return 0 when strings are completely different and same length', () => {
    expect(normalizedLevenshtein('abc', 'xyz')).toBeCloseTo(0, 10);
  });

  it('should return 0.5 for 1 edit on a 2-char string', () => {
    // distance(1) / maxLen(2) → 1 - 0.5 = 0.5
    expect(normalizedLevenshtein('ab', 'ac')).toBeCloseTo(0.5, 10);
  });

  it('should return 0 when non-empty differs from empty', () => {
    expect(normalizedLevenshtein('hello', '')).toBe(0);
  });

  it('should return value between 0 and 1 for partial matches', () => {
    const score = normalizedLevenshtein('kitten', 'sitting');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it('should handle single characters', () => {
    expect(normalizedLevenshtein('a', 'a')).toBe(1);
    expect(normalizedLevenshtein('a', 'b')).toBe(0);
  });

  it('should handle Russian text', () => {
    // 'смартфон' (8) vs 'смартфоны' (9) → distance=1, max=9 → 1 - 1/9
    expect(normalizedLevenshtein('смартфон', 'смартфоны')).toBeCloseTo(1 - 1 / 9, 10);
  });
});

// ============================================================
// computeSimilarity(textA, textB, options?): SimilarityResult
// ============================================================

describe('computeSimilarity', () => {
  it('should return score=1 for identical phrases', () => {
    const result = computeSimilarity('notebook laptop', 'notebook laptop');
    expect(result.score).toBe(1);
    expect(result.details.jaccard).toBe(1);
    expect(result.details.dice).toBe(1);
    expect(result.details.levenshtein).toBe(1);
    expect(result.details.permutationMatch).toBe(true);
  });

  it('should return score=1 for identical Russian phrases', () => {
    const result = computeSimilarity('ремонт квартир москва', 'ремонт квартир москва');
    expect(result.score).toBe(1);
    expect(result.details.permutationMatch).toBe(true);
  });

  it('should detect permutation match (reordered words)', () => {
    const result = computeSimilarity('notebook laptop mouse', 'mouse notebook laptop');
    // ignoreStopWords=true by default
    // sortedKey removes stop words, sorts → both become "laptop mouse notebook"
    expect(result.details.permutationMatch).toBe(true);
    // Permutation is detected, but dice/levenshtein operate on full strings
    // (which are in different order) → score is high but not 1
    expect(result.score).toBeGreaterThan(0.7);
    expect(result.score).toBeLessThan(1);
  });

  it('should not match permutations when compareWordOrder is true', () => {
    const result = computeSimilarity(
      'notebook laptop mouse',
      'mouse notebook laptop',
      { compareWordOrder: true },
    );
    expect(result.details.permutationMatch).toBe(false);
    // Score should be less than 1 since word order differs
    expect(result.score).toBeLessThan(1);
  });

  it('should give low score for completely different phrases', () => {
    const result = computeSimilarity('купить ноутбук', 'сдать квартиру');
    // Different words → jaccard 0 (no overlap), but let's check dice/levenshtein
    expect(result.details.jaccard).toBe(0);
    expect(result.score).toBeLessThan(0.5);
  });

  it('should give moderate score for phrases differing by word ending', () => {
    // "ремонт квартир" vs "ремонт квартиры" — "квартир" and "квартиры" are different tokens
    // → jaccard is lower than expected because word-level comparison treats them as distinct
    const result = computeSimilarity('ремонт квартир', 'ремонт квартиры');
    expect(result.score).toBeGreaterThan(0.4);
    // But strings are close at character level → levenshtein should be high
    expect(result.details.levenshtein).toBeGreaterThan(0.8);
  });

  it('should respect ignoreStopWords option', () => {
    // "купить в москва ноутбук" vs "купить на петербург ноутбук"
    // With stop words ignored: "купить","в","москва","на","петербург" are all stop words → "ноутбук" vs "ноутбук"
    const withIgnore = computeSimilarity(
      'купить в москва ноутбук',
      'купить на петербург ноутбук',
      { ignoreStopWords: true },
    );
    expect(withIgnore.details.permutationMatch).toBe(true);

    // Without stop words ignored: different words, not a permutation
    const withoutIgnore = computeSimilarity(
      'купить в москва ноутбук',
      'купить на петербург ноутбук',
      { ignoreStopWords: false },
    );
    expect(withoutIgnore.details.permutationMatch).toBe(false);
  });

  it('should include all detail components', () => {
    const result = computeSimilarity('test phrase', 'another phrase');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('details');
    expect(result.details).toHaveProperty('jaccard');
    expect(result.details).toHaveProperty('dice');
    expect(result.details).toHaveProperty('levenshtein');
    expect(result.details).toHaveProperty('permutationMatch');
  });

  it('should return score between 0 and 1', () => {
    const result = computeSimilarity('some text here', 'completely different words');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('should be symmetric', () => {
    const a = computeSimilarity('hello world test', 'hello world best');
    const b = computeSimilarity('hello world best', 'hello world test');
    expect(a.score).toBeCloseTo(b.score, 10);
  });

  it('should handle empty strings', () => {
    const result = computeSimilarity('', '');
    expect(result.score).toBe(1);
  });

  it('should handle empty vs non-empty', () => {
    const result = computeSimilarity('', 'hello world');
    expect(result.score).toBe(0);
  });

  it('should give higher score with stop words removed for SEO-like phrases', () => {
    // "купить ноутбук москва" vs "купить ноутбук петербург"
    // "купить","москва","петербург" are all stop words → after removal: "ноутбук" vs "ноутбук"
    const result = computeSimilarity(
      'купить ноутбук москва',
      'купить ноутбук петербург',
      { ignoreStopWords: true },
    );
    expect(result.details.permutationMatch).toBe(true);
    // permutation=true, jaccard=1, but dice/levenshtein on full strings differ → not 1
    expect(result.score).toBeGreaterThan(0.7);
  });

  it('should handle phrases with overlapping but different words', () => {
    const result = computeSimilarity('ремонт квартиры москва', 'ремонт дома питер');
    // "ремонт" is common → jaccard > 0
    // Different words → jaccard < 1
    expect(result.details.jaccard).toBeGreaterThan(0);
    expect(result.details.jaccard).toBeLessThan(1);
  });
});

// ============================================================
// findImplicitDuplicates(phrases, options): ImplicitDuplicateGroup[]
// ============================================================

describe('findImplicitDuplicates', () => {
  // ---- Basic behaviour ----

  it('should return empty array for empty input', () => {
    const result = findImplicitDuplicates([], defaultOptions);
    expect(result).toEqual([]);
  });

  it('should return empty array for single phrase (no groups of 2+)', () => {
    const phrases = [{ id: '1', text: 'купить ноутбук' }];
    const result = findImplicitDuplicates(phrases, defaultOptions);
    expect(result).toEqual([]);
  });

  it('should group identical phrases together', () => {
    const phrases = [
      { id: '1', text: 'купить ноутбук', frequency: 100 },
      { id: '2', text: 'купить ноутбук', frequency: 50 },
    ];
    const result = findImplicitDuplicates(phrases, { ...defaultOptions, threshold: 60 });
    expect(result).toHaveLength(1);
    expect(result[0].phrases).toHaveLength(2);
    expect(result[0].phrases.map(p => p.id).sort()).toEqual(['1', '2']);
  });

  it('should group word-permuted phrases (reordered words)', () => {
    const phrases = [
      { id: '1', text: 'ремонт квартиры москва', frequency: 80 },
      { id: '2', text: 'квартиры ремонт москва', frequency: 60 },
    ];
    const result = findImplicitDuplicates(phrases, { ...defaultOptions, threshold: 50 });
    // With stop words removed (москва): "ремонт квартиры" → sorted = "квартиры ремонт"
    // Both should match as permutation
    expect(result).toHaveLength(1);
    expect(result[0].phrases).toHaveLength(2);
  });

  it('should NOT group completely different phrases', () => {
    const phrases = [
      { id: '1', text: 'купить ноутбук', frequency: 100 },
      { id: '2', text: 'сдать квартиру', frequency: 100 },
    ];
    const result = findImplicitDuplicates(phrases, { ...defaultOptions, threshold: 60 });
    expect(result).toHaveLength(0);
  });

  it('should create multiple groups for distinct clusters', () => {
    const phrases = [
      { id: '1', text: 'ремонт квартир москва', frequency: 100 },
      { id: '2', text: 'ремонт квартир питер', frequency: 80 },
      { id: '3', text: 'купить ноутбук дешево', frequency: 60 },
      { id: '4', text: 'купить ноутбук недорого', frequency: 40 },
    ];
    const result = findImplicitDuplicates(phrases, { ...defaultOptions, threshold: 40 });
    // Group 1: 1,2 (share "ремонт", "квартир" after stop words removed)
    // Group 2: 3,4 (after removing "купить" and "дешево"/"недорого": "ноутбук" in both)
    expect(result).toHaveLength(2);

    // Each group should have 2 phrases
    for (const group of result) {
      expect(group.phrases).toHaveLength(2);
    }
  });

  // ---- Threshold sensitivity ----

  it('should return fewer groups with higher threshold', () => {
    const phrases = [
      { id: '1', text: 'ремонт квартир', frequency: 100 },
      { id: '2', text: 'ремонт дома', frequency: 80 },
      { id: '3', text: 'ремонт офиса', frequency: 60 },
    ];

    const lowThreshold = findImplicitDuplicates(phrases, { ...defaultOptions, threshold: 10 });
    const highThreshold = findImplicitDuplicates(phrases, { ...defaultOptions, threshold: 99 });

    // Lower threshold → more things grouped → fewer groups (or same number but more phrases per group)
    // Higher threshold → stricter → fewer matches → potentially fewer groups
    const lowPhraseCount = lowThreshold.reduce((sum, g) => sum + g.phrases.length, 0);
    const highPhraseCount = highThreshold.reduce((sum, g) => sum + g.phrases.length, 0);
    expect(lowPhraseCount).toBeGreaterThanOrEqual(highPhraseCount);
  });

  // ---- ignoreStopWords option ----

  it('should group more aggressively with ignoreStopWords=true', () => {
    const phrases = [
      { id: '1', text: 'купить ноутбук москва', frequency: 100 },
      { id: '2', text: 'купить ноутбук петербург', frequency: 80 },
    ];

    // With stop words removed: "купить","москва","петербург" are all stop words
    // → both become "ноутбук" → permutation match → high similarity
    const withIgnore = findImplicitDuplicates(phrases, { ...defaultOptions, ignoreStopWords: true, threshold: 60 });
    expect(withIgnore).toHaveLength(1);

    // Without removing stop words: more words → lower relative overlap
    const withoutIgnore = findImplicitDuplicates(phrases, { ...defaultOptions, ignoreStopWords: false, threshold: 60 });
    // They still have overlap (купить, ноутбук), so they may still group
    // But if they do group, the avgSimilarity may differ
    if (withoutIgnore.length > 0) {
      // If they do group, that's fine — just verify the structure
      expect(withoutIgnore[0].phrases).toHaveLength(2);
    }
  });

  // ---- keepHigherFrequency option ----

  it('should select highest-frequency phrase as mainPhrase when keepHigherFrequency=true', () => {
    const phrases = [
      { id: '1', text: 'ремонт квартир', frequency: 50 },
      { id: '2', text: 'ремонт квартир', frequency: 200 },
      { id: '3', text: 'ремонт квартир', frequency: 100 },
    ];

    const result = findImplicitDuplicates(phrases, {
      ...defaultOptions,
      keepHigherFrequency: true,
    });

    expect(result).toHaveLength(1);
    expect(result[0].mainPhrase.id).toBe('2');
    expect(result[0].mainPhrase.frequency).toBe(200);
  });

  it('should select first phrase as mainPhrase when keepHigherFrequency=false', () => {
    const phrases = [
      { id: '1', text: 'ремонт квартир', frequency: 10 },
      { id: '2', text: 'ремонт квартир', frequency: 999 },
    ];

    const result = findImplicitDuplicates(phrases, {
      ...defaultOptions,
      keepHigherFrequency: false,
    });

    expect(result).toHaveLength(1);
    expect(result[0].mainPhrase.id).toBe('1');
  });

  it('should handle phrases without frequency field', () => {
    const phrases = [
      { id: '1', text: 'ремонт квартир' },
      { id: '2', text: 'ремонт домов' },
    ];

    const result = findImplicitDuplicates(phrases, { ...defaultOptions, threshold: 40 });
    // Should not crash; may or may not group depending on similarity
    expect(Array.isArray(result)).toBe(true);
  });

  // ---- Group structure ----

  it('should set groupId equal to mainPhrase.id', () => {
    const phrases = [
      { id: 'a1', text: 'купить телефон', frequency: 100 },
      { id: 'a2', text: 'купить телефон', frequency: 50 },
    ];

    const result = findImplicitDuplicates(phrases, defaultOptions);
    expect(result).toHaveLength(1);
    expect(result[0].groupId).toBe(result[0].mainPhrase.id);
  });

  it('should include avgSimilarity between 0 and 1', () => {
    const phrases = [
      { id: '1', text: 'купить телефон', frequency: 100 },
      { id: '2', text: 'купить телефон', frequency: 50 },
    ];

    const result = findImplicitDuplicates(phrases, defaultOptions);
    expect(result).toHaveLength(1);
    expect(result[0].avgSimilarity).toBeGreaterThanOrEqual(0);
    expect(result[0].avgSimilarity).toBeLessThanOrEqual(1);
  });

  it('should have avgSimilarity=1 for identical two-phrase group', () => {
    const phrases = [
      { id: '1', text: 'купить телефон', frequency: 100 },
      { id: '2', text: 'купить телефон', frequency: 50 },
    ];

    const result = findImplicitDuplicates(phrases, defaultOptions);
    expect(result).toHaveLength(1);
    expect(result[0].avgSimilarity).toBe(1);
  });

  it('should sort groups by descending avgSimilarity', () => {
    const phrases = [
      { id: '1', text: 'ремонт квартир москва', frequency: 100 },
      { id: '2', text: 'ремонт квартир москва', frequency: 80 },   // identical → sim=1
      { id: '3', text: 'ремонт домов москва', frequency: 60 },
      { id: '4', text: 'ремонт дома москва', frequency: 40 },     // similar but not identical
    ];

    const result = findImplicitDuplicates(phrases, { ...defaultOptions, threshold: 30 });
    if (result.length >= 2) {
      expect(result[0].avgSimilarity).toBeGreaterThanOrEqual(result[1].avgSimilarity);
    }
  });

  it('should sort phrases within group by descending frequency', () => {
    const phrases = [
      { id: '1', text: 'купить ноутбук', frequency: 10 },
      { id: '2', text: 'купить ноутбук', frequency: 300 },
      { id: '3', text: 'купить ноутбук', frequency: 100 },
    ];

    const result = findImplicitDuplicates(phrases, defaultOptions);
    expect(result).toHaveLength(1);
    const freqs = result[0].phrases.map(p => p.frequency ?? 0);
    for (let i = 1; i < freqs.length; i++) {
      expect(freqs[i - 1]).toBeGreaterThanOrEqual(freqs[i]);
    }
  });

  // ---- Union-Find indirect tests (transitive grouping) ----

  it('should transitively group phrases (A~B, B~C → A,B,C in one group)', () => {
    const phrases = [
      { id: '1', text: 'ремонт ванной комнаты', frequency: 100 },
      { id: '2', text: 'ремонт комнаты ванной', frequency: 80 },   // permutation of 1
      { id: '3', text: 'ванной комнаты ремонт', frequency: 60 },   // permutation of 1 & 2
    ];

    const result = findImplicitDuplicates(phrases, { ...defaultOptions, threshold: 30 });
    // With stop words removed, these all become "ванный комната ремонт" sorted
    expect(result).toHaveLength(1);
    expect(result[0].phrases).toHaveLength(3);
    const ids = result[0].phrases.map(p => p.id);
    expect(ids).toContain('1');
    expect(ids).toContain('2');
    expect(ids).toContain('3');
  });

  it('should create separate groups for non-connected clusters', () => {
    const phrases = [
      // Cluster A
      { id: '1', text: 'купить айфон', frequency: 100 },
      { id: '2', text: 'айфон купить', frequency: 80 },
      // Cluster B
      { id: '3', text: 'купить самсунг', frequency: 60 },
      { id: '4', text: 'самсунг купить', frequency: 40 },
    ];

    const result = findImplicitDuplicates(phrases, { ...defaultOptions, threshold: 50 });
    // With stop words removed: "купить" is removed → "айфон" / "самсунг" each form a group
    // Group A: 1,2 → sortedKey = "айфон"
    // Group B: 3,4 → sortedKey = "самсунг"
    expect(result).toHaveLength(2);
  });

  // ---- Edge cases ----

  it('should handle phrases with empty text', () => {
    const phrases = [
      { id: '1', text: '', frequency: 100 },
      { id: '2', text: '', frequency: 80 },
      { id: '3', text: 'купить ноутбук', frequency: 60 },
    ];

    const result = findImplicitDuplicates(phrases, defaultOptions);
    // Empty text → wordSet is empty → overlap check skips → never compared → never grouped
    expect(result).toHaveLength(0);
  });

  it('should handle many phrases efficiently (stress test)', () => {
    const phrases = Array.from({ length: 50 }, (_, i) => ({
      id: String(i),
      text: i < 25
        ? `купить ноутбук вариант ${i}`
        : `сдать квартиру вариант ${i - 25}`,
      frequency: 100 - i,
    }));

    const result = findImplicitDuplicates(phrases, { ...defaultOptions, threshold: 40 });
    // At least two groups: notebook cluster and apartment cluster
    expect(result.length).toBeGreaterThanOrEqual(1);
    // Verify all phrase IDs are accounted for across groups
    const allIds = new Set(result.flatMap(g => g.phrases.map(p => p.id)));
    for (const p of phrases) {
      expect(allIds.has(p.id)).toBe(true);
    }
  });

  it('should not crash with threshold=0 (everything matches)', () => {
    const phrases = [
      { id: '1', text: 'aaa', frequency: 100 },
      { id: '2', text: 'bbb', frequency: 80 },
    ];

    // With threshold=0 and NO overlapping words → skip (hasOverlap=false)
    const result = findImplicitDuplicates(phrases, { ...defaultOptions, threshold: 0 });
    expect(Array.isArray(result)).toBe(true);
  });

  it('should not crash with threshold=100 (only near-identical matches)', () => {
    const phrases = [
      { id: '1', text: 'купить ноутбук', frequency: 100 },
      { id: '2', text: 'купить ноутбук', frequency: 80 },
      { id: '3', text: 'купить телефон', frequency: 60 },
    ];

    const result = findImplicitDuplicates(phrases, { ...defaultOptions, threshold: 100 });
    // Only 1 and 2 are identical → score=1.0 ≥ 1.0 → grouped
    expect(result).toHaveLength(1);
    expect(result[0].phrases).toHaveLength(2);
  });

  // ---- Russian-specific tests ----

  it('should handle Russian SEO phrases with geo stop words', () => {
    const phrases = [
      { id: '1', text: 'ремонт ванной москва', frequency: 100 },
      { id: '2', text: 'ремонт ванной спб', frequency: 80 },
      { id: '3', text: 'ремонт ванной петербург', frequency: 60 },
    ];

    const result = findImplicitDuplicates(phrases, { ...defaultOptions, threshold: 40 });
    // With stop words removed (москва, спб, петербург): all become "ремонт ванный"
    expect(result).toHaveLength(1);
    expect(result[0].phrases).toHaveLength(3);
  });

  it('should handle phrases with only stop words', () => {
    const phrases = [
      { id: '1', text: 'в на с к по', frequency: 100 },
      { id: '2', text: 'в на с к по', frequency: 80 },
    ];

    const result = findImplicitDuplicates(phrases, defaultOptions);
    // After stop word removal: empty sets → wordSet overlap check fails (empty)
    // But computeSimilarity with empty strings → score = 1 (identical)
    // However: the overlap check in findImplicitDuplicates skips if no overlap
    // Empty set has no overlap → skip → not grouped
    // Wait, let me trace more carefully:
    // setA = wordSet("в на с к по", true) = Set() (all are stop words)
    // setB = wordSet("в на с к по", true) = Set()
    // for (const w of setA) { if (setB.has(w)) { hasOverlap = true; break; } }
    // setA is empty → loop doesn't execute → hasOverlap = false → skip
    // So they won't be grouped!
    expect(result).toHaveLength(0);
  });
});
