// ============================================================
// Tests: modules/cross-search/index.ts — findDuplicates
// ============================================================

import { describe, it, expect } from 'vitest';
import { findDuplicates } from '@user-plugins/cross-search/index';
import type { Phrase } from '@/core/types';

function makePhrase(id: string, text: string, groupId: string): Phrase {
  return { id, text, groupId, frequency: 1, createdAt: Date.now() };
}

describe('Phrase', () => {

  it('should find phrases present in multiple groups', () => {
    const phrases = [
      makePhrase('1', 'купить ноутбук', 'g1'),
      makePhrase('2', 'купить ноутбук', 'g2'),
      makePhrase('3', 'аренда квартиры', 'g1'),
    ];
    const dupes = findDuplicates(phrases);
    expect(dupes.size).toBe(1);
    expect(dupes.has('купить ноутбук')).toBe(true);
    const entry = dupes.get('купить ноутбук')!;
    expect(entry.groupIds.size).toBe(2);
    expect(entry.count).toBe(2);
  });

  it('should not flag phrases in only one group', () => {
    const phrases = [
      makePhrase('1', 'ноутбук', 'g1'),
      makePhrase('2', 'телефон', 'g2'),
    ];
    const dupes = findDuplicates(phrases);
    expect(dupes.size).toBe(0);
  });

  it('should be case-insensitive', () => {
    const phrases = [
      makePhrase('1', 'Купить Ноутбук', 'g1'),
      makePhrase('2', 'купить ноутбук', 'g2'),
    ];
    const dupes = findDuplicates(phrases);
    expect(dupes.size).toBe(1);
  });

  it('should handle same phrase in 3+ groups', () => {
    const phrases = [
      makePhrase('1', 'тест', 'g1'),
      makePhrase('2', 'тест', 'g2'),
      makePhrase('3', 'тест', 'g3'),
    ];
    const dupes = findDuplicates(phrases);
    expect(dupes.size).toBe(1);
    expect(dupes.get('тест')!.groupIds.size).toBe(3);
    expect(dupes.get('тест')!.count).toBe(3);
  });

  it('should handle duplicate phrases within same group', () => {
    const phrases = [
      makePhrase('1', 'ноутбук', 'g1'),
      makePhrase('2', 'ноутбук', 'g1'),
    ];
    const dupes = findDuplicates(phrases);
    // Same group, not multiple groups => no duplicate
    expect(dupes.size).toBe(0);
  });

  it('should trim text for comparison', () => {
    const phrases = [
      makePhrase('1', '  ноутбук  ', 'g1'),
      makePhrase('2', 'ноутбук', 'g2'),
    ];
    const dupes = findDuplicates(phrases);
    expect(dupes.size).toBe(1);
  });

  it('should return empty for empty input', () => {
    const dupes = findDuplicates([]);
    expect(dupes.size).toBe(0);
  });

  it('should find multiple different duplicate phrases', () => {
    const phrases = [
      makePhrase('1', 'ноутбук', 'g1'),
      makePhrase('2', 'ноутбук', 'g2'),
      makePhrase('3', 'телефон', 'g1'),
      makePhrase('4', 'телефон', 'g3'),
      makePhrase('5', 'уникальная фраза', 'g1'),
    ];
    const dupes = findDuplicates(phrases);
    expect(dupes.size).toBe(2);
    expect(dupes.has('ноутбук')).toBe(true);
    expect(dupes.has('телефон')).toBe(true);
  });
});
