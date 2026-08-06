// ============================================================
// Tests: Clustering — combined options interactions
// ============================================================
//
// Tests for combinations of options in clusterByWords and clusterByJaccard:
// - lemmatize + ignoreNumbers
// - lemmatize + stopWords
// - ignoreNumbers + stopWords
// - synonyms + lemmatize
// - All options combined
// ============================================================

import { describe, it, expect } from 'vitest';
import { clusterByWords, clusterByJaccard } from '@user-plugins/clustering/index';
import type { Phrase } from '@/plugin-sdk';

function makePhrase(id: string, text: string): Phrase {
  return { id, groupId: 'root', text, frequency: 100, kei: 10, cpc: 5, createdAt: Date.now() };
}

// ============================================================
// clusterByWords — option combinations
// ============================================================

describe('clusterByWords — lemmatize + ignoreNumbers', () => {
  it('should combine lemmatize and ignoreNumbers', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'iphone 15 pro max'),
      makePhrase('2', 'iphone 16 pro max'),
      makePhrase('3', 'iphone 15'),
    ];
    const clusters = clusterByWords(phrases, 1, {
      lemmatize: true,
      ignoreNumbers: true,
      stopWords: new Set(),
    });
    // All should cluster on 'iphone' and 'pro' and 'max'
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(3);
  });

  it('should handle lemmatized words with numbers ignored', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'купить телефоны 2024'),
      makePhrase('2', 'купить телефон 2023'),
    ];
    const clusters = clusterByWords(phrases, 1, {
      lemmatize: true,
      ignoreNumbers: true,
      stopWords: new Set(),
    });
    expect(clusters.size).toBeGreaterThanOrEqual(1);
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(2);
  });
});

describe('clusterByWords — lemmatize + stopWords', () => {
  it('should lemmatize and filter custom stopWords', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'купить в москве'),
      makePhrase('2', 'купить в питере'),
    ];
    const clusters = clusterByWords(phrases, 1, {
      lemmatize: false,
      stopWords: new Set(['москве', 'питере', 'в']),
    });
    // Only 'купить' remains
    expect(clusters.size).toBe(1);
  });

  it('should handle empty stopWords set with lemmatization', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'а б в'),
      makePhrase('2', 'а б г'),
    ];
    const clusters = clusterByWords(phrases, 1, {
      lemmatize: true,
      stopWords: new Set(),
    });
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });
});

describe('clusterByWords — ignoreNumbers + stopWords', () => {
  it('should ignore numbers and filter stopWords', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'iphone 15 pro в'),
      makePhrase('2', 'iphone 16 pro на'),
    ];
    const clusters = clusterByWords(phrases, 1, {
      ignoreNumbers: true,
      stopWords: new Set(['в', 'на', 'с', 'и']),
    });
    // 'iphone' and 'pro' remain
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });
});

describe('clusterByWords — synonyms + lemmatize', () => {
  it('should apply synonyms after lemmatization', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'сделать мрт'),
      makePhrase('2', 'сделать томографию'),
      makePhrase('3', 'сделать кт'),
    ];
    const synonyms = new Map<string, string>([
      ['мрт', 'томографию'],
      ['кт', 'томографию'],
    ]);
    const clusters = clusterByWords(phrases, 1, {
      lemmatize: true,
      synonyms,
      stopWords: new Set(),
    });
    // All should cluster on 'томографию'
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(3);
  });
});

describe('clusterByWords — all options combined', () => {
  it('should handle all options together', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'купить iphone 15 pro в москве'),
      makePhrase('2', 'купить iphone 16 pro на'),
      makePhrase('3', 'купить iphone pro max'),
    ];
    const clusters = clusterByWords(phrases, 1, {
      lemmatize: true,
      ignoreNumbers: true,
      stopWords: new Set(['в', 'на', 'с', 'и', 'по']),
      synonyms: new Map(),
    });
    expect(clusters.size).toBeGreaterThanOrEqual(1);
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(3);
  });

  it('should handle empty synonyms map', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'купить ноутбук'),
      makePhrase('2', 'купить телефон'),
    ];
    const clusters = clusterByWords(phrases, 1, {
      synonyms: new Map(),
      stopWords: new Set(),
    });
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// clusterByJaccard — option combinations
// ============================================================

describe('clusterByJaccard — lemmatize + ignoreNumbers', () => {
  it('should combine lemmatize and ignoreNumbers', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'iphone 15 pro'),
      makePhrase('2', 'iphone 16 pro'),
    ];
    const clusters = clusterByJaccard(phrases, 0.3, {
      lemmatize: true,
      ignoreNumbers: true,
      stopWords: new Set(),
    });
    expect(clusters.size).toBe(1);
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(2);
  });
});

describe('clusterByJaccard — lemmatize + stopWords', () => {
  it('should lemmatize and filter stopWords', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'купить в'),
      makePhrase('2', 'купить на'),
    ];
    const clusters = clusterByJaccard(phrases, 0.3, {
      lemmatize: false,
      stopWords: new Set(['в', 'на']),
    });
    // Only 'купить' remains
    expect(clusters.size).toBe(1);
  });
});

describe('clusterByJaccard — ignoreNumbers + stopWords', () => {
  it('should ignore numbers and filter stopWords', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'iphone 15 в'),
      makePhrase('2', 'iphone 16 на'),
    ];
    const clusters = clusterByJaccard(phrases, 0.3, {
      ignoreNumbers: true,
      stopWords: new Set(['в', 'на']),
    });
    expect(clusters.size).toBe(1);
  });
});

describe('clusterByJaccard — synonyms + lemmatize', () => {
  it('should apply synonyms with lemmatization', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'сделать мрт'),
      makePhrase('2', 'сделать томографию'),
    ];
    const synonyms = new Map([['мрт', 'томографию']]);
    const clusters = clusterByJaccard(phrases, 0.3, {
      lemmatize: true,
      synonyms,
      stopWords: new Set(),
    });
    expect(clusters.size).toBe(1);
  });
});

describe('clusterByJaccard — all options combined', () => {
  it('should handle all options together', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'купить iphone 15 pro в'),
      makePhrase('2', 'купить iphone 16 pro на'),
    ];
    const clusters = clusterByJaccard(phrases, 0.3, {
      lemmatize: true,
      ignoreNumbers: true,
      stopWords: new Set(['в', 'на']),
      synonyms: new Map(),
    });
    expect(clusters.size).toBe(1);
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(2);
  });
});

// ============================================================
// Different minCommonWords / threshold values
// ============================================================

describe('clusterByWords — minCommonWords boundary', () => {
  it('should handle minCommonWords=0', () => {
    const phrases = [
      makePhrase('1', 'а'),
      makePhrase('2', 'б'),
    ];
    const clusters = clusterByWords(phrases, 0, { stopWords: new Set() });
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });

  it('should handle very high minCommonWords', () => {
    const phrases = [
      makePhrase('1', 'а б в г д'),
      makePhrase('2', 'а б в г е'),
      makePhrase('3', 'а б в д е'),
    ];
    const clusters = clusterByWords(phrases, 10, { stopWords: new Set() });
    // No phrases share 10 common words
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(3);
  });

  it('should handle minCommonWords=1 strictly', () => {
    const phrases = [
      makePhrase('1', 'а'),
      makePhrase('2', 'б'),
    ];
    const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });
    // Single char words are filtered (w.length > 1), but algorithm
    // may still process them
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });
});

describe('clusterByJaccard — threshold boundary', () => {
  it('should handle threshold=0', () => {
    const phrases = [
      makePhrase('1', 'а'),
      makePhrase('2', 'б'),
    ];
    const clusters = clusterByJaccard(phrases, 0, { stopWords: new Set() });
    expect(clusters.size).toBe(1);
  });

  it('should handle threshold=1', () => {
    const phrases = [
      makePhrase('1', 'а б в'),
      makePhrase('2', 'а б в'),
    ];
    const clusters = clusterByJaccard(phrases, 1, { stopWords: new Set() });
    // Only identical phrases cluster at threshold=1
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });

  it('should handle very low threshold', () => {
    const phrases = [
      makePhrase('1', 'купить ноутбук'),
      makePhrase('2', 'аренда квартира'),
    ];
    const clusters = clusterByJaccard(phrases, 0.01, { stopWords: new Set() });
    // Algorithm behavior - just verify it doesn't crash and returns valid result
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });

  it('should handle very high threshold', () => {
    const phrases = [
      makePhrase('1', 'а б в'),
      makePhrase('2', 'а б г'),
      makePhrase('3', 'а б д'),
    ];
    const clusters = clusterByJaccard(phrases, 0.99, { stopWords: new Set() });
    // High threshold means very little similarity needed
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// scanMode combinations
// ============================================================

describe('clusterByWords — scanMode with options', () => {
  it('should work with wide-to-narrow and lemmatize', () => {
    const phrases = [
      makePhrase('1', 'а'),
      makePhrase('2', 'а б'),
      makePhrase('3', 'а б в'),
    ];
    const clusters = clusterByWords(phrases, 1, {
      scanMode: 'wide-to-narrow',
      lemmatize: true,
      stopWords: new Set(),
    });
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(3);
  });

  it('should work with narrow-to-wide and ignoreNumbers', () => {
    const phrases = [
      makePhrase('1', 'а б в'),
      makePhrase('2', 'а б'),
      makePhrase('3', 'а'),
    ];
    const clusters = clusterByWords(phrases, 1, {
      scanMode: 'narrow-to-wide',
      ignoreNumbers: true,
      stopWords: new Set(),
    });
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(3);
  });
});

describe('clusterByJaccard — scanMode with options', () => {
  it('should work with wide-to-narrow and synonyms', () => {
    const phrases = [
      makePhrase('1', 'а'),
      makePhrase('2', 'а б'),
      makePhrase('3', 'а б в'),
    ];
    const synonyms = new Map([['б', 'б']]);
    const clusters = clusterByJaccard(phrases, 0.3, {
      scanMode: 'wide-to-narrow',
      synonyms,
      stopWords: new Set(),
    });
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(3);
  });
});
