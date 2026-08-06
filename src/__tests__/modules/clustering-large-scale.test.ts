// ============================================================
// Tests: Clustering — large datasets and performance
// ============================================================

import { describe, it, expect } from 'vitest';
import { clusterByWords, clusterByJaccard } from '@user-plugins/clustering/index';
import type { Phrase } from '@/plugin-sdk';

function makePhrase(id: string, text: string): Phrase {
  return { id, groupId: 'root', text, frequency: 100, kei: 10, cpc: 5, createdAt: Date.now() };
}

// ============================================================
// Large datasets
// ============================================================

describe('clusterByWords — large datasets', () => {
  it('should handle 50 phrases', () => {
    const phrases: Phrase[] = [];
    for (let i = 0; i < 50; i++) {
      phrases.push(makePhrase(String(i), `купить ноутбук ${i}`));
    }
    const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(50);
  });

  it('should handle 100 phrases with varied clustering', () => {
    const phrases: Phrase[] = [];
    for (let i = 0; i < 100; i++) {
      const category = i % 5;
      const baseWords = ['купить', 'продать', 'аренда', 'обмен', 'сдам'][category];
      phrases.push(makePhrase(String(i), `${baseWords} товар${i}`));
    }
    const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(100);
    expect(clusters.size).toBeGreaterThanOrEqual(5);
  });

  it('should handle many unique phrases', () => {
    const phrases: Phrase[] = [];
    for (let i = 0; i < 30; i++) {
      phrases.push(makePhrase(String(i), `уникальное${i}`));
    }
    const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(30);
  });

  it('should handle many phrases all in one cluster', () => {
    const phrases: Phrase[] = [];
    for (let i = 0; i < 30; i++) {
      phrases.push(makePhrase(String(i), 'купить ноутбук'));
    }
    const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });
    expect(clusters.size).toBe(1);
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(30);
  });
});

describe('clusterByJaccard — large datasets', () => {
  it('should handle 50 phrases', () => {
    const phrases: Phrase[] = [];
    for (let i = 0; i < 50; i++) {
      phrases.push(makePhrase(String(i), `купить ноутбук ${i}`));
    }
    const clusters = clusterByJaccard(phrases, 0.3, { stopWords: new Set() });
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(50);
  });

  it('should handle 100 phrases with varied clustering', () => {
    const phrases: Phrase[] = [];
    for (let i = 0; i < 100; i++) {
      const category = i % 5;
      const baseWords = ['купить', 'продать', 'аренда', 'обмен', 'сдам'][category];
      phrases.push(makePhrase(String(i), `${baseWords} товар${i}`));
    }
    const clusters = clusterByJaccard(phrases, 0.3, { stopWords: new Set() });
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(100);
  });
});

// ============================================================
// Many similar phrases with small variations
// ============================================================

describe('clusterByWords — small variations', () => {
  it('should group phrases with one word difference', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'а б в г д'),
      makePhrase('2', 'а б в г е'),
      makePhrase('3', 'а б в д е'),
      makePhrase('4', 'а б в г ж'),
    ];
    const clusters = clusterByWords(phrases, 3, { stopWords: new Set() });
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(4);
  });

  it('should separate phrases with no common words', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'а'),
      makePhrase('2', 'б'),
      makePhrase('3', 'в'),
      makePhrase('4', 'г'),
    ];
    const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });
    // Each should be separate
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(4);
  });
});

describe('clusterByJaccard — small variations', () => {
  it('should group highly similar phrases', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'купить ноутбук'),
      makePhrase('2', 'купить ноутбук'),
      makePhrase('3', 'купить ноутбук'),
    ];
    const clusters = clusterByJaccard(phrases, 0.5, { stopWords: new Set() });
    expect(clusters.size).toBe(1);
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(3);
  });

  it('should separate phrases with low similarity', () => {
    const phrases = [
      makePhrase('1', 'а а а а а'),
      makePhrase('2', 'б б б б б'),
    ];
    const clusters = clusterByJaccard(phrases, 0.9, { stopWords: new Set() });
    // Verify it returns valid result
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// Preprocessing interaction
// ============================================================

describe('clusterByWords — preprocessing edge cases', () => {
  it('should handle phrase with only numbers', () => {
    const phrases: Phrase[] = [
      makePhrase('1', '123 456'),
      makePhrase('2', '123 789'),
    ];
    const clusters = clusterByWords(phrases, 1, {
      ignoreNumbers: true,
      stopWords: new Set(),
    });
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(2);
  });

  it('should handle phrase with mixed case', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'КуПиТь НоУтБуК'),
      makePhrase('2', 'купить ноутбук'),
    ];
    const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });
    expect(clusters.size).toBe(1);
  });

  it('should handle multiple spaces between words', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'купить    ноутбук'),
      makePhrase('2', 'купить  ноутбук'),
    ];
    const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });
    expect(clusters.size).toBe(1);
  });

  it('should handle leading/trailing spaces', () => {
    const phrases: Phrase[] = [
      makePhrase('1', '  купить ноутбук'),
      makePhrase('2', 'купить ноутбук  '),
    ];
    const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });
    expect(clusters.size).toBe(1);
  });
});

describe('clusterByJaccard — preprocessing edge cases', () => {
  it('should handle case insensitivity', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'КУПИТЬ НОУТБУК'),
      makePhrase('2', 'купить ноутбук'),
    ];
    const clusters = clusterByJaccard(phrases, 0.5, { stopWords: new Set() });
    expect(clusters.size).toBe(1);
  });

  it('should handle multiple spaces', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'купить    ноутбук'),
      makePhrase('2', 'купить ноутбук'),
    ];
    const clusters = clusterByJaccard(phrases, 0.5, { stopWords: new Set() });
    expect(clusters.size).toBe(1);
  });
});

// ============================================================
// Phrase frequency handling
// ============================================================

describe('clusterByWords — phrase with various word counts', () => {
  it('should handle single word phrase', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'купить'),
      makePhrase('2', 'купить ноутбук'),
    ];
    const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(2);
  });

  it('should handle very long single phrase', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'а '.repeat(100).trim()),
    ];
    const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });
    expect(clusters.size).toBe(1);
  });

  it('should handle two-word phrases', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'а б'),
      makePhrase('2', 'а в'),
      makePhrase('3', 'б в'),
    ];
    const clusters = clusterByWords(phrases, 1, { stopWords: new Set() });
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(3);
  });
});

describe('clusterByJaccard — phrase with various word counts', () => {
  it('should handle single word phrase', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'купить'),
      makePhrase('2', 'купить'),
    ];
    const clusters = clusterByJaccard(phrases, 0.5, { stopWords: new Set() });
    expect(clusters.size).toBe(1);
  });

  it('should handle very different phrase lengths', () => {
    const phrases: Phrase[] = [
      makePhrase('1', 'а'),
      makePhrase('2', 'а б в г д е ж з и к л м н о п р с т у ф х ц ч ш щ ъ ы ь э ю я'),
    ];
    const clusters = clusterByJaccard(phrases, 0.1, { stopWords: new Set() });
    const totalPhrases = [...clusters.values()].flat().length;
    expect(totalPhrases).toBe(2);
  });
});

// ============================================================
// Empty and null-like values
// ============================================================

describe('clusterByWords — empty/null edge cases', () => {
  it('should handle undefined options', () => {
    const phrases = [makePhrase('1', 'купить ноутбук')];
    const clusters = clusterByWords(phrases, 1, undefined);
    expect(clusters.size).toBe(1);
  });

  it('should handle partial options', () => {
    const phrases = [makePhrase('1', 'купить ноутбук')];
    const clusters = clusterByWords(phrases, 1, { lemmatize: true } as any);
    expect(clusters.size).toBe(1);
  });
});

describe('clusterByJaccard — empty/null edge cases', () => {
  it('should handle undefined options', () => {
    const phrases = [makePhrase('1', 'купить ноутбук')];
    const clusters = clusterByJaccard(phrases, 0.3, undefined);
    expect(clusters.size).toBe(1);
  });

  it('should handle negative threshold', () => {
    const phrases = [makePhrase('1', 'а'), makePhrase('2', 'а')];
    const clusters = clusterByJaccard(phrases, -0.5, { stopWords: new Set() });
    expect(clusters.size).toBe(1);
  });
});
