// ============================================================
// Tests: Multigroup mode — activation, filtering, deactivation
// Validates that:
// 1. multigroupMode defaults to false
// 2. setMultigroupMode enables/disables mode
// 3. Entering multigroup clears activeGroupId
// 4. filteredPhrases logic respects multigroupMode + selectedGroupIds
// 5. selectedGroupIds works with toggleGroupSelection
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/plugin-sdk';
import type { Group, Phrase, MinusWord, MinusWordGroup } from '@/core/types';

// Helper to create a test phrase
function makePhrase(id: string, groupId: string, text: string): Phrase {
  return {
    id,
    text,
    groupId,
    frequency: 1,
    createdAt: Date.now(),
  };
}

// Helper to create a test group
function makeGroup(id: string, name: string, parentId: string | null = null): Group {
  return {
    id,
    name,
    parentId,
    isExpanded: false,
    isTrash: false,
    createdAt: Date.now(),
  };
}

describe('Store — Multigroup mode', () => {
  beforeEach(() => {
    useAppStore.getState().clearAll();
  });

  it('should default multigroupMode to false', () => {
    const state = useAppStore.getState();
    expect(state.ui.multigroupMode).toBe(false);
  });

  it('should activate multigroup mode with setMultigroupMode', () => {
    const store = useAppStore.getState();
    store.setMultigroupMode(true);
    expect(useAppStore.getState().ui.multigroupMode).toBe(true);
  });

  it('should deactivate multigroup mode', () => {
    const store = useAppStore.getState();
    store.setMultigroupMode(true);
    store.setMultigroupMode(false);
    expect(useAppStore.getState().ui.multigroupMode).toBe(false);
  });

  it('should clear activeGroupId when entering multigroup mode', () => {
    const store = useAppStore.getState();
    store.setActiveGroup('group-1');
    expect(useAppStore.getState().activeGroupId).toBe('group-1');

    store.setMultigroupMode(true);
    // activeGroupId is cleared — multigroup uses selectedGroupIds instead
    expect(useAppStore.getState().activeGroupId).toBeNull();
  });

  it('should restore first selected as activeGroupId when exiting multigroup mode', () => {
    const store = useAppStore.getState();
    store.setActiveGroup('group-1');
    store.setMultigroupMode(true);

    store.setMultigroupMode(false);
    // activeGroupId restored from first selected (which was group-1 transferred on enter)
    expect(useAppStore.getState().activeGroupId).toBe('group-1');
  });

  it('should reset multigroupMode on clearAll', () => {
    const store = useAppStore.getState();
    store.setMultigroupMode(true);
    expect(useAppStore.getState().ui.multigroupMode).toBe(true);

    store.clearAll();
    expect(useAppStore.getState().ui.multigroupMode).toBe(false);
  });
});

describe('Multigroup filtering logic (pure)', () => {
  // Replicates the logic from PhrasesTable.filteredPhrases
  function collectDescendantIds(gid: string, groups: Group[]): Set<string> {
    const ids = new Set<string>();
    const walk = (id: string) => {
      ids.add(id);
      groups.filter(g => g.parentId === id).forEach(g => walk(g.id));
    };
    walk(gid);
    return ids;
  }

  function filterPhrases(
    phrases: Phrase[],
    groups: Group[],
    activeGroupId: string | null,
    multigroupMode: boolean,
    selectedGroupIds: string[],
  ): Phrase[] {
    const trashGroup = groups.find(g => g.isTrash);
    let result = trashGroup ? phrases.filter(p => p.groupId !== trashGroup.id) : [...phrases];

    if (multigroupMode && selectedGroupIds.length > 0) {
      const groupIds = new Set<string>();
      selectedGroupIds.forEach(gid => {
        collectDescendantIds(gid, groups).forEach(id => groupIds.add(id));
      });
      result = result.filter(p => groupIds.has(p.groupId));
    } else if (activeGroupId) {
      const groupIds = collectDescendantIds(activeGroupId, groups);
      result = result.filter(p => groupIds.has(p.groupId));
    }
    return result;
  }

  const groups: Group[] = [
    makeGroup('g1', 'Group 1'),
    makeGroup('g2', 'Group 2'),
    makeGroup('g3', 'Group 3'),
    makeGroup('g1-sub', 'Sub 1', 'g1'),
    makeGroup('trash', 'Trash', null),
  ];
  (groups[4] as Group).isTrash = true;

  const phrases: Phrase[] = [
    makePhrase('p1', 'g1', 'keyword 1'),
    makePhrase('p2', 'g1', 'keyword 2'),
    makePhrase('p3', 'g2', 'keyword 3'),
    makePhrase('p4', 'g3', 'keyword 4'),
    makePhrase('p5', 'g1-sub', 'keyword 5'),
    makePhrase('p6', 'trash', 'keyword 6'),
  ];

  it('should show all phrases when no group active and no multigroup', () => {
    const result = filterPhrases(phrases, groups, null, false, []);
    // All except trash
    expect(result).toHaveLength(5);
    expect(result.find(p => p.id === 'p6')).toBeUndefined();
  });

  it('should filter by single active group (with descendants)', () => {
    const result = filterPhrases(phrases, groups, 'g1', false, []);
    // g1 includes its descendant g1-sub → p1, p2, p5
    expect(result).toHaveLength(3);
  });

  it('should include subgroups for single active group', () => {
    const result = filterPhrases(phrases, groups, 'g1', false, []);
    // g1 has child g1-sub, but collectDescendantIds only collects children of g1
    // g1's children: g1-sub. So groupIds = {g1, g1-sub}
    const groupIds = collectDescendantIds('g1', groups);
    expect(groupIds.has('g1')).toBe(true);
    expect(groupIds.has('g1-sub')).toBe(true);
    expect(groupIds.size).toBe(2);
  });

  it('should filter by multiple groups in multigroup mode', () => {
    const result = filterPhrases(phrases, groups, null, true, ['g1', 'g2']);
    // g1 has p1, p2; g1-sub has p5 (descendant of g1); g2 has p3
    expect(result).toHaveLength(4);
    const ids = result.map(p => p.id);
    expect(ids).toContain('p1');
    expect(ids).toContain('p2');
    expect(ids).toContain('p3');
    expect(ids).toContain('p5'); // subgroup of g1 included
  });

  it('should respect multigroup over activeGroupId', () => {
    // Even if activeGroupId is set, multigroup takes priority
    const result = filterPhrases(phrases, groups, 'g3', true, ['g1', 'g2']);
    // Should show g1+g2 phrases, NOT g3
    // g1 + g1-sub = 3 phrases, g2 = 1 phrase → total 4
    expect(result).toHaveLength(4);
    expect(result.find(p => p.id === 'p4')).toBeUndefined(); // p4 is in g3
  });

  it('should show all non-trash in multigroup mode with empty selection', () => {
    const result = filterPhrases(phrases, groups, null, true, []);
    // multigroupMode but no selectedGroupIds → falls to else-if activeGroupId=null → all
    expect(result).toHaveLength(5);
  });

  it('should exclude trash phrases in multigroup mode', () => {
    const result = filterPhrases(phrases, groups, null, true, ['g1', 'g2', 'trash']);
    // g1=2, g1-sub=1, g2=1, trash=1(excluded) → 4
    expect(result).toHaveLength(4);
    const ids = result.map(p => p.id);
    expect(ids).not.toContain('p6');
  });

  it('should handle three groups in multigroup mode', () => {
    const result = filterPhrases(phrases, groups, null, true, ['g1', 'g2', 'g3']);
    // All 5 non-trash phrases
    expect(result).toHaveLength(5);
  });
});

describe('selectGroupRange', () => {
  beforeEach(() => {
    useAppStore.getState().clearAll();
  });

  it('should select range from first to last in order', () => {
    const store = useAppStore.getState();
    const orderedIds = ['g1', 'g2', 'g3', 'g4', 'g5'];
    store.selectGroupRange('g1', 'g3', orderedIds);
    expect([...useAppStore.getState().selectedGroupIds].sort()).toEqual(['g1', 'g2', 'g3']);
  });

  it('should select range in reverse order (last to first)', () => {
    const store = useAppStore.getState();
    const orderedIds = ['g1', 'g2', 'g3', 'g4', 'g5'];
    store.selectGroupRange('g4', 'g2', orderedIds);
    expect([...useAppStore.getState().selectedGroupIds].sort()).toEqual(['g2', 'g3', 'g4']);
  });

  it('should select single item when fromId === toId', () => {
    const store = useAppStore.getState();
    const orderedIds = ['g1', 'g2', 'g3'];
    store.selectGroupRange('g2', 'g2', orderedIds);
    expect([...useAppStore.getState().selectedGroupIds]).toEqual(['g2']);
  });

  it('should not modify selection when fromId not in orderedIds', () => {
    const store = useAppStore.getState();
    store.toggleGroupSelection('existing');
    store.selectGroupRange('unknown', 'g3', ['g1', 'g2', 'g3']);
    expect([...useAppStore.getState().selectedGroupIds]).toEqual(['existing']);
  });

  it('should not modify selection when toId not in orderedIds', () => {
    const store = useAppStore.getState();
    store.toggleGroupSelection('existing');
    store.selectGroupRange('g1', 'unknown', ['g1', 'g2', 'g3']);
    expect([...useAppStore.getState().selectedGroupIds]).toEqual(['existing']);
  });

  it('should append to existing selection (not replace)', () => {
    const store = useAppStore.getState();
    store.toggleGroupSelection('existing');
    store.selectGroupRange('g1', 'g2', ['g1', 'g2', 'g3']);
    expect([...useAppStore.getState().selectedGroupIds].sort()).toEqual(['existing', 'g1', 'g2']);
  });

  it('should select full range when fromId is first and toId is last', () => {
    const store = useAppStore.getState();
    const orderedIds = ['a', 'b', 'c', 'd'];
    store.selectGroupRange('a', 'd', orderedIds);
    expect([...useAppStore.getState().selectedGroupIds].sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('selectPhraseRange', () => {
  beforeEach(() => {
    useAppStore.getState().clearAll();
  });

  it('should select range from first to last in order', () => {
    const store = useAppStore.getState();
    const orderedIds = ['p1', 'p2', 'p3', 'p4', 'p5'];
    store.selectPhraseRange('p1', 'p3', orderedIds);
    expect([...useAppStore.getState().selectedPhraseIds].sort()).toEqual(['p1', 'p2', 'p3']);
  });

  it('should select range in reverse order (last to first)', () => {
    const store = useAppStore.getState();
    const orderedIds = ['p1', 'p2', 'p3', 'p4', 'p5'];
    store.selectPhraseRange('p4', 'p2', orderedIds);
    expect([...useAppStore.getState().selectedPhraseIds].sort()).toEqual(['p2', 'p3', 'p4']);
  });

  it('should select single item when fromId === toId', () => {
    const store = useAppStore.getState();
    const orderedIds = ['p1', 'p2', 'p3'];
    store.selectPhraseRange('p2', 'p2', orderedIds);
    expect([...useAppStore.getState().selectedPhraseIds]).toEqual(['p2']);
  });

  it('should use index 0 as fallback when both IDs not in orderedIds', () => {
    const store = useAppStore.getState();
    store.togglePhraseSelection('existing');
    store.selectPhraseRange('unknown', 'also-unknown', ['p1', 'p2']);
    expect([...useAppStore.getState().selectedPhraseIds].sort()).toEqual(['existing', 'p1']);
  });

  it('should use toId as fallback when fromId not in orderedIds', () => {
    const store = useAppStore.getState();
    const orderedIds = ['p1', 'p2', 'p3'];
    store.selectPhraseRange('unknown', 'p2', orderedIds);
    expect([...useAppStore.getState().selectedPhraseIds]).toEqual(['p2']);
  });

  it('should use fromId as fallback when toId not in orderedIds', () => {
    const store = useAppStore.getState();
    const orderedIds = ['p1', 'p2', 'p3'];
    store.selectPhraseRange('p2', 'unknown', orderedIds);
    expect([...useAppStore.getState().selectedPhraseIds]).toEqual(['p2']);
  });

  it('should append to existing selection (not replace)', () => {
    const store = useAppStore.getState();
    store.togglePhraseSelection('existing');
    store.selectPhraseRange('p1', 'p2', ['p1', 'p2', 'p3']);
    expect([...useAppStore.getState().selectedPhraseIds].sort()).toEqual(['existing', 'p1', 'p2']);
  });

  it('should select full range when fromId is first and toId is last', () => {
    const store = useAppStore.getState();
    const orderedIds = ['a', 'b', 'c', 'd'];
    store.selectPhraseRange('a', 'd', orderedIds);
    expect([...useAppStore.getState().selectedPhraseIds].sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('setSelectedGroupIds', () => {
  beforeEach(() => {
    useAppStore.getState().clearAll();
  });

  it('should directly set selected group IDs', () => {
    const store = useAppStore.getState();
    store.setSelectedGroupIds(new Set(['g1', 'g2', 'g3']));
    expect(useAppStore.getState().selectedGroupIds.size).toBe(3);
    expect(useAppStore.getState().selectedGroupIds.has('g1')).toBe(true);
    expect(useAppStore.getState().selectedGroupIds.has('g2')).toBe(true);
    expect(useAppStore.getState().selectedGroupIds.has('g3')).toBe(true);
  });

  it('should replace existing selection', () => {
    const store = useAppStore.getState();
    store.toggleGroupSelection('old1');
    store.toggleGroupSelection('old2');
    store.setSelectedGroupIds(new Set(['new1']));
    expect(useAppStore.getState().selectedGroupIds.size).toBe(1);
    expect(useAppStore.getState().selectedGroupIds.has('new1')).toBe(true);
  });

  it('should accept empty set', () => {
    const store = useAppStore.getState();
    store.toggleGroupSelection('g1');
    store.setSelectedGroupIds(new Set());
    expect(useAppStore.getState().selectedGroupIds.size).toBe(0);
  });
});

describe('setMultigroupMode — new behavior', () => {
  beforeEach(() => {
    useAppStore.getState().clearAll();
  });

  it('should set activeGroupId to null when entering multigroup mode', () => {
    const store = useAppStore.getState();
    store.setActiveGroup('group-1');
    store.setMultigroupMode(true);
    expect(useAppStore.getState().activeGroupId).toBeNull();
  });

  it('should transfer activeGroupId into selectedGroupIds when entering', () => {
    const store = useAppStore.getState();
    store.setActiveGroup('group-1');
    store.setMultigroupMode(true);
    expect(useAppStore.getState().selectedGroupIds.has('group-1')).toBe(true);
  });

  it('should merge existing selectedGroupIds with activeGroupId when entering', () => {
    const store = useAppStore.getState();
    store.toggleGroupSelection('existing-selected');
    store.setActiveGroup('active-one');
    store.setMultigroupMode(true);
    const ids = useAppStore.getState().selectedGroupIds;
    expect(ids.has('existing-selected')).toBe(true);
    expect(ids.has('active-one')).toBe(true);
    expect(ids.size).toBe(2);
  });

  it('should clear selectedGroupIds and restore first as activeGroupId when exiting', () => {
    const store = useAppStore.getState();
    store.setMultigroupMode(true);
    store.toggleGroupSelection('group-a');
    store.toggleGroupSelection('group-b');
    store.setMultigroupMode(false);
    const state = useAppStore.getState();
    expect(state.ui.multigroupMode).toBe(false);
    expect(state.selectedGroupIds.size).toBe(0);
    expect(state.activeGroupId).toBe('group-a');
  });

  it('should set activeGroupId to null when exiting with empty selection', () => {
    const store = useAppStore.getState();
    store.setMultigroupMode(true);
    store.setMultigroupMode(false);
    const state = useAppStore.getState();
    expect(state.ui.multigroupMode).toBe(false);
    expect(state.selectedGroupIds.size).toBe(0);
    expect(state.activeGroupId).toBeNull();
  });
});

describe('Multigroup + selectedGroupIds integration', () => {
  beforeEach(() => {
    useAppStore.getState().clearAll();
  });

  it('should toggle group selection', () => {
    const store = useAppStore.getState();
    store.toggleGroupSelection('g1');
    expect(useAppStore.getState().selectedGroupIds.has('g1')).toBe(true);

    store.toggleGroupSelection('g2');
    expect(useAppStore.getState().selectedGroupIds.has('g1')).toBe(true);
    expect(useAppStore.getState().selectedGroupIds.has('g2')).toBe(true);

    store.toggleGroupSelection('g1');
    expect(useAppStore.getState().selectedGroupIds.has('g2')).toBe(true);
    expect(useAppStore.getState().selectedGroupIds.has('g1')).toBe(false);
  });

  it('should clear group selection', () => {
    const store = useAppStore.getState();
    store.toggleGroupSelection('g1');
    store.toggleGroupSelection('g2');
    store.clearGroupSelection();
    expect(useAppStore.getState().selectedGroupIds.size).toBe(0);
  });

  it('should maintain selectedGroupIds when entering multigroup mode', () => {
    const store = useAppStore.getState();
    store.toggleGroupSelection('g1');
    store.toggleGroupSelection('g2');
    store.setMultigroupMode(true);

    expect(useAppStore.getState().selectedGroupIds.has('g1')).toBe(true);
    expect(useAppStore.getState().selectedGroupIds.has('g2')).toBe(true);
    expect(useAppStore.getState().ui.multigroupMode).toBe(true);
  });
});
