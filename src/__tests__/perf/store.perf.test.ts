// ============================================================
// Performance Test: Zustand Store Mutations
// ============================================================
//
// Проверить что Store не тормозит при большом состоянии:
// - Наполни store 100k ключей
// - Сделай 100 последовательных мутаций (например смена фильтра)
// - Замерь среднее время одной мутации
// - Замерь время полной сериализации store в JSON
//
// Порог провала:
//   * одна мутация > 50ms
//   * сериализация всего store > 200ms
//
// Запуск: npx vitest run --config vitest.config.perf.ts src/__tests__/perf/store.perf.test.ts

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { generatePhraseObjects, bytesToMB } from './helpers/generate-keys';

// Mock localStorage for Node
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

import { useAppStore } from '@/plugin-sdk';

describe('use App Store', () => {
  const MUTATION_COUNT = 100;
  const PHRASE_COUNT = 100_000;
  const MUTATION_THRESHOLD_MS = 50;
  const BATCH_ADD_THRESHOLD_MS = 2000;
  const SERIALIZATION_THRESHOLD_MS = 200;

  let mutationTimings: number[] = [];
  let serializationTime = 0;

  beforeAll(() => {
    console.log(`\n=== ZUSTAND STORE PERFORMANCE TEST ===`);
    console.log(`Loading ${PHRASE_COUNT.toLocaleString()} phrases into store...`);

    // Setup: load 100k phrases
    const groupId = useAppStore.getState().addGroup('Test Group');
    const phrases = generatePhraseObjects(PHRASE_COUNT, groupId);
    useAppStore.getState().setPhrases(phrases as any);

    console.log(`Store loaded: ${useAppStore.getState().phrases.length} phrases`);
    console.log(`Heap: ${bytesToMB(process.memoryUsage().heapUsed)} MB`);
    console.log(``);
  });

  afterAll(() => {
    // Print mutation stats
    const avg = mutationTimings.reduce((a, b) => a + b, 0) / mutationTimings.length;
    const min = Math.min(...mutationTimings);
    const max = Math.max(...mutationTimings);
    const p50 = mutationTimings.sort((a, b) => a - b)[Math.floor(mutationTimings.length * 0.5)];
    const p95 = mutationTimings.sort((a, b) => a - b)[Math.floor(mutationTimings.length * 0.95)];
    const p99 = mutationTimings.sort((a, b) => a - b)[Math.floor(mutationTimings.length * 0.99)];

    console.log(`\n--- Store Mutation Timings (100 mutations on ${PHRASE_COUNT.toLocaleString()} phrases) ---`);
    console.log(`  Avg:   ${avg.toFixed(2)} ms`);
    console.log(`  Min:   ${min.toFixed(2)} ms`);
    console.log(`  Max:   ${max.toFixed(2)} ms`);
    console.log(`  P50:   ${p50.toFixed(2)} ms`);
    console.log(`  P95:   ${p95.toFixed(2)} ms`);
    console.log(`  P99:   ${p99.toFixed(2)} ms`);
    console.log(`  Serialization: ${serializationTime.toFixed(1)} ms`);
    console.log(`  Threshold: mutation < ${MUTATION_THRESHOLD_MS}ms, serialize < ${SERIALIZATION_THRESHOLD_MS}ms`);

    // Cleanup
    useAppStore.getState().clearAll();
  });

  test('средняя мутация < 50ms при 100k фраз (togglePhraseSelection)', () => {
    mutationTimings = [];

    // Get some phrase IDs to toggle
    const state = useAppStore.getState();
    const phraseIds = state.phrases.slice(0, MUTATION_COUNT + 10).map(p => p.id);

    for (let i = 0; i < MUTATION_COUNT; i++) {
      const start = performance.now();
      useAppStore.getState().togglePhraseSelection(phraseIds[i]);
      const duration = performance.now() - start;
      mutationTimings.push(duration);
    }

    const avg = mutationTimings.reduce((a, b) => a + b, 0) / mutationTimings.length;
    const max = Math.max(...mutationTimings);

    console.log(`  [togglePhraseSelection] avg: ${avg.toFixed(2)}ms, max: ${max.toFixed(2)}ms`);

    // Clear selection after test
    useAppStore.getState().clearPhraseSelection();

    expect(avg).toBeLessThan(MUTATION_THRESHOLD_MS);
  });

  test('мутация setActiveGroup < 50ms при 100k фраз', () => {
    const timings: number[] = [];
    const groupIds = useAppStore.getState().groups.map(g => g.id);

    for (let i = 0; i < MUTATION_COUNT; i++) {
      const start = performance.now();
      useAppStore.getState().setActiveGroup(groupIds[i % groupIds.length]);
      const duration = performance.now() - start;
      timings.push(duration);
    }

    const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
    console.log(`  [setActiveGroup] avg: ${avg.toFixed(2)}ms`);

    mutationTimings.push(...timings);
    expect(avg).toBeLessThan(MUTATION_THRESHOLD_MS);
  });

  test('мутация setTheme < 50ms при 100k фраз', () => {
    const themes: Array<'light' | 'dark'> = ['light', 'dark'];
    const timings: number[] = [];

    for (let i = 0; i < MUTATION_COUNT; i++) {
      const start = performance.now();
      useAppStore.getState().setTheme(themes[i % themes.length]);
      const duration = performance.now() - start;
      timings.push(duration);
    }

    const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
    console.log(`  [setTheme] avg: ${avg.toFixed(2)}ms`);

    mutationTimings.push(...timings);
    expect(avg).toBeLessThan(MUTATION_THRESHOLD_MS);
  });

  test('addPhrases (batch 100) < 2000ms при 100k фраз в store', () => {
    const newKeys = Array.from({ length: 100 }, (_, i) => `new phrase ${i}`);
    const groupId = useAppStore.getState().groups[0]?.id;
    if (!groupId) return;

    const start = performance.now();
    useAppStore.getState().addPhrases(newKeys, groupId);
    const duration = performance.now() - start;

    console.log(`  [addPhrases 100] ${duration.toFixed(2)}ms`);

    // Clean up added phrases
    const state = useAppStore.getState();
    const newPhraseIds = state.phrases.filter(p => p.text.startsWith('new phrase')).map(p => p.id);
    useAppStore.getState().deletePhrases(newPhraseIds);

    expect(duration).toBeLessThan(BATCH_ADD_THRESHOLD_MS);
  });

  // FIXED: phrases excluded from persist — now only groups + minusWords + ui are serialized
  // This is what Zustand persist middleware actually writes to localStorage
  test('сериализация persist-данных < 200ms при 100k фраз', () => {
    const state = useAppStore.getState();

    const start = performance.now();
    // Serialize only what persist middleware actually persists (no phrases)
    const json = JSON.stringify({
      groups: state.groups,
      minusWords: state.minusWords,
      ui: {
        ...state.ui,
        failedModules: [],
      },
    });
    const duration = performance.now() - start;
    serializationTime = duration;

    const jsonKB = (json.length / 1024).toFixed(1);
    console.log(`  [JSON serialize (persist)] ${duration.toFixed(1)} ms, size: ${jsonKB} KB`);

    expect(duration).toBeLessThan(SERIALIZATION_THRESHOLD_MS);
  });

  test('полная сериализация с phrases (для справки)', () => {
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
    console.log(`  [JSON serialize (full)] ${duration.toFixed(1)} ms, size: ${jsonMB} MB — NOT persisted to localStorage`);

    // Informational — this is not persisted, so no threshold
  });

  test('десериализация store из JSON < 300ms при 100k фраз', () => {
    const state = useAppStore.getState();
    const json = JSON.stringify({
      groups: state.groups,
      phrases: state.phrases,
      minusWords: state.minusWords,
      ui: state.ui,
    });

    const start = performance.now();
    const parsed = JSON.parse(json);
    const duration = performance.now() - start;

    console.log(`  [JSON deserialize] ${duration.toFixed(1)} ms`);

    expect(parsed.phrases.length).toBe(state.phrases.length);
    expect(duration).toBeLessThan(300);
  });

  test('selectAllPhrases < 100ms при 100k фраз', () => {
    const start = performance.now();
    useAppStore.getState().selectAllPhrases();
    const duration = performance.now() - start;

    console.log(`  [selectAllPhrases] ${duration.toFixed(2)}ms, selected: ${useAppStore.getState().selectedPhraseIds.size}`);

    useAppStore.getState().clearPhraseSelection();

    expect(duration).toBeLessThan(100);
  });

  test('clearPhraseSelection < 50ms при 100k выбранных фраз', () => {
    // First select all
    useAppStore.getState().selectAllPhrases();

    const start = performance.now();
    useAppStore.getState().clearPhraseSelection();
    const duration = performance.now() - start;

    console.log(`  [clearPhraseSelection] ${duration.toFixed(2)}ms`);

    expect(duration).toBeLessThan(MUTATION_THRESHOLD_MS);
  });
});
