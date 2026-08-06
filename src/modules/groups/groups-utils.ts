import type { KCID, Group, Phrase } from '@/plugin-sdk';
import { sortGroups } from './utils/sort';
import type { GroupSortField } from './utils/sort';
import { subtreeMatchesFilter } from './utils/filter';
import { GroupFilterCondition } from './utils/filter';

export function getFlatVisibleGroupIds(
  groups: Group[],
  parentId: KCID | null,
  filterConditions: GroupFilterCondition[],
  hasFilter: boolean,
  getPhraseCount: (id: KCID) => number,
  sortField: GroupSortField | null,
  sortDir: 'asc' | 'desc',
  phrases: Phrase[],
  selectedPhraseIds: Set<KCID>,
  phraseCountByGroup: Map<KCID, number>,
): KCID[] {
  let children = groups.filter(g => g.parentId === parentId && !g.isTrash);
  if (sortField) {
    children = sortGroups(children, sortField, sortDir, getPhraseCount);
  }
  const result: KCID[] = [];
  for (const g of children) {
    if (hasFilter && !subtreeMatchesFilter(g, filterConditions, groups, phrases, selectedPhraseIds, phraseCountByGroup)) {
      continue;
    }
    result.push(g.id);
    if (g.isExpanded) {
      result.push(...getFlatVisibleGroupIds(groups, g.id, filterConditions, hasFilter, getPhraseCount, sortField, sortDir, phrases, selectedPhraseIds, phraseCountByGroup));
    }
  }
  return result;
}