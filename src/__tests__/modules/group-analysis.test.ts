import { describe, it, expect } from 'vitest';
import { groupByWords } from '@user-plugins/group-analysis';
import type { Phrase } from '@/plugin-sdk';

const makePhrase = (id: string, text: string): Phrase => ({
  id,
  groupId: 'root',
  text,
  frequency: 100,
  kei: 10,
  cpc: 5,
  createdAt: Date.now(),
});

describe('groupByWords (group-analysis)', () => {
  describe('basic grouping by words', () => {
    it('should group phrases containing the same word', () => {
      const phrases = [
        makePhrase('1', 'машинное обучение'),
        makePhrase('2', 'машинное зрение'),
        makePhrase('3', 'глубокое обучение'),
      ];
      const result = groupByWords(phrases, {});
      const machineGroup = result.find(g => g.word === 'машинное');
      expect(machineGroup).toBeDefined();
      expect(machineGroup!.phrases.length).toBeGreaterThanOrEqual(2);
    });

    it('should not create group for word appearing only once', () => {
      const phrases = [
        makePhrase('1', 'уникальное слово один'),
        makePhrase('2', 'другое слово'),
      ];
      const result = groupByWords(phrases, { minGroupSize: 2 });
      const uniqueGroup = result.find(g => g.word === 'уникальное');
      expect(uniqueGroup).toBeUndefined();
    });
  });

  describe('minGroupSize option', () => {
    it('should filter out groups smaller than minGroupSize', () => {
      const phrases = [
        makePhrase('1', 'тест слово'),
        makePhrase('2', 'тест другая'),
        makePhrase('3', 'тест третья'),
      ];
      const result = groupByWords(phrases, { minGroupSize: 3 });
      const testGroup = result.find(g => g.word === 'тест');
      expect(testGroup).toBeDefined();
    });

    it('should exclude groups below minGroupSize', () => {
      const phrases = [
        makePhrase('1', 'редкое слово'),
        makePhrase('2', 'другое слово'),
      ];
      const result = groupByWords(phrases, { minGroupSize: 3 });
      expect(result.every(g => g.phrases.length >= 3)).toBe(true);
    });
  });

  describe('stopWords option', () => {
    it('should exclude stop words from grouping', () => {
      const phrases = [
        makePhrase('1', 'в слово на'),
        makePhrase('2', 'в другое на'),
      ];
      const result = groupByWords(phrases, { stopWords: ['в', 'на'] });
      const stopWordGroup = result.find(g => g.word === 'в' || g.word === 'на');
      expect(stopWordGroup).toBeUndefined();
    });
  });

  describe('lemmatize option', () => {
    it('should group words with common root when lemmatize is true', () => {
      const phrases = [
        makePhrase('1', 'обучение роботов'),
        makePhrase('2', 'обучение машин'),
      ];
      const result = groupByWords(phrases, { lemmatize: true });
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('ignoreNumbers option', () => {
    it('should exclude pure numbers from grouping', () => {
      const phrases = [
        makePhrase('1', 'тест 123'),
        makePhrase('2', 'тест 456'),
      ];
      const result = groupByWords(phrases, { ignoreNumbers: true });
      const numGroup = result.find(g => g.word === '123' || g.word === '456');
      expect(numGroup).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty phrases array', () => {
      const result = groupByWords([], {});
      expect(result).toEqual([]);
    });

    it('should handle single phrase', () => {
      const phrases = [makePhrase('1', 'одиночная фраза')];
      const result = groupByWords(phrases, {});
      expect(result).toEqual([]);
    });

    it('should handle phrases with special characters', () => {
      const phrases = [
        makePhrase('1', 'тест!@# слово'),
        makePhrase('2', 'тест!@# слово'),
      ];
      const result = groupByWords(phrases, {});
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle unicode text', () => {
      const phrases = [
        makePhrase('1', 'привет мир'),
        makePhrase('2', 'привет мир'),
      ];
      const result = groupByWords(phrases, {});
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('group sorting', () => {
    it('should sort groups by phrase count descending', () => {
      const phrases = [
        makePhrase('1', 'частое слово'),
        makePhrase('2', 'частое слово'),
        makePhrase('3', 'частое слово'),
        makePhrase('4', 'редкое слово'),
        makePhrase('5', 'редкое слово'),
      ];
      const result = groupByWords(phrases, { minGroupSize: 2 });
      expect(result[0].phrases.length).toBeGreaterThanOrEqual(result[1].phrases.length);
    });
  });

  describe('phrases appear in multiple groups', () => {
    it('should allow same phrase in multiple word groups', () => {
      const phrases = [
        makePhrase('1', 'машинное обучение'),
        makePhrase('2', 'машинное зрение'),
        makePhrase('3', 'глубокое обучение'),
      ];
      const result = groupByWords(phrases, { minGroupSize: 2 });
      const machineGroup = result.find(g => g.word === 'машинное');
      const learningGroup = result.find(g => g.word === 'обучение');
      expect(machineGroup).toBeDefined();
      expect(learningGroup).toBeDefined();
    });
  });

  describe('performance', () => {
    it('should handle 100 phrases', () => {
      const phrases = Array.from({ length: 100 }, (_, i) =>
        makePhrase(`p${i}`, `фраза ${i % 10} тест ${Math.floor(i / 10)}`)
      );
      const result = groupByWords(phrases, {});
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
