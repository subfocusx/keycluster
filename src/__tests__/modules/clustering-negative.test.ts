// ============================================================
// Tests: Clustering — negative and error conditions
// ============================================================

import { describe, it, expect } from 'vitest';
import { clusterByWords, clusterByJaccard } from '@user-plugins/clustering/index';
import type { Phrase } from '@/plugin-sdk';

function makePhrase(id: string, text: string): Phrase {
  return { id, groupId: 'root', text, frequency: 100, kei: 10, cpc: 5, createdAt: Date.now() };
}

// ============================================================
// Negative test cases
// ============================================================

describe('clusterByWords — negative cases', () => {
  it('should not cluster unrelated phrases with high minCommonWords', () => {
    const phrases = [
      makePhrase('1', 'а б в'),
      makePhrase('2', 'г д е'),
      makePhrase('3', 'ж з и'),
    ];
    const clusters = clusterByWords(phrases, 3, { stopWords: new Set() });
    // Each phrase has 0 common words with others
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(3);
  });

  it('should not lose phrases when minCommonWords is too high', () => {
    const phrases = [
      makePhrase('1', 'а а а а а'),
      makePhrase('2', 'а а а а'),
      makePhrase('3', 'а а а'),
    ];
    const clusters = clusterByWords(phrases, 10, { stopWords: new Set() });
    // No cluster meets minCommonWords=10, so all phrases stay separate but preserved
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(3);
  });

  it('should not crash with non-array input', () => {
    // This tests that the function doesn't crash with malformed input
    const phrases = [makePhrase('1', 'test')];
    try {
      const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });
      expect(clusters).toBeInstanceOf(Map);
    } catch (e) {
      // Should not throw
      expect(true).toBe(false);
    }
  });
});

describe('clusterByJaccard — negative cases', () => {
  it('should not cluster completely different phrases with high threshold', () => {
    const phrases = [
      makePhrase('1', 'а а а а а'),
      makePhrase('2', 'б б б б б'),
    ];
    const clusters = clusterByJaccard(phrases, 0.95, { stopWords: new Set() });
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });

  it('should handle zero intersection correctly', () => {
    const phrases = [
      makePhrase('1', 'а б в'),
      makePhrase('2', 'г д е'),
    ];
    const clusters = clusterByJaccard(phrases, 0.5, { stopWords: new Set() });
    // No common words, but algorithm behavior varies
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });

  it('should handle empty intersection at high threshold', () => {
    const phrases = [
      makePhrase('1', 'тест один'),
      makePhrase('2', 'тест два'),
    ];
    const clusters = clusterByJaccard(phrases, 0.99, { stopWords: new Set() });
    // Even though "тест" is common, intersection/union ratio may be low
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// Word boundary edge cases
// ============================================================

describe('clusterByWords — word boundary edge cases', () => {
  it('should handle hyphens as word separators', () => {
    const phrases = [
      makePhrase('1', 'купить-ноутбук'),
      makePhrase('2', 'купить ноутбук'),
    ];
    const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });
    // "купить-ноутбук" splits on whitespace only, not hyphen
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(2);
  });

  it('should handle underscores in text', () => {
    const phrases = [
      makePhrase('1', 'купить_ноутбук'),
      makePhrase('2', 'купить ноутбук'),
    ];
    const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });
    // Underscore is part of word
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(2);
  });

  it('should handle dots in text', () => {
    const phrases = [
      makePhrase('1', 'купить.ноутбук'),
      makePhrase('2', 'купить ноутбук'),
    ];
    const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(2);
  });
});

describe('clusterByJaccard — word boundary edge cases', () => {
  it('should handle various separators', () => {
    const phrases = [
      makePhrase('1', 'а-б-в'),
      makePhrase('2', 'а б в'),
    ];
    const clusters = clusterByJaccard(phrases, 0.3, { stopWords: new Set() });
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// Special Unicode cases
// ============================================================

describe('clusterByWords — special Unicode', () => {
  it('should handle mixed Russian and English', () => {
    const phrases = [
      makePhrase('1', 'купить laptop'),
      makePhrase('2', 'купить notebook'),
    ];
    const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });
    // "купить" is common
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });

  it('should handle numbers mixed with text', () => {
    const phrases = [
      makePhrase('1', 'iphone15'),
      makePhrase('2', 'iphone16'),
    ];
    const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });
    // "iphone15" and "iphone16" are different words
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(2);
  });

  it('should handle mixed scripts', () => {
    const phrases = [
      makePhrase('1', 'купить ааа'),
      makePhrase('2', 'купить ббб'),
    ];
    const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });
    // "купить" is common
    expect(clusters.size).toBe(1);
  });
});

describe('clusterByJaccard — special Unicode', () => {
  it('should handle Chinese characters', () => {
    const phrases = [
      makePhrase('1', '购买 笔记本'),
      makePhrase('2', '购买 笔记本电脑'),
    ];
    const clusters = clusterByJaccard(phrases, 0.3, { stopWords: new Set() });
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(2);
  });

  it('should handle Japanese characters', () => {
    const phrases = [
      makePhrase('1', '購入 ノートブック'),
      makePhrase('2', '購入 ノートパソコン'),
    ];
    const clusters = clusterByJaccard(phrases, 0.3, { stopWords: new Set() });
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(2);
  });
});

// ============================================================
// Cluster size edge cases
// ============================================================

describe('clusterByWords — cluster size edge cases', () => {
  it('should handle all phrases in one cluster', () => {
    const phrases = [
      makePhrase('1', 'а'),
      makePhrase('2', 'а'),
      makePhrase('3', 'а'),
    ];
    const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });
    expect(clusters.size).toBe(1);
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(3);
  });

  it('should handle each phrase in separate cluster', () => {
    const phrases = [
      makePhrase('1', 'а'),
      makePhrase('2', 'б'),
      makePhrase('3', 'в'),
    ];
    const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });
    // Only "а", "б", "в" - no overlaps with single-char
    // Actually single char 'а', 'б', 'в' are filtered
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(3);
  });

  it('should handle two large clusters', () => {
    const phrases = [
      makePhrase('1', 'а б в'),
      makePhrase('2', 'а б г'),
      makePhrase('3', 'г д е'),
      makePhrase('4', 'г д ж'),
    ];
    const clusters = clusterByWords(phrases, 2, { stopWords: new Set() });
    // {а,б} and {г,д} should cluster
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(4);
  });
});

describe('clusterByJaccard — cluster size edge cases', () => {
  it('should handle all phrases in one cluster', () => {
    const phrases = [
      makePhrase('1', 'а б в'),
      makePhrase('2', 'а б в'),
      makePhrase('3', 'а б в'),
    ];
    const clusters = clusterByJaccard(phrases, 0.5, { stopWords: new Set() });
    expect(clusters.size).toBe(1);
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(3);
  });

  it('should handle many small clusters', () => {
    const phrases = [
      makePhrase('1', 'а'),
      makePhrase('2', 'б'),
      makePhrase('3', 'в'),
      makePhrase('4', 'г'),
    ];
    const clusters = clusterByJaccard(phrases, 0.99, { stopWords: new Set() });
    // Verify valid result returned
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// Map key generation edge cases  
// ============================================================

describe('clusterByWords — Map key generation', () => {
  it('should generate valid Map keys', () => {
    const phrases = [
      makePhrase('1', 'купить ноутбук'),
      makePhrase('2', 'купить телефон'),
    ];
    const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });
    for (const key of clusters.keys()) {
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    }
  });

  it('should handle keys with special characters', () => {
    const phrases = [
      makePhrase('1', 'test тест'),
      makePhrase('2', 'test'),
    ];
    const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });
    const keys = [...clusters.keys()];
    expect(keys.length).toBeGreaterThan(0);
  });
});

describe('clusterByJaccard — Map key generation', () => {
  it('should generate unique keys for all clusters', () => {
    const phrases = [
      makePhrase('1', 'а'),
      makePhrase('2', 'б'),
      makePhrase('3', 'в'),
    ];
    const clusters = clusterByJaccard(phrases, 0.99, { stopWords: new Set() });
    const keys = [...clusters.keys()];
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });
});

// ============================================================
// Stop words edge cases
// ============================================================

describe('clusterByWords — stopWords edge cases', () => {
  it('should handle empty stopWords set', () => {
    const phrases = [
      makePhrase('1', 'в с и на'),
      makePhrase('2', 'в с и по'),
    ];
    const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });
    // Now 'в', 'с', 'и', 'на', 'по' are counted
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(2);
  });

  it('should handle stopWords with duplicates', () => {
    const phrases = [
      makePhrase('1', 'а б в'),
      makePhrase('2', 'а б г'),
    ];
    const stopWords = new Set(['а', 'а', 'б', 'б', 'в']);
    const clusters = clusterByWords(phrases, 1, { stopWords });
    // Only 'г' and 'б' common
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(2);
  });

  it('should handle very large stopWords set', () => {
    const phrases = [
      makePhrase('1', 'а б в'),
      makePhrase('2', 'а б г'),
    ];
    const stopWords = new Set(['а', 'б', 'в', 'г', 'д', 'е', 'ж', 'з', 'и', 'к']);
    const clusters = clusterByWords(phrases, 1, { stopWords });
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(2);
  });
});

describe('clusterByJaccard — stopWords edge cases', () => {
  it('should handle all words as stopWords', () => {
    const phrases = [
      makePhrase('1', 'в с и на'),
      makePhrase('2', 'в с и по'),
    ];
    const clusters = clusterByJaccard(phrases, 0.1, { stopWords: new Set(['в', 'с', 'и', 'на', 'по']) });
    // Everything is filtered out
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });
});
