import { describe, it, expect } from 'vitest';
import { buildChildrenMap, collectWithDescendants, collectManyWithDescendants } from '@/core/utils/group-tree';
import type { Group } from '@/core/types';

function g(id: string, parentId: string | null = null): Group {
  return { id, parentId, name: id, isExpanded: true, isTrash: false, createdAt: 0 };
}

describe('buildChildrenMap', () => {
  it('empty array returns empty Map', () => {
    const map = buildChildrenMap([]);
    expect(map.size).toBe(0);
  });

  it('root groups are under null key', () => {
    const groups = [g('a'), g('b')];
    const map = buildChildrenMap(groups);
    expect(map.get(null)).toEqual(['a', 'b']);
  });

  it('child groups are under parentId key', () => {
    const groups = [g('a'), g('child1', 'a'), g('child2', 'a')];
    const map = buildChildrenMap(groups);
    expect(map.get(null)).toEqual(['a']);
    expect(map.get('a')).toEqual(['child1', 'child2']);
  });

  it('multiple children for same parent', () => {
    const groups = [g('root'), g('c1', 'root'), g('c2', 'root'), g('c3', 'root')];
    const map = buildChildrenMap(groups);
    expect(map.get('root')).toEqual(['c1', 'c2', 'c3']);
  });
});

describe('collectWithDescendants', () => {
  it('leaf node returns only itself', () => {
    const groups = [g('a'), g('b', 'a')];
    const map = buildChildrenMap(groups);
    const result = collectWithDescendants('b', map);
    expect(result).toEqual(new Set(['b']));
  });

  it('node with children returns itself and all descendants', () => {
    const groups = [g('a'), g('b', 'a'), g('c', 'a')];
    const map = buildChildrenMap(groups);
    const result = collectWithDescendants('a', map);
    expect(result).toEqual(new Set(['a', 'b', 'c']));
  });

  it('deep tree includes all levels', () => {
    const groups = [
      g('root'),
      g('A', 'root'),
      g('B', 'A'),
      g('C', 'B'),
      g('D', 'C'),
    ];
    const map = buildChildrenMap(groups);
    const result = collectWithDescendants('root', map);
    expect(result).toEqual(new Set(['root', 'A', 'B', 'C', 'D']));
  });

  it('non-existent id returns set with only that id', () => {
    const groups = [g('a')];
    const map = buildChildrenMap(groups);
    const result = collectWithDescendants('nonexistent', map);
    expect(result).toEqual(new Set(['nonexistent']));
  });
});

describe('collectManyWithDescendants', () => {
  it('two independent subtrees merged', () => {
    const groups = [
      g('root1'), g('c1', 'root1'),
      g('root2'), g('c2', 'root2'),
      g('unrelated'),
    ];
    const result = collectManyWithDescendants(['root1', 'root2'], groups);
    expect(result).toEqual(new Set(['root1', 'c1', 'root2', 'c2']));
  });

  it('overlapping subtrees produce no duplicates', () => {
    const groups = [
      g('root'),
      g('child', 'root'),
      g('grandchild', 'child'),
    ];
    const result = collectManyWithDescendants(['root', 'child'], groups);
    expect(result).toEqual(new Set(['root', 'child', 'grandchild']));
  });
});
