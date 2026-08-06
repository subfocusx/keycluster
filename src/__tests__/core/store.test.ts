// ============================================================
// Tests: core/store.ts
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '@/plugin-sdk';
import type { Group, Phrase, MinusWord } from '@/plugin-sdk';
import { createStoreAccess } from '@/core/store';

// Helper to reset store between tests
function resetStore() {
  useAppStore.getState().clearAll();
}

describe('AppStore', () => {
  beforeEach(() => {
    resetStore();
  });

  // ---- Group Slice ----

  describe('Group Slice', () => {
    it('should start with empty groups', () => {
      expect(useAppStore.getState().groups).toEqual([]);
    });

    it('should add a group and return its id', () => {
      const id = useAppStore.getState().addGroup('Test Group');
      expect(id).toBeTypeOf('string');
      expect(id.length).toBeGreaterThan(0);
      const groups = useAppStore.getState().groups;
      expect(groups).toHaveLength(1);
      expect(groups[0].name).toBe('Test Group');
      expect(groups[0].parentId).toBeNull();
      expect(groups[0].isTrash).toBe(false);
    });

    it('should add a subgroup with parentId', () => {
      const parentId = useAppStore.getState().addGroup('Parent');
      const childId = useAppStore.getState().addGroup('Child', parentId);
      const groups = useAppStore.getState().groups;
      expect(groups).toHaveLength(2);
      expect(groups.find(g => g.id === childId)?.parentId).toBe(parentId);
    });

    it('should add multiple groups from list', () => {
      const ids = useAppStore.getState().addGroupFromList(['A', 'B', 'C']);
      expect(ids).toHaveLength(3);
      expect(useAppStore.getState().groups).toHaveLength(3);
      expect(useAppStore.getState().groups.map(g => g.name)).toEqual(['A', 'B', 'C']);
    });

    it('should rename a group', () => {
      const id = useAppStore.getState().addGroup('Old Name');
      useAppStore.getState().renameGroup(id, 'New Name');
      const group = useAppStore.getState().groups.find(g => g.id === id);
      expect(group?.name).toBe('New Name');
    });

    it('should delete a group and its phrases', () => {
      const store = useAppStore.getState();
      const groupId = store.addGroup('ToDelete');
      store.addPhrases(['phrase 1', 'phrase 2'], groupId);
      expect(useAppStore.getState().phrases).toHaveLength(2);

      useAppStore.getState().deleteGroup(groupId);
      expect(useAppStore.getState().groups).toHaveLength(0);
      expect(useAppStore.getState().phrases).toHaveLength(0);
    });

    it('should delete child groups recursively', () => {
      const store = useAppStore.getState();
      const parentId = store.addGroup('Parent');
      const childId = store.addGroup('Child', parentId);
      const grandchildId = store.addGroup('Grandchild', childId);
      store.addPhrases(['test'], grandchildId);

      useAppStore.getState().deleteGroup(parentId);
      expect(useAppStore.getState().groups).toHaveLength(0);
      expect(useAppStore.getState().phrases).toHaveLength(0);
    });

    it('should move a group to a new parent', () => {
      const store = useAppStore.getState();
      const parentId1 = store.addGroup('Parent1');
      const parentId2 = store.addGroup('Parent2');
      const childId = store.addGroup('Child', parentId1);

      useAppStore.getState().moveGroup(childId, parentId2);
      const group = useAppStore.getState().groups.find(g => g.id === childId);
      expect(group?.parentId).toBe(parentId2);
    });

    it('should toggle group expand', () => {
      const id = useAppStore.getState().addGroup('Test');
      // Groups are created expanded by default (see store.addGroup)
      expect(useAppStore.getState().groups[0].isExpanded).toBe(true);
      useAppStore.getState().toggleExpand(id);
      expect(useAppStore.getState().groups[0].isExpanded).toBe(false);
      useAppStore.getState().toggleExpand(id);
      expect(useAppStore.getState().groups[0].isExpanded).toBe(true);
    });

    it('should set group color', () => {
      const id = useAppStore.getState().addGroup('Test');
      useAppStore.getState().setGroupColor(id, '#ff0000');
      expect(useAppStore.getState().groups[0].color).toBe('#ff0000');
    });

    it('should set group notes', () => {
      const id = useAppStore.getState().addGroup('Test');
      useAppStore.getState().setGroupNotes(id, 'some notes');
      expect(useAppStore.getState().groups[0].notes).toBe('some notes');
    });

    // ---- Batch Operations ----

    it('should delete multiple groups and their phrases', () => {
      const store = useAppStore.getState();
      const g1 = store.addGroup('Group 1');
      const g2 = store.addGroup('Group 2');
      const g3 = store.addGroup('Group 3');
      store.addPhrases(['p1'], g1);
      store.addPhrases(['p2'], g2);
      store.addPhrases(['p3'], g3);
      expect(useAppStore.getState().groups).toHaveLength(3);
      expect(useAppStore.getState().phrases).toHaveLength(3);

      useAppStore.getState().deleteGroups([g1, g2]);
      const state = useAppStore.getState();
      expect(state.groups).toHaveLength(1);
      expect(state.groups[0].id).toBe(g3);
      expect(state.phrases).toHaveLength(1);
      expect(state.phrases[0].groupId).toBe(g3);
    });

    it('should recursively delete multiple groups with children', () => {
      const store = useAppStore.getState();
      const parent1 = store.addGroup('Parent 1');
      const child1 = store.addGroup('Child 1', parent1);
      const parent2 = store.addGroup('Parent 2');
      const child2 = store.addGroup('Child 2', parent2);
      store.addPhrases(['test'], child1);

      useAppStore.getState().deleteGroups([parent1, parent2]);
      expect(useAppStore.getState().groups).toHaveLength(0);
      expect(useAppStore.getState().phrases).toHaveLength(0);
    });

    it('should clean up selectedGroupIds when deleting groups', () => {
      const store = useAppStore.getState();
      const g1 = store.addGroup('G1');
      const g2 = store.addGroup('G2');
      store.toggleGroupSelection(g1);
      store.toggleGroupSelection(g2);
      expect(useAppStore.getState().selectedGroupIds.has(g1)).toBe(true);

      useAppStore.getState().deleteGroups([g1]);
      expect(useAppStore.getState().selectedGroupIds.has(g1)).toBe(false);
      expect(useAppStore.getState().selectedGroupIds.has(g2)).toBe(true);
    });

    it('should exit multigroup mode if no groups remain after delete', () => {
      const store = useAppStore.getState();
      const g1 = store.addGroup('G1');
      const g2 = store.addGroup('G2');
      store.toggleGroupSelection(g1);
      store.toggleGroupSelection(g2);
      store.setMultigroupMode(true);
      expect(useAppStore.getState().ui.multigroupMode).toBe(true);

      useAppStore.getState().deleteGroups([g1, g2]);
      expect(useAppStore.getState().ui.multigroupMode).toBe(false);
    });

    it('should move multiple groups to a new parent', () => {
      const store = useAppStore.getState();
      const parent1 = store.addGroup('Parent 1');
      const child1 = store.addGroup('Child 1', parent1);
      const parent2 = store.addGroup('Parent 2');

      useAppStore.getState().moveGroups([child1], parent2);
      const moved = useAppStore.getState().groups.find(g => g.id === child1);
      expect(moved?.parentId).toBe(parent2);
    });

    it('should move multiple groups to root', () => {
      const store = useAppStore.getState();
      const parent = store.addGroup('Parent');
      const child1 = store.addGroup('Child 1', parent);
      const child2 = store.addGroup('Child 2', parent);

      useAppStore.getState().moveGroups([child1, child2], null);
      const state = useAppStore.getState();
      expect(state.groups.find(g => g.id === child1)?.parentId).toBeNull();
      expect(state.groups.find(g => g.id === child2)?.parentId).toBeNull();
    });

    it('should set selected group ids directly', () => {
      const store = useAppStore.getState();
      const g1 = store.addGroup('G1');
      const g2 = store.addGroup('G2');
      const g3 = store.addGroup('G3');

      store.setSelectedGroupIds(new Set([g1, g3]));
      expect(useAppStore.getState().selectedGroupIds.has(g1)).toBe(true);
      expect(useAppStore.getState().selectedGroupIds.has(g2)).toBe(false);
      expect(useAppStore.getState().selectedGroupIds.has(g3)).toBe(true);
    });

    it('should select a range of groups', () => {
      const store = useAppStore.getState();
      const g1 = store.addGroup('A');
      const g2 = store.addGroup('B');
      const g3 = store.addGroup('C');
      const g4 = store.addGroup('D');
      const orderedIds = [g1, g2, g3, g4];

      store.selectGroupRange(g2, g4, orderedIds);
      const selected = useAppStore.getState().selectedGroupIds;
      expect(selected.has(g1)).toBe(false);
      expect(selected.has(g2)).toBe(true);
      expect(selected.has(g3)).toBe(true);
      expect(selected.has(g4)).toBe(true);
      expect(selected.size).toBe(3);
    });

    it('should select range in reverse order', () => {
      const store = useAppStore.getState();
      const g1 = store.addGroup('A');
      const g2 = store.addGroup('B');
      const g3 = store.addGroup('C');
      const orderedIds = [g1, g2, g3];

      store.selectGroupRange(g3, g1, orderedIds);
      const selected = useAppStore.getState().selectedGroupIds;
      expect(selected.has(g1)).toBe(true);
      expect(selected.has(g2)).toBe(true);
      expect(selected.has(g3)).toBe(true);
    });

    it('should merge range with existing selection', () => {
      const store = useAppStore.getState();
      const g1 = store.addGroup('A');
      const g2 = store.addGroup('B');
      const g3 = store.addGroup('C');
      const g4 = store.addGroup('D');
      const orderedIds = [g1, g2, g3, g4];

      store.toggleGroupSelection(g1);
      store.selectGroupRange(g3, g4, orderedIds);
      const selected = useAppStore.getState().selectedGroupIds;
      expect(selected.has(g1)).toBe(true);  // pre-existing
      expect(selected.has(g2)).toBe(false); // not in range
      expect(selected.has(g3)).toBe(true);
      expect(selected.has(g4)).toBe(true);
    });

    it('should not crash on range select with unknown ids', () => {
      const store = useAppStore.getState();
      store.selectGroupRange('nonexistent', 'also-none', ['a', 'b']);
      expect(useAppStore.getState().selectedGroupIds.size).toBe(0);
    });
  });

  // ---- Phrase Slice ----

  describe('Phrase Slice', () => {
    it('should start with empty phrases', () => {
      expect(useAppStore.getState().phrases).toEqual([]);
    });

    it('should add phrases to a group', () => {
      const groupId = useAppStore.getState().addGroup('G1');
      useAppStore.getState().addPhrases(['hello', 'world'], groupId);
      const phrases = useAppStore.getState().phrases;
      expect(phrases).toHaveLength(2);
      expect(phrases.map(p => p.text)).toEqual(['hello', 'world']);
      expect(phrases.every(p => p.groupId === groupId)).toBe(true);
    });

    it('should add phrases with extra fields', () => {
      const groupId = useAppStore.getState().addGroup('G1');
      useAppStore.getState().addPhrases(['test'], groupId, [
        { frequency: 100, kei: 5, cpc: 12.5 },
      ]);
      const phrase = useAppStore.getState().phrases[0];
      expect(phrase.frequency).toBe(100);
      expect(phrase.kei).toBe(5);
      expect(phrase.cpc).toBe(12.5);
    });

    it('should trim phrase text on add', () => {
      const groupId = useAppStore.getState().addGroup('G1');
      useAppStore.getState().addPhrases(['  padded  '], groupId);
      expect(useAppStore.getState().phrases[0].text).toBe('padded');
    });

    it('should delete phrases by ids', () => {
      const groupId = useAppStore.getState().addGroup('G1');
      useAppStore.getState().addPhrases(['a', 'b', 'c'], groupId);
      const [p1, , p3] = useAppStore.getState().phrases;
      useAppStore.getState().deletePhrases([p1.id, p3.id]);
      expect(useAppStore.getState().phrases).toHaveLength(1);
      expect(useAppStore.getState().phrases[0].text).toBe('b');
    });

    it('should move phrases to another group', () => {
      const g1 = useAppStore.getState().addGroup('G1');
      const g2 = useAppStore.getState().addGroup('G2');
      useAppStore.getState().addPhrases(['phrase'], g1);
      const phraseId = useAppStore.getState().phrases[0].id;
      useAppStore.getState().movePhrases([phraseId], g2);
      expect(useAppStore.getState().phrases[0].groupId).toBe(g2);
    });

    it('should copy phrases to another group (creating new ids)', () => {
      const g1 = useAppStore.getState().addGroup('G1');
      const g2 = useAppStore.getState().addGroup('G2');
      useAppStore.getState().addPhrases(['phrase'], g1);
      const origId = useAppStore.getState().phrases[0].id;
      useAppStore.getState().copyPhrases([origId], g2);
      const phrases = useAppStore.getState().phrases;
      expect(phrases).toHaveLength(2);
      expect(phrases[0].id).not.toBe(phrases[1].id);
      expect(phrases[1].groupId).toBe(g2);
      expect(phrases[1].text).toBe('phrase');
    });

    it('should update a phrase', () => {
      const groupId = useAppStore.getState().addGroup('G1');
      useAppStore.getState().addPhrases(['test'], groupId);
      const phraseId = useAppStore.getState().phrases[0].id;
      useAppStore.getState().updatePhrase(phraseId, { text: 'updated', frequency: 500 });
      const phrase = useAppStore.getState().phrases[0];
      expect(phrase.text).toBe('updated');
      expect(phrase.frequency).toBe(500);
    });

    it('should set all phrases', () => {
      const groupId = useAppStore.getState().addGroup('G1');
      const newPhrases: Phrase[] = [
        { id: 'p1', text: 'x', groupId, createdAt: Date.now() },
        { id: 'p2', text: 'y', groupId, createdAt: Date.now() },
      ];
      useAppStore.getState().setPhrases(newPhrases);
      expect(useAppStore.getState().phrases).toHaveLength(2);
      expect(useAppStore.getState().phrases.map(p => p.text)).toEqual(['x', 'y']);
    });
  });

  // ---- Trash Slice ----

  describe('Trash Slice', () => {
    it('should move phrases to trash group', () => {
      const groupId = useAppStore.getState().addGroup('G1');
      useAppStore.getState().addPhrases(['phrase1', 'phrase2'], groupId);
      const [p1] = useAppStore.getState().phrases;

      useAppStore.getState().moveToTrash([p1.id]);

      const state = useAppStore.getState();
      const trashGroup = state.groups.find(g => g.isTrash);
      expect(trashGroup).toBeDefined();
      expect(trashGroup!.name).toBe('Корзина');

      const trashedPhrase = state.phrases.find(p => p.id === p1.id);
      expect(trashedPhrase!.groupId).toBe(trashGroup!.id);
      expect((trashedPhrase as any)!._originalGroupId).toBe(groupId);
    });

    it('should create trash group automatically if it does not exist', () => {
      const groupId = useAppStore.getState().addGroup('G1');
      useAppStore.getState().addPhrases(['test'], groupId);
      const phraseId = useAppStore.getState().phrases[0].id;

      expect(useAppStore.getState().groups.find(g => g.isTrash)).toBeUndefined();

      useAppStore.getState().moveToTrash([phraseId]);

      expect(useAppStore.getState().groups.find(g => g.isTrash)).toBeDefined();
    });

    it('should use existing trash group if one exists', () => {
      const groupId = useAppStore.getState().addGroup('G1');
      useAppStore.getState().addPhrases(['a', 'b'], groupId);
      const [p1, p2] = useAppStore.getState().phrases;

      useAppStore.getState().moveToTrash([p1.id]);
      const trashId1 = useAppStore.getState().groups.find(g => g.isTrash)!.id;

      useAppStore.getState().moveToTrash([p2.id]);
      const trashId2 = useAppStore.getState().groups.find(g => g.isTrash)!.id;

      expect(trashId1).toBe(trashId2);
      expect(useAppStore.getState().groups.filter(g => g.isTrash)).toHaveLength(1);
    });

    it('should clear selectedPhraseIds when moving to trash', () => {
      const groupId = useAppStore.getState().addGroup('G1');
      useAppStore.getState().addPhrases(['phrase1'], groupId);
      const phraseId = useAppStore.getState().phrases[0].id;
      useAppStore.getState().togglePhraseSelection(phraseId);

      expect(useAppStore.getState().selectedPhraseIds).toContain(phraseId);

      useAppStore.getState().moveToTrash([phraseId]);

      expect(useAppStore.getState().selectedPhraseIds).not.toContain(phraseId);
    });

    it('should restore phrases from trash to original group', () => {
      const groupId = useAppStore.getState().addGroup('G1');
      useAppStore.getState().addPhrases(['phrase1'], groupId);
      const phraseId = useAppStore.getState().phrases[0].id;

      useAppStore.getState().moveToTrash([phraseId]);
      expect(useAppStore.getState().phrases.find(p => p.id === phraseId)?.groupId).not.toBe(groupId);

      useAppStore.getState().restoreFromTrash([phraseId]);

      const restored = useAppStore.getState().phrases.find(p => p.id === phraseId);
      expect(restored!.groupId).toBe(groupId);
      expect((restored as any)!._originalGroupId).toBeUndefined();
    });

    it('should keep phrase in current group if original group no longer exists', () => {
      const groupId = useAppStore.getState().addGroup('G1');
      useAppStore.getState().addPhrases(['phrase1'], groupId);
      const phraseId = useAppStore.getState().phrases[0].id;

      useAppStore.getState().moveToTrash([phraseId]);
      const trashGroupId = useAppStore.getState().groups.find(g => g.isTrash)!.id;

      // Delete the original group
      useAppStore.getState().deleteGroup(groupId);

      useAppStore.getState().restoreFromTrash([phraseId]);

      const restored = useAppStore.getState().phrases.find(p => p.id === phraseId);
      // Should stay in trash group since original no longer exists
      expect(restored!.groupId).toBe(trashGroupId);
    });

    it('should clear trash (permanently delete all trashed phrases)', () => {
      const groupId = useAppStore.getState().addGroup('G1');
      useAppStore.getState().addPhrases(['a', 'b'], groupId);
      const [p1, p2] = useAppStore.getState().phrases;

      useAppStore.getState().moveToTrash([p1.id, p2.id]);
      const trashGroupId = useAppStore.getState().groups.find(g => g.isTrash)!.id;
      expect(useAppStore.getState().phrases.filter(p => p.groupId === trashGroupId)).toHaveLength(2);

      useAppStore.getState().clearTrash();

      expect(useAppStore.getState().phrases.filter(p => p.groupId === trashGroupId)).toHaveLength(0);
      expect(useAppStore.getState().phrases).toHaveLength(0);
    });

    it('should not affect non-trash phrases when clearing trash', () => {
      const g1 = useAppStore.getState().addGroup('G1');
      useAppStore.getState().addPhrases(['keep', 'trash'], g1);
      const [, trashPhrase] = useAppStore.getState().phrases;

      useAppStore.getState().moveToTrash([trashPhrase.id]);
      useAppStore.getState().clearTrash();

      expect(useAppStore.getState().phrases).toHaveLength(1);
      expect(useAppStore.getState().phrases[0].text).toBe('keep');
    });

    it('should handle clearTrash when no trash group exists', () => {
      // Should not throw
      useAppStore.getState().clearTrash();
      expect(useAppStore.getState().phrases).toEqual([]);
    });

    it('should support StoreAccess dispatch for trash actions', () => {
      const access = createStoreAccess();
      const groupId = useAppStore.getState().addGroup('G1');
      useAppStore.getState().addPhrases(['test'], groupId);
      const phraseId = useAppStore.getState().phrases[0].id;

      access.dispatch('moveToTrash', [phraseId]);
      expect(useAppStore.getState().groups.find(g => g.isTrash)).toBeDefined();

      access.dispatch('restoreFromTrash', [phraseId]);
      expect(useAppStore.getState().phrases.find(p => p.id === phraseId)?.groupId).toBe(groupId);

      access.dispatch('moveToTrash', [phraseId]);
      access.dispatch('clearTrash');
      expect(useAppStore.getState().phrases).toHaveLength(0);
    });
  });

  // ---- MinusWord Slice ----

  describe('MinusWord Slice', () => {
    it('should start with empty minus words', () => {
      expect(useAppStore.getState().minusWords).toEqual([]);
    });

    it('should add a minus word', () => {
      useAppStore.getState().addMinusWord('бесплатно', false);
      const mw = useAppStore.getState().minusWords;
      expect(mw).toHaveLength(1);
      expect(mw[0].text).toBe('бесплатно');
      expect(mw[0].isExact).toBe(false);
      expect(mw[0].groupId).toBeNull();
      expect(mw[0].searchType).toBe('broad');
    });

    it('should add exact minus word with group', () => {
      const groupId = useAppStore.getState().addGroup('G1');
      useAppStore.getState().addMinusWord('точно', true, groupId, 'exact');
      const mw = useAppStore.getState().minusWords[0];
      expect(mw.isExact).toBe(true);
      expect(mw.groupId).toBe(groupId);
      expect(mw.searchType).toBe('exact');
    });

    it('should remove a minus word', () => {
      useAppStore.getState().addMinusWord('test', false);
      const id = useAppStore.getState().minusWords[0].id;
      useAppStore.getState().removeMinusWord(id);
      expect(useAppStore.getState().minusWords).toHaveLength(0);
    });

    it('should apply broad minus words — move to trash (contains match)', () => {
      const groupId = useAppStore.getState().addGroup('G1');
      useAppStore.getState().addPhrases(['купить ноутбук', 'ноутбук бесплатно', 'компьютер'], groupId);
      useAppStore.getState().addMinusWord('бесплатно', false, null, 'broad');
      const result = useAppStore.getState().applyMinusWords();
      expect(result.removed).toBe(1);
      // Phrase is moved to trash, not deleted
      const trashGroup = useAppStore.getState().groups.find(g => g.isTrash);
      expect(trashGroup).toBeDefined();
      const inTrash = useAppStore.getState().phrases.filter(p => p.groupId === trashGroup!.id);
      expect(inTrash).toHaveLength(1);
      expect(inTrash[0].text).toBe('ноутбук бесплатно');
      expect((inTrash[0] as any)._originalGroupId).toBe(groupId);
      // Non-matching phrases stay in original group
      const inOriginal = useAppStore.getState().phrases.filter(p => p.groupId === groupId);
      expect(inOriginal).toHaveLength(2);
    });

    it('should apply exact minus words — move to trash (full match)', () => {
      const groupId = useAppStore.getState().addGroup('G1');
      useAppStore.getState().addPhrases(['ноутбук', 'ноутбук купить', 'ноутбук дешево'], groupId);
      useAppStore.getState().addMinusWord('ноутбук', true, null, 'exact');
      const result = useAppStore.getState().applyMinusWords();
      expect(result.removed).toBe(1);
      // Phrase is in trash, not permanently deleted
      const trashGroup = useAppStore.getState().groups.find(g => g.isTrash);
      expect(trashGroup).toBeDefined();
      const inTrash = useAppStore.getState().phrases.filter(p => p.groupId === trashGroup!.id);
      expect(inTrash).toHaveLength(1);
      expect(inTrash[0].text).toBe('ноутбук');
    });

    it('should apply group-specific minus words — only that group moves to trash', () => {
      const g1 = useAppStore.getState().addGroup('G1');
      const g2 = useAppStore.getState().addGroup('G2');
      useAppStore.getState().addPhrases(['ноутбук дешево'], g1);
      useAppStore.getState().addPhrases(['ноутбук дешево'], g2);
      useAppStore.getState().addMinusWord('дешево', false, g1, 'broad');
      const result = useAppStore.getState().applyMinusWords();
      expect(result.removed).toBe(1);
      // G2 phrase stays in G2
      expect(useAppStore.getState().phrases.filter(p => p.groupId === g2)).toHaveLength(1);
      // G1 phrase moved to trash
      const trashGroup = useAppStore.getState().groups.find(g => g.isTrash);
      expect(trashGroup).toBeDefined();
      const inTrash = useAppStore.getState().phrases.filter(p => p.groupId === trashGroup!.id);
      expect(inTrash).toHaveLength(1);
      expect((inTrash[0] as any)._originalGroupId).toBe(g1);
    });

    it('should apply broad_modified minus words — move to trash (word-level match)', () => {
      const groupId = useAppStore.getState().addGroup('G1');
      useAppStore.getState().addPhrases(['бесплатный ноутбук', 'ноутбук бесплатно', 'платный ноутбук'], groupId);
      useAppStore.getState().addMinusWord('бесплатно', false, null, 'broad_modified');
      const result = useAppStore.getState().applyMinusWords();
      // "бесплатно" as a word should match "ноутбук бесплатно" but not "бесплатный ноутбук"
      expect(result.removed).toBe(1);
      // Moved to trash, not deleted
      const trashGroup = useAppStore.getState().groups.find(g => g.isTrash);
      expect(trashGroup).toBeDefined();
      const inTrash = useAppStore.getState().phrases.filter(p => p.groupId === trashGroup!.id);
      expect(inTrash).toHaveLength(1);
      expect(inTrash[0].text).toBe('ноутбук бесплатно');
    });
  });

  // ---- Selection Slice ----

  describe('Selection Slice', () => {
    it('should start with no selections', () => {
      const s = useAppStore.getState();
      expect(s.selectedGroupIds.size).toBe(0);
      expect(s.selectedPhraseIds.size).toBe(0);
      expect(s.activeGroupId).toBeNull();
    });

    it('should set active group', () => {
      const groupId = useAppStore.getState().addGroup('G1');
      useAppStore.getState().setActiveGroup(groupId);
      expect(useAppStore.getState().activeGroupId).toBe(groupId);
    });

    it('should toggle group selection', () => {
      const g1 = useAppStore.getState().addGroup('G1');
      const g2 = useAppStore.getState().addGroup('G2');
      useAppStore.getState().toggleGroupSelection(g1);
      expect(useAppStore.getState().selectedGroupIds.has(g1)).toBe(true);
      useAppStore.getState().toggleGroupSelection(g2);
      expect(useAppStore.getState().selectedGroupIds.has(g1)).toBe(true);
      expect(useAppStore.getState().selectedGroupIds.has(g2)).toBe(true);
      useAppStore.getState().toggleGroupSelection(g1);
      expect(useAppStore.getState().selectedGroupIds.has(g1)).toBe(false);
      expect(useAppStore.getState().selectedGroupIds.has(g2)).toBe(true);
    });

    it('should toggle phrase selection', () => {
      const groupId = useAppStore.getState().addGroup('G1');
      useAppStore.getState().addPhrases(['a', 'b'], groupId);
      const [p1, p2] = useAppStore.getState().phrases;
      useAppStore.getState().togglePhraseSelection(p1.id);
      expect(useAppStore.getState().selectedPhraseIds.has(p1.id)).toBe(true);
      useAppStore.getState().togglePhraseSelection(p1.id);
      expect(useAppStore.getState().selectedPhraseIds.has(p1.id)).toBe(false);
    });

    it('should select all phrases (all if no active group)', () => {
      const g1 = useAppStore.getState().addGroup('G1');
      useAppStore.getState().addPhrases(['a', 'b'], g1);
      useAppStore.getState().selectAllPhrases();
      expect(useAppStore.getState().selectedPhraseIds.size).toBe(2);
    });

    it('should select all phrases in active group only', () => {
      const g1 = useAppStore.getState().addGroup('G1');
      const g2 = useAppStore.getState().addGroup('G2');
      useAppStore.getState().addPhrases(['a', 'b'], g1);
      useAppStore.getState().addPhrases(['c'], g2);
      useAppStore.getState().setActiveGroup(g1);
      useAppStore.getState().selectAllPhrases();
      expect(useAppStore.getState().selectedPhraseIds.size).toBe(2);
    });

    it('should clear phrase selection', () => {
      const groupId = useAppStore.getState().addGroup('G1');
      useAppStore.getState().addPhrases(['a'], groupId);
      useAppStore.getState().selectAllPhrases();
      useAppStore.getState().clearPhraseSelection();
      expect(useAppStore.getState().selectedPhraseIds.size).toBe(0);
    });

    it('should clear group selection', () => {
      const g1 = useAppStore.getState().addGroup('G1');
      useAppStore.getState().toggleGroupSelection(g1);
      useAppStore.getState().clearGroupSelection();
      expect(useAppStore.getState().selectedGroupIds.size).toBe(0);
    });
  });

  // ---- UI Slice ----

  describe('UI Slice', () => {
    it('should have default UI state', () => {
      const ui = useAppStore.getState().ui;
      expect(ui.theme).toBe('light');
      expect(ui.leftPanel.open).toBe(false);
      expect(ui.rightPanel.open).toBe(true);
    });

    it('should set left panel', () => {
      useAppStore.getState().setLeftPanel(true, 'clustering');
      const ui = useAppStore.getState().ui;
      expect(ui.leftPanel.open).toBe(true);
      expect(ui.leftPanel.module).toBe('clustering');
    });

    it('should set right panel', () => {
      useAppStore.getState().setRightPanel(false);
      expect(useAppStore.getState().ui.rightPanel.open).toBe(false);
    });

    it('should clamp left panel width between 200 and 500', () => {
      useAppStore.getState().setLeftPanelWidth(100);
      expect(useAppStore.getState().ui.leftPanel.width).toBe(200);
      useAppStore.getState().setLeftPanelWidth(600);
      expect(useAppStore.getState().ui.leftPanel.width).toBe(500);
      useAppStore.getState().setLeftPanelWidth(350);
      expect(useAppStore.getState().ui.leftPanel.width).toBe(350);
    });

    it('should clamp right panel width between 200 and 500', () => {
      useAppStore.getState().setRightPanelWidth(50);
      expect(useAppStore.getState().ui.rightPanel.width).toBe(200);
      useAppStore.getState().setRightPanelWidth(999);
      expect(useAppStore.getState().ui.rightPanel.width).toBe(500);
    });

    it('should set theme', () => {
      useAppStore.getState().setTheme('dark');
      expect(useAppStore.getState().ui.theme).toBe('dark');
      useAppStore.getState().setTheme('light');
      expect(useAppStore.getState().ui.theme).toBe('light');
    });
  });

  // ---- Project Slice ----

  describe('Project Slice', () => {
    it('should load project data', () => {
      const mockData = {
        groups: [{ id: 'g1', name: 'Test', parentId: null, isExpanded: true, isTrash: false, createdAt: 1000 }] as Group[],
        phrases: [{ id: 'p1', text: 'test', groupId: 'g1', createdAt: 1000 }] as Phrase[],
        minusWords: [{ id: 'mw1', text: 'free', isExact: false, groupId: null, searchType: 'broad' as const, createdAt: 1000 }] as MinusWord[],
        minusWordGroups: [],
      };
      useAppStore.getState().loadProject(mockData);
      expect(useAppStore.getState().groups).toHaveLength(1);
      expect(useAppStore.getState().phrases).toHaveLength(1);
      expect(useAppStore.getState().minusWords).toHaveLength(1);
      expect(useAppStore.getState().activeGroupId).toBeNull();
    });

    it('should clear all data', () => {
      useAppStore.getState().addGroup('G1');
      useAppStore.getState().addMinusWord('test', false);
      useAppStore.getState().clearAll();
      expect(useAppStore.getState().groups).toEqual([]);
      expect(useAppStore.getState().phrases).toEqual([]);
      expect(useAppStore.getState().minusWords).toEqual([]);
      expect(useAppStore.getState().activeGroupId).toBeNull();
    });
  });

  // ---- StoreAccess Adapter ----

  describe('StoreAccess Adapter', () => {
    it('should return state via getState()', () => {
      const access = createStoreAccess();
      const state = access.getState();
      expect(state).toHaveProperty('groups');
      expect(state).toHaveProperty('phrases');
      expect(state).toHaveProperty('minusWords');
      expect(state).toHaveProperty('activeGroupId');
      expect(state).toHaveProperty('ui');
    });

    it('should return specific slice via getStateSlice()', () => {
      useAppStore.getState().addGroup('G1');
      const access = createStoreAccess();
      const groups = access.getStateSlice('groups');
      expect(groups).toHaveLength(1);
    });

    it('should dispatch addGroup action', () => {
      const access = createStoreAccess();
      access.dispatch('addGroup', { name: 'From Dispatch', parentId: null });
      expect(useAppStore.getState().groups).toHaveLength(1);
      expect(useAppStore.getState().groups[0].name).toBe('From Dispatch');
    });

    it('should dispatch addPhrases action', () => {
      const groupId = useAppStore.getState().addGroup('G1');
      const access = createStoreAccess();
      access.dispatch('addPhrases', { texts: ['hello'], groupId });
      expect(useAppStore.getState().phrases).toHaveLength(1);
    });

    it('should dispatch clearAll action', () => {
      useAppStore.getState().addGroup('G1');
      const access = createStoreAccess();
      access.dispatch('clearAll');
      expect(useAppStore.getState().groups).toEqual([]);
    });

    it('should dispatch deleteGroups action', () => {
      const store = useAppStore.getState();
      const g1 = store.addGroup('G1');
      const g2 = store.addGroup('G2');
      const access = createStoreAccess();
      access.dispatch('deleteGroups', [g1, g2]);
      expect(useAppStore.getState().groups).toHaveLength(0);
    });

    it('should dispatch moveGroups action', () => {
      const store = useAppStore.getState();
      const parent = store.addGroup('Parent');
      const child = store.addGroup('Child');
      const access = createStoreAccess();
      access.dispatch('moveGroups', { ids: [child], newParentId: parent });
      expect(useAppStore.getState().groups.find(g => g.id === child)?.parentId).toBe(parent);
    });

    it('should dispatch setSelectedGroupIds action', () => {
      const store = useAppStore.getState();
      const g1 = store.addGroup('G1');
      const access = createStoreAccess();
      access.dispatch('setSelectedGroupIds', new Set([g1]));
      expect(useAppStore.getState().selectedGroupIds.has(g1)).toBe(true);
    });

    it('should warn on unknown action', () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const access = createStoreAccess();
      access.dispatch('nonexistentAction', {});
      expect(consoleWarn).toHaveBeenCalled();
      consoleWarn.mockRestore();
    });

    it('should subscribe to store changes', () => {
      const access = createStoreAccess();
      const listener = vi.fn();
      const unsub = access.subscribe(listener);
      useAppStore.getState().addGroup('New');
      expect(listener).toHaveBeenCalled();
      unsub();
    });
  });
});
