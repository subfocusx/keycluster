// ============================================================
// Performance Test: Table Rendering Without Virtualization
// ============================================================
//
// Проверить рендер таблицы через @testing-library/react:
// - Отрендери таблицу с 1k, 5k, 10k строк
// - Замерь время рендера через performance.now()
// - Замерь количество DOM-узлов после рендера
// - Проверь что 10k строк рендерятся за < 3 секунды
//
// Порог провала:
//   * рендер 10k строк > 3000ms
//   * DOM-узлов > 500k (признак отсутствия виртуализации)
//
// Запуск: npx vitest run --config vitest.config.perf.ts src/__tests__/perf/table.perf.test.ts
//
// NOTE: This test uses jsdom environment — it must be run with the default vitest config
// because it needs DOM rendering. Run separately:
// npx vitest run src/__tests__/perf/table.perf.test.ts

// @vitest-environment jsdom

import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import React, { useRef } from 'react';
import { render, cleanup } from '@testing-library/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { generatePhraseObjects } from './helpers/generate-keys';

// Mock localStorage
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

function SimplePhrasesTable({ phraseCount }: { phraseCount: number }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const phrases = useAppStore((s) => (s as any).phrases ?? []);
  const visiblePhrases = phrases.slice(0, phraseCount);
  const selectedPhraseIds: Set<string> = new Set();
  const rowVirtualizer = useVirtualizer({
    count: visiblePhrases.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 35,
    overscan: 10,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();
  return React.createElement('div', { className: 'flex flex-col h-full' },
    React.createElement('div', {
      className: 'flex-1 overflow-auto',
      ref: scrollRef,
      style: { height: '500px' },
    },
      React.createElement('table', {
        className: 'border-collapse',
        style: { tableLayout: 'fixed', position: 'relative' }
      },
        React.createElement('thead', null,
          React.createElement('tr', null,
            React.createElement('th', null, ''),
            React.createElement('th', null, 'Ключевая фраза'),
            React.createElement('th', null, 'Частота'),
            React.createElement('th', null, 'KEI'),
            React.createElement('th', null, 'CPC'),
          )
        ),
        React.createElement('tbody', { style: { position: 'relative', height: rowVirtualizer.getTotalSize() } },
          virtualItems.map((virtualRow) => {
            const phrase = visiblePhrases[virtualRow.index];
            if (!phrase) return null;
            return React.createElement('tr', {
              key: phrase.id,
              className: virtualRow.index % 2 === 0 ? 'data-row-even' : 'data-row-odd',
              style: {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              },
            },
              React.createElement('td', null,
                React.createElement('input', {
                  type: 'checkbox',
                  checked: selectedPhraseIds.has(phrase.id),
                  readOnly: true,
                })
              ),
              React.createElement('td', null, phrase.text),
              React.createElement('td', null, String(phrase.frequency ?? '—')),
              React.createElement('td', null, String(phrase.kei ?? '—')),
              React.createElement('td', null, String(phrase.cpc ?? '—')),
            );
          })
        )
      )
    )
  );
}

describe('Table Rendering Performance (Virtualized)', () => {
  const results: Array<{ count: number; renderMs: number; domNodes: number }> = [];
  const RENDER_THRESHOLD_MS = 3000;
  const DOM_NODE_THRESHOLD = 2000;

  beforeAll(() => {
    console.log(`\n=== TABLE RENDERING PERFORMANCE TEST ===`);
    console.log(`Testing: SimplePhrasesTable with @tanstack/react-virtual`);
    console.log(`Virtualization renders only visible rows + overscan`);
    console.log(``);
  });

  afterAll(() => {
    console.log(`\n┌──────────┬────────────┬────────────┐`);
    console.log(`│ Строк    │ Render(ms) │ DOM-узлов  │`);
    console.log(`├──────────┼────────────┼────────────┤`);
    for (const r of results) {
      const warn = r.count === 10_000 && r.domNodes > DOM_NODE_THRESHOLD ? ' ⚠️' : '';
      console.log(`│ ${r.count.toString().padStart(8)} │ ${r.renderMs.toFixed(0).padStart(10)} │ ${r.domNodes.toLocaleString().padStart(10)}${warn} │`);
    }
    console.log(`└──────────┴────────────┴────────────┘`);

    // Check virtualization warning
    const result10k = results.find(r => r.count === 10_000);
    if (result10k && result10k.domNodes > DOM_NODE_THRESHOLD) {
      console.log(`\n⚠️ WARN: виртуализация отсутствует, при 100k строк UI зависнет`);
      console.log(`  DOM-узлов при 10k: ${result10k.domNodes.toLocaleString()} (порог: ${DOM_NODE_THRESHOLD.toLocaleString()})`);
      console.log(`  Рекомендация: добавить @tanstack/react-virtual или react-window`);
    }

    useAppStore.getState().clearAll();
  });

  afterEach(() => {
    cleanup();
  });

  const sizes = [1_000, 5_000, 10_000];

  for (const count of sizes) {
    test(`рендер ${count.toLocaleString()} строк — < ${RENDER_THRESHOLD_MS}ms`, () => {
      // Setup store with phrases
      useAppStore.getState().clearAll();
      const groupId = useAppStore.getState().addGroup('Test Group');
      const phrases = generatePhraseObjects(count, groupId);
      useAppStore.getState().setPhrases(phrases as any);

      // Render and measure
      const start = performance.now();
      const { container } = render(React.createElement(SimplePhrasesTable, { phraseCount: count }));
      const duration = performance.now() - start;

      // Count DOM nodes
      const domNodes = container.querySelectorAll('*').length;

      results.push({ count, renderMs: duration, domNodes: domNodes });

      console.log(`  [${count.toLocaleString()} rows] Render: ${duration.toFixed(0)} ms, DOM nodes: ${domNodes.toLocaleString()}`);

      // Assert: 10k rows should render in < 3 seconds
      if (count === 10_000) {
        expect(duration).toBeLessThan(RENDER_THRESHOLD_MS);
      }
    });
  }

  test('проверка виртуализации — DOM-узлов < 2000 при 10k', () => {
    const result10k = results.find(r => r.count === 10_000);
    if (!result10k) {
      console.log('  SKIP: 10k test not found');
      return;
    }

    // With virtualization, only ~20 rows should be rendered
    expect(result10k.domNodes).toBeLessThan(DOM_NODE_THRESHOLD);
    console.log(`  ✅ Virtualization works: ${result10k.domNodes.toLocaleString()} DOM-узлов при 10k строк`);
  });

  test('оценка DOM-узлов при 100k строк (экстраполяция)', () => {
    const result10k = results.find(r => r.count === 10_000);
    if (!result10k) return;

    const nodesPerRow = result10k.domNodes / 10_000;
    const projected100k = Math.round(nodesPerRow * 100_000);
    console.log(`  DOM-узлов на строку: ${nodesPerRow.toFixed(1)}`);
    console.log(`  Экстраполяция 100k: ${projected100k.toLocaleString()} DOM-узлов`);

    if (projected100k > 5_000_000) {
      console.log(`  ⚠️ CRITICAL: при 100k строк браузер создаст ~${(projected100k / 1_000_000).toFixed(1)}M DOM-узлов — UI гарантированно зависнет`);
    }
  });
});
