// ╔══════════════════════════════════════════════════════════╗
// ║  @core — ЯДРО KEYCLUSTER                                 ║
// ║  Плагины НЕ ДОЛЖНЫ импортировать этот файл напрямую.    ║
// ╚══════════════════════════════════════════════════════════╝
import { v4 as uuid } from 'uuid';
import type { Group, KCID } from '../types';
import { LogStore } from '../logging/LogStore';
import { collectManyWithDescendants, buildChildrenMap, collectWithDescendants } from '@/core/utils/group-tree';
import { rebuildPhraseMap } from './phraseSlice';

export interface GroupSlice {
  groups: Group[];
  addGroup: (name: string, parentId?: KCID | null) => KCID;
  addGroupFromList: (names: string[], parentId?: KCID | null) => KCID[];
  renameGroup: (id: KCID, name: string) => void;
  deleteGroup: (id: KCID) => void;
  deleteGroups: (ids: KCID[]) => void;
  moveGroup: (id: KCID, newParentId: KCID | null) => void;
  moveGroups: (ids: KCID[], newParentId: KCID | null) => void;
  toggleExpand: (id: KCID) => void;
  setAllExpanded: (expanded: boolean) => void;
  setGroupColor: (id: KCID, color: string) => void;
  setGroupsColor: (ids: KCID[], color: string) => void;
  setGroupNotes: (id: KCID, notes: string) => void;
  setGroupQuality: (id: KCID, quality: { score: number; reason: string; updatedAt: number } | null) => void;
}

export function createGroupSlice(set: any, get: any) {
  return {
    groups: [] as Group[],
    addGroup: (name: string, parentId: KCID | null = null) => {
      get().pushUndo();
      const id = uuid();
      set((s: any) => ({ groups: [...s.groups, { id, name, parentId, isExpanded: true, isTrash: false, createdAt: Date.now() }] }));
      LogStore._log('info', 'groups', `Group added: "${name}"`, { id, parentId });
      return id;
    },
    addGroupFromList: (names: string[], parentId: KCID | null = null) => {
      get().pushUndo();
      const ids: KCID[] = [];
      const newGroups: Group[] = names.map(name => {
        const id = uuid();
        ids.push(id);
        return { id, name, parentId, isExpanded: false, isTrash: false, createdAt: Date.now() };
      });
      set((s: any) => ({ groups: [...s.groups, ...newGroups] }));
      LogStore._log('info', 'groups', `${names.length} groups added from list`, { ids, parentId });
      return ids;
    },
    renameGroup: (id: KCID, name: string) => {
      get().pushUndo();
      set((s: any) => ({ groups: s.groups.map((g: Group) => g.id === id ? { ...g, name } : g) }));
      LogStore._log('debug', 'groups', `Group renamed to "${name}"`, { id });
    },
    deleteGroup: (id: KCID) => {
      get().pushUndo();
      const state = get();
      const toDelete = collectManyWithDescendants([id], state.groups);
      LogStore._log('info', 'groups', `Group deleted: ${id} (${toDelete.size} sub-groups)`, { id, deletedIds: Array.from(toDelete) });
      set((draft: any) => {
        draft.groups = draft.groups.filter((g: Group) => !toDelete.has(g.id));
        draft.phrases = draft.phrases.filter((p: any) => !toDelete.has(p.groupId));
        draft.phraseMap = rebuildPhraseMap(draft.phrases);
        draft.selectedGroupIds = new Set([...draft.selectedGroupIds].filter((gid: KCID) => !toDelete.has(gid)));
        if (draft.activeGroupId && toDelete.has(draft.activeGroupId)) draft.activeGroupId = null;
      });
    },
    moveGroup: (id: KCID, newParentId: KCID | null) => {
      get().pushUndo();
      set((s: any) => ({
        groups: s.groups.map((g: Group) => g.id === id ? { ...g, parentId: newParentId } : g),
      }));
    },
    deleteGroups: (ids: KCID[]) => {
      get().pushUndo();
      const state = get();
      const toDelete = collectManyWithDescendants(ids, state.groups);
      LogStore._log('info', 'groups', `${ids.length} groups deleted (${toDelete.size} total)`, { ids, deletedIds: Array.from(toDelete) });
      set((draft: any) => {
        draft.groups = draft.groups.filter((g: Group) => !toDelete.has(g.id));
        draft.phrases = draft.phrases.filter((p: any) => !toDelete.has(p.groupId));
        draft.phraseMap = rebuildPhraseMap(draft.phrases);
        draft.selectedGroupIds = new Set([...draft.selectedGroupIds].filter((gid: KCID) => !toDelete.has(gid)));
        if (draft.activeGroupId && toDelete.has(draft.activeGroupId)) draft.activeGroupId = null;
        if (draft.ui.multigroupMode && draft.selectedGroupIds.size === 0) {
          draft.ui.multigroupMode = false;
        }
      });
    },
    moveGroups: (ids: KCID[], newParentId: KCID | null) => {
      const state = get();
      const idSet = new Set(ids);

      if (!newParentId) {
        get().pushUndo();
        set((draft: any) => {
          draft.groups = draft.groups.map((g: Group) => idSet.has(g.id) ? { ...g, parentId: null } : g);
        });
        return;
      }

      const childrenMap = buildChildrenMap(state.groups);

      for (const id of ids) {
        const descendants = collectWithDescendants(id, childrenMap);
        if (descendants.has(newParentId)) {
          console.warn(`[moveGroups] Cannot move group ${id} into its own descendant ${newParentId}`);
          return;
        }
      }

      get().pushUndo();
      set((draft: any) => {
        draft.groups = draft.groups.map((g: Group) => idSet.has(g.id) ? { ...g, parentId: newParentId } : g);
      });
    },
    toggleExpand: (id: KCID) => set((s: any) => ({
      groups: s.groups.map((g: Group) => g.id === id ? { ...g, isExpanded: !g.isExpanded } : g),
    })),
    setAllExpanded: (expanded: boolean) => {
      set((s: any) => ({
        groups: s.groups.map((g: Group) => ({ ...g, isExpanded: expanded })),
      }));
    },
    setGroupColor: (id: KCID, color: string) => {
      get().pushUndo();
      set((s: any) => ({ groups: s.groups.map((g: Group) => g.id === id ? { ...g, color } : g) }));
    },
    setGroupsColor: (ids: KCID[], color: string) => {
      get().pushUndo();
      const idSet = new Set(ids);
      set((s: any) => ({
        groups: s.groups.map((g: Group) =>
          idSet.has(g.id) ? { ...g, color } : g
        ),
      }));
    },
    setGroupNotes: (id: KCID, notes: string) => {
      get().pushUndo();
      set((s: any) => ({ groups: s.groups.map((g: Group) => g.id === id ? { ...g, notes } : g) }));
    },
    setGroupQuality: (id: KCID, quality: { score: number; reason: string; updatedAt: number } | null) => set((s: any) => ({
      groups: s.groups.map((g: Group) => g.id === id ? { ...g, clusterQuality: quality ?? undefined } : g),
    })),
  };
}
