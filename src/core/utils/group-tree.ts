import type { Group, KCID } from '@/core/types';

export function buildChildrenMap(groups: Group[]): Map<KCID | null, KCID[]> {
  const map = new Map<KCID | null, KCID[]>();
  for (const g of groups) {
    const children = map.get(g.parentId);
    if (children) {
      children.push(g.id);
    } else {
      map.set(g.parentId, [g.id]);
    }
  }
  return map;
}

export function collectWithDescendants(
  rootId: KCID,
  childrenMap: Map<KCID | null, KCID[]>,
): Set<KCID> {
  const result = new Set<KCID>();
  const stack: KCID[] = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    result.add(id);
    const children = childrenMap.get(id);
    if (children) {
      for (const child of children) {
        stack.push(child);
      }
    }
  }
  return result;
}

export function collectManyWithDescendants(
  rootIds: KCID[],
  groups: Group[],
): Set<KCID> {
  const childrenMap = buildChildrenMap(groups);
  const result = new Set<KCID>();
  for (const rootId of rootIds) {
    for (const id of collectWithDescendants(rootId, childrenMap)) {
      result.add(id);
    }
  }
  return result;
}
