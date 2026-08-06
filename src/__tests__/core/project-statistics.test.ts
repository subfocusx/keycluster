import { describe, it, expect } from 'vitest';
import { computeProjectStats, computePhraseStats } from '@/plugin-sdk';
import type { Group, Phrase, MinusWord, MinusWordGroup } from '@/core/types';

describe('project-statistics', () => {
  const groups: Group[] = [
    { id: 'g1', name: 'Main', parentId: null, isExpanded: true, isTrash: false, createdAt: 1 },
    { id: 'trash', name: 'Корзина', parentId: null, isExpanded: true, isTrash: true, createdAt: 2 },
    { id: 'g2', name: 'Empty', parentId: null, isExpanded: true, isTrash: false, createdAt: 3 },
  ];

  const phrases: Phrase[] = [
    { id: 'p1', text: 'hello world', groupId: 'g1', createdAt: 1, starredAt: Date.now() },
    { id: 'p2', text: 'test', groupId: 'g1', createdAt: 2 },
    { id: 'p3', text: 'deleted', groupId: 'trash', createdAt: 3 },
  ];

  const minusWords: MinusWord[] = [
    { id: 'mw1', text: 'bad', isExact: true, groupId: null, searchType: 'exact', createdAt: 1 },
    { id: 'mw2', text: 'worse', isExact: false, groupId: 'g1', searchType: 'broad', createdAt: 2 },
  ];

  const minusWordGroups: MinusWordGroup[] = [
    { id: 'mwg1', name: 'Folder', createdAt: 1 },
  ];

  it('computeProjectStats returns correct counts', () => {
    const stats = computeProjectStats(groups, phrases, minusWords, minusWordGroups);
    expect(stats.phraseCount).toBe(2);
    expect(stats.trashCount).toBe(1);
    expect(stats.starredCount).toBe(1);
    expect(stats.groupCount).toBe(2);
    expect(stats.emptyGroupCount).toBe(1);
    expect(stats.minusWordCount).toBe(2);
    expect(stats.minusGlobal).toBe(1);
    expect(stats.minusScoped).toBe(1);
  });

  it('computePhraseStats returns word count', () => {
    const stats = computePhraseStats(phrases[0], 'Main');
    expect(stats.wordCount).toBe(2);
    expect(stats.length).toBe(11);
    expect(stats.groupName).toBe('Main');
    expect(stats.starred).toBe(true);
  });
});
