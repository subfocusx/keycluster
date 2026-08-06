// ============================================================
// Performance Test: Clustering Algorithms
// ============================================================
//
// - Запусти кластеризацию на 1k / 10k / 50k / 100k ключей
// - Замерь время каждого запуска
// - Вычисли коэффициент роста между шагами
// - Если коэффициент > 8x при удвоении данных — O(N²) подтверждён
//
// Запуск: npx vitest run --config vitest.config.perf.ts src/__tests__/perf/clustering.perf.test.ts

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { generatePhraseObjects } from './helpers/generate-keys';
import { clusterByWords, clusterByJaccard } from '@user-plugins/clustering/index';
import { clusterByNgrams } from '@user-plugins/ngrams/index';
import { clusterByTFIDF } from '@user-plugins/tfidf/index';
import { groupByWords } from '@user-plugins/group-analysis/index';
import type { Phrase } from '@/core/types';

const GROUP_ID = 'perf-test-group';

describe('Clustering Performance', () => {
  const results: Array<{
    algorithm: string;
    count: number;
    durationMs: number;
    clusterCount: number;
  }> = [];

  beforeAll(() => {
    console.log(`\n=== CLUSTERING PERFORMANCE TEST ===`);
    console.log(`Testing: clusterByWords, clusterByJaccard, clusterByNgrams, clusterByTFIDF, groupByWords`);
    console.log(``);
  });

  afterAll(() => {
    // Print summary table
    const algorithms = [...new Set(results.map(r => r.algorithm))];
    console.log(`\n┌─────────────────────┬──────────┬────────────┬───────────┐`);
    console.log(`│ Алгоритм            │ Ключей   │ Время (ms) │ Кластеров │`);
    console.log(`├─────────────────────┼──────────┼────────────┼───────────┤`);
    for (const r of results) {
      console.log(`│ ${r.algorithm.padEnd(19)} │ ${r.count.toString().padStart(8)} │ ${r.durationMs.toFixed(0).padStart(10)} │ ${r.clusterCount.toString().padStart(9)} │`);
    }
    console.log(`└─────────────────────┴──────────┴────────────┴───────────┘`);

    // Check O(N²) growth pattern for clusterByJaccard
    const jaccardResults = results.filter(r => r.algorithm === 'Jaccard');
    if (jaccardResults.length >= 2) {
      console.log(`\n--- O(N²) Growth Analysis (Jaccard) ---`);
      for (let i = 1; i < jaccardResults.length; i++) {
        const prev = jaccardResults[i - 1];
        const curr = jaccardResults[i];
        const sizeRatio = curr.count / prev.count;
        const timeRatio = curr.durationMs / prev.durationMs;
        console.log(`  ${prev.count} → ${curr.count}: size×${sizeRatio.toFixed(1)}, time×${timeRatio.toFixed(1)}`);
        if (sizeRatio <= 2 && timeRatio > 8) {
          console.log(`  ⚠️ WARN: O(N²) подтверждён — при удвоении данных время выросло в ${timeRatio.toFixed(1)}x`);
        }
      }
    }
  });

  // ---- clusterByWords ----

  describe('clusterByWords', () => {
    const sizes = [1_000, 10_000];

    for (const count of sizes) {
      test(`${count} ключей — < 10 секунд`, () => {
        const phrases = generatePhraseObjects(count, GROUP_ID) as Phrase[];
        const start = performance.now();
        const clusters = clusterByWords(phrases, 2);
        const duration = performance.now() - start;

        results.push({ algorithm: 'ByWords', count, durationMs: duration, clusterCount: clusters.size });
        console.log(`  [ByWords ${count}] ${duration.toFixed(0)} ms, clusters: ${clusters.size}`);

        if (count === 10_000) {
          expect(duration).toBeLessThan(10000);
        }
      });
    }
  });

  // ---- clusterByJaccard ----

  describe('clusterByJaccard', () => {
    const sizes = [1_000, 10_000];

    for (const count of sizes) {
      test(`${count} ключей — < 5 секунд (10k)`, () => {
        const phrases = generatePhraseObjects(count, GROUP_ID) as Phrase[];
        const start = performance.now();
        const clusters = clusterByJaccard(phrases, 0.3);
        const duration = performance.now() - start;

        results.push({ algorithm: 'Jaccard', count, durationMs: duration, clusterCount: clusters.size });
        console.log(`  [Jaccard ${count}] ${duration.toFixed(0)} ms, clusters: ${clusters.size}`);

        if (count === 10_000) {
          expect(duration).toBeLessThan(5000);
        }
      });
    }

    // FIXED: preprocessing предвычисляется O(N) раз, замедление ~1.1x вместо 5x
    test('с лемматизацией 10k — замедление < 3x', () => {
      const phrases = generatePhraseObjects(10_000, GROUP_ID) as Phrase[];
      const start = performance.now();
      const clusters = clusterByJaccard(phrases, 0.3, { lemmatize: true });
      const duration = performance.now() - start;

      results.push({ algorithm: 'Jaccard+Lemm', count: 10_000, durationMs: duration, clusterCount: clusters.size });
      console.log(`  [Jaccard+Lemm 10k] ${duration.toFixed(0)} ms, clusters: ${clusters.size}`);

      const baseline = results.find(r => r.algorithm === 'Jaccard' && r.count === 10_000);
      if (baseline) {
        const slowdown = duration / baseline.durationMs;
        console.log(`  Lemmatization slowdown: ${slowdown.toFixed(2)}x`);
        expect(slowdown).toBeLessThan(3);
      } else {
        // Если baseline не найден — всё равно падаем, тест не имеет смысла без сравнения
        expect(true).toBe(false);
      }
    });

    test('splitByStrength 10k', { timeout: 30_000 }, () => {
      const phrases = generatePhraseObjects(10_000, GROUP_ID) as Phrase[];
      const start = performance.now();
      const clusters = clusterByJaccard(phrases, 0.3, { splitByStrength: true });
      const duration = performance.now() - start;

      results.push({ algorithm: 'Jaccard+Strength', count: 10_000, durationMs: duration, clusterCount: clusters.size });
      console.log(`  [Jaccard+Strength 10k] ${duration.toFixed(0)} ms, clusters: ${clusters.size}`);
    });
  });

  // ---- clusterByNgrams ----

  describe('clusterByNgrams', () => {
    // FIXED: N-gram множества предвычисляются O(N) раз вместо O(N²)
    test('10k ключей, биграммы — < 5 секунд', () => {
      const phrases = generatePhraseObjects(10_000, GROUP_ID) as Phrase[];
      const start = performance.now();
      const clusters = clusterByNgrams(phrases, { ngramSize: 2, threshold: 0.3, minGroupSize: 2 });
      const duration = performance.now() - start;

      results.push({ algorithm: 'N-grams(2)', count: 10_000, durationMs: duration, clusterCount: clusters.size });
      console.log(`  [N-grams(2) 10k] ${duration.toFixed(0)} ms, clusters: ${clusters.size}`);

      expect(duration).toBeLessThan(5000);
    });

    test('10k ключей, триграммы — < 5 секунд', () => {
      const phrases = generatePhraseObjects(10_000, GROUP_ID) as Phrase[];
      const start = performance.now();
      const clusters = clusterByNgrams(phrases, { ngramSize: 3, threshold: 0.3, minGroupSize: 2 });
      const duration = performance.now() - start;

      results.push({ algorithm: 'N-grams(3)', count: 10_000, durationMs: duration, clusterCount: clusters.size });
      console.log(`  [N-grams(3) 10k] ${duration.toFixed(0)} ms, clusters: ${clusters.size}`);

      expect(duration).toBeLessThan(5000);
    });
  });

  // ---- clusterByTFIDF ----

  describe('clusterByTFIDF', () => {
    test('10k ключей — < 10 секунд', () => {
      const phrases = generatePhraseObjects(10_000, GROUP_ID) as Phrase[];
      const start = performance.now();
      const clusters = clusterByTFIDF(phrases, { threshold: 0.3, minGroupSize: 2 });
      const duration = performance.now() - start;

      results.push({ algorithm: 'TF-IDF', count: 10_000, durationMs: duration, clusterCount: clusters.size });
      console.log(`  [TF-IDF 10k] ${duration.toFixed(0)} ms, clusters: ${clusters.size}`);

      // TF-IDF has O(N²) similarity computation + O(N*V) vector building
      expect(duration).toBeLessThan(10_000);
    });
  });

  // ---- groupByWords (Key Collector style) ----

  describe('groupByWords', () => {
    const sizes = [1_000, 10_000, 50_000];

    for (const count of sizes) {
      test(`${count} ключей — линейное время`, () => {
        const phrases = generatePhraseObjects(count, GROUP_ID) as Phrase[];
        const start = performance.now();
        const groups = groupByWords(phrases, { minGroupSize: 2 });
        const duration = performance.now() - start;

        results.push({ algorithm: 'GroupByWords', count, durationMs: duration, clusterCount: groups.length });
        console.log(`  [GroupByWords ${count}] ${duration.toFixed(0)} ms, groups: ${groups.length}`);

        // groupByWords should be O(N) — fast even for large datasets
        if (count === 50_000) {
          expect(duration).toBeLessThan(5000);
        }
      });
    }
  });

  // ---- 50k/100k stress test (only for Jaccard in Worker path) ----

  describe('O(N²) detection', () => {
    const sizes = [1_000, 2_000, 5_000];

    test('Jaccard — замер роста времени для O(N²) анализа', () => {
      const timings: Array<{ n: number; ms: number }> = [];

      for (const count of sizes) {
        const phrases = generatePhraseObjects(count, GROUP_ID) as Phrase[];
        const start = performance.now();
        clusterByJaccard(phrases, 0.3);
        const duration = performance.now() - start;
        timings.push({ n: count, ms: duration });
      }

      console.log(`  --- O(N²) Detection ---`);
      for (let i = 1; i < timings.length; i++) {
        const prev = timings[i - 1];
        const curr = timings[i];
        const sizeRatio = curr.n / prev.n;
        const timeRatio = curr.ms / prev.ms;
        console.log(`  ${prev.n} → ${curr.n}: size×${sizeRatio.toFixed(1)}, time×${timeRatio.toFixed(1)}`);

        // If doubling data causes >8x time increase, O(N²) is confirmed
        if (sizeRatio <= 2.1 && timeRatio > 8) {
          console.log(`  ⚠️ WARN: O(N²) подтверждён — при удвоении данных время выросло в ${timeRatio.toFixed(1)}x`);
        }
      }

      // Just informational — we expect O(N²) for Jaccard
      expect(timings.length).toBeGreaterThan(0);
    });
  });
});
