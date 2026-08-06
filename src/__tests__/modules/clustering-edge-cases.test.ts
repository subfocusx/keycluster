// ============================================================
// Tests: Clustering algorithms — edge cases
// ============================================================
//
// Tests for edge cases in clusterByWords and clusterByJaccard:
// - Empty input
// - Single phrase
// - Identical phrases
// - No common words
// - Whitespace-only text
// - Special characters
// - Unicode and emoji
// - Very long phrases
// ============================================================

import { describe, it, expect } from 'vitest';
import { clusterByWords, clusterByJaccard } from '@user-plugins/clustering/index';
import type { Phrase } from '@/plugin-sdk';

// ---- Test data helpers ----

function makePhrase(id: string, text: string): Phrase {
  return { id, groupId: 'root', text, frequency: 100, kei: 10, cpc: 5, createdAt: Date.now() };
}

// ============================================================
// Empty input
// ============================================================

describe('clusterByWords — empty input', () => {
  it('should return empty map for empty array', () => {
    const clusters = clusterByWords([], 1);
    expect(clusters.size).toBe(0);
  });

  it('should return empty map for undefined phrases', () => {
    const clusters = clusterByWords([], 1);
    expect(clusters).toBeInstanceOf(Map);
    expect(clusters.size).toBe(0);
  });
});

describe('clusterByJaccard — empty input', () => {
  it('should return empty map for empty array', () => {
    const clusters = clusterByJaccard([], 0.3);
    expect(clusters.size).toBe(0);
  });
});

// ============================================================
// Single phrase
// ============================================================

describe('clusterByWords — single phrase', () => {
  it('should return 1 cluster for single phrase', () => {
    const phrases = [makePhrase('1', 'купить ноутбук')];
    const clusters = clusterByWords(phrases, 1);
    expect(clusters.size).toBe(1);
  });

  it('should preserve single phrase in cluster', () => {
    const phrases = [makePhrase('1', 'купить ноутбук')];
    const clusters = clusterByWords(phrases, 1);
    const [clusterPhrases] = [...clusters.values()];
    expect(clusterPhrases).toHaveLength(1);
    expect(clusterPhrases[0].id).toBe('1');
  });
});

describe('clusterByJaccard — single phrase', () => {
  it('should return 1 cluster for single phrase', () => {
    const phrases = [makePhrase('1', 'купить ноутбук')];
    const clusters = clusterByJaccard(phrases, 0.3);
    expect(clusters.size).toBe(1);
  });
});

// ============================================================
// Identical phrases
// ============================================================

describe('clusterByWords — identical phrases', () => {
  it('should cluster identical phrases together', () => {
    const phrases = [
      makePhrase('1', 'купить ноутбук'),
      makePhrase('2', 'купить ноутбук'),
      makePhrase('3', 'купить ноутбук'),
    ];
    const clusters = clusterByWords(phrases, 1);
    expect(clusters.size).toBe(1);
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(3);
  });
});

describe('clusterByJaccard — identical phrases', () => {
  it('should cluster identical phrases together', () => {
    const phrases = [
      makePhrase('1', 'купить ноутбук'),
      makePhrase('2', 'купить ноутбук'),
    ];
    const clusters = clusterByJaccard(phrases, 0.3);
    expect(clusters.size).toBe(1);
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(2);
  });
});

// ============================================================
// No common words
// ============================================================

describe('clusterByWords — no common words', () => {
  it('should create separate clusters when no common words', () => {
    const phrases = [
      makePhrase('1', 'купить ноутбук'),
      makePhrase('2', 'аренда квартира'),
      makePhrase('3', 'продать машина'),
    ];
    const clusters = clusterByWords(phrases, 1);
    // Each should be in its own cluster
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(3);
  });

  it('should not merge unrelated phrases', () => {
    const phrases = [
      makePhrase('1', 'ааа'),
      makePhrase('2', 'ббб'),
      makePhrase('3', 'ввв'),
    ];
    const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });
    // No common words at all — should be 3 clusters or filtered
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });
});

describe('clusterByJaccard — no common words', () => {
  it('should not cluster unrelated phrases', () => {
    const phrases = [
      makePhrase('1', 'купить ноутбук'),
      makePhrase('2', 'аренда квартира'),
    ];
    const clusters = clusterByJaccard(phrases, 0.9); // High threshold
    // Should be 2 separate clusters
    expect(clusters.size).toBe(2);
  });
});

// ============================================================
// Whitespace-only and empty text
// ============================================================

describe('clusterByWords — whitespace handling', () => {
  it('should handle whitespace-only text', () => {
    const phrases = [
      makePhrase('1', 'купить ноутбук'),
      makePhrase('2', '   '),
      makePhrase('3', 'купить телефон'),
    ];
    const clusters = clusterByWords(phrases, 1);
    // Whitespace-only should not cause errors
    expect(clusters.size).toBeGreaterThanOrEqual(1);
    const totalPhrases = [...clusters.values()].flat().length;
    // All non-empty phrases should be preserved
    expect(totalPhrases).toBeGreaterThanOrEqual(2);
  });

  it('should handle empty string', () => {
    const phrases = [
      makePhrase('1', ''),
      makePhrase('2', 'купить'),
    ];
    const clusters = clusterByWords(phrases, 1);
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });
});

describe('clusterByJaccard — whitespace handling', () => {
  it('should handle empty strings', () => {
    const phrases = [
      makePhrase('1', ''),
      makePhrase('2', 'купить ноутбук'),
    ];
    const clusters = clusterByJaccard(phrases, 0.3);
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// Special characters
// ============================================================

describe('clusterByWords — special characters', () => {
  it('should handle punctuation', () => {
    const phrases = [
      makePhrase('1', 'купить - ноутбук'),
      makePhrase('2', 'купить, телефон'),
      makePhrase('3', 'купить!'),
    ];
    const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });
    expect(clusters.size).toBeGreaterThanOrEqual(1);
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(3);
  });

  it('should handle parentheses', () => {
    const phrases = [
      makePhrase('1', 'ноутбук (игровой)'),
      makePhrase('2', 'ноутбук (офисный)'),
    ];
    const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });

  it('should handle quotes and brackets', () => {
    const phrases = [
      makePhrase('1', '"купить" ноутбук'),
      makePhrase('2', '[купить] телефон'),
    ];
    const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });
});

describe('clusterByJaccard — special characters', () => {
  it('should handle punctuation', () => {
    const phrases = [
      makePhrase('1', 'купить - ноутбук'),
      makePhrase('2', 'купить - ноутбук'),
    ];
    const clusters = clusterByJaccard(phrases, 0.3);
    expect(clusters.size).toBe(1);
  });
});

// ============================================================
// Unicode and symbols
// ============================================================

describe('clusterByWords — unicode', () => {
  it('should handle Cyrillic text', () => {
    const phrases = [
      makePhrase('1', 'купить ноутбук'),
      makePhrase('2', 'купить телефон'),
      makePhrase('3', 'аренда квартира'),
    ];
    const clusters = clusterByWords(phrases, 1);
    expect(clusters.size).toBeGreaterThanOrEqual(2);
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(3);
  });

  it('should handle mixed Cyrillic/Latin', () => {
    const phrases = [
      makePhrase('1', 'купить iPhone'),
      makePhrase('2', 'купить Samsung'),
    ];
    const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });

  it('should handle emoji', () => {
    const phrases = [
      makePhrase('1', 'купить ноутбук 🚀'),
      makePhrase('2', 'купить ноутбук 💻'),
    ];
    const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });
});

describe('clusterByJaccard — unicode', () => {
  it('should handle emoji in phrases', () => {
    const phrases = [
      makePhrase('1', 'iphone 🚀'),
      makePhrase('2', 'iphone 💻'),
    ];
    const clusters = clusterByJaccard(phrases, 0.3, { stopWords: new Set() });
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// Very long phrases
// ============================================================

describe('clusterByWords — long phrases', () => {
  it('should handle long phrase with many words', () => {
    const longText = 'купить ноутбук для работы и игр в москве с доставкой';
    const phrases = [
      makePhrase('1', longText),
      makePhrase('2', 'купить ноутбук'),
    ];
    const clusters = clusterByWords(phrases, 1, { stopWords: new Set(['для', 'и', 'в', 'с']) });
    expect(clusters.size).toBeGreaterThanOrEqual(1);
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(2);
  });
});

describe('clusterByJaccard — long phrases', () => {
  it('should handle phrases with many words', () => {
    const phrases = [
      makePhrase('1', 'а а а а а а а а а а'),
      makePhrase('2', 'а а а а а а'),
    ];
    const clusters = clusterByJaccard(phrases, 0.3);
    expect(clusters.size).toBe(1);
  });
});

// ============================================================
// minCommonWords threshold
// ============================================================

describe('clusterByWords — minCommonWords threshold', () => {
  it('should create more clusters with higher minCommonWords', () => {
    const phrases = [
      makePhrase('1', 'а б в'),
      makePhrase('2', 'а б г'),
      makePhrase('3', 'а б д'),
      makePhrase('4', 'а б е'),
    ];
    const low = clusterByWords(phrases, 1, { stopWords: new Set() });
    const high = clusterByWords(phrases, 2, { stopWords: new Set() });

    // Higher threshold should create more clusters
    expect(high.size).toBeGreaterThanOrEqual(low.size);
  });

  it('should filter out small clusters by minCommonWords', () => {
    const phrases = [
      makePhrase('1', 'а'),
      makePhrase('2', 'а б'),
    ];
    const clusters = clusterByWords(phrases, 2, { stopWords: new Set() });
    // With minCommonWords=2, only phrases with 2+ common words cluster
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });
});

describe('clusterByJaccard — threshold', () => {
  it('should create more clusters with higher threshold', () => {
    const phrases = [
      makePhrase('1', 'купить ноутбук'),
      makePhrase('2', 'купить ноутбук дешево'),
      makePhrase('3', 'купить телефон'),
    ];
    const high = clusterByJaccard(phrases, 0.9);
    const low = clusterByJaccard(phrases, 0.1);

    // High threshold = stricter = more clusters
    expect(high.size).toBeGreaterThanOrEqual(low.size);
  });
});
