// ============================================================
// Tests: Project Store Sync — serialization edge cases
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/core/store';
import { useSettingsStore } from '@/plugin-sdk';
import { extractProjectState, restoreToPartialState, createSnapshot } from '@/core/project-store-sync';

describe('extract Project State', () => {
  beforeEach(() => {
    useAppStore.getState().clearAll();
  });

  it('handles empty state correctly', () => {
    const appState = useAppStore.getState();
    const settingsState = useSettingsStore.getState();
    const state = extractProjectState({
      groups: appState.groups,
      phrases: appState.phrases,
      minusWords: appState.minusWords,
      settings: settingsState.settings,
      ui: appState.ui,
    });

    expect(state.groups).toEqual([]);
    expect(state.phrases).toEqual([]);
    expect(state.minusWords).toEqual([]);
    expect(state.settings).toEqual({});
    expect(state.uiState).toBeDefined();
  });

  it('serializes groups with correct fields', () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('Test Group');
    store.addGroup('Trash Group');
    // Mark second group as trash
    const groups = useAppStore.getState().groups;
    const trashGroupId = groups.find(g => g.name === 'Trash Group')!.id;
    useAppStore.setState({
      groups: groups.map(g =>
        g.id === trashGroupId ? { ...g, isTrash: true } : g
      ),
    });

    const appState = useAppStore.getState();
    const settingsState = useSettingsStore.getState();
    const state = extractProjectState({
      groups: appState.groups,
      phrases: appState.phrases,
      minusWords: appState.minusWords,
      settings: settingsState.settings,
      ui: appState.ui,
    });

    expect(state.groups).toHaveLength(2);
    const normalGroup = state.groups.find(g => !g.isTrash);
    const trashGroup = state.groups.find(g => g.isTrash);
    expect(normalGroup).toBeDefined();
    expect(trashGroup).toBeDefined();
    expect(normalGroup!.name).toBe('Test Group');
  });

  it('preserves uiState theme and panel settings', () => {
    const store = useAppStore.getState();
    store.setTheme('dark');
    store.setRightPanelWidth(400);
    store.setLeftPanelWidth(350);

    const appState = useAppStore.getState();
    const settingsState = useSettingsStore.getState();
    const state = extractProjectState({
      groups: appState.groups,
      phrases: appState.phrases,
      minusWords: appState.minusWords,
      settings: settingsState.settings,
      ui: appState.ui,
    });

    expect(state.uiState.theme).toBe('dark');
    expect(state.uiState.rightPanel?.width).toBe(400);
    expect(state.uiState.leftPanel?.width).toBe(350);
  });

  it('creates a shallow copy of settings', () => {
    const appState = useAppStore.getState();
    const customSettings = { 'test-module': { key1: 'value1' } };
    const state = extractProjectState({
      groups: appState.groups,
      phrases: appState.phrases,
      minusWords: appState.minusWords,
      settings: customSettings,
      ui: appState.ui,
    });

    // Verify settings were extracted (shallow copy via spread)
    expect(state.settings).toBeDefined();
    expect(Object.keys(state.settings)).toContain('test-module');
    expect(state.settings['test-module']['key1']).toBe('value1');
  });

  it('removes undefined values from phrases', () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('Test');

    // Add a phrase with minimal data (some fields may be undefined)
    useAppStore.setState({
      phrases: [
        {
          id: 'p1',
          text: 'тест',
          groupId: gid,
          frequency: 0,
          kei: undefined as any,
          cpc: undefined as any,
          competition: undefined as any,
          notes: undefined as any,
          tags: undefined as any,
          createdAt: Date.now(),
        },
      ],
    });

    const appState = useAppStore.getState();
    const settingsState = useSettingsStore.getState();
    const state = extractProjectState({
      groups: appState.groups,
      phrases: appState.phrases,
      minusWords: appState.minusWords,
      settings: settingsState.settings,
      ui: appState.ui,
    });

    // Serialized phrase should not have undefined keys
    const serializedPhrase = state.phrases[0];
    expect(serializedPhrase.id).toBe('p1');
    expect(serializedPhrase.text).toBe('тест');
    // undefined values should be removed
    const keys = Object.keys(serializedPhrase);
    for (const key of keys) {
      expect((serializedPhrase as any)[key]).not.toBeUndefined();
    }
  });

  it('handles minus words with different search types', () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('Test');
    store.addMinusWord('бесплатно', false, null, 'broad');
    store.addMinusWord('точно', true, gid, 'exact');

    const appState = useAppStore.getState();
    const settingsState = useSettingsStore.getState();
    const state = extractProjectState({
      groups: appState.groups,
      phrases: appState.phrases,
      minusWords: appState.minusWords,
      settings: settingsState.settings,
      ui: appState.ui,
    });

    expect(state.minusWords).toHaveLength(2);
    const broadWord = state.minusWords.find(mw => mw.text === 'бесплатно');
    const exactWord = state.minusWords.find(mw => mw.text === 'точно');
    expect(broadWord!.searchType).toBe('broad');
    expect(exactWord!.searchType).toBe('exact');
    expect(exactWord!.isExact).toBe(true);
  });
});

describe('restoreToPartialState', () => {
  it('produces clean partial state with empty selections', () => {
    const state = {
      groups: [
        { id: 'g1', name: 'Group 1', parentId: null, isExpanded: true, isTrash: false, createdAt: Date.now() },
      ],
      phrases: [
        { id: 'p1', text: 'фраза', groupId: 'g1', frequency: 100, createdAt: Date.now() },
      ],
      minusWords: [],
      settings: {},
      uiState: { theme: 'dark' },
    };

    const partial = restoreToPartialState(state as any);

    expect(partial.groups).toHaveLength(1);
    expect(partial.phrases).toHaveLength(1);
    expect(partial.selectedGroupIds?.size ?? 0).toBe(0);
    expect(partial.selectedPhraseIds?.size ?? 0).toBe(0);
    expect(partial.activeGroupId).toBeNull();
  });

  it('handles empty state', () => {
    const state = {
      groups: [],
      phrases: [],
      minusWords: [],
      settings: {},
      uiState: {},
    };

    const partial = restoreToPartialState(state as any);

    expect(partial.groups).toEqual([]);
    expect(partial.phrases).toEqual([]);
    expect(partial.minusWords).toEqual([]);
  });
});

describe('createSnapshot', () => {
  beforeEach(() => {
    useAppStore.getState().clearAll();
  });

  it('creates an independent deep copy', () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('Original');
    store.addPhrases(['фраза 1'], gid);

    const appState = useAppStore.getState();
    const snapshot = createSnapshot({
      groups: appState.groups,
      phrases: appState.phrases,
      minusWords: appState.minusWords,
      activeGroupId: appState.activeGroupId,
      selectedGroupIds: appState.selectedGroupIds,
      selectedPhraseIds: appState.selectedPhraseIds,
    });

    // Modify the store
    store.addPhrases(['фраза 2'], gid);

    // Snapshot should not be affected
    expect(snapshot.phrases).toHaveLength(1);
    expect(snapshot.phrases[0].text).toBe('фраза 1');
  });

  it('preserves selection state', () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('Group');
    store.addPhrases(['фраза'], gid);

    useAppStore.setState({
      selectedGroupIds: new Set([gid]),
      selectedPhraseIds: new Set([useAppStore.getState().phrases[0].id]),
      activeGroupId: gid,
    });

    const appState = useAppStore.getState();
    const snapshot = createSnapshot({
      groups: appState.groups,
      phrases: appState.phrases,
      minusWords: appState.minusWords,
      activeGroupId: appState.activeGroupId,
      selectedGroupIds: appState.selectedGroupIds,
      selectedPhraseIds: appState.selectedPhraseIds,
    });

    expect(snapshot.activeGroupId).toBe(gid);
    expect(snapshot.selectedGroupIds).toContain(gid);
    expect(snapshot.selectedPhraseIds.size).toBe(1);
  });

  it('handles empty store', () => {
    const appState = useAppStore.getState();
    const snapshot = createSnapshot({
      groups: appState.groups,
      phrases: appState.phrases,
      minusWords: appState.minusWords,
      activeGroupId: appState.activeGroupId,
      selectedGroupIds: appState.selectedGroupIds,
      selectedPhraseIds: appState.selectedPhraseIds,
    });

    expect(snapshot.groups).toEqual([]);
    expect(snapshot.phrases).toEqual([]);
    expect(snapshot.minusWords).toEqual([]);
    expect(snapshot.activeGroupId).toBeNull();
    expect(snapshot.selectedGroupIds.size).toBe(0);
    expect(snapshot.selectedPhraseIds.size).toBe(0);
  });

  it('preserves minus words in snapshot', () => {
    const store = useAppStore.getState();
    store.addMinusWord('тест1', false);
    store.addMinusWord('тест2', true);

    const appState = useAppStore.getState();
    const snapshot = createSnapshot({
      groups: appState.groups,
      phrases: appState.phrases,
      minusWords: appState.minusWords,
      activeGroupId: appState.activeGroupId,
      selectedGroupIds: appState.selectedGroupIds,
      selectedPhraseIds: appState.selectedPhraseIds,
    });

    expect(snapshot.minusWords).toHaveLength(2);
    // Deep copy — modify original shouldn't affect snapshot
    useAppStore.getState().addMinusWord('тест3', false, null, 'broad');
    expect(snapshot.minusWords).toHaveLength(2);
  });
});
