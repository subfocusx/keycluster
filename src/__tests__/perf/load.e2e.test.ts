// ============================================================
// E2E Performance Test: Load 100k Keywords into Electron App
// ============================================================
//
// This test requires Playwright + running Electron app.
// It is SKIPPED by default because it needs:
//   1. Built Electron app (npm run build + electron)
//   2. Playwright with Electron support
//
// To run manually:
//   1. Build the app: npm run build
//   2. Start Electron: npm run electron
//   3. Run: npx vitest run src/__tests__/perf/load.e2e.test.ts
//
// Порог провала:
//   * загрузка > 10 секунд
//   * FPS при скролле < 30
//   * приложение упало/зависло

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { generateCSV } from './helpers/generate-keys';
import * as fs from 'fs';
import * as path from 'path';

const SKIP_E2E = !process.env.RUN_E2E_PERF;

describe.skipIf(SKIP_E2E)('E2E Load Performance', () => {
  const CSV_PATH = path.join(__dirname, 'test-100k.csv');
  const csvData = generateCSV(100_000);

  beforeAll(() => {
    console.log(`\n=== E2E LOAD PERFORMANCE TEST ===`);
    console.log(`Generating 100k CSV...`);

    // Write CSV file for import
    fs.writeFileSync(CSV_PATH, csvData, 'utf-8');
    const sizeMB = (Buffer.byteLength(csvData) / 1024 / 1024).toFixed(1);
    console.log(`CSV written: ${CSV_PATH} (${sizeMB} MB)`);
    console.log(``);
  });

  afterAll(() => {
    // Clean up
    if (fs.existsSync(CSV_PATH)) {
      fs.unlinkSync(CSV_PATH);
    }
    console.log(`\nCleaned up test CSV file`);
  });

  test('CSV-файл с 100k ключей создан корректно', () => {
    const lines = csvData.split('\n');
    expect(lines.length).toBe(100_001); // header + 100k rows

    const header = lines[0];
    expect(header).toContain('Фраза');
    expect(header).toContain('Частота');

    // Sample first data row
    const firstRow = lines[1];
    expect(firstRow).toBeTruthy();
    expect(firstRow.length).toBeGreaterThan(5);
  });

  test('CSV размер разумный', () => {
    const sizeBytes = Buffer.byteLength(csvData);
    const sizeMB = sizeBytes / 1024 / 1024;

    console.log(`  CSV size: ${sizeMB.toFixed(1)} MB`);

    // 100k phrases CSV should be < 50MB
    expect(sizeMB).toBeLessThan(50);
  });

  // The following tests require a real browser/Electron environment.
  // They are documented here as specifications but need Playwright to run.

  test.todo('загрузка CSV через UI < 10 секунд', async () => {
    // 1. Launch Electron app with Playwright
    // 2. Click "Файл" → "Импорт"
    // 3. Upload test-100k.csv
    // 4. Click "Импортировать"
    // 5. Wait for table to populate
    // 6. Measure time from click to table render
    // EXPECT: < 10 seconds
  });

  test.todo('FPS при скролле таблицы >= 30', async () => {
    // 1. After loading 100k phrases
    // 2. Use CDP to measure FPS
    // 3. Scroll the table programmatically
    // 4. Record FPS during scroll
    // EXPECT: FPS >= 30
    //
    // Playwright CDP approach:
    // const client = await page.context().newCDPSession(page);
    // await client.send('Performance.enable');
    // const metrics = await client.send('Performance.getMetrics');
  });

  test.todo('приложение не крашится при 100k', async () => {
    // 1. Load 100k phrases
    // 2. Wait 30 seconds
    // 3. Check if app is still responsive
    // 4. Check for "Page Unresponsive" dialog
    // EXPECT: No crash, no unresponsive dialog
  });

  // Instead of real E2E, we can test the import logic in-process

  test('parseCSV обрабатывает 100k строк за разумное время', () => {
    const { parseCSV } = require('@user-plugins/import-export/index');

    const start = performance.now();
    const rows = parseCSV(csvData, ';');
    const duration = performance.now() - start;

    console.log(`  [parseCSV 100k] ${duration.toFixed(0)} ms, rows: ${rows.length}`);

    expect(duration).toBeLessThan(10_000);
    expect(rows.length).toBe(100_001); // header + data
  });

  test('импорт 100k фраз в store через addPhrases', () => {
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

    const { useAppStore } = require('@/plugin-sdk');
    const { parseCSV } = require('@user-plugins/import-export/index');
    const { generateKeys } = require('./helpers/generate-keys');

    // Parse CSV
    const rows = parseCSV(csvData, ';');

    // Extract just the phrases (column 0, skip header)
    const phraseTexts = rows.slice(1).map((row: string[]) => row[0]?.replace(/^"|"$/g, '')).filter(Boolean);

    // Import into store
    const store = useAppStore.getState();
    store.clearAll();
    const groupId = store.addGroup('Импорт 100k');

    const start = performance.now();
    store.addPhrases(phraseTexts.slice(0, 100_000), groupId);
    const duration = performance.now() - start;

    const phraseCount = useAppStore.getState().phrases.length;
    console.log(`  [addPhrases 100k] ${duration.toFixed(0)} ms, loaded: ${phraseCount.toLocaleString()}`);

    expect(duration).toBeLessThan(10_000);
    expect(phraseCount).toBe(100_000);

    // Cleanup
    store.clearAll();
  });
});

// Always-run summary
describe('E2E Test Prerequisites', () => {
  test('E2E статус', () => {
    if (SKIP_E2E) {
      console.log(`\n  E2E tests are SKIPPED. Set RUN_E2E_PERF=1 to enable.`);
      console.log(`  Prerequisites:`);
      console.log(`    1. Build: npm run build`);
      console.log(`    2. Install Playwright: npm install -D @playwright/test`);
      console.log(`    3. Run: RUN_E2E_PERF=1 npx vitest run src/__tests__/perf/load.e2e.test.ts`);
    }
    expect(true).toBe(true);
  });
});
