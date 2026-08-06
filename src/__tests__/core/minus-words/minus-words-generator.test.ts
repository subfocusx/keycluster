import { describe, it, expect } from 'vitest';
import { findMinusWords, extractWords, DEFAULT_MINUS_WORDS } from '@/core/minus-words/minus-words-generator';
import type { Phrase, Group } from '@/core/types';

describe('extractWords', () => {
  it('extracts word frequencies from phrases', () => {
    const phrases: Phrase[] = [
      { id: '1', text: 'купить холодильник москва', groupId: 'g1', createdAt: Date.now() },
      { id: '2', text: 'купить стиральная машина москва', groupId: 'g1', createdAt: Date.now() },
    ];
    const freq = extractWords(phrases);
    expect(freq.get('купить')).toBe(2);
    expect(freq.get('москва')).toBe(2);
    expect(freq.get('холодильник')).toBe(1);
  });
});

describe('findMinusWords', () => {
  it('returns empty for fewer than 2 groups', () => {
    const groups: Group[] = [{ id: 'g1', name: 'Group 1', parentId: null, isTrash: false, isExpanded: false, createdAt: Date.now() }];
    const phrases: Phrase[] = [];
    expect(findMinusWords(phrases, groups)).toEqual([]);
  });

  it('identifies unique words as minus candidates', () => {
    const groups: Group[] = [
      { id: 'g1', name: 'Group 1', parentId: null, isTrash: false, isExpanded: false, createdAt: Date.now() },
      { id: 'g2', name: 'Group 2', parentId: null, isTrash: false, isExpanded: false, createdAt: Date.now() },
    ];
    const phrases: Phrase[] = [
      { id: '1', text: 'купить холодильник спб', groupId: 'g1', createdAt: Date.now() },
      { id: '2', text: 'купить стиральная машина спб', groupId: 'g1', createdAt: Date.now() },
      { id: '3', text: 'аренда квартиры москва', groupId: 'g2', createdAt: Date.now() },
      { id: '4', text: 'аренда дома ключи', groupId: 'g2', createdAt: Date.now() },
    ];
    const candidates = findMinusWords(phrases, groups, null, 20);

    expect(candidates.length).toBeGreaterThan(0);

    const холодильник = candidates.find(c => c.word === 'холодильник');
    expect(холодильник).toBeDefined();
    expect(холодильник!.groupSpread).toBe(1);

    const спб = candidates.find(c => c.word === 'спб');
    expect(спб).toBeDefined();
    expect(спб!.groupSpread).toBe(1);
  });

  it('filters by target group IDs', () => {
    const groups: Group[] = [
      { id: 'g1', name: 'Group 1', parentId: null, isTrash: false, isExpanded: false, createdAt: Date.now() },
      { id: 'g2', name: 'Group 2', parentId: null, isTrash: false, isExpanded: false, createdAt: Date.now() },
    ];
    const phrases: Phrase[] = [
      { id: '1', text: 'купить холодильник', groupId: 'g1', createdAt: Date.now() },
      { id: '2', text: 'купить стиральная', groupId: 'g2', createdAt: Date.now() },
      { id: '3', text: 'аренда квартиры', groupId: 'g1', createdAt: Date.now() },
      { id: '4', text: 'аренда дома', groupId: 'g2', createdAt: Date.now() },
    ];

    const candidates = findMinusWords(phrases, groups, new Set(['g1']), 20);
    expect(candidates.length).toBe(0);
  });

  it('skips default minus words', () => {
    const groups: Group[] = [
      { id: 'g1', name: 'Group 1', parentId: null, isTrash: false, isExpanded: false, createdAt: Date.now() },
      { id: 'g2', name: 'Group 2', parentId: null, isTrash: false, isExpanded: false, createdAt: Date.now() },
    ];
    const phrases: Phrase[] = [
      { id: '1', text: 'скачать бесплатно книгу', groupId: 'g1', createdAt: Date.now() },
      { id: '2', text: 'скачать бесплатно фильм', groupId: 'g2', createdAt: Date.now() },
    ];
    const candidates = findMinusWords(phrases, groups, null, 20);
    const скачать = candidates.find(c => c.word === 'скачать');
    const бесплатно = candidates.find(c => c.word === 'бесплатно');

    expect(скачать).toBeUndefined();
    expect(бесплатно).toBeUndefined();
  });

  it('returns up to topN results', () => {
    const groups: Group[] = [
      { id: 'g1', name: 'Group 1', parentId: null, isTrash: false, isExpanded: false, createdAt: Date.now() },
      { id: 'g2', name: 'Group 2', parentId: null, isTrash: false, isExpanded: false, createdAt: Date.now() },
      { id: 'g3', name: 'Group 3', parentId: null, isTrash: false, isExpanded: false, createdAt: Date.now() },
    ];
    const words = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'];
    const phrases: Phrase[] = groups.flatMap((g, gi) =>
      words.slice(gi * 3, gi * 3 + 3).map((w, i) => ({
        id: `${g.id}-${i}`,
        text: `купить ${w} москва`,
        groupId: g.id,
        createdAt: Date.now(),
      }))
    );

    const candidates = findMinusWords(phrases, groups, null, 3);
    expect(candidates.length).toBeLessThanOrEqual(3);
  });
});

describe('DEFAULT_MINUS_WORDS', () => {
  it('contains common noise words', () => {
    expect(DEFAULT_MINUS_WORDS.has('бесплатно')).toBe(true);
    expect(DEFAULT_MINUS_WORDS.has('скачать')).toBe(true);
    expect(DEFAULT_MINUS_WORDS.has('отзывы')).toBe(true);
  });
});
