import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAppStore } from '@/plugin-sdk';
import { useActiveGroupIds } from '@/modules/phrases/useActiveGroupIds';

beforeEach(() => {
  useAppStore.setState({
    groups: [],
    phrases: [],
    minusWords: [],
    activeGroupId: null,
    activePhraseId: null,
    selectedGroupIds: new Set(),
    selectedPhraseIds: new Set(),
  } as any);
});

describe('useActiveGroupIds', () => {
  it('returns all groups when no active group and no multigroup mode', () => {
    const store = useAppStore.getState();
    store.addGroup('Group A');
    store.addGroup('Group B');

    const { result } = renderHook(() => useActiveGroupIds());
    expect(result.current.size).toBe(2);
  });

  it('returns set with single active group ID', () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('Group A');
    store.setActiveGroup(gid);

    const { result } = renderHook(() => useActiveGroupIds());
    expect(result.current).toEqual(new Set([gid]));
  });

  it('returns set with active group and its descendants', () => {
    const store = useAppStore.getState();
    const parentId = store.addGroup('Parent');
    const childId = store.addGroup('Child', parentId);
    const grandchildId = store.addGroup('Grandchild', childId);
    store.setActiveGroup(parentId);

    const { result } = renderHook(() => useActiveGroupIds());
    expect(result.current).toEqual(new Set([parentId, childId, grandchildId]));
  });

  it('returns selected group IDs when in multigroup mode', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Group 1');
    const g2 = store.addGroup('Group 2');
    store.setMultigroupMode(true);
    store.toggleGroupSelection(g1);
    store.toggleGroupSelection(g2);

    const { result } = renderHook(() => useActiveGroupIds());
    expect(result.current).toEqual(new Set([g1, g2]));
  });

  it('returns all group IDs when in multigroup mode with no selected groups', () => {
    const store = useAppStore.getState();
    store.addGroup('Group A');
    store.addGroup('Group B');
    store.setMultigroupMode(true);

    const { result } = renderHook(() => useActiveGroupIds());
    const allGroups = useAppStore.getState().groups.map(g => g.id);
    expect(result.current.size).toBe(allGroups.length);
    allGroups.forEach(id => {
      expect(result.current.has(id)).toBe(true);
    });
  });

  it('returns selected group IDs with descendants in multigroup mode', () => {
    const store = useAppStore.getState();
    const parentId = store.addGroup('Parent');
    const childId = store.addGroup('Child', parentId);
    store.setMultigroupMode(true);
    store.toggleGroupSelection(parentId);

    const { result } = renderHook(() => useActiveGroupIds());
    expect(result.current).toEqual(new Set([parentId, childId]));
  });

  it('returns all groups when multigroup mode is off and no active group', () => {
    const store = useAppStore.getState();
    store.addGroup('Orphan');
    store.setMultigroupMode(false);

    const { result } = renderHook(() => useActiveGroupIds());
    expect(result.current.size).toBe(1);
  });

  it('returns active group ID even when multigroup mode is off', () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('Lonely');
    store.setActiveGroup(gid);
    store.setMultigroupMode(false);

    const { result } = renderHook(() => useActiveGroupIds());
    expect(result.current).toEqual(new Set([gid]));
  });

  it('recomputes when groups change (new child added)', () => {
    const store = useAppStore.getState();
    const parentId = store.addGroup('Parent');
    store.setActiveGroup(parentId);

    const { result, rerender } = renderHook(() => useActiveGroupIds());
    expect(result.current).toEqual(new Set([parentId]));

    const childId = store.addGroup('Child', parentId);
    rerender();
    expect(result.current).toEqual(new Set([parentId, childId]));
  });
});
