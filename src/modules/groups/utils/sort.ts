import type { Group, KCID } from '@/plugin-sdk';
export type GroupSortField = 'name' | 'phraseCount' | 'createdAt';

export function sortGroups(
  groupsToSort: Group[],
  field: GroupSortField,
  dir: 'asc' | 'desc',
  getPhraseCount: (id: KCID) => number,
): Group[] {
  const sorted = [...groupsToSort].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case 'name':
        cmp = a.name.localeCompare(b.name, 'ru');
        break;
      case 'phraseCount':
        cmp = getPhraseCount(a.id) - getPhraseCount(b.id);
        break;
      case 'createdAt':
        cmp = a.createdAt - b.createdAt;
        break;
    }
    return dir === 'asc' ? cmp : -cmp;
  });
  return sorted;
}
