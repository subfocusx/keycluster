import type { KCID } from '@/plugin-sdk';
import { useMemo } from 'react';
import { useAppStore } from '@/plugin-sdk';

function collectDescendantIds(gid: KCID, groups: { id: KCID; parentId: KCID | null }[]): Set<KCID> {
  const ids = new Set<KCID>();
  const walk = (id: KCID) => {
    ids.add(id);
    groups.filter(g => g.parentId === id).forEach(g => walk(g.id));
  };
  walk(gid);
  return ids;
}

export function useActiveGroupIds(): Set<KCID> {
  const activeGroupId = useAppStore(s => s.activeGroupId);
  const selectedGroupIds = useAppStore(s => s.selectedGroupIds);
  const multigroupMode = useAppStore(s => s.ui.multigroupMode);
  const groups = useAppStore(s => s.groups);

  return useMemo(() => {
    if (multigroupMode && selectedGroupIds.size > 0) {
      const groupIds = new Set<KCID>();
      selectedGroupIds.forEach(gid => {
        collectDescendantIds(gid, groups).forEach(id => groupIds.add(id));
      });
      return groupIds;
    }
    if (activeGroupId) {
      return collectDescendantIds(activeGroupId, groups);
    }
    return new Set(groups.map(g => g.id));
  }, [activeGroupId, multigroupMode, selectedGroupIds, groups]);
}
