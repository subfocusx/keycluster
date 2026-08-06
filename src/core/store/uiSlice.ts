import { v4 as uuid } from 'uuid';
import type { KCID, UIState } from '../types';
import { rebuildPhraseMap } from './phraseSlice';

export interface UISlice {
  ui: UIState;
  clusteringResults: Map<string, any[]> | null;
  setLeftPanel: (open: boolean, module?: string | null) => void;
  setRightPanel: (open: boolean) => void;
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  setTheme: (theme: UIState['theme']) => void;
  setModulesLoading: (loading: boolean) => void;
  addFailedModule: (moduleId: string) => void;
  removeFailedModule: (moduleId: string) => void;
  setDbPersistenceEnabled: (enabled: boolean) => void;
  triggerColumnAutoResize: () => void;
  toggleColumnVisibility: (colKey: string) => void;
  setColumnLabel: (colKey: string, label: string) => void;
  setColumnColor: (colKey: string, color: string) => void;
  resetColumnSettings: () => void;
  setMultigroupMode: (enabled: boolean) => void;
  setClusteringResults: (results: Map<string, any[]> | null) => void;
  applyClusteringResults: () => void;
}

export function createUISlice(set: any, get: any) {
  return {
    clusteringResults: null as Map<string, any[]> | null,
    ui: {
      leftPanel: { open: false, width: 300, module: null },
      rightPanel: { open: true, width: 280 },
      ribbon: { activeTab: 'file' },
      theme: 'light' as const,
      modulesLoading: true,
      failedModules: [] as string[],
      dbPersistenceEnabled: false,
      columnAutoResizeTrigger: 0,
      columnVisibility: {} as Record<string, boolean>,
      columnLabels: {} as Record<string, string>,
      columnColors: {} as Record<string, string>,
      multigroupMode: false,
    } as UIState,
    setLeftPanel: (open: boolean, module: string | null = null) => set((s: any) => ({
      ui: { ...s.ui, leftPanel: { ...s.ui.leftPanel, open, module: module ?? s.ui.leftPanel.module } },
    })),
    setRightPanel: (open: boolean) => set((s: any) => ({
      ui: { ...s.ui, rightPanel: { ...s.ui.rightPanel, open } },
    })),
    setLeftPanelWidth: (width: number) => set((s: any) => ({
      ui: { ...s.ui, leftPanel: { ...s.ui.leftPanel, width: Math.max(200, Math.min(500, width)) } },
    })),
    setRightPanelWidth: (width: number) => set((s: any) => ({
      ui: { ...s.ui, rightPanel: { ...s.ui.rightPanel, width: Math.max(200, Math.min(500, width)) } },
    })),
    setTheme: (theme: UIState['theme']) => set((s: any) => ({ ui: { ...s.ui, theme } })),
    setModulesLoading: (modulesLoading: boolean) => set((s: any) => ({ ui: { ...s.ui, modulesLoading } })),
    addFailedModule: (moduleId: string) => set((s: any) => ({
      ui: {
        ...s.ui,
        failedModules: s.ui.failedModules.includes(moduleId)
          ? s.ui.failedModules
          : [...s.ui.failedModules, moduleId],
      },
    })),
    removeFailedModule: (moduleId: string) => set((s: any) => ({
      ui: { ...s.ui, failedModules: s.ui.failedModules.filter((id: string) => id !== moduleId) },
    })),
    setDbPersistenceEnabled: (enabled: boolean) => set((s: any) => ({
      ui: { ...s.ui, dbPersistenceEnabled: enabled },
    })),
    triggerColumnAutoResize: () => set((s: any) => ({
      ui: { ...s.ui, columnAutoResizeTrigger: s.ui.columnAutoResizeTrigger + 1 },
    })),
    toggleColumnVisibility: (colKey: string) => set((s: any) => ({
      ui: { ...s.ui, columnVisibility: { ...s.ui.columnVisibility, [colKey]: s.ui.columnVisibility[colKey] === false ? true : false } },
    })),
    setColumnLabel: (colKey: string, label: string) => set((s: any) => ({
      ui: { ...s.ui, columnLabels: { ...s.ui.columnLabels, [colKey]: label } },
    })),
    setColumnColor: (colKey: string, color: string) => set((s: any) => ({
      ui: { ...s.ui, columnColors: { ...s.ui.columnColors, [colKey]: color } },
    })),
    resetColumnSettings: () => set((s: any) => ({
      ui: { ...s.ui, columnVisibility: {}, columnLabels: {}, columnColors: {} },
    })),
    setMultigroupMode: (enabled: boolean) => set((draft: any) => {
      if (enabled) {
        const ids = new Set(draft.selectedGroupIds);
        if (draft.activeGroupId) ids.add(draft.activeGroupId);
        draft.selectedGroupIds = ids;
        draft.ui.multigroupMode = true;
        draft.activeGroupId = null;
      } else {
        draft.ui.multigroupMode = false;
        const firstSelected = [...draft.selectedGroupIds][0] ?? null;
        draft.activeGroupId = firstSelected;
        draft.selectedGroupIds = new Set();
      }
    }),
    setClusteringResults: (results: Map<string, any[]> | null) => set({ clusteringResults: results }),
    applyClusteringResults: () => {
      const state = get();
      const results = state.clusteringResults;
      if (!results || results.size === 0) return;

      state.pushUndo();

      const now = Date.now();
      const rootId = uuid();

      const phraseToGroup = new Map<KCID, KCID>();
      const newGroups: any[] = [{ id: rootId, name: 'Кластеры', parentId: null, isExpanded: true, isTrash: false, createdAt: now }];

      for (const [name, clusterPhrases] of results) {
        const groupId = uuid();
        newGroups.push({ id: groupId, name, parentId: rootId, isExpanded: false, isTrash: false, createdAt: now });
        for (const p of clusterPhrases) {
          phraseToGroup.set(p.id, groupId);
        }
      }

      set((draft: any) => {
        draft.groups.push(...newGroups);
        for (const p of draft.phrases) {
          const targetGroupId = phraseToGroup.get(p.id);
          if (targetGroupId !== undefined) {
            p.groupId = targetGroupId;
          }
        }
        draft.phraseMap = rebuildPhraseMap(draft.phrases);
        draft.activeGroupId = rootId;
        draft.clusteringResults = null;
      });
    },
  };
}
