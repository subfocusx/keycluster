import type { Phrase, KCID } from '../types';
import { buildChildrenMap, collectWithDescendants } from '@/core/utils/group-tree';

export interface SelectionSlice {
  selectedGroupIds: Set<KCID>;
  selectedPhraseIds: Set<KCID>;
  activeGroupId: KCID | null;
  setActiveGroup: (id: KCID | null) => void;
  toggleGroupSelection: (id: KCID) => void;
  selectGroupRange: (fromId: KCID, toId: KCID, orderedIds: KCID[]) => void;
  setSelectedGroupIds: (ids: Set<KCID>) => void;
  togglePhraseSelection: (id: KCID) => void;
  selectPhraseRange: (fromId: KCID, toId: KCID, orderedIds: KCID[]) => void;
  selectAllPhrases: () => void;
  clearPhraseSelection: () => void;
  clearGroupSelection: () => void;
}

export function createSelectionSlice(set: any, get: any) {
  return {
    selectedGroupIds: new Set<KCID>(),
    selectedPhraseIds: new Set<KCID>(),
    activeGroupId: null as KCID | null,
    setActiveGroup: (id: KCID | null) => set({ activeGroupId: id }),
    toggleGroupSelection: (id: KCID) => set((draft: any) => {
      const next = new Set(draft.selectedGroupIds);
      if (next.has(id)) next.delete(id); else next.add(id);
      draft.selectedGroupIds = next;
    }),
    selectGroupRange: (fromId: KCID, toId: KCID, orderedIds: KCID[]) => set((draft: any) => {
      const fromIdx = orderedIds.indexOf(fromId);
      const toIdx = orderedIds.indexOf(toId);
      if (fromIdx === -1 || toIdx === -1) return;
      const [start, end] = fromIdx <= toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
      const rangeIds = orderedIds.slice(start, end + 1);
      const next = new Set(draft.selectedGroupIds);
      for (const id of rangeIds) next.add(id);
      draft.selectedGroupIds = next;
    }),
    setSelectedGroupIds: (ids: Set<KCID>) => set((draft: any) => {
      draft.selectedGroupIds = ids;
    }),
    togglePhraseSelection: (id: KCID) => set((draft: any) => {
      const next = new Set(draft.selectedPhraseIds);
      if (next.has(id)) next.delete(id); else next.add(id);
      draft.selectedPhraseIds = next;
    }),
    selectPhraseRange: (fromId: KCID, toId: KCID, orderedIds: KCID[]) => set((draft: any) => {
      let fromIdx = orderedIds.indexOf(fromId);
      let toIdx = orderedIds.indexOf(toId);
      if (fromIdx === -1) fromIdx = toIdx === -1 ? 0 : toIdx;
      if (toIdx === -1) toIdx = fromIdx === -1 ? 0 : fromIdx;
      if (fromIdx === -1 && toIdx === -1) return;
      const [start, end] = fromIdx <= toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
      const rangeIds = orderedIds.slice(start, end + 1);
      const next = new Set(draft.selectedPhraseIds);
      for (const id of rangeIds) next.add(id);
      draft.selectedPhraseIds = next;
    }),
    selectAllPhrases: () => {
      const state = get();
      let pool: Phrase[];
      if (state.ui.multigroupMode && state.selectedGroupIds.size > 0) {
        const childrenMap = buildChildrenMap(state.groups);
        const groupIds = new Set<KCID>();
        for (const gid of state.selectedGroupIds) {
          for (const id of collectWithDescendants(gid, childrenMap)) {
            groupIds.add(id);
          }
        }
        pool = state.phrases.filter((p: Phrase) => groupIds.has(p.groupId));
      } else if (state.activeGroupId) {
        const childrenMap = buildChildrenMap(state.groups);
        const groupIds = new Set<KCID>();
        for (const id of collectWithDescendants(state.activeGroupId, childrenMap)) {
          groupIds.add(id);
        }
        pool = state.phrases.filter((p: Phrase) => groupIds.has(p.groupId));
      } else {
        pool = state.phrases;
      }
      set({ selectedPhraseIds: new Set(pool.map((p: Phrase) => p.id)) });
    },
    clearPhraseSelection: () => set((draft: any) => { draft.selectedPhraseIds = new Set() }),
    clearGroupSelection: () => set((draft: any) => { draft.selectedGroupIds = new Set() }),
  };
}
