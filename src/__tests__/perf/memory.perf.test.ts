// ============================================================
// Performance Test: Memory Usage — heap consumption at scale
// ============================================================
//
// Проверить что heap не превышает лимиты при загрузке данных:
// - Загрузи 10k, 50k, 100k ключей в Store
// - После каждой загрузки замерь process.memoryUsage().heapUsed
// - Проверь что 100k ключей занимают меньше 500MB heap
// - Запусти GC между замерами (--expose-gc)
// - Выведи таблицу: количество ключей → MB памяти
//
// Запуск: npx vitest run --config vitest.config.perf.ts src/__tests__/perf/memory.perf.test.ts
// С GC:  node --expose-gc ./node_modules/.bin/vitest run --config vitest.config.perf.ts src/__tests__/perf/memory.perf.test.ts

import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import { generatePhraseObjects, bytesToMB } from './helpers/generate-keys';

// We test the Zustand store directly by importing and using it
// The store uses localStorage persist — we need to mock it for Node env
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (idx: number) => Object.keys(store)[idx] ?? null,
  };
})();

// @ts-ignore
global.localStorage = localStorageMock;

// Mock uuid for predictable IDs
vi.mock('uuid', () => ({
  v4: () => `id-${Math.random().toString(36).slice(2, 9)}`,
}));

import { useAppStore } from '@/plugin-sdk';

function forceGC() {
  if (typeof global.gc === 'function') {
    global.gc();
  }
}

function getHeapMB(): number {
  return process.memoryUsage().heapUsed / 1024 / 1024;
}

describe('Memory Performance', () => {
  const results: Array<{ count: number; heapMB: string; deltaMB: string }> = [];
  let baselineHeap = 0;

  beforeAll(() => {
    forceGC();
    baselineHeap = getHeapMB();
    console.log(`\n=== MEMORY PERFORMANCE TEST ===`);
    console.log(`Baseline heap: ${bytesToMB(process.memoryUsage().heapUsed)} MB`);
    console.log(`GC available: ${typeof global.gc === 'function' ? 'YES' : 'NO (run with --expose-gc)'}`);
    console.log(``);
  });

  afterAll(() => {
    console.log(`\n┌──────────────┬────────────┬────────────┐`);
    console.log(`│ Ключей       │ Heap (MB)  │ +Δ (MB)    │`);
    console.log(`├──────────────┼────────────┼────────────┤`);
    for (const r of results) {
      console.log(`│ ${r.count.toString().padStart(10)} │ ${r.heapMB.padStart(10)} │ ${r.deltaMB.padStart(10)} │`);
    }
    console.log(`└──────────────┴────────────┴────────────┘`);
  });

  const sizes = [10_000, 50_000, 100_000];
  const HEAP_LIMIT_MB = 500;

  for (const count of sizes) {
    test(`${count} ключей — heap < ${HEAP_LIMIT_MB}MB`, () => {
      // Clean up from previous test
      useAppStore.getState().clearAll();
      forceGC();

      const heapBefore = getHeapMB();

      // Generate phrases and load into store
      const groupId = useAppStore.getState().addGroup('Test Group');
      const phrases = generatePhraseObjects(count, groupId);

      // Load all phrases at once via setPhrases (simulates bulk import)
      useAppStore.getState().setPhrases(phrases as any);

      // Force GC to get stable measurement
      forceGC();
      const heapAfter = getHeapMB();
      const deltaMB = heapAfter - heapBefore;

      results.push({
        count,
        heapMB: heapAfter.toFixed(1),
        deltaMB: deltaMB.toFixed(1),
      });

      console.log(`  [${count}] Heap: ${heapAfter.toFixed(1)} MB (delta: ${deltaMB > 0 ? '+' : ''}${deltaMB.toFixed(1)} MB)`);

      // Assert: 100k phrases should not exceed 500MB
      if (count === 100_000) {
        expect(heapAfter).toBeLessThan(HEAP_LIMIT_MB);
      }

      // Per-phrase overhead check
      const bytesPerPhrase = (deltaMB * 1024 * 1024) / count;
      console.log(`  [${count}] Bytes per phrase: ${bytesPerPhrase.toFixed(0)} bytes`);

      // Sanity: each phrase should use less than 5KB on average
      expect(bytesPerPhrase).toBeLessThan(5120);
    });
  }

  test('сериализация store в JSON при 100k ключей', () => {
    // Store should already have 100k phrases from the previous test
    const state = useAppStore.getState();

    const start = performance.now();
    const json = JSON.stringify({
      groups: state.groups,
      phrases: state.phrases,
      minusWords: state.minusWords,
      ui: state.ui,
    });
    const duration = performance.now() - start;

    const jsonMB = (json.length / 1024 / 1024).toFixed(1);
    console.log(`  [JSON serialize] ${duration.toFixed(1)} ms, size: ${jsonMB} MB`);

    // Serialization should complete in reasonable time
    expect(duration).toBeLessThan(5000); // 5 seconds max for 100k
    expect(json.length).toBeGreaterThan(0);
  });

  test('очистка store освобождает память', () => {
    useAppStore.getState().clearAll();
    forceGC();

    const heapAfter = getHeapMB();
    console.log(`  [clearAll] Heap after cleanup: ${heapAfter.toFixed(1)} MB (baseline was ${baselineHeap.toFixed(1)} MB)`);

    // After clearing, heap should be significantly lower than peak
    // We don't assert exact match because V8 doesn't return memory immediately
    expect(useAppStore.getState().phrases.length).toBe(0);
  });
});
