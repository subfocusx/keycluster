import { describe, it, expect } from 'vitest';
import { evaluateCluster, evaluateAllClusters } from '@/core/clustering/cluster-quality';
import type { Phrase, Group } from '@/core/types';

describe('evaluateCluster', () => {
  it('returns score 1 for empty cluster', () => {
    const result = evaluateCluster([], 'Empty');
    expect(result.score).toBe(1);
    expect(result.reason).toContain('Пустой кластер');
  });

  it('scores cohesively for clusters with shared words', () => {
    const phrases: Phrase[] = [
      { id: '1', text: 'купить холодильник москва недорого', groupId: 'g1', createdAt: Date.now() },
      { id: '2', text: 'купить холодильник спб цена', groupId: 'g1', createdAt: Date.now() },
      { id: '3', text: 'купить холодильник дешево казань', groupId: 'g1', createdAt: Date.now() },
      { id: '4', text: 'купить холодильник доставка москва', groupId: 'g1', createdAt: Date.now() },
    ];
    const result = evaluateCluster(phrases, 'Холодильник', [], []);
    expect(result.details.avgWordOverlap).toBeGreaterThan(0);
  });

  it('scores lower for diverse clusters', () => {
    const phrases: Phrase[] = [
      { id: '1', text: 'купить холодильник москва', groupId: 'g1', createdAt: Date.now() },
      { id: '2', text: 'аренда квартиры спб', groupId: 'g1', createdAt: Date.now() },
      { id: '3', text: 'ремонт телефонов цена', groupId: 'g1', createdAt: Date.now() },
    ];
    const result = evaluateCluster(phrases, 'Разное', [], []);
    expect(result.details.avgWordOverlap).toBeLessThan(0.3);
  });

  it('accepts allGroups and allPhrases parameters', () => {
    const phrases: Phrase[] = [
      { id: '1', text: 'купить холодильник москва', groupId: 'g1', createdAt: Date.now() },
      { id: '2', text: 'купить стиральная машина', groupId: 'g1', createdAt: Date.now() },
    ];
    const allGroups: Group[] = [{ id: 'g1', name: 'Tech', parentId: null, isTrash: false, isExpanded: false, createdAt: Date.now() }];
    const allPhrases: Phrase[] = [...phrases];
    const result = evaluateCluster(phrases, 'Tech', allGroups, allPhrases);
    expect(result.score).toBeGreaterThanOrEqual(1);
  });

  it('returns score in 1-5 range', () => {
    for (let i = 1; i <= 20; i++) {
      const phrases: Phrase[] = Array.from({ length: i }, (_, j) => ({
        id: `${j}`,
        text: `word_a word_b ${j}`,
        groupId: 'g1',
        createdAt: Date.now(),
      }));
      const result = evaluateCluster(phrases, `Cluster ${i}`);
      expect(result.score).toBeGreaterThanOrEqual(1);
      expect(result.score).toBeLessThanOrEqual(5);
    }
  });
});

describe('evaluateAllClusters', () => {
  it('evaluates all non-trash groups', () => {
    const groups: Group[] = [
      { id: 'g1', name: 'Group 1', parentId: null, isTrash: false, isExpanded: false, createdAt: Date.now() },
      { id: 'g2', name: 'Group 2', parentId: null, isTrash: false, isExpanded: false, createdAt: Date.now() },
      { id: 'g3', name: 'Trash', parentId: null, isTrash: true, isExpanded: false, createdAt: Date.now() },
    ];
    const phrases: Phrase[] = [
      { id: '1', text: 'купить холодильник', groupId: 'g1', createdAt: Date.now() },
      { id: '2', text: 'купить стиральная', groupId: 'g1', createdAt: Date.now() },
      { id: '3', text: 'аренда квартиры', groupId: 'g2', createdAt: Date.now() },
    ];
    const results = evaluateAllClusters(groups, phrases);
    expect(results.size).toBe(2);
    expect(results.has('g1')).toBe(true);
    expect(results.has('g2')).toBe(true);
    expect(results.has('g3')).toBe(false);
  });
});
