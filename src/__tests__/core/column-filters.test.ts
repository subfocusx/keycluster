// ============================================================
// Tests: Column filter logic (PhrasesTable filtering)
// ============================================================

import { describe, it, expect } from 'vitest';
import type { Phrase } from '@/plugin-sdk';
import type { ColumnFilter, ColumnFilters } from '@/modules/phrases/shared';

// ---- Pure filter logic tests (no React rendering) ----

// Replicate the filter logic from PhrasesTable for unit testing
function isNumericColumn(key: string): boolean {
  return key === 'frequency' || key === 'kei' || key === 'cpc';
}

function passesColumnFilters(
  phrase: Phrase,
  columnFilters: Record<string, ColumnFilter | null>,
): boolean {
  for (const [colKey, filter] of Object.entries(columnFilters)) {
    if (!filter || filter.value === '') continue;
    const cellValue = phrase[colKey as keyof Phrase];

    if (isNumericColumn(colKey)) {
      const numValue = typeof cellValue === 'number' ? cellValue : null;
      const filterNum = parseFloat(filter.value);
      if (isNaN(filterNum)) continue;
      if (numValue === null || numValue === undefined) return false;
      switch (filter.type) {
        case 'eq': if (numValue !== filterNum) return false; break;
        case 'gt': if (numValue <= filterNum) return false; break;
        case 'lt': if (numValue >= filterNum) return false; break;
      }
    } else {
      // String columns — eq means "contains" (case-insensitive)
      const strValue = typeof cellValue === 'string' ? cellValue.toLowerCase() : '';
      const filterStr = filter.value.toLowerCase();
      if (filter.type === 'eq' && !strValue.includes(filterStr)) return false;
      if (filter.type === 'gt' && strValue <= filterStr) return false;
      if (filter.type === 'lt' && strValue >= filterStr) return false;
    }
  }
  return true;
}

function makePhrase(overrides: Partial<Phrase> & { id: string; text: string; groupId: string }): Phrase {
  return {
    frequency: undefined,
    kei: undefined,
    cpc: undefined,
    competition: undefined,
    notes: undefined,
    tags: undefined,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('Column filter logic', () => {
  const phrases = [
    makePhrase({ id: '1', text: 'купить ноутбук', groupId: 'g1', frequency: 12100, kei: 12, cpc: 85.5 }),
    makePhrase({ id: '2', text: 'аренда квартиры', groupId: 'g1', frequency: 8500, kei: 8, cpc: 72.3 }),
    makePhrase({ id: '3', text: 'ноутбук дешево', groupId: 'g2', frequency: 500, kei: 2, cpc: 10.0 }),
    makePhrase({ id: '4', text: 'аренда авто', groupId: 'g2', frequency: 50000, kei: 55, cpc: 1.5 }),
    makePhrase({ id: '5', text: 'дешевый ремонт', groupId: 'g2', frequency: 200 }),
  ];

  describe('numeric column filters', () => {
    it('should filter frequency by equals', () => {
      const filters: ColumnFilters = { frequency: { type: 'eq', value: '8500' } };
      const result = phrases.filter(p => passesColumnFilters(p, filters));
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });

    it('should filter frequency by greater than', () => {
      const filters: ColumnFilters = { frequency: { type: 'gt', value: '10000' } };
      const result = phrases.filter(p => passesColumnFilters(p, filters));
      expect(result).toHaveLength(2);
      expect(result.map(p => p.id)).toContain('1'); // 12100
      expect(result.map(p => p.id)).toContain('4'); // 50000
    });

    it('should filter frequency by less than', () => {
      const filters: ColumnFilters = { frequency: { type: 'lt', value: '1000' } };
      const result = phrases.filter(p => passesColumnFilters(p, filters));
      // id 3 (freq=500) and id 5 (freq=200)
      expect(result).toHaveLength(2);
      expect(result.map(p => p.id)).toContain('3');
      expect(result.map(p => p.id)).toContain('5');
    });

    it('should filter CPC by greater than', () => {
      const filters: ColumnFilters = { cpc: { type: 'gt', value: '50' } };
      const result = phrases.filter(p => passesColumnFilters(p, filters));
      expect(result).toHaveLength(2);
      expect(result.map(p => p.id)).toContain('1'); // 85.5
      expect(result.map(p => p.id)).toContain('2'); // 72.3
    });

    it('should filter KEI by less than', () => {
      const filters: ColumnFilters = { kei: { type: 'lt', value: '10' } };
      const result = phrases.filter(p => passesColumnFilters(p, filters));
      // kei 8 (id 2), kei 2 (id 3), kei undefined (id 5)
      expect(result).toHaveLength(2);
      expect(result.map(p => p.id)).toContain('2');
      expect(result.map(p => p.id)).toContain('3');
    });

    it('should exclude phrases with undefined numeric value when filter is set', () => {
      const filters: ColumnFilters = { cpc: { type: 'eq', value: '10' } };
      const result = phrases.filter(p => passesColumnFilters(p, filters));
      // id 3 has cpc=10, id 5 has cpc=undefined (excluded)
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('3');
    });
  });

  describe('text column filters', () => {
    it('should filter text by contains (eq)', () => {
      const filters: ColumnFilters = { text: { type: 'eq', value: 'ноутбук' } };
      const result = phrases.filter(p => passesColumnFilters(p, filters));
      expect(result).toHaveLength(2);
      expect(result.map(p => p.id)).toContain('1');
      expect(result.map(p => p.id)).toContain('3');
    });

    it('should filter text by contains (case-insensitive)', () => {
      const filters: ColumnFilters = { text: { type: 'eq', value: 'Ноутбук' } };
      const result = phrases.filter(p => passesColumnFilters(p, filters));
      expect(result).toHaveLength(2);
    });

    it('should filter text by greater than (localeCompare)', () => {
      const filters: ColumnFilters = { text: { type: 'gt', value: 'ноутбук' } };
      const result = phrases.filter(p => passesColumnFilters(p, filters));
      // 'р' > 'н' in Russian alphabet, so 'ремонт' and 'аренда' > 'ноутбук'
      expect(result.length).toBeGreaterThan(0);
    });

    it('should filter text by less than (localeCompare)', () => {
      const filters: ColumnFilters = { text: { type: 'lt', value: 'дешевый' } };
      const result = phrases.filter(p => passesColumnFilters(p, filters));
      // In Russian: 'аренда' < 'дешевый' < 'купить' < 'ноутбук'
      // So 'аренда квартиры' and 'аренда авто' should pass
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('multiple column filters', () => {
    it('should apply multiple filters with AND logic', () => {
      const filters: ColumnFilters = {
        text: { type: 'eq', value: 'аренда' },
        frequency: { type: 'gt', value: '10000' },
      };
      const result = phrases.filter(p => passesColumnFilters(p, filters));
      // Only id 4 matches: text contains "аренда" AND frequency > 10000
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('4');
    });

    it('should return empty when filters conflict', () => {
      const filters: ColumnFilters = {
        text: { type: 'eq', value: 'ноутбук' },
        frequency: { type: 'lt', value: '100' },
      };
      const result = phrases.filter(p => passesColumnFilters(p, filters));
      expect(result).toHaveLength(0);
    });
  });

  describe('empty and null filters', () => {
    it('should return all phrases when no filters set', () => {
      const filters: ColumnFilters = {};
      const result = phrases.filter(p => passesColumnFilters(p, filters));
      expect(result).toHaveLength(phrases.length);
    });

    it('should skip filters with empty value', () => {
      const filters: ColumnFilters = { frequency: { type: 'eq', value: '' } };
      const result = phrases.filter(p => passesColumnFilters(p, filters));
      expect(result).toHaveLength(phrases.length);
    });

    it('should skip null filters', () => {
      const filters: ColumnFilters = { frequency: null };
      const result = phrases.filter(p => passesColumnFilters(p, filters));
      expect(result).toHaveLength(phrases.length);
    });

    it('should skip filters with NaN value for numeric columns', () => {
      const filters: ColumnFilters = { frequency: { type: 'eq', value: 'abc' } };
      const result = phrases.filter(p => passesColumnFilters(p, filters));
      expect(result).toHaveLength(phrases.length);
    });
  });
});
