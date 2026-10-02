// ╔══════════════════════════════════════════════════════════╗
// ║  @core — ЯДРО KEYCLUSTER                                 ║
// ║  Этот файл является частью ядра приложения.              ║
// ║  НЕ ИЗМЕНЯТЬ логику без явного решения команды.         ║
// ║  Плагины НЕ ДОЛЖНЫ импортировать этот файл напрямую.    ║
// ╚══════════════════════════════════════════════════════════╝
// ============================================================
// KeyCluster Store — Zustand with modular slices + StoreAccess adapter
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import type { UIState, StoreAccess, SettingFieldSchema } from './types';
import { useSettingsStore } from './settings-store';

let _runtimeRef: { getRuntime: () => unknown } | null = null;
export function setRuntimeRef(ref: { getRuntime: () => unknown }): void {
  _runtimeRef = ref;
}

enableMapSet();

import { createGroupSlice } from './store/groupSlice';
import type { GroupSlice } from './store/groupSlice';
import { createPhraseSlice, rebuildPhraseMap } from './store/phraseSlice';
import type { PhraseSlice } from './store/phraseSlice';
import type { Phrase } from './types';
import { createMinusWordSlice } from './store/minusWordSlice';
import type { MinusWordSlice } from './store/minusWordSlice';
import { createSelectionSlice } from './store/selectionSlice';
import type { SelectionSlice } from './store/selectionSlice';
import { createUISlice } from './store/uiSlice';
import type { UISlice } from './store/uiSlice';
import { createProjectSlice } from './store/projectSlice';
import type { ProjectSlice } from './store/projectSlice';
import { createUndoSlice } from './store/undoSlice';
import type { UndoSlice } from './store/undoSlice';
import { createDevtoolsSlice } from './store/devtoolsSlice';
import type { DevtoolsSlice } from './store/devtoolsSlice';


// ---- Combined Store Type ----

export type AppStore = GroupSlice & PhraseSlice & MinusWordSlice & SelectionSlice & UISlice & ProjectSlice & UndoSlice & DevtoolsSlice;

// ---- Store Implementation ----

export const useAppStore = create<AppStore>()(
  persist(
    immer((set, get) => ({
      ...createGroupSlice(set, get),
      ...createPhraseSlice(set, get),
      ...createMinusWordSlice(set, get),
      ...createSelectionSlice(set, get),
      ...createUISlice(set, get),
      ...createProjectSlice(set, get),
      ...createUndoSlice(set, get),
      ...createDevtoolsSlice(set, get),
    })),
    {
      name: 'keycluster-store',
      partialize: (state) => ({
        groups: state.groups,
        phrases: state.phrases,
        minusWords: state.minusWords,
        minusWordGroups: state.minusWordGroups,
        ui: {
          ...state.ui,
          modulesLoading: undefined,
          failedModules: [],
        },
      }),
      merge: (persisted: unknown, current: AppStore) => {
        const p = persisted as Partial<AppStore> | null;
        if (!p || typeof p !== 'object') return current;
        // phraseMap не персистится (Map не сериализуем) — перестраиваем из phrases,
        // иначе все операции по индексу (updatePhrase, togglePhraseStar, addTag) — no-op.
        const phrases = p.phrases ?? current.phrases;
        const phraseMap = rebuildPhraseMap(phrases as unknown as Phrase[]);
        return {
          ...current,
          groups: p.groups ?? current.groups,
          phrases,
          phraseMap,
          minusWords: p.minusWords ?? current.minusWords,
          minusWordGroups: p.minusWordGroups ?? current.minusWordGroups,
          ui: {
            ...current.ui,
            ...(p.ui as Partial<AppStore['ui']> | undefined),
            modulesLoading: true,
            columnAutoResizeTrigger: 0,
          },
          undoStack: [],
          redoStack: [],
        } as AppStore;
      },
    }
  )
);

// ---- Context Keys sync ----

let contextKeysInitialized = false;
export function resetContextKeysSync(): void {
  contextKeysInitialized = false;
}
export function initContextKeysSync() {
  if (contextKeysInitialized) return;
  contextKeysInitialized = true;

  const sync = () => {
    const s = useAppStore.getState();
    import('./context-keys').then(({ getContextKeyService }) => {
      const ck = getContextKeyService();
      ck.setKey('hasSelection', s.selectedPhraseIds.size > 0);
      ck.setKey('hasActiveGroup', s.activeGroupId !== null);
      ck.setKey('phraseCount', s.phrases.length);
      ck.setKey('groupCount', s.groups.filter((g) => !g.isTrash).length);
    }).catch(() => { /* context-keys optional */ });
  };

  useAppStore.subscribe(sync);
  sync();
}

// ---- StoreAccess Adapter for Modules ----

export function createStoreAccess(): StoreAccess {
  return {
    getState: () => {
      const s = useAppStore.getState();
      return {
        groups: s.groups,
        phrases: s.phrases,
        minusWords: s.minusWords,
        minusWordGroups: s.minusWordGroups,
        selectedGroupIds: s.selectedGroupIds,
        selectedPhraseIds: s.selectedPhraseIds,
        activeGroupId: s.activeGroupId,
        ui: s.ui,
      };
    },
    getStateSlice: (key) => {
      return useAppStore.getState()[key];
    },
    dispatch: (action, payload) => {
      const store = useAppStore.getState();
      switch (action) {
        case 'addGroup': store.addGroup(payload.name, payload.parentId); break;
        case 'deleteGroup': store.deleteGroup(payload); break;
        case 'deleteGroups': store.deleteGroups(payload); break;
        case 'moveGroups': store.moveGroups(payload.ids, payload.newParentId); break;
        case 'setSelectedGroupIds': store.setSelectedGroupIds(payload); break;
        case 'renameGroup': store.renameGroup(payload.id, payload.name); break;
        case 'addPhrases': store.addPhrases(payload.texts, payload.groupId, payload.extra); break;
        case 'deletePhrases': store.deletePhrases(payload); break;
        case 'moveToTrash': store.moveToTrash(payload); break;
        case 'restoreFromTrash': store.restoreFromTrash(payload); break;
        case 'clearTrash': store.clearTrash(); break;
        case 'movePhrases': store.movePhrases(payload.ids, payload.targetGroupId); break;
        case 'copyPhrases': store.copyPhrases(payload.ids, payload.targetGroupId); break;
        case 'setActiveGroup': store.setActiveGroup(payload); break;
        case 'setMultigroupMode': store.setMultigroupMode(payload); break;
        case 'clearAll': store.clearAll(); break;
        case 'addTagToPhrase': store.addTagToPhrase(payload.id, payload.tag); break;
        case 'removeTagFromPhrase': store.removeTagFromPhrase(payload.id, payload.tag); break;
        case 'setLeftPanel':
          store.setLeftPanel(payload.open, payload.module ?? null);
          break;
        case 'setRightPanel':
          store.setRightPanel(payload.open);
          break;
        case 'batchOperation': store.batchOperation(payload); break;
        case 'toggleExpand': store.toggleExpand(payload); break;
        case 'updatePhrase': store.updatePhrase(payload.id, payload.updates); break;
        case 'updatePhraseNoUndo': store.updatePhraseNoUndo(payload.id, payload.updates); break;
        case 'pushUndo': store.pushUndo(); break;
        case 'setClusteringResults': store.setClusteringResults(payload); break;
        case 'applyClusteringResults': store.applyClusteringResults(); break;
        default:
          console.warn(`[StoreAccess] Unknown action: ${action}`);
      }
    },
    subscribe: (listener) => {
      return useAppStore.subscribe(listener);
    },
    getModuleSetting: (moduleId, key) => {
      const settingsState = useSettingsStore.getState();
      const value = settingsState.getModuleSetting(moduleId, key);
      if (value !== undefined) return value;
      try {
        const rt = _runtimeRef?.getRuntime?.() as { getModule?: (id: string) => { manifest: { settingsSchema?: SettingFieldSchema[] } } | undefined } | undefined;
        const mod = rt?.getModule?.(moduleId);
        const field = mod?.manifest.settingsSchema?.find((f) => f.key === key);
        if (field) return field.default;
      } catch { /* runtime may not be available during tests */ }
      return undefined;
    },
  };
}
