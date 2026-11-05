import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/plugin-sdk';
import { extractProjectState, restoreToPartialState } from '@/core/project-store-sync';
import type { Group, Phrase } from '@/core/types';

// ============================================================
// Regression tests for the minus-words model.
//
// 1. Duplicates: the same text in the same scope must not create
//    a second row (otherwise deleting one copy leaves the word
//    "still in the list of minus phrases").
// 2. Folders ("папки") of minus words must survive save/load.
// 3. A minus word bound to a group must apply to that group AND
//    to all of its descendant groups.
// ============================================================

const mkGroup = (id: string, parentId: string | null = null): Group => ({
  id,
  name: id,
  parentId,
  color: '#000',
  notes: '',
  isExpanded: true,
  isTrash: false,
  createdAt: Date.now(),
});

const mkPhrase = (id: string, text: string, groupId: string): Phrase => ({
  id,
  text,
  groupId,
  frequency: 0,
  kei: 0,
  cpc: 0,
  competition: 0,
  notes: '',
  tags: [],
  createdAt: Date.now(),
});

describe('minus words — duplicates', () => {
  beforeEach(() => {
    useAppStore.setState({ minusWords: [], minusWordGroups: [], groups: [], phrases: [] });
  });

  it('rejects an exact duplicate in the same scope', () => {
    const store = useAppStore.getState();
    expect(store.addMinusWord('купить', false, null, 'broad')).toBe(true);
    expect(store.addMinusWord('купить', false, null, 'broad')).toBe(false);
    expect(useAppStore.getState().minusWords).toHaveLength(1);
  });

  it('normalizes case and spaces before comparing', () => {
    const store = useAppStore.getState();
    expect(store.addMinusWord('Купить  Автобус', false, null, 'broad')).toBe(true);
    expect(store.addMinusWord('купить автобус', false, null, 'broad')).toBe(false);
    expect(useAppStore.getState().minusWords).toHaveLength(1);
  });

  it('keeps the same text for different groups', () => {
    const g = useAppStore.getState().addGroup('G1');
    const store = useAppStore.getState();
    expect(store.addMinusWord('word', false, null, 'broad')).toBe(true);
    expect(store.addMinusWord('word', false, g, 'broad')).toBe(true);
    expect(useAppStore.getState().minusWords).toHaveLength(2);
  });

  it('after deleting one entry the word is really gone from the list', () => {
    const store = useAppStore.getState();
    store.addMinusWord('купить', false, null, 'broad');
    const id = useAppStore.getState().minusWords[0].id;
    useAppStore.getState().removeMinusWord(id);
    expect(useAppStore.getState().minusWords).toHaveLength(0);
  });
});

describe('minus words — folders persist', () => {
  it('extract/restore keeps folders and the folder link of a word', () => {
    const folderId = 'mw-folder-1';
    const state = extractProjectState({
      groups: [],
      phrases: [],
      minusWords: [
        { id: 'w1', text: 'купить', isExact: false, groupId: null, searchType: 'broad', createdAt: 1, mwGroupId: folderId },
      ],
      minusWordGroups: [{ id: folderId, name: 'Мусор', createdAt: 2 }],
      settings: {},
      ui: { theme: 'light', rightPanel: { width: 1, open: true }, leftPanel: { width: 1, open: true, module: null } },
    });

    expect(state.minusWordGroups).toHaveLength(1);
    expect(state.minusWordGroups?.[0].name).toBe('Мусор');
    expect(state.minusWords[0].mwGroupId).toBe(folderId);

    const restored = restoreToPartialState(state);
    expect(restored.minusWordGroups).toHaveLength(1);
    expect(restored.minusWords?.[0].mwGroupId).toBe(folderId);
  });

  it('deleting a folder keeps its words but unbinds them', () => {
    const folderId = useAppStore.getState().createMinusWordGroup('Мусор');
    useAppStore.getState().addMinusWord('купить', false, null, 'broad', folderId);
    useAppStore.getState().deleteMinusWordGroup(folderId);

    expect(useAppStore.getState().minusWordGroups).toHaveLength(0);
    expect(useAppStore.getState().minusWords).toHaveLength(1);
    expect(useAppStore.getState().minusWords[0].mwGroupId).toBeNull();
  });
});

describe('minus words — group scope covers descendants', () => {
  beforeEach(() => {
    useAppStore.setState({ minusWords: [], minusWordGroups: [], groups: [], phrases: [] });
  });

  it('applies a group minus word to phrases of child groups', () => {
    const parent = useAppStore.getState().addGroup('Parent');
    const child = useAppStore.getState().addGroup('Child', parent);
    useAppStore.getState().addPhrases(['купить автобус'], child);

    useAppStore.getState().addMinusWord('купить', false, parent, 'broad_modified');

    const preview = useAppStore.getState().previewMinusWords(null);
    expect(preview.removed).toBe(1);
    expect(preview.phrases[0].text).toBe('купить автобус');
  });

  it('does not apply a child group minus word to the parent group', () => {
    const parent = useAppStore.getState().addGroup('Parent');
    const child = useAppStore.getState().addGroup('Child', parent);
    useAppStore.getState().addPhrases(['купить автобус'], parent);

    useAppStore.getState().addMinusWord('купить', false, child, 'broad_modified');

    const preview = useAppStore.getState().previewMinusWords(null);
    expect(preview.removed).toBe(0);
  });

  it('global minus words still apply everywhere', () => {
    const g = useAppStore.getState().addGroup('G1');
    useAppStore.getState().addPhrases(['купить автобус'], g);
    useAppStore.getState().addMinusWord('купить', false, null, 'broad_modified');

    expect(useAppStore.getState().previewMinusWords(null).removed).toBe(1);
  });

  it('respects the scope filter', () => {
    const g1 = useAppStore.getState().addGroup('G1');
    const g2 = useAppStore.getState().addGroup('G2');
    useAppStore.getState().addPhrases(['купить автобус'], g1);
    useAppStore.getState().addPhrases(['купить автобус'], g2);
    useAppStore.getState().addMinusWord('купить', false, null, 'broad_modified');

    const preview = useAppStore.getState().previewMinusWords(new Set([g1]));
    expect(preview.removed).toBe(1);
    expect(preview.phrases[0].groupId).toBe(g1);
  });
});
