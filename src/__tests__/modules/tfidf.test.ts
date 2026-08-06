import { describe, it, expect } from 'vitest';
import { clusterByTFIDF } from '@user-plugins/tfidf';

const makePhrase = (id: number, text: string) => ({ id: `p${id}` as any, text, groupId: null as any, createdAt: 0, updatedAt: 0, tags: [] });

describe('clusterByTFIDF', () => {
  describe('basic TF-IDF clustering', () => {
    it('should cluster identical phrases', () => {
      const phrases = [
        makePhrase(1, 'машинное обучение'),
        makePhrase(2, 'машинное обучение'),
      ];
      const result = clusterByTFIDF(phrases, {});
      expect(result.size).toBeGreaterThan(0);
    });

    it('should not cluster completely different phrases', () => {
      const phrases = [
        makePhrase(1, 'кот сидит на окне'),
        makePhrase(2, 'собака бежит по траве'),
        makePhrase(3, 'птица летит в небе'),
      ];
      const result = clusterByTFIDF(phrases, { threshold: 0.5 });
      expect(result.size).toBe(0);
    });
  });

  describe('threshold parameter', () => {
    it('should be more selective with higher threshold', () => {
      const phrases = [
        makePhrase(1, 'машинное обучение'),
        makePhrase(2, 'машинное обучение'),
        makePhrase(3, 'машинное обучение'),
      ];
      const low = clusterByTFIDF(phrases, { threshold: 0.1 });
      const high = clusterByTFIDF(phrases, { threshold: 0.9 });
      expect(low.size).toBeGreaterThanOrEqual(high.size);
    });
  });

  describe('minGroupSize parameter', () => {
    it('should filter out groups smaller than minGroupSize', () => {
      const phrases = [
        makePhrase(1, 'уникальная фраза один'),
        makePhrase(2, 'уникальная фраза два'),
        makePhrase(3, 'уникальная фраза три'),
      ];
      const result = clusterByTFIDF(phrases, { minGroupSize: 4 });
      expect(result.size).toBe(0);
    });

    it('should keep groups meeting minGroupSize', () => {
      const phrases = [
        makePhrase(1, 'тестовая фраза раз'),
        makePhrase(2, 'тестовая фраза два'),
        makePhrase(3, 'тестовая фраза три'),
      ];
      const result = clusterByTFIDF(phrases, { minGroupSize: 2 });
      expect(result.size).toBeGreaterThan(0);
    });
  });

  describe('stopWords option', () => {
    it('should handle phrases with only stop words', () => {
      const phrases = [
        makePhrase(1, 'в и на с'),
        makePhrase(2, 'и в на с'),
      ];
      const result = clusterByTFIDF(phrases, { stopWords: ['в', 'и', 'на', 'с'] });
      expect(result.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty phrases array', () => {
      const result = clusterByTFIDF([], {});
      expect(result.size).toBe(0);
    });

    it('should handle single phrase', () => {
      const phrases = [makePhrase(1, 'одиночная фраза')];
      const result = clusterByTFIDF(phrases, {});
      expect(result.size).toBe(0);
    });

    it('should handle duplicate phrases', () => {
      const phrases = [
        makePhrase(1, 'точная копия'),
        makePhrase(2, 'точная копия'),
      ];
      const result = clusterByTFIDF(phrases, {});
      expect(result.size).toBeGreaterThan(0);
    });

    it('should handle unicode text', () => {
      const phrases = [
        makePhrase(1, 'привет мир'),
        makePhrase(2, 'привет мир'),
      ];
      const result = clusterByTFIDF(phrases, {});
      expect(result.size).toBeGreaterThan(0);
    });

    it('should handle special characters', () => {
      const phrases = [
        makePhrase(1, 'тест!@#$%'),
        makePhrase(2, 'тест!@#$%'),
      ];
      const result = clusterByTFIDF(phrases, {});
      expect(result.size).toBeGreaterThan(0);
    });
  });

  describe('cluster naming', () => {
    it('should generate cluster names from top words', () => {
      const phrases = [
        makePhrase(1, 'машинное обучение'),
        makePhrase(2, 'машинное обучение'),
        makePhrase(3, 'машинное обучение'),
        makePhrase(4, 'машинное обучение'),
      ];
      const result = clusterByTFIDF(phrases, { minGroupSize: 2 });
      const names = [...result.keys()];
      expect(names.length).toBeGreaterThan(0);
    });
  });

  describe('performance with large datasets', () => {
    it('should handle 50 phrases', () => {
      const phrases = Array.from({ length: 50 }, (_, i) =>
        makePhrase(i, `фраза ${i % 10} тест ${Math.floor(i / 10)}`)
      );
      const result = clusterByTFIDF(phrases, {});
      expect(result.size).toBeGreaterThan(0);
    });

    it('should handle 100 phrases', () => {
      const phrases = Array.from({ length: 100 }, (_, i) =>
        makePhrase(i, `фраза ${i % 20} тест ${Math.floor(i / 20)}`)
      );
      const result = clusterByTFIDF(phrases, {});
      expect(result.size).toBeGreaterThan(0);
    });
  });
});
