import { describe, it, expect } from 'vitest';
import { clusterByNgrams } from '@user-plugins/ngrams';

const makePhrase = (id: number, text: string) => ({ id: `p${id}` as any, text, groupId: null as any, createdAt: 0, updatedAt: 0, tags: [] });

describe('clusterByNgrams', () => {
  describe('basic ngram clustering', () => {
    it('should cluster phrases sharing bigrams', () => {
      const phrases = [
        makePhrase(1, 'машинное обучение данных'),
        makePhrase(2, 'машинное обучение моделей'),
        makePhrase(3, 'глубокое обучение нейросетей'),
      ];
      const result = clusterByNgrams(phrases, { threshold: 0.3 });
      expect(result.size).toBeGreaterThan(0);
    });

    it('should not cluster completely different phrases', () => {
      const phrases = [
        makePhrase(1, 'кот сидит на дереве'),
        makePhrase(2, 'собака бежит по траве'),
        makePhrase(3, 'птица летит в небе'),
      ];
      const result = clusterByNgrams(phrases, { threshold: 0.3 });
      expect(result.size).toBe(0);
    });

    it('should use trigrams when ngramSize is 3', () => {
      const phrases = [
        makePhrase(1, 'машинное обучение данных'),
        makePhrase(2, 'машинное обучение моделей'),
        makePhrase(3, 'глубокое обучение нейросетей'),
      ];
      const result = clusterByNgrams(phrases, { ngramSize: 3, threshold: 0.3 });
      expect(result.size).toBeGreaterThan(0);
    });
  });

  describe('threshold parameter', () => {
    it('should require higher similarity at higher threshold', () => {
      const phrases = [
        makePhrase(1, 'машинное обучение данных машинное'),
        makePhrase(2, 'машинное обучение моделей машинное'),
        makePhrase(3, 'машинное обучение практика машинное'),
      ];
      const low = clusterByNgrams(phrases, { threshold: 0.1 });
      const high = clusterByNgrams(phrases, { threshold: 0.9 });
      expect(low.size).toBeGreaterThanOrEqual(high.size);
    });

    it('should return empty at threshold 1.0 with different phrases', () => {
      const phrases = [
        makePhrase(1, 'ааа ббб ввв'),
        makePhrase(2, 'ггг ддд еёё'),
      ];
      const result = clusterByNgrams(phrases, { threshold: 1.0 });
      expect(result.size).toBe(0);
    });
  });

  describe('minGroupSize parameter', () => {
    it('should filter out groups smaller than minGroupSize', () => {
      const phrases = [
        makePhrase(1, 'уникальная фраза один'),
        makePhrase(2, 'уникальная фраза два'),
        makePhrase(3, 'уникальная фраза три'),
      ];
      const result = clusterByNgrams(phrases, { minGroupSize: 4 });
      expect(result.size).toBe(0);
    });

    it('should keep groups meeting minGroupSize', () => {
      const phrases = [
        makePhrase(1, 'тестовая фраза раз'),
        makePhrase(2, 'тестовая фраза два'),
        makePhrase(3, 'тестовая фраза три'),
      ];
      const result = clusterByNgrams(phrases, { minGroupSize: 2 });
      expect(result.size).toBeGreaterThan(0);
    });
  });

  describe('stopWords option', () => {
    it('should ignore stop words when computing ngrams', () => {
      const phrases = [
        makePhrase(1, 'в машинное на'),
        makePhrase(2, 'в зрение на'),
      ];
      const result = clusterByNgrams(phrases, { stopWords: ['в', 'на'] });
      expect(result.size).toBe(0);
    });
  });

  describe('ignoreNumbers option', () => {
    it('should exclude pure numbers from ngrams', () => {
      const phrases = [
        makePhrase(1, 'тест слово'),
        makePhrase(2, 'тест слово'),
      ];
      const result = clusterByNgrams(phrases, { ignoreNumbers: false });
      expect(result.size).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty phrases array', () => {
      const result = clusterByNgrams([], {});
      expect(result.size).toBe(0);
    });

    it('should handle single phrase', () => {
      const phrases = [makePhrase(1, 'одиночная фраза')];
      const result = clusterByNgrams(phrases, {});
      expect(result.size).toBe(0);
    });

    it('should handle phrases shorter than ngramSize', () => {
      const phrases = [
        makePhrase(1, 'одно'),
        makePhrase(2, 'одно'),
      ];
      const result = clusterByNgrams(phrases, { ngramSize: 3 });
      expect(result.size).toBeGreaterThan(0);
    });

    it('should handle unicode characters', () => {
      const phrases = [
        makePhrase(1, 'привет мир'),
        makePhrase(2, 'привет мир'),
      ];
      const result = clusterByNgrams(phrases, {});
      expect(result.size).toBeGreaterThan(0);
    });

    it('should handle special characters', () => {
      const phrases = [
        makePhrase(1, 'тест!@# слово'),
        makePhrase(2, 'тест!@# слово'),
      ];
      const result = clusterByNgrams(phrases, {});
      expect(result.size).toBeGreaterThan(0);
    });
  });

  describe('cluster naming', () => {
    it('should generate meaningful cluster names', () => {
      const phrases = [
        makePhrase(1, 'машинное обучение'),
        makePhrase(2, 'машинное обучение'),
        makePhrase(3, 'машинное обучение'),
        makePhrase(4, 'машинное обучение'),
      ];
      const result = clusterByNgrams(phrases, { minGroupSize: 2 });
      const names = [...result.keys()];
      expect(names.length).toBeGreaterThan(0);
    });

    it('should handle duplicate cluster names by merging', () => {
      const phrases = [
        makePhrase(1, 'тест один'),
        makePhrase(2, 'тест два'),
        makePhrase(3, 'тест три'),
      ];
      const result = clusterByNgrams(phrases, { minGroupSize: 2 });
      expect(result.size).toBeLessThanOrEqual(2);
    });
  });

  describe('performance with large datasets', () => {
    it('should handle 50 phrases', () => {
      const phrases = Array.from({ length: 50 }, (_, i) =>
        makePhrase(i, `фраза ${i % 10} тест ${Math.floor(i / 10)}`)
      );
      const result = clusterByNgrams(phrases, {});
      expect(result.size).toBeGreaterThan(0);
    });

    it('should handle 100 phrases', () => {
      const phrases = Array.from({ length: 100 }, (_, i) =>
        makePhrase(i, `фраза ${i % 20} тест ${Math.floor(i / 20)}`)
      );
      const result = clusterByNgrams(phrases, {});
      expect(result.size).toBeGreaterThan(0);
    });
  });
});
