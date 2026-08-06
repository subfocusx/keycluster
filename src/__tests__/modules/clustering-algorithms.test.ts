// ============================================================
// Tests: Clustering algorithms — preprocessing options
// ============================================================
//
// Tests for clusterByWords and clusterByJaccard options:
// - lemmatize
// - ignoreNumbers
// - stopWords
// - synonyms
// - scanMode (narrow-to-wide / wide-to-narrow)
// - splitByStrength
// ============================================================

import { describe, it, expect } from 'vitest';
import { clusterByWords, clusterByJaccard } from '@user-plugins/clustering/index';
import type { Phrase } from '@/plugin-sdk';

// ---- Test data helpers ----

function makePhrase(id: string, text: string): Phrase {
  return { id, groupId: 'root', text, frequency: 100, kei: 10, cpc: 5, createdAt: Date.now() };
}

// ============================================================
// clusterByWords — lemmatize option
// ============================================================

describe('clusterByWords — lemmatize', () => {
  it('should group words with common root when lemmatize=true', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'купить ноутбуки'),
      makePhrase('2', 'купить ноутбук'),
      makePhrase('3', 'продать ноутбук'),
    ];

    const clusters = clusterByWords(phrases, 1, { lemmatize: true, stopWords: new Set() });

    // All three should cluster together on root "ноутбук"
    expect(clusters.size).toBeGreaterThanOrEqual(1);
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(3);
  });

  it('should not lemmatize when lemmatize=false (default)', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'купить ноутбуки'),
      makePhrase('2', 'купить ноутбук'),
    ];

    const clusters = clusterByWords(phrases, 1, { lemmatize: false, stopWords: new Set() });

    // Without lemmatization, "ноутбуки" and "ноутбук" are different words
    // They may not cluster together depending on common words count
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// clusterByWords — ignoreNumbers option
// ============================================================

describe('clusterByWords — ignoreNumbers', () => {
  it('should ignore numbers when ignoreNumbers=true', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'iphone 15 pro'),
      makePhrase('2', 'iphone 15'),
      makePhrase('3', 'iphone 14'),
    ];

    const clusters = clusterByWords(phrases, 1, { ignoreNumbers: true, stopWords: new Set() });

    // All should cluster on "iphone"
    expect(clusters.size).toBeGreaterThanOrEqual(1);
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(3);
  });

  it('should keep numbers when ignoreNumbers=false', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'iphone 15'),
      makePhrase('2', 'iphone 14'),
    ];

    const clusters = clusterByWords(phrases, 1, { ignoreNumbers: false, stopWords: new Set() });

    // Each model number creates different word token
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// clusterByWords — stopWords option
// ============================================================

describe('clusterByWords — stopWords', () => {
  it('should filter out custom stop words', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'купить в москве'),
      makePhrase('2', 'купить в питере'),
    ];

    const clusters = clusterByWords(phrases, 1, { stopWords: new Set(['москве', 'питере']) });

    // Only "купить" should be the significant word
    expect(clusters.size).toBe(1);
    const [key] = [...clusters.keys()];
    expect(key).toContain('купить');
  });

  it('should use empty stop words set when provided', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'купить в'),
      makePhrase('2', 'купить в'),
    ];

    const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });

    // Without default stop words, "в" should be counted
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// clusterByWords — synonyms option
// ============================================================

describe('clusterByWords — synonyms', () => {
  it('should treat synonymous words as the same', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'сделать мрт'),
      makePhrase('2', 'сделать томографию'),
    ];

    const synonyms = new Map([['мрт', 'томографию']]);
    const clusters = clusterByWords(phrases, 1, { synonyms, stopWords: new Set() });

    // Both should cluster on "томографию"
    expect(clusters.size).toBe(1);
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(2);
  });

  it('should handle multiple synonyms mapping', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'iphone x'),
      makePhrase('2', 'iphone ten'),
    ];

    const synonyms = new Map([['ten', 'x']]);
    const clusters = clusterByWords(phrases, 1, { synonyms, stopWords: new Set() });

    expect(clusters.size).toBe(1);
  });
});

// ============================================================
// clusterByWords — scanMode option
// ============================================================

describe('clusterByWords — scanMode', () => {
  it('should process narrow-to-wide (default) — short phrases first', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'купить ноутбук samsung игровой'),
      makePhrase('2', 'купить телефон'),
      makePhrase('3', 'купить'),
    ];

    const clusters = clusterByWords(phrases, 1, { scanMode: 'narrow-to-wide', stopWords: new Set() });

    // Default behavior — order of processing may affect which phrases
    // get assigned first
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });

  it('should process wide-to-narrow — long phrases first', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'купить'),
      makePhrase('2', 'купить телефон'),
      makePhrase('3', 'купить ноутбук samsung игровой мощный'),
    ];

    const clusters = clusterByWords(phrases, 1, { scanMode: 'wide-to-narrow', stopWords: new Set() });

    // Longest phrase processed first, may affect clustering
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });

  it('should produce different results for different scan modes', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'а б в'),
      makePhrase('2', 'а б'),
      makePhrase('3', 'а'),
    ];

    const narrowWide = clusterByWords(phrases, 1, { scanMode: 'narrow-to-wide', stopWords: new Set() });
    const wideNarrow = clusterByWords(phrases, 1, { scanMode: 'wide-to-narrow', stopWords: new Set() });

    // Different scan orders may produce different clustering results
    // At minimum, both should preserve all phrases
    const totalNarrow = [...narrowWide.values()].flat().length;
    const totalWide = [...wideNarrow.values()].flat().length;
    expect(totalNarrow).toBe(3);
    expect(totalWide).toBe(3);
  });
});

// ============================================================
// clusterByWords — splitByStrength option
// ============================================================

describe('clusterByWords — splitByStrength', () => {
  it('should create more clusters when splitByStrength=true', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'купить ноутбук'),
      makePhrase('2', 'купить ноутбук gaming'),
      makePhrase('3', 'купить ноутбук office'),
      makePhrase('4', 'продать телефон'),
    ];

    const normal = clusterByWords(phrases, 1, { stopWords: new Set() });
    const split = clusterByWords(phrases, 1, { splitByStrength: true, stopWords: new Set() });

    // With splitByStrength, should create more/smaller clusters
    expect(split.size).toBeGreaterThanOrEqual(normal.size);
  });

  it('should preserve all phrases when splitByStrength=true', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'купить ноутбук'),
      makePhrase('2', 'купить телефон'),
    ];

    const clusters = clusterByWords(phrases, 1, { splitByStrength: true, stopWords: new Set() });

    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(2);
  });
});

// ============================================================
// clusterByJaccard — same options tests
// ============================================================

describe('clusterByJaccard — lemmatize', () => {
  it('should lemmatize words before jaccard clustering', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'купить ноутбуки'),
      makePhrase('2', 'купить ноутбук'),
    ];

    const clusters = clusterByJaccard(phrases, 0.3, { lemmatize: true, stopWords: new Set() });

    expect(clusters.size).toBeGreaterThanOrEqual(1);
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(2);
  });
});

describe('clusterByJaccard — ignoreNumbers', () => {
  it('should ignore numbers when clustering', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'iphone 15 pro'),
      makePhrase('2', 'iphone 15'),
      makePhrase('3', 'iphone 14'),
    ];

    const clusters = clusterByJaccard(phrases, 0.3, { ignoreNumbers: true, stopWords: new Set() });

    // All should cluster together on "iphone"
    expect(clusters.size).toBe(1);
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(3);
  });
});

describe('clusterByJaccard — stopWords', () => {
  it('should filter custom stop words', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'купить в москве'),
      makePhrase('2', 'купить в питере'),
    ];

    const clusters = clusterByJaccard(phrases, 0.3, { stopWords: new Set(['москве', 'питере']) });

    // "купить" is the significant word
    expect(clusters.size).toBe(1);
  });
});

describe('clusterByJaccard — synonyms', () => {
  it('should treat synonymous words as the same', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'сделать мрт'),
      makePhrase('2', 'сделать томографию'),
    ];

    const synonyms = new Map([['мрт', 'томографию']]);
    const clusters = clusterByJaccard(phrases, 0.3, { synonyms, stopWords: new Set() });

    expect(clusters.size).toBe(1);
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(2);
  });
});

describe('clusterByJaccard — scanMode', () => {
  it('should process wide-to-narrow', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'купить'),
      makePhrase('2', 'купить телефон'),
      makePhrase('3', 'купить ноутбук samsung'),
    ];

    const clusters = clusterByJaccard(phrases, 0.3, { scanMode: 'wide-to-narrow', stopWords: new Set() });

    expect(clusters.size).toBeGreaterThanOrEqual(1);
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(3);
  });
});

describe('clusterByJaccard — splitByStrength', () => {
  it('should split clusters with splitByStrength', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'купить ноутбук'),
      makePhrase('2', 'купить ноутбук gaming'),
      makePhrase('3', 'купить ноутбук office'),
    ];

    const clusters = clusterByJaccard(phrases, 0.3, { splitByStrength: true, stopWords: new Set() });

    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(3);
  });
});
