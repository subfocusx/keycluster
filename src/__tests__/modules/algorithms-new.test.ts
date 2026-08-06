// ============================================================
// Tests: New algorithms — N-grams, TF-IDF, preprocessing
// ============================================================

import { describe, it, expect } from 'vitest';
import { clusterByNgrams } from '@user-plugins/ngrams/index';
import { clusterByTFIDF } from '@user-plugins/tfidf/index';
import { clusterByWords, clusterByJaccard } from '@user-plugins/clustering/index';
import { groupByWords } from '@user-plugins/group-analysis/index';
import { simpleLemmatize, preprocessPhrase, DEFAULT_STOP_WORDS } from '@/plugin-sdk';
import type { Phrase } from '@/core/types';

// Helper: create Phrase objects quickly
const P = (id: string, text: string): Phrase => ({
  id, groupId: 'root', text, frequency: 100, kei: 10, cpc: 5, createdAt: Date.now(),
});

// ============================================================
// N-grams algorithm
// ============================================================

describe('clusterByNgrams', () => {
  it('should cluster phrases sharing bigrams', () => {
    const phrases = [
      P('1', 'купить красные туфли'),
      P('2', 'купить красные ботинки'),
      P('3', 'аренда квартиры москва'),
    ];

    // "купить красные" is a shared bigram between 1 and 2
    const clusters = clusterByNgrams(phrases, { ngramSize: 2, threshold: 0.3, minGroupSize: 2 });
    expect(clusters.size).toBeGreaterThanOrEqual(1);

    // Find cluster containing phrase 1 and 2
    let found = false;
    for (const [, cps] of clusters) {
      if (cps.some(p => p.id === '1') && cps.some(p => p.id === '2')) {
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it('should separate phrases without shared n-grams', () => {
    const phrases = [
      P('1', 'купить ноутбук'),
      P('2', 'аренда квартиры'),
    ];

    // No shared bigrams → separate clusters
    const clusters = clusterByNgrams(phrases, { ngramSize: 2, threshold: 0.3, minGroupSize: 1 });
    expect(clusters.size).toBeGreaterThanOrEqual(2);
  });

  it('should respect ngramSize parameter', () => {
    const phrases = [
      P('1', 'купить красные туфли москва'),
      P('2', 'купить красные ботинки москва'),
    ];

    // With bigrams (2): many shared → 1 cluster
    const bigram = clusterByNgrams(phrases, { ngramSize: 2, threshold: 0.2, minGroupSize: 1 });
    // With trigrams (3): fewer shared → might not cluster
    const trigram = clusterByNgrams(phrases, { ngramSize: 3, threshold: 0.2, minGroupSize: 1 });

    // Bigram should cluster more aggressively than trigram
    expect(bigram.size).toBeLessThanOrEqual(trigram.size);
  });

  it('should respect threshold parameter', () => {
    const phrases = [
      P('1', 'купить красные туфли'),
      P('2', 'купить синие туфли'),
      P('3', 'аренда квартиры москва'),
    ];

    const lowThreshold = clusterByNgrams(phrases, { ngramSize: 2, threshold: 0.1, minGroupSize: 1 });
    const highThreshold = clusterByNgrams(phrases, { ngramSize: 2, threshold: 0.9, minGroupSize: 1 });

    // Lower threshold → fewer clusters (more things grouped together)
    expect(lowThreshold.size).toBeLessThanOrEqual(highThreshold.size);
  });

  it('should filter by minGroupSize', () => {
    const phrases = [
      P('1', 'купить ноутбук'),
      P('2', 'аренда квартиры'),
    ];

    const clusters = clusterByNgrams(phrases, { ngramSize: 2, threshold: 0.1, minGroupSize: 2 });
    // Single-phrase clusters should be filtered out
    for (const [, cps] of clusters) {
      expect(cps.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('should return empty map for empty input', () => {
    const clusters = clusterByNgrams([], { ngramSize: 2 });
    expect(clusters.size).toBe(0);
  });

  it('should handle ignoreNumbers option', () => {
    const phrases = [
      P('1', 'iphone 15 купить'),
      P('2', 'iphone 16 купить'),
      P('3', 'аренда квартиры'),
    ];

    // Without ignoring numbers: "15" ≠ "16" → less overlap
    const without = clusterByNgrams(phrases, { ngramSize: 2, threshold: 0.2, minGroupSize: 1, ignoreNumbers: false });
    // With ignoring numbers: both become "iphone купить" → more overlap
    const withIgnore = clusterByNgrams(phrases, { ngramSize: 2, threshold: 0.2, minGroupSize: 1, ignoreNumbers: true });

    // Ignoring numbers should cluster iphone phrases together
    let iphoneTogether = false;
    for (const [, cps] of withIgnore) {
      if (cps.some(p => p.id === '1') && cps.some(p => p.id === '2')) {
        iphoneTogether = true;
      }
    }
    expect(iphoneTogether).toBe(true);
  });

  it('should handle lemmatize option', () => {
    const phrases = [
      P('1', 'купить телефоны'),
      P('2', 'купить телефон'),
    ];

    // Without lemmatize: "телефоны" ≠ "телефон" → less overlap
    const without = clusterByNgrams(phrases, { ngramSize: 2, threshold: 0.3, minGroupSize: 1, lemmatize: false });
    // With lemmatize: both become "телефон" → more overlap
    const withLemma = clusterByNgrams(phrases, { ngramSize: 2, threshold: 0.3, minGroupSize: 1, lemmatize: true });

    // With lemmatization, they should cluster together
    let together = false;
    for (const [, cps] of withLemma) {
      if (cps.some(p => p.id === '1') && cps.some(p => p.id === '2')) {
        together = true;
      }
    }
    expect(together).toBe(true);
  });

  it('should handle custom stopWords', () => {
    const phrases = [
      P('1', 'купить москва ноутбук'),
      P('2', 'купить питер ноутбук'),
    ];

    // With "москва" and "питер" as stop-words, both phrases become "купить ноутбук"
    const clusters = clusterByNgrams(phrases, {
      ngramSize: 2, threshold: 0.3, minGroupSize: 1,
      stopWords: ['москва', 'питер'],
    });

    let together = false;
    for (const [, cps] of clusters) {
      if (cps.some(p => p.id === '1') && cps.some(p => p.id === '2')) {
        together = true;
      }
    }
    expect(together).toBe(true);
  });

  it('should handle short phrases shorter than ngramSize', () => {
    const phrases = [
      P('1', 'ноутбук'),      // 1 word — shorter than bigram
      P('2', 'ноутбук'),      // same single word
    ];

    // Should still handle gracefully (uses whole phrase as n-gram)
    const clusters = clusterByNgrams(phrases, { ngramSize: 2, threshold: 0.3, minGroupSize: 1 });
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// TF-IDF algorithm
// ============================================================

describe('clusterByTFIDF', () => {
  it('should cluster similar phrases', () => {
    const phrases = [
      P('1', 'купить ноутбук москва'),
      P('2', 'купить ноутбук дешево'),
      P('3', 'аренда квартиры питер'),
    ];

    const clusters = clusterByTFIDF(phrases, { threshold: 0.3, minGroupSize: 1 });
    expect(clusters.size).toBeGreaterThanOrEqual(1);

    // Phrases 1 and 2 should be together (share "купить" and "ноутбук")
    let together = false;
    for (const [, cps] of clusters) {
      if (cps.some(p => p.id === '1') && cps.some(p => p.id === '2')) {
        together = true;
      }
    }
    expect(together).toBe(true);
  });

  it('should separate very different phrases', () => {
    const phrases = [
      P('1', 'купить ноутбук'),
      P('2', 'ремонт квартир'),
    ];

    const clusters = clusterByTFIDF(phrases, { threshold: 0.5, minGroupSize: 1 });
    // These are completely different → separate clusters
    expect(clusters.size).toBeGreaterThanOrEqual(2);
  });

  it('should respect threshold parameter', () => {
    const phrases = [
      P('1', 'купить ноутбук москва'),
      P('2', 'ноутбук для работы'),
      P('3', 'аренда авто'),
    ];

    const lowThreshold = clusterByTFIDF(phrases, { threshold: 0.1, minGroupSize: 1 });
    const highThreshold = clusterByTFIDF(phrases, { threshold: 0.9, minGroupSize: 1 });

    // Lower threshold → fewer clusters (more things grouped together)
    expect(lowThreshold.size).toBeLessThanOrEqual(highThreshold.size);
  });

  it('should filter by minGroupSize', () => {
    const phrases = [
      P('1', 'купить ноутбук'),
      P('2', 'ремонт квартир'),
    ];

    const clusters = clusterByTFIDF(phrases, { threshold: 0.1, minGroupSize: 2 });
    for (const [, cps] of clusters) {
      expect(cps.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('should return empty map for empty input', () => {
    const clusters = clusterByTFIDF([], { threshold: 0.3 });
    expect(clusters.size).toBe(0);
  });

  it('should weight rare words higher than common words', () => {
    // "смартфон" appears once → high IDF → high weight
    // "купить" appears in all phrases → low IDF → low weight
    const phrases = [
      P('1', 'купить смартфон'),
      P('2', 'купить смартфон дешево'),
      P('3', 'купить квартиру'),
    ];

    const clusters = clusterByTFIDF(phrases, { threshold: 0.3, minGroupSize: 1 });

    // Phrases 1 and 2 share the rare word "смартфон" → should cluster together
    let together = false;
    for (const [, cps] of clusters) {
      if (cps.some(p => p.id === '1') && cps.some(p => p.id === '2')) {
        together = true;
      }
    }
    expect(together).toBe(true);
  });

  it('should handle ignoreNumbers', () => {
    const phrases = [
      P('1', 'iphone 15 pro'),
      P('2', 'iphone 16 pro'),
      P('3', 'аренда квартир'),
    ];

    const clusters = clusterByTFIDF(phrases, { threshold: 0.3, minGroupSize: 1, ignoreNumbers: true });

    let iphoneTogether = false;
    for (const [, cps] of clusters) {
      if (cps.some(p => p.id === '1') && cps.some(p => p.id === '2')) {
        iphoneTogether = true;
      }
    }
    expect(iphoneTogether).toBe(true);
  });

  it('should handle lemmatize option', () => {
    const phrases = [
      P('1', 'купить телефоны дешево'),
      P('2', 'купить телефон недорого'),
    ];

    const clusters = clusterByTFIDF(phrases, { threshold: 0.3, minGroupSize: 1, lemmatize: true });

    let together = false;
    for (const [, cps] of clusters) {
      if (cps.some(p => p.id === '1') && cps.some(p => p.id === '2')) {
        together = true;
      }
    }
    expect(together).toBe(true);
  });

  it('should handle custom stopWords', () => {
    const phrases = [
      P('1', 'ноутбук москва купить'),
      P('2', 'ноутбук питер купить'),
    ];

    const clusters = clusterByTFIDF(phrases, {
      threshold: 0.3, minGroupSize: 1,
      stopWords: ['москва', 'питер'],
    });

    let together = false;
    for (const [, cps] of clusters) {
      if (cps.some(p => p.id === '1') && cps.some(p => p.id === '2')) {
        together = true;
      }
    }
    expect(together).toBe(true);
  });

  it('should preserve all phrases across clusters', () => {
    const phrases = [
      P('1', 'купить ноутбук'),
      P('2', 'купить телефон'),
      P('3', 'аренда квартиры'),
      P('4', 'сдать квартиру'),
    ];

    const clusters = clusterByTFIDF(phrases, { threshold: 0.2, minGroupSize: 1 });

    let total = 0;
    for (const [, cps] of clusters) total += cps.length;
    expect(total).toBe(phrases.length);
  });

  it('should generate unique cluster keys', () => {
    const phrases = [
      P('1', 'купить а'),
      P('2', 'купить б'),
      P('3', 'продать в'),
      P('4', 'продать г'),
    ];

    const clusters = clusterByTFIDF(phrases, { threshold: 0.3, minGroupSize: 1 });
    const keys = [...clusters.keys()];
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });
});

// ============================================================
// Text Preprocessing: Lemmatization
// ============================================================

describe('simpleLemmatize', () => {
  it('should return short words unchanged', () => {
    expect(simpleLemmatize('в')).toBe('в');
    expect(simpleLemmatize('на')).toBe('на');
    expect(simpleLemmatize('и')).toBe('и');
  });

  it('should lowercase input', () => {
    const result = simpleLemmatize('Ноутбук');
    expect(result).toBe(result.toLowerCase());
  });

  it('should strip plural endings', () => {
    // Common Russian plural patterns
    const result1 = simpleLemmatize('телефоны');
    // Should strip "ы" ending → "телефон"
    expect(result1).toBe('телефон');
  });

  it('should handle adjective endings', () => {
    const result = simpleLemmatize('красные');
    // Should change "ые" → "ый"
    expect(result).toBe('красный');
  });

  it('should handle verb endings', () => {
    // Infinitive verbs ending in -ть are kept as-is (they ARE the dictionary form)
    expect(simpleLemmatize('купить')).toBe('купить');
    expect(simpleLemmatize('продать')).toBe('продать');
    // Past tense → infinitive (suffix replacement)
    expect(simpleLemmatize('купил')).toBe('купить');
    expect(simpleLemmatize('сделала')).toBe('сделать');
  });

  it('should return word unchanged if no rule matches', () => {
    // Exception dictionary words
    expect(simpleLemmatize('москва')).toBe('москва');
    // Words that don't match any rule (minStem protection)
    expect(simpleLemmatize('ноутбук')).toBe('ноутбук');
  });
});

// ============================================================
// Text Preprocessing: preprocessPhrase
// ============================================================

describe('preprocessPhrase', () => {
  it('should tokenize a phrase into words', () => {
    const result = preprocessPhrase('купить ноутбук москва');
    expect(result).toContain('купить');
    expect(result).toContain('ноутбук');
    expect(result).toContain('москва');
  });

  it('should remove stop words', () => {
    const result = preprocessPhrase('купить в москва на', {
      stopWords: DEFAULT_STOP_WORDS,
    });
    expect(result).toContain('купить');
    expect(result).toContain('москва');
    expect(result).not.toContain('в');
    expect(result).not.toContain('на');
  });

  it('should ignore numbers when option is set', () => {
    const result = preprocessPhrase('iphone 15 pro 2024', {
      ignoreNumbers: true,
    });
    expect(result).toContain('iphone');
    expect(result).toContain('pro');
    expect(result).not.toContain('15');
    expect(result).not.toContain('2024');
  });

  it('should apply lemmatization', () => {
    const result = preprocessPhrase('купить телефоны', {
      lemmatize: true,
    });
    // "телефоны" → "телефон" (plural stripped)
    expect(result).toContain('телефон');
  });

  it('should apply synonyms', () => {
    const synonyms = new Map([['мрт', 'магнитно резонансная томография']]);
    const result = preprocessPhrase('сделать мрт', { synonyms });
    // "мрт" should be replaced → but it becomes multiple words in one slot
    // Our synonym map replaces word-for-word, so "мрт" → "магнитно резонансная томография" as one token
    expect(result.some(w => w.includes('магнитно'))).toBe(true);
  });

  it('should keep single-char words (stop words filter removes them)', () => {
    const result = preprocessPhrase('а б в телефон');
    expect(result).toContain('а');
    expect(result).toContain('б');
    expect(result).toContain('в');
    expect(result).toContain('телефон');
  });

  it('should apply all preprocessing steps in correct order', () => {
    const result = preprocessPhrase('купить 15 телефоны в москва', {
      ignoreNumbers: true,
      lemmatize: true,
      stopWords: DEFAULT_STOP_WORDS,
    });
    // Numbers removed: no "15"
    expect(result).not.toContain('15');
    // Stop words removed: no "в"
    expect(result).not.toContain('в');
    // Lemmatized: "телефоны" → "телефон"
    expect(result).toContain('телефон');
    // Meaningful words kept
    expect(result).toContain('купить');
    // москва is in exception dictionary, kept as-is
    expect(result).toContain('москва');
  });

  it('should return empty array for stop-words-only phrase', () => {
    const result = preprocessPhrase('в на с и по', {
      stopWords: DEFAULT_STOP_WORDS,
    });
    expect(result).toEqual([]);
  });
});

// ============================================================
// Clustering with preprocessing options
// ============================================================

describe('clusterByWords with preprocessing', () => {
  it('should cluster with lemmatize option', () => {
    const phrases = [
      P('1', 'купить телефоны'),
      P('2', 'купить телефон'),
      P('3', 'аренда квартиры'),
    ];

    const clusters = clusterByWords(phrases, 1, { lemmatize: true });
    // With lemmatization, "телефоны" and "телефон" become the same
    let together = false;
    for (const [, cps] of clusters) {
      if (cps.some((p: Phrase) => p.id === '1') && cps.some((p: Phrase) => p.id === '2')) {
        together = true;
      }
    }
    expect(together).toBe(true);
  });

  it('should cluster with ignoreNumbers option', () => {
    const phrases = [
      P('1', 'iphone 15 pro'),
      P('2', 'iphone 16 pro'),
      P('3', 'аренда квартир'),
    ];

    const clusters = clusterByWords(phrases, 1, { ignoreNumbers: true });
    // "iphone" and "pro" are shared between 1 and 2
    let together = false;
    for (const [, cps] of clusters) {
      if (cps.some((p: Phrase) => p.id === '1') && cps.some((p: Phrase) => p.id === '2')) {
        together = true;
      }
    }
    expect(together).toBe(true);
  });

  it('should cluster with synonyms option', () => {
    const phrases = [
      P('1', 'сделать мрт головного мозга'),
      P('2', 'магнитно резонансная томография головного мозга'),
    ];

    const synonyms = new Map([['мрт', 'магнитно']]);
    const clusters = clusterByWords(phrases, 1, { synonyms });
    // With synonyms, "мрт" → "магнитно", so both share "магнитно"
    let together = false;
    for (const [, cps] of clusters) {
      if (cps.some((p: Phrase) => p.id === '1') && cps.some((p: Phrase) => p.id === '2')) {
        together = true;
      }
    }
    expect(together).toBe(true);
  });

  it('should apply scanMode wide-to-narrow', () => {
    const phrases = [
      P('1', 'купить'),                     // 1 word — short
      P('2', 'купить ноутбук'),             // 2 words
      P('3', 'купить ноутбук москва'),      // 3 words — long
    ];

    // Default mode: narrow-to-wide (long phrases first)
    const narrowFirst = clusterByWords(phrases, 1, { scanMode: 'narrow-to-wide' });
    // Wide-to-narrow: short phrases first
    const wideFirst = clusterByWords(phrases, 1, { scanMode: 'wide-to-narrow' });

    // Both should produce valid results
    expect(narrowFirst.size).toBeGreaterThanOrEqual(1);
    expect(wideFirst.size).toBeGreaterThanOrEqual(1);
  });

  it('should apply splitByStrength option', () => {
    const phrases = [
      P('1', 'купить ноутбук москва дешево'),     // 4 words
      P('2', 'купить ноутбук москва недорого'),    // 4 words — strong match (3 common)
      P('3', 'купить телефон питер'),              // 2 words — weak match (1 common with #1)
    ];

    // Without splitByStrength: #3 might be pulled into #1's cluster
    const normal = clusterByWords(phrases, 1, { splitByStrength: false });
    // With splitByStrength: #3 with only 1 common word stays separate (strong threshold = 1*2 = 2)
    const split = clusterByWords(phrases, 1, { splitByStrength: true });

    // splitByStrength should produce more clusters (or equal)
    expect(split.size).toBeGreaterThanOrEqual(normal.size);
  });

  it('should cluster with Jaccard + preprocessing', () => {
    const phrases = [
      P('1', 'купить телефоны'),
      P('2', 'купить телефон дешево'),
      P('3', 'аренда квартир'),
    ];

    const clusters = clusterByJaccard(phrases, 0.3, { lemmatize: true });
    expect(clusters.size).toBeGreaterThanOrEqual(1);

    let together = false;
    for (const [, cps] of clusters) {
      if (cps.some((p: Phrase) => p.id === '1') && cps.some((p: Phrase) => p.id === '2')) {
        together = true;
      }
    }
    expect(together).toBe(true);
  });
});

// ============================================================
// Group Analysis with preprocessing
// ============================================================

describe('groupByWords with preprocessing', () => {
  it('should group with lemmatize option', () => {
    const phrases = [
      P('1', 'купить телефоны'),
      P('2', 'купить телефон дешево'),
      P('3', 'телефон москва'),
    ];

    const groups = groupByWords(phrases, { minGroupSize: 2, lemmatize: true });
    // With lemmatization, "телефоны" and "телефон" both become "телефон"
    // → "телефон" group should have all 3 phrases
    const telGroup = groups.find((g: any) => g.word === 'телефон');
    expect(telGroup).toBeTruthy();
    expect(telGroup!.phrases.length).toBe(3);
  });

  it('should group with ignoreNumbers option', () => {
    const phrases = [
      P('1', 'iphone 15'),
      P('2', 'iphone 16'),
    ];

    // Without ignore numbers: "15" and "16" are separate groups
    const without = groupByWords(phrases, { minGroupSize: 1, ignoreNumbers: false });
    // With ignore numbers: "15" and "16" are skipped, "iphone" is the only significant word
    const withIgnore = groupByWords(phrases, { minGroupSize: 1, ignoreNumbers: true });

    const iphoneGroup = withIgnore.find((g: any) => g.word === 'iphone');
    expect(iphoneGroup).toBeTruthy();
    expect(iphoneGroup!.phrases.length).toBe(2);
  });

  it('should group with synonyms option', () => {
    const phrases = [
      P('1', 'сделать мрт'),
      P('2', 'сделать магнитно'),
    ];

    const synonyms = new Map([['мрт', 'магнитно']]);
    const groups = groupByWords(phrases, { minGroupSize: 1, synonyms });

    // "мрт" → "магнитно", so both phrases have "магнитно"
    const magGroup = groups.find((g: any) => g.word === 'магнитно');
    expect(magGroup).toBeTruthy();
    expect(magGroup!.phrases.length).toBe(2);
  });
});

// ============================================================
// Edge cases
// ============================================================

describe('Algorithm edge cases', () => {
  it('N-grams: should handle single word phrases', () => {
    const phrases = [P('1', 'ноутбук'), P('2', 'телефон')];
    const clusters = clusterByNgrams(phrases, { ngramSize: 2, threshold: 0.1, minGroupSize: 1 });
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });

  it('TF-IDF: should handle identical phrases', () => {
    const phrases = [P('1', 'купить ноутбук'), P('2', 'купить ноутбук')];
    const clusters = clusterByTFIDF(phrases, { threshold: 0.5, minGroupSize: 1 });
    // Identical phrases should cluster together
    let together = false;
    for (const [, cps] of clusters) {
      if (cps.some(p => p.id === '1') && cps.some(p => p.id === '2')) {
        together = true;
      }
    }
    expect(together).toBe(true);
  });

  it('N-grams: should handle phrases with only stop-words', () => {
    const phrases = [P('1', 'в на с'), P('2', 'купить ноутбук')];
    const clusters = clusterByNgrams(phrases, { ngramSize: 2, threshold: 0.1, minGroupSize: 1 });
    // Should not crash
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });

  it('TF-IDF: should handle phrases with only numbers', () => {
    const phrases = [P('1', '15 2024'), P('2', 'купить ноутбук')];
    const clusters = clusterByTFIDF(phrases, { threshold: 0.1, minGroupSize: 1, ignoreNumbers: true });
    // "15" and "2024" are removed, leaving empty doc for phrase 1
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });

  it('preprocessPhrase: should handle empty string', () => {
    const result = preprocessPhrase('');
    expect(result).toEqual([]);
  });

  it('preprocessPhrase: should handle string with only spaces', () => {
    const result = preprocessPhrase('   ');
    expect(result).toEqual([]);
  });

  it('preprocessPhrase: should handle string with only numbers', () => {
    const result = preprocessPhrase('15 2024 300', { ignoreNumbers: true });
    expect(result).toEqual([]);
  });
});
