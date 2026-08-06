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
} from '@user-plugins/implicit-duplicates/similarity';

describe('implicit-duplicates similarity', () => {
  describe('normalize', () => {
    it('should lowercase text', () => {
      expect(normalize('Hello World')).toBe('hello world');
    });

    it('should trim whitespace', () => {
      expect(normalize('  hello  ')).toBe('hello');
    });

    it('should collapse multiple spaces', () => {
      expect(normalize('hello    world')).toBe('hello world');
    });
  });

  describe('tokenize', () => {
    it('should split by whitespace', () => {
      expect(tokenize('hello world')).toEqual(['hello', 'world']);
    });

    it('should filter empty tokens', () => {
      expect(tokenize('hello  world')).toEqual(['hello', 'world']);
    });
  });

  describe('removeStopWords', () => {
    it('should remove Russian stop words', () => {
      const tokens = ['купить', 'телефон', 'в', 'москве'];
      const result = removeStopWords(tokens);
      expect(result).not.toContain('в');
      expect(result).not.toContain('купить');
      expect(result).toContain('телефон');
      expect(result).toContain('москве');
    });

    it('should remove English stop words', () => {
      const tokens = ['buy', 'phone', 'in', 'moscow'];
      const result = removeStopWords(tokens);
      expect(result).not.toContain('buy');
      expect(result).not.toContain('in');
      expect(result).toContain('phone');
      expect(result).toContain('moscow');
    });
  });

  describe('wordSet', () => {
    it('should create set of words', () => {
      const result = wordSet('hello world hello', false);
      expect(result).toEqual(new Set(['hello', 'world']));
    });

    it('should ignore stop words when option is true', () => {
      const result = wordSet('купить телефон в москве', true);
      expect(result.has('в')).toBe(false);
      expect(result.has('телефон')).toBe(true);
    });
  });

  describe('sortedWords', () => {
    it('should return sorted words', () => {
      expect(sortedWords('c b a', false)).toEqual(['a', 'b', 'c']);
    });

    it('should remove stop words when option is true', () => {
      const result = sortedWords('b a the', true);
      expect(result).not.toContain('the');
      expect(result).not.toContain('a');
      expect(result).toContain('b');
    });
  });

  describe('sortedKey', () => {
    it('should return sorted words joined by space', () => {
      expect(sortedKey('c b a', false)).toBe('a b c');
    });
  });

  describe('jaccardSimilarity', () => {
    it('should return 1 for identical sets', () => {
      const setA = new Set(['a', 'b', 'c']);
      const setB = new Set(['a', 'b', 'c']);
      expect(jaccardSimilarity(setA, setB)).toBe(1);
    });

    it('should return 0 for completely different sets', () => {
      const setA = new Set(['a', 'b']);
      const setB = new Set(['c', 'd']);
      expect(jaccardSimilarity(setA, setB)).toBe(0);
    });

    it('should handle partial overlap', () => {
      const setA = new Set(['a', 'b', 'c']);
      const setB = new Set(['b', 'c', 'd']);
      expect(jaccardSimilarity(setA, setB)).toBe(0.5);
    });

    it('should return 1 for two empty sets', () => {
      expect(jaccardSimilarity(new Set(), new Set())).toBe(1);
    });

    it('should return 0 if one set is empty', () => {
      expect(jaccardSimilarity(new Set(['a']), new Set())).toBe(0);
    });
  });

  describe('ngrams', () => {
    it('should generate bigrams', () => {
      const result = ngrams('hello', 2);
      expect(result).toEqual(new Set(['he', 'el', 'll', 'lo']));
    });

    it('should handle text shorter than n', () => {
      const result = ngrams('hi', 3);
      expect(result).toEqual(new Set(['hi']));
    });

    it('should generate trigrams', () => {
      const result = ngrams('hello', 3);
      expect(result).toEqual(new Set(['hel', 'ell', 'llo']));
    });
  });

  describe('diceCoefficient', () => {
    it('should return 1 for identical strings', () => {
      expect(diceCoefficient('hello', 'hello')).toBe(1);
    });

    it('should return 0 for completely different strings', () => {
      expect(diceCoefficient('abc', 'def')).toBe(0);
    });

    it('should handle partial similarity', () => {
      const result = diceCoefficient('test', 'tent');
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1);
    });

    it('should return 1 for two empty strings', () => {
      expect(diceCoefficient('', '')).toBe(1);
    });
  });

  describe('levenshteinDistance', () => {
    it('should return 0 for identical strings', () => {
      expect(levenshteinDistance('hello', 'hello')).toBe(0);
    });

    it('should count character substitutions', () => {
      expect(levenshteinDistance('hello', 'hallo')).toBe(1);
    });

    it('should count insertions', () => {
      expect(levenshteinDistance('hello', 'helloo')).toBe(1);
    });

    it('should count deletions', () => {
      expect(levenshteinDistance('hello', 'hell')).toBe(1);
    });

    it('should return string length for empty target', () => {
      expect(levenshteinDistance('hello', '')).toBe(5);
    });

    it('should return string length for empty source', () => {
      expect(levenshteinDistance('', 'hello')).toBe(5);
    });
  });

  describe('normalizedLevenshtein', () => {
    it('should return 1 for identical strings', () => {
      expect(normalizedLevenshtein('hello', 'hello')).toBe(1);
    });

    it('should return 0 for completely different strings', () => {
      expect(normalizedLevenshtein('abc', 'def')).toBe(0);
    });

    it('should return 1 for two empty strings', () => {
      expect(normalizedLevenshtein('', '')).toBe(1);
    });
  });

  describe('computeSimilarity', () => {
    it('should return high score for identical phrases', () => {
      const result = computeSimilarity('купить телефон', 'купить телефон');
      expect(result.score).toBeGreaterThan(0.9);
    });

    it('should return high score for permutation', () => {
      const result = computeSimilarity('купить телефон', 'телефон купить');
      expect(result.score).toBeGreaterThan(0.7);
    });

    it('should return lower score for different phrases', () => {
      const result = computeSimilarity('купить телефон', 'аренда квартиры');
      expect(result.score).toBeLessThan(0.3);
    });

    it('should include details in result', () => {
      const result = computeSimilarity('test', 'test');
      expect(result.details).toHaveProperty('jaccard');
      expect(result.details).toHaveProperty('dice');
      expect(result.details).toHaveProperty('levenshtein');
      expect(result.details).toHaveProperty('permutationMatch');
    });

    it('should consider word order when compareWordOrder is true', () => {
      const withOrder = computeSimilarity('купить телефон', 'телефон купить', { compareWordOrder: true });
      const withoutOrder = computeSimilarity('купить телефон', 'телефон купить', { compareWordOrder: false });
      expect(withOrder.details.permutationMatch).toBe(false);
      expect(withoutOrder.details.permutationMatch).toBe(true);
    });

    it('should handle typos with levenshtein', () => {
      const result = computeSimilarity('дизайн интерьера', 'дизайн интерера');
      expect(result.details.levenshtein).toBeGreaterThan(0.8);
    });
  });
});
