// ============================================================
// Tests: Clustering module algorithms
// ============================================================

import { describe, it, expect } from 'vitest';
import { clusterByWords, clusterByJaccard } from '@user-plugins/clustering/index';
import type { Phrase } from '@/plugin-sdk';

describe('Phrase', () => {
  it('should group phrases with common words', () => {
    const phrases: Phrase[] = [
      { id: '1', groupId: 'root', text: 'купить ноутбук', frequency: 100, kei: 10, cpc: 5, createdAt: Date.now() },
      { id: '2', groupId: 'root', text: 'купить телефон', frequency: 80, kei: 9, cpc: 4, createdAt: Date.now() },
      { id: '3', groupId: 'root', text: 'продать машину', frequency: 50, kei: 5, cpc: 3, createdAt: Date.now() },
    ];

    const clusters = clusterByWords(phrases, 1);
    expect(clusters.size).toBe(2);
  });

  it('should create clusters with correct names', () => {
    const phrases: Phrase[] = [
      { id: '1', groupId: 'root', text: 'купить ноутбук', frequency: 100, kei: 10, cpc: 5, createdAt: Date.now() },
      { id: '2', groupId: 'root', text: 'ноутбук для игр', frequency: 50, kei: 8, cpc: 4, createdAt: Date.now() },
    ];

    const clusters = clusterByWords(phrases, 1);
    // generateClusterName picks top-2 meaningful words: "купить ноутбук"
    // The cluster name should contain "ноутбук" as part of it
    const keys = [...clusters.keys()];
    const hasNotebook = keys.some(k => k.includes('ноутбук'));
    expect(hasNotebook).toBe(true);
  });

  it('should return empty map for empty input', () => {
    const clusters = clusterByWords([], 1);
    expect(clusters.size).toBe(0);
  });

  it('should handle single phrase', () => {
    const phrases: Phrase[] = [
      { id: '1', groupId: 'root', text: 'купить ноутбук', frequency: 100, kei: 10, cpc: 5, createdAt: Date.now() },
    ];

    const clusters = clusterByWords(phrases, 1);
    expect(clusters.size).toBe(1);
  });

  it('should filter by minClusterSize', () => {
    const phrases: Phrase[] = [
      { id: '1', groupId: 'root', text: 'купить ноутбук', frequency: 100, kei: 10, cpc: 5, createdAt: Date.now() },
      { id: '2', groupId: 'root', text: 'ноутбук для игр', frequency: 50, kei: 8, cpc: 4, createdAt: Date.now() },
      { id: '3', groupId: 'root', text: 'аренда квартиры', frequency: 30, kei: 5, cpc: 3, createdAt: Date.now() },
    ];

    const clusters = clusterByWords(phrases, 1);
    const filtered = new Map([...clusters].filter(([, v]) => v.length >= 2));
    expect(filtered.size).toBe(1);
  });
});

describe('clusterByJaccard', () => {
  it('should group similar phrases', () => {
    const phrases: Phrase[] = [
      { id: '1', groupId: 'root', text: 'купить ноутбук', frequency: 100, kei: 10, cpc: 5, createdAt: Date.now() },
      { id: '2', groupId: 'root', text: 'ноутбук для работы', frequency: 50, kei: 8, cpc: 4, createdAt: Date.now() },
    ];

    const clusters = clusterByJaccard(phrases, 0.3);
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });

  it('should return empty map for empty input', () => {
    const clusters = clusterByJaccard([], 0.3);
    expect(clusters.size).toBe(0);
  });

  it('should use threshold correctly', () => {
    const phrases: Phrase[] = [
      { id: '1', groupId: 'root', text: 'купить ноутбук', frequency: 100, kei: 10, cpc: 5, createdAt: Date.now() },
      { id: '2', groupId: 'root', text: 'ноутбук для работы', frequency: 50, kei: 8, cpc: 4, createdAt: Date.now() },
      { id: '3', groupId: 'root', text: 'аренда авто', frequency: 30, kei: 5, cpc: 3, createdAt: Date.now() },
    ];

    const highThreshold = clusterByJaccard(phrases, 0.8);
    const lowThreshold = clusterByJaccard(phrases, 0.1);
    
    expect(highThreshold.size).toBeGreaterThanOrEqual(lowThreshold.size);
  });
});

describe('Clustering edge cases', () => {
  it('should handle phrases with same words', () => {
    const phrases: Phrase[] = [
      { id: '1', groupId: 'root', text: 'тест тест тест', frequency: 100, kei: 10, cpc: 5, createdAt: Date.now() },
      { id: '2', groupId: 'root', text: 'тест тест', frequency: 50, kei: 8, cpc: 4, createdAt: Date.now() },
    ];

    const clusters = clusterByWords(phrases, 1);
    expect(clusters.size).toBe(1);
    const cluster = clusters.values().next().value;
    expect(cluster?.length).toBe(2);
  });

  it('should handle special characters', () => {
    const phrases: Phrase[] = [
      { id: '1', groupId: 'root', text: 'купить - ноутбук', frequency: 100, kei: 10, cpc: 5, createdAt: Date.now() },
      { id: '2', groupId: 'root', text: 'ноутбук (игровой)', frequency: 50, kei: 8, cpc: 4, createdAt: Date.now() },
    ];

    const clusters = clusterByWords(phrases, 1);
    expect(clusters.size).toBeGreaterThan(0);
  });

  it('should handle russian text', () => {
    const phrases: Phrase[] = [
      { id: '1', groupId: 'root', text: 'купить ноутбук', frequency: 100, kei: 10, cpc: 5, createdAt: Date.now() },
      { id: '2', groupId: 'root', text: 'купить телефон', frequency: 80, kei: 9, cpc: 4, createdAt: Date.now() },
      { id: '3', groupId: 'root', text: 'аренда квартиры', frequency: 30, kei: 5, cpc: 3, createdAt: Date.now() },
      { id: '4', groupId: 'root', text: 'сдам квартиру', frequency: 20, kei: 3, cpc: 2, createdAt: Date.now() },
    ];

    const clusters = clusterByWords(phrases, 1);
    expect(clusters.size).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// Bug fix tests: Map key duplication in clustering algorithms
// ============================================================
// Bug: When multiple clusters share the same topWord, the Map.set()
// call overwrites previous entries, causing data loss.
// Fix: Append cluster index to duplicate keys (e.g. "купить_1").

describe('clusterByWords — Map key duplication fix', () => {
  it('should not lose clusters when topWords collide', () => {
    // These phrases are designed so that multiple clusters share
    // the same top word "купить"
    const phrases: Phrase[] = [
      { id: '1', groupId: 'root', text: 'купить ноутбук москва', frequency: 100, kei: 10, cpc: 5, createdAt: Date.now() },
      { id: '2', groupId: 'root', text: 'ноутбук купить дешево', frequency: 80, kei: 9, cpc: 4, createdAt: Date.now() },
      { id: '3', groupId: 'root', text: 'купить ноутбук недорого', frequency: 70, kei: 8, cpc: 3, createdAt: Date.now() },
      { id: '4', groupId: 'root', text: 'купить телефон москва', frequency: 60, kei: 7, cpc: 3, createdAt: Date.now() },
      { id: '5', groupId: 'root', text: 'телефон купить дешево', frequency: 50, kei: 6, cpc: 2, createdAt: Date.now() },
      { id: '6', groupId: 'root', text: 'купить смартфон дешево', frequency: 40, kei: 5, cpc: 2, createdAt: Date.now() },
      { id: '7', groupId: 'root', text: 'планшет купить москва', frequency: 30, kei: 4, cpc: 1, createdAt: Date.now() },
    ];

    // With minCommon=2, the first cluster absorbs several phrases
    // with common word "купить". The remaining phrases form another
    // cluster that also has "купить" as topWord.
    const clusters = clusterByWords(phrases, 2);

    // Before fix: only 1 cluster in Map (others overwritten)
    // After fix: all clusters preserved with unique keys
    expect(clusters.size).toBeGreaterThanOrEqual(2);

    // Total phrases across all clusters should equal input
    let totalPhrases = 0;
    for (const [, clusterPhrases] of clusters) {
      totalPhrases += clusterPhrases.length;
    }
    expect(totalPhrases).toBe(phrases.length);
  });

  it('should generate unique keys for clusters with same topWord', () => {
    const phrases: Phrase[] = [
      { id: '1', groupId: 'root', text: 'купить а', frequency: 100, kei: 10, cpc: 5, createdAt: Date.now() },
      { id: '2', groupId: 'root', text: 'купить б', frequency: 80, kei: 9, cpc: 4, createdAt: Date.now() },
      { id: '3', groupId: 'root', text: 'продать в', frequency: 50, kei: 5, cpc: 3, createdAt: Date.now() },
      { id: '4', groupId: 'root', text: 'продать г', frequency: 40, kei: 4, cpc: 2, createdAt: Date.now() },
    ];

    // minCommon=1: "купить а" groups with "купить б" (common: "купить")
    // "продать в" groups with "продать г" (common: "продать")
    const clusters = clusterByWords(phrases, 1);
    expect(clusters.size).toBe(2);

    // Keys should be unique
    const keys = [...clusters.keys()];
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it('should preserve all phrases when clusters share topWord', () => {
    const phrases: Phrase[] = [
      { id: '1', groupId: 'root', text: 'а б в', frequency: 100, kei: 10, cpc: 5, createdAt: Date.now() },
      { id: '2', groupId: 'root', text: 'а б г', frequency: 80, kei: 9, cpc: 4, createdAt: Date.now() },
      { id: '3', groupId: 'root', text: 'а д е', frequency: 50, kei: 5, cpc: 3, createdAt: Date.now() },
      { id: '4', groupId: 'root', text: 'а д ж', frequency: 40, kei: 4, cpc: 2, createdAt: Date.now() },
    ];

    const clusters = clusterByWords(phrases, 2);
    // With minCommon=2, "а б в" and "а б г" share "а","б" → 1 cluster
    // "а д е" and "а д ж" share "а","д" → 1 cluster
    // Both clusters have topWord "а" (appears 2 times in each)
    expect(clusters.size).toBeGreaterThanOrEqual(1);

    let totalPhrases = 0;
    for (const [, clusterPhrases] of clusters) {
      totalPhrases += clusterPhrases.length;
    }
    expect(totalPhrases).toBe(phrases.length);
  });

  it('should not lose phrases when clusters generate identical names', () => {
    // This test ensures that when two clusters happen to generate the same name,
    // they are stored as separate entries with unique keys (e.g., "name" and "name (2)")
    // The fix adds a suffix to duplicate keys to prevent data loss
    const phrases: Phrase[] = [
      { id: '1', groupId: 'root', text: 'красный большой', frequency: 100, kei: 10, cpc: 5, createdAt: Date.now() },
      { id: '2', groupId: 'root', text: 'большой красный', frequency: 80, kei: 9, cpc: 4, createdAt: Date.now() },
      { id: '3', groupId: 'root', text: 'синий большой', frequency: 50, kei: 5, cpc: 3, createdAt: Date.now() },
      { id: '4', groupId: 'root', text: 'большой синий', frequency: 40, kei: 4, cpc: 2, createdAt: Date.now() },
    ];

    const clusters = clusterByWords(phrases, 2);

    // All 4 phrases should be preserved across clusters
    let totalPhrases = 0;
    for (const [, clusterPhrases] of clusters) {
      totalPhrases += clusterPhrases.length;
    }
    expect(totalPhrases).toBe(phrases.length);
  });
});

describe('clusterByJaccard — Map key duplication fix', () => {
  it('should not lose clusters when topWords collide', () => {
    const phrases: Phrase[] = [
      { id: '1', groupId: 'root', text: 'купить ноутбук', frequency: 100, kei: 10, cpc: 5, createdAt: Date.now() },
      { id: '2', groupId: 'root', text: 'купить ноутбук дешево', frequency: 80, kei: 9, cpc: 4, createdAt: Date.now() },
      { id: '3', groupId: 'root', text: 'купить телефон', frequency: 60, kei: 7, cpc: 3, createdAt: Date.now() },
      { id: '4', groupId: 'root', text: 'купить смартфон', frequency: 40, kei: 5, cpc: 2, createdAt: Date.now() },
    ];

    const clusters = clusterByJaccard(phrases, 0.3);

    // All phrases should be in some cluster
    let totalPhrases = 0;
    for (const [, clusterPhrases] of clusters) {
      totalPhrases += clusterPhrases.length;
    }
    expect(totalPhrases).toBe(phrases.length);

    // Keys should be unique
    const keys = [...clusters.keys()];
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it('should generate unique keys for duplicate topWord entries', () => {
    const phrases: Phrase[] = [
      { id: '1', groupId: 'root', text: 'тест альфа', frequency: 100, kei: 10, cpc: 5, createdAt: Date.now() },
      { id: '2', groupId: 'root', text: 'тест бета', frequency: 80, kei: 9, cpc: 4, createdAt: Date.now() },
      { id: '3', groupId: 'root', text: 'тест гамма', frequency: 60, kei: 7, cpc: 3, createdAt: Date.now() },
      { id: '4', groupId: 'root', text: 'тест дельта', frequency: 40, kei: 5, cpc: 2, createdAt: Date.now() },
    ];

    // With a very low threshold, everything clusters together
    // With a very high threshold, each becomes its own cluster
    // In both cases, keys must be unique
    const clusters = clusterByJaccard(phrases, 0.9);
    const keys = [...clusters.keys()];
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });
});