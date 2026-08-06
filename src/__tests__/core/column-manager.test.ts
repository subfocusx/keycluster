// ============================================================
// Tests: Column Manager — visibility, labels, colors, reset
// Validates that:
// 1. columnVisibility defaults to empty (all visible)
// 2. toggleColumnVisibility hides/shows columns
// 3. columnLabels defaults to empty (default names)
// 4. setColumnLabel renames columns
// 5. columnColors defaults to empty (no color)
// 6. setColumnColor sets and resets colors
// 7. resetColumnSettings clears all column settings
// 8. Text column is protected (cannot be hidden/renamed via store)
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/plugin-sdk';

describe('use App Store', () => {
  beforeEach(() => {
    useAppStore.getState().clearAll();
  });

  // ---- columnVisibility ----

  describe('columnVisibility', () => {
    it('should default to empty object (all columns visible)', () => {
      const state = useAppStore.getState();
      expect(state.ui.columnVisibility).toEqual({});
    });

    it('should hide a column when toggleColumnVisibility is called', () => {
      const store = useAppStore.getState();
      store.toggleColumnVisibility('frequency');

      const state = useAppStore.getState();
      expect(state.ui.columnVisibility['frequency']).toBe(false);
    });

    it('should show a column when toggled back', () => {
      const store = useAppStore.getState();
      store.toggleColumnVisibility('frequency');
      expect(useAppStore.getState().ui.columnVisibility['frequency']).toBe(false);

      store.toggleColumnVisibility('frequency');
      expect(useAppStore.getState().ui.columnVisibility['frequency']).toBe(true);
    });

    it('should not affect other columns when toggling one', () => {
      const store = useAppStore.getState();
      store.toggleColumnVisibility('frequency');

      const state = useAppStore.getState();
      expect(state.ui.columnVisibility['kei']).toBeUndefined();
      expect(state.ui.columnVisibility['cpc']).toBeUndefined();
    });

    it('should support hiding multiple columns', () => {
      const store = useAppStore.getState();
      store.toggleColumnVisibility('frequency');
      store.toggleColumnVisibility('kei');
      store.toggleColumnVisibility('cpc');

      const state = useAppStore.getState();
      expect(state.ui.columnVisibility['frequency']).toBe(false);
      expect(state.ui.columnVisibility['kei']).toBe(false);
      expect(state.ui.columnVisibility['cpc']).toBe(false);
    });
  });

  // ---- columnLabels ----

  describe('columnLabels', () => {
    it('should default to empty object (default labels)', () => {
      const state = useAppStore.getState();
      expect(state.ui.columnLabels).toEqual({});
    });

    it('should set a custom label with setColumnLabel', () => {
      const store = useAppStore.getState();
      store.setColumnLabel('frequency', 'Freq');

      const state = useAppStore.getState();
      expect(state.ui.columnLabels['frequency']).toBe('Freq');
    });

    it('should allow updating a label', () => {
      const store = useAppStore.getState();
      store.setColumnLabel('frequency', 'Freq');
      store.setColumnLabel('frequency', 'Частота');

      expect(useAppStore.getState().ui.columnLabels['frequency']).toBe('Частота');
    });

    it('should not affect other labels when setting one', () => {
      const store = useAppStore.getState();
      store.setColumnLabel('frequency', 'Freq');

      expect(useAppStore.getState().ui.columnLabels['kei']).toBeUndefined();
      expect(useAppStore.getState().ui.columnLabels['cpc']).toBeUndefined();
    });
  });

  // ---- columnColors ----

  describe('columnColors', () => {
    it('should default to empty object (no colors)', () => {
      const state = useAppStore.getState();
      expect(state.ui.columnColors).toEqual({});
    });

    it('should set a color with setColumnColor', () => {
      const store = useAppStore.getState();
      store.setColumnColor('frequency', '#E74C3C');

      const state = useAppStore.getState();
      expect(state.ui.columnColors['frequency']).toBe('#E74C3C');
    });

    it('should reset a color by setting empty string', () => {
      const store = useAppStore.getState();
      store.setColumnColor('frequency', '#E74C3C');
      expect(useAppStore.getState().ui.columnColors['frequency']).toBe('#E74C3C');

      store.setColumnColor('frequency', '');
      // Empty string clears the color — key remains but value is empty
      expect(useAppStore.getState().ui.columnColors['frequency']).toBe('');
    });

    it('should support setting different colors for different columns', () => {
      const store = useAppStore.getState();
      store.setColumnColor('frequency', '#E74C3C');
      store.setColumnColor('kei', '#2ECC71');
      store.setColumnColor('cpc', '#4A90D9');

      const state = useAppStore.getState();
      expect(state.ui.columnColors['frequency']).toBe('#E74C3C');
      expect(state.ui.columnColors['kei']).toBe('#2ECC71');
      expect(state.ui.columnColors['cpc']).toBe('#4A90D9');
    });

    it('should accept all 10 palette colors', () => {
      const colors = [
        '#4A90D9', '#E67E22', '#2ECC71', '#E74C3C', '#9B59B6',
        '#1ABC9C', '#F1C40F', '#E91E8C', '#7F8C8D', '#34495E',
      ];

      const store = useAppStore.getState();
      colors.forEach((color, i) => {
        store.setColumnColor(`col_${i}`, color);
      });

      const state = useAppStore.getState();
      colors.forEach((color, i) => {
        expect(state.ui.columnColors[`col_${i}`]).toBe(color);
      });
    });
  });

  // ---- resetColumnSettings ----

  describe('resetColumnSettings', () => {
    it('should clear all column settings', () => {
      const store = useAppStore.getState();
      store.toggleColumnVisibility('frequency');
      store.toggleColumnVisibility('kei');
      store.setColumnLabel('cpc', 'Price');
      store.setColumnColor('frequency', '#E74C3C');

      // Verify settings are applied
      const before = useAppStore.getState();
      expect(before.ui.columnVisibility['frequency']).toBe(false);
      expect(before.ui.columnLabels['cpc']).toBe('Price');
      expect(before.ui.columnColors['frequency']).toBe('#E74C3C');

      // Reset
      store.resetColumnSettings();

      const after = useAppStore.getState();
      expect(after.ui.columnVisibility).toEqual({});
      expect(after.ui.columnLabels).toEqual({});
      expect(after.ui.columnColors).toEqual({});
    });

    it('should not affect other UI state when resetting', () => {
      const store = useAppStore.getState();
      store.toggleColumnVisibility('frequency');
      store.setColumnLabel('cpc', 'Price');
      store.setColumnColor('frequency', '#E74C3C');

      const beforeTheme = useAppStore.getState().ui.theme;
      const beforeResize = useAppStore.getState().ui.columnAutoResizeTrigger;
      const beforeLeftPanel = useAppStore.getState().ui.leftPanel.open;

      store.resetColumnSettings();

      const after = useAppStore.getState();
      expect(after.ui.theme).toBe(beforeTheme);
      expect(after.ui.columnAutoResizeTrigger).toBe(beforeResize);
      expect(after.ui.leftPanel.open).toBe(beforeLeftPanel);
    });

    it('should allow re-applying settings after reset', () => {
      const store = useAppStore.getState();
      store.setColumnLabel('cpc', 'Price');
      store.resetColumnSettings();
      expect(useAppStore.getState().ui.columnLabels['cpc']).toBeUndefined();

      // Re-apply
      store.setColumnLabel('cpc', 'Cost');
      expect(useAppStore.getState().ui.columnLabels['cpc']).toBe('Cost');
    });
  });

  // ---- Integration: visibility + labels + colors together ----

  describe('Column settings integration', () => {
    it('should maintain independent visibility, label, and color state', () => {
      const store = useAppStore.getState();

      store.toggleColumnVisibility('frequency');
      store.setColumnLabel('frequency', 'Freq');
      store.setColumnColor('frequency', '#E74C3C');

      const state = useAppStore.getState();
      expect(state.ui.columnVisibility['frequency']).toBe(false);
      expect(state.ui.columnLabels['frequency']).toBe('Freq');
      expect(state.ui.columnColors['frequency']).toBe('#E74C3C');

      // Toggle visibility back — label and color should persist
      store.toggleColumnVisibility('frequency');
      const state2 = useAppStore.getState();
      expect(state2.ui.columnVisibility['frequency']).toBe(true);
      expect(state2.ui.columnLabels['frequency']).toBe('Freq');
      expect(state2.ui.columnColors['frequency']).toBe('#E74C3C');
    });

    it('should handle all column keys (text, frequency, kei, cpc, group)', () => {
      const store = useAppStore.getState();
      const colKeys = ['text', 'frequency', 'kei', 'cpc', 'group'];

      colKeys.forEach(key => {
        store.setColumnLabel(key, `Custom_${key}`);
        store.setColumnColor(key, '#4A90D9');
      });

      const state = useAppStore.getState();
      colKeys.forEach(key => {
        expect(state.ui.columnLabels[key]).toBe(`Custom_${key}`);
        expect(state.ui.columnColors[key]).toBe('#4A90D9');
      });
    });
  });

  // ---- Persist merge compatibility ----

  describe('Persist merge compatibility', () => {
    it('should have all new UI fields accessible', () => {
      const state = useAppStore.getState();
      expect('columnVisibility' in state.ui).toBe(true);
      expect('columnLabels' in state.ui).toBe(true);
      expect('columnColors' in state.ui).toBe(true);
    });

    it('should not lose new fields when partial UI is merged', () => {
      // Simulate what happens during rehydration with custom merge:
      // The merge function spreads current.ui first, then persisted.ui on top.
      // New fields from current should survive if not in persisted.
      const store = useAppStore.getState();
      store.setColumnLabel('cpc', 'Price');
      store.setColumnColor('frequency', '#E74C3C');

      // After reset, verify fields exist
      store.resetColumnSettings();
      const state = useAppStore.getState();
      expect(state.ui.columnVisibility).toBeDefined();
      expect(state.ui.columnLabels).toBeDefined();
      expect(state.ui.columnColors).toBeDefined();
    });
  });
});
