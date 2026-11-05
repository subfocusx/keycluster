// ============================================================
// Minus Words — list scoping helper
// ============================================================
//
// The minus-words list is scoped by the "target"/active group:
//  - when a group is active -> show that group's own words, the words of
//    its ancestors (a parent-group word applies to the whole subtree)
//    and global words,
//  - when nothing is active (global/main folder) -> show every word.
//
// Pure helper, separated for unit-testing.

import type { MinusWord, KCID } from 'plugin-sdk';

interface ScopedGroup {
  id: KCID;
  parentId?: KCID | null;
}

/** Collect the ids of all ancestors of a group (closest first). */
export function collectAncestorGroupIds(groupId: KCID, groups: ScopedGroup[]): Set<KCID> {
  const ids = new Set<KCID>();
  const byId = new Map(groups.map(g => [g.id, g]));
  let current = byId.get(groupId)?.parentId ?? null;
  while (current && !ids.has(current)) {
    ids.add(current);
    current = byId.get(current)?.parentId ?? null;
  }
  return ids;
}

export function scopedMinusWords(
  minusWords: MinusWord[],
  groupId: KCID | null,
  groups: ScopedGroup[] = [],
): MinusWord[] {
  if (groupId == null) return minusWords;
  const ancestorIds = collectAncestorGroupIds(groupId, groups);
  return minusWords.filter(mw =>
    mw.groupId == null || mw.groupId === groupId || ancestorIds.has(mw.groupId),
  );
}
