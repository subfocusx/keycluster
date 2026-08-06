import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { findDuplicates, crossSearchSettings } from '@user-plugins/cross-search';

const makePhrase = (id: number, text: string, groupId: string) =>
  ({ id: `p${id}` as any, text, groupId, createdAt: 0, updatedAt: 0, tags: [] });

describe('cross-search', () => {
  describe('findDuplicates', () => {
    it('should find phrases appearing in multiple groups', () => {
      const phrases = [
        makePhrase(1, 'тест', 'group1'),
        makePhrase(2, 'тест', 'group2'),
        makePhrase(3, 'тест', 'group3'),
      ];
      const result = findDuplicates(phrases);
      expect(result.size).toBe(1);
      expect(result.get('тест')?.groupIds.size).toBe(3);
    });

    it('should not include phrases in single group', () => {
      const phrases = [
        makePhrase(1, 'уникальная', 'group1'),
        makePhrase(2, 'уникальная', 'group1'),
      ];
      const result = findDuplicates(phrases);
      expect(result.size).toBe(0);
    });

    it('should be case insensitive', () => {
      const phrases = [
        makePhrase(1, 'Тест', 'group1'),
        makePhrase(2, 'тест', 'group2'),
      ];
      const result = findDuplicates(phrases);
      expect(result.size).toBe(1);
    });

    it('should trim whitespace', () => {
      const phrases = [
        makePhrase(1, '  тест  ', 'group1'),
        makePhrase(2, 'тест', 'group2'),
      ];
      const result = findDuplicates(phrases);
      expect(result.size).toBe(1);
    });

    it('should count total occurrences', () => {
      const phrases = [
        makePhrase(1, 'тест', 'group1'),
        makePhrase(2, 'тест', 'group1'),
        makePhrase(3, 'тест', 'group2'),
      ];
      const result = findDuplicates(phrases);
      expect(result.get('тест')?.count).toBe(3);
    });

    it('should handle empty array', () => {
      const result = findDuplicates([]);
      expect(result.size).toBe(0);
    });

    it('should handle empty groups', () => {
      const phrases = [
        makePhrase(1, 'тест', ''),
        makePhrase(2, 'тест', ''),
      ];
      const result = findDuplicates(phrases);
      expect(result.size).toBe(0);
    });

    it('should track unique group IDs', () => {
      const phrases = [
        makePhrase(1, 'тест', 'a'),
        makePhrase(2, 'тест', 'b'),
        makePhrase(3, 'тест', 'a'),
      ];
      const result = findDuplicates(phrases);
      expect(result.get('тест')?.groupIds.size).toBe(2);
    });

    it('should preserve original text case', () => {
      const phrases = [
        makePhrase(1, 'Тест с заглавной', 'group1'),
        makePhrase(2, 'тест с заглавной', 'group2'),
      ];
      const result = findDuplicates(phrases);
      expect(result.get('тест с заглавной')?.text).toBe('Тест с заглавной');
    });
  });

  describe('crossSearchSettings.minGroups', () => {
    beforeEach(() => {
      crossSearchSettings.minGroups = 2;
    });

    afterEach(() => {
      crossSearchSettings.minGroups = 2;
    });

    it('should respect minGroups setting', () => {
      crossSearchSettings.minGroups = 4;
      const phrases = [
        makePhrase(1, 'тест', 'g1'),
        makePhrase(2, 'тест', 'g2'),
        makePhrase(3, 'тест', 'g3'),
      ];
      const result = findDuplicates(phrases);
      expect(result.size).toBe(0);
    });

    it('should include when group count meets minGroups', () => {
      crossSearchSettings.minGroups = 2;
      const phrases = [
        makePhrase(1, 'тест', 'g1'),
        makePhrase(2, 'тест', 'g2'),
      ];
      const result = findDuplicates(phrases);
      expect(result.size).toBe(1);
    });

    it('should exclude when group count below minGroups', () => {
      crossSearchSettings.minGroups = 4;
      const phrases = [
        makePhrase(1, 'тест', 'g1'),
        makePhrase(2, 'тест', 'g2'),
        makePhrase(3, 'тест', 'g3'),
      ];
      const result = findDuplicates(phrases);
      expect(result.size).toBe(0);
    });
  });
});
