// ============================================================
// Tests: Column auto-resize trigger + logic
// Validates that:
// 1. Store has columnAutoResizeTrigger in UI state
// 2. triggerColumnAutoResize() increments the counter
// 3. Auto-resize resets to DEFAULT widths then fits to container
// 4. Auto-resize respects minWidth/maxWidth constraints
// 5. Auto-resize gives leftover space to text column
// 6. Auto-resize produces different results from manually resized state
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/plugin-sdk';

describe('use App Store', () => {
  beforeEach(() => {
    useAppStore.getState().clearAll();
  });

  it('should have columnAutoResizeTrigger default to 0', () => {
    const state = useAppStore.getState();
    expect(state.ui.columnAutoResizeTrigger).toBe(0);
  });

  it('should increment trigger when triggerColumnAutoResize is called', () => {
    const store = useAppStore.getState();
    expect(store.ui.columnAutoResizeTrigger).toBe(0);

    store.triggerColumnAutoResize();
    expect(useAppStore.getState().ui.columnAutoResizeTrigger).toBe(1);

    useAppStore.getState().triggerColumnAutoResize();
    expect(useAppStore.getState().ui.columnAutoResizeTrigger).toBe(2);
  });

  it('should not affect other UI state when triggering resize', () => {
    const beforeTheme = useAppStore.getState().ui.theme;
    const beforeDb = useAppStore.getState().ui.dbPersistenceEnabled;

    useAppStore.getState().triggerColumnAutoResize();

    expect(useAppStore.getState().ui.theme).toBe(beforeTheme);
    expect(useAppStore.getState().ui.dbPersistenceEnabled).toBe(beforeDb);
  });
});

// ---- Pure auto-resize calculation logic ----
// Replicating the FIXED logic from PhrasesTable for unit testing.
// Key: auto-resize always uses DEFAULT widths as the proportional base,
// NOT the current (possibly manually resized) widths.

interface ColDef {
  key: string;
  width: number;
  minWidth: number;
  maxWidth: number;
}

const CHECKBOX_COL = 32;

// DEFAULT column widths — the base for proportional scaling
const DEFAULT_COLS: ColDef[] = [
  { key: 'text', width: 400, minWidth: 80, maxWidth: 2000 },
  { key: 'frequency', width: 90, minWidth: 50, maxWidth: 300 },
  { key: 'kei', width: 64, minWidth: 40, maxWidth: 150 },
  { key: 'cpc', width: 72, minWidth: 40, maxWidth: 150 },
];

/**
 * Auto-resize logic (matches PhrasesTable implementation).
 * Always uses baseDefaults as the base for proportional scaling,
 * ignoring current (possibly manually resized) widths.
 * When no baseDefaults are provided, uses DEFAULT_COLS.
 */
function autoResizeColumns(_currentCols: ColDef[], containerWidth: number, baseDefaults?: ColDef[]): ColDef[] {
  // If baseDefaults explicitly provided as empty, or both _currentCols and DEFAULT_COLS are empty, return as-is
  if (baseDefaults !== undefined && baseDefaults.length === 0) return [];
  // Always use provided defaults (or DEFAULT_COLS) as base for proportional scaling
  const visibleDefaults = baseDefaults ?? DEFAULT_COLS;
  if (visibleDefaults.length === 0 || containerWidth === 0) return _currentCols;

  const availableWidth = containerWidth - CHECKBOX_COL;

  // Step 1: proportional scale based on default widths
  const totalDefaultWidth = visibleDefaults.reduce((sum, c) => sum + c.width, 0);
  const scaleFactor = availableWidth / totalDefaultWidth;

  const newWidths = visibleDefaults.map(c => {
    const scaled = Math.round(c.width * scaleFactor);
    return Math.max(c.minWidth, Math.min(c.maxWidth, scaled));
  });

  // Step 2: if total exceeds available due to min-width constraints, shrink proportionally
  let totalNew = newWidths.reduce((s, w) => s + w, 0);
  if (totalNew > availableWidth) {
    const excess = totalNew - availableWidth;
    const shrinkable = newWidths.map((w, i) => ({
      index: i,
      room: w - visibleDefaults[i].minWidth,
    })).filter(x => x.room > 0);
    const totalRoom = shrinkable.reduce((s, x) => s + x.room, 0);
    if (totalRoom > 0) {
      for (const item of shrinkable) {
        const shrink = Math.round(excess * (item.room / totalRoom));
        newWidths[item.index] = Math.max(visibleDefaults[item.index].minWidth, newWidths[item.index] - shrink);
      }
    }
  } else if (totalNew < availableWidth) {
    // Step 3: give extra space to the text column
    const leftover = availableWidth - totalNew;
    const textIdx = visibleDefaults.findIndex(c => c.key === 'text');
    if (textIdx >= 0) {
      newWidths[textIdx] = Math.min(visibleDefaults[textIdx].maxWidth, newWidths[textIdx] + leftover);
    }
  }

  return visibleDefaults.map((c, i) => ({ ...c, width: newWidths[i] }));
}

describe('Auto-resize column calculation', () => {
  it('should distribute column widths proportionally to fit container', () => {
    const containerWidth = 756;
    const result = autoResizeColumns(DEFAULT_COLS, containerWidth);

    const totalWidth = result.reduce((s, c) => s + c.width, 0);
    expect(totalWidth).toBe(containerWidth - CHECKBOX_COL);
  });

  it('should give leftover space to the text column', () => {
    const containerWidth = 900;
    const result = autoResizeColumns(DEFAULT_COLS, containerWidth);

    const textCol = result.find(c => c.key === 'text')!;
    expect(textCol.width).toBeGreaterThan(400);
    expect(textCol.width).toBeLessThanOrEqual(textCol.maxWidth);
  });

  it('should respect minWidth for all columns', () => {
    const containerWidth = 200;
    const result = autoResizeColumns(DEFAULT_COLS, containerWidth);

    for (const col of result) {
      expect(col.width).toBeGreaterThanOrEqual(col.minWidth);
    }
  });

  it('should respect maxWidth for all columns', () => {
    const containerWidth = 5000;
    const result = autoResizeColumns(DEFAULT_COLS, containerWidth);

    for (const col of result) {
      expect(col.width).toBeLessThanOrEqual(col.maxWidth);
    }
  });

  it('should shrink columns when container is narrow', () => {
    const containerWidth = 350;
    const result = autoResizeColumns(DEFAULT_COLS, containerWidth);

    const textCol = result.find(c => c.key === 'text')!;
    expect(textCol.width).toBeLessThan(400);
  });

  it('should keep numeric columns at reasonable size for wide container', () => {
    const containerWidth = 1200;
    const result = autoResizeColumns(DEFAULT_COLS, containerWidth);

    const freqCol = result.find(c => c.key === 'frequency')!;
    const keiCol = result.find(c => c.key === 'kei')!;
    const cpcCol = result.find(c => c.key === 'cpc')!;

    expect(freqCol.width).toBeLessThanOrEqual(300);
    expect(keiCol.width).toBeLessThanOrEqual(150);
    expect(cpcCol.width).toBeLessThanOrEqual(150);
  });

  it('should return unchanged columns for zero container width', () => {
    const result = autoResizeColumns(DEFAULT_COLS, 0);
    expect(result).toEqual(DEFAULT_COLS);
  });

  it('should return unchanged columns for empty array', () => {
    const result = autoResizeColumns([], 800, []);
    expect(result).toEqual([]);
  });

  it('should handle a single column', () => {
    const singleCol: ColDef[] = [
      { key: 'text', width: 400, minWidth: 80, maxWidth: 2000 },
    ];
    const containerWidth = 600;
    const result = autoResizeColumns(singleCol, containerWidth, singleCol);

    expect(result[0].width).toBe(containerWidth - CHECKBOX_COL);
  });

  it('should handle columns with group column (5 visible cols)', () => {
    const colsWithGroup: ColDef[] = [
      { key: 'text', width: 400, minWidth: 80, maxWidth: 2000 },
      { key: 'frequency', width: 90, minWidth: 50, maxWidth: 300 },
      { key: 'kei', width: 64, minWidth: 40, maxWidth: 150 },
      { key: 'cpc', width: 72, minWidth: 40, maxWidth: 150 },
      { key: 'group', width: 120, minWidth: 60, maxWidth: 400 },
    ];
    const containerWidth = 900;
    const result = autoResizeColumns(colsWithGroup, containerWidth, colsWithGroup);

    const totalWidth = result.reduce((s, c) => s + c.width, 0);
    expect(totalWidth).toBeGreaterThanOrEqual(containerWidth - CHECKBOX_COL - 10);
    expect(totalWidth).toBeLessThanOrEqual(containerWidth - CHECKBOX_COL + 10);

    for (const col of result) {
      expect(col.width).toBeGreaterThanOrEqual(col.minWidth);
      expect(col.width).toBeLessThanOrEqual(col.maxWidth);
    }
  });

  // ---- Key new tests: auto-resize resets to default proportions ----

  it('should produce the same result regardless of current column widths', () => {
    // Even if current columns are manually resized (text=800, freq=200, kei=40, cpc=40),
    // auto-resize should always use DEFAULT widths as the base for scaling
    const manuallyResized: ColDef[] = [
      { key: 'text', width: 800, minWidth: 80, maxWidth: 2000 },
      { key: 'frequency', width: 200, minWidth: 50, maxWidth: 300 },
      { key: 'kei', width: 40, minWidth: 40, maxWidth: 150 },
      { key: 'cpc', width: 40, minWidth: 40, maxWidth: 150 },
    ];

    const containerWidth = 900;
    const resultFromDefault = autoResizeColumns(DEFAULT_COLS, containerWidth);
    const resultFromManual = autoResizeColumns(manuallyResized, containerWidth);

    // Results should be IDENTICAL because auto-resize always uses DEFAULT widths
    expect(resultFromDefault).toEqual(resultFromManual);
  });

  it('should reset manually widened text column back to proportional default', () => {
    const manuallyResized: ColDef[] = [
      { key: 'text', width: 1500, minWidth: 80, maxWidth: 2000 },
      { key: 'frequency', width: 90, minWidth: 50, maxWidth: 300 },
      { key: 'kei', width: 64, minWidth: 40, maxWidth: 150 },
      { key: 'cpc', width: 72, minWidth: 40, maxWidth: 150 },
    ];

    const containerWidth = 756;
    const result = autoResizeColumns(manuallyResized, containerWidth);

    const textCol = result.find(c => c.key === 'text')!;
    // Text should be back to proportional size, NOT 1500
    expect(textCol.width).toBeLessThan(500);
    expect(textCol.width).toBeGreaterThan(300);
  });

  it('should reset manually narrowed columns back to proportional defaults', () => {
    const manuallyNarrowed: ColDef[] = [
      { key: 'text', width: 100, minWidth: 80, maxWidth: 2000 },
      { key: 'frequency', width: 50, minWidth: 50, maxWidth: 300 },
      { key: 'kei', width: 40, minWidth: 40, maxWidth: 150 },
      { key: 'cpc', width: 40, minWidth: 40, maxWidth: 150 },
    ];

    const containerWidth = 1000;
    const result = autoResizeColumns(manuallyNarrowed, containerWidth);

    const textCol = result.find(c => c.key === 'text')!;
    // Text should expand well beyond 100 (manually narrowed)
    expect(textCol.width).toBeGreaterThan(400);
  });

  it('should produce consistent results when called multiple times', () => {
    const containerWidth = 800;
    const result1 = autoResizeColumns(DEFAULT_COLS, containerWidth);
    const result2 = autoResizeColumns(result1, containerWidth);

    // Second call should produce same result (idempotent)
    expect(result1).toEqual(result2);
  });
});
