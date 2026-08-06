import type { Group, Phrase, MinusWord, MinusWordGroup, KCID } from './domain';

export interface StoreAccess {
  getState(): AppState;
  getStateSlice<K extends keyof AppState>(key: K): AppState[K];
  dispatch(action: string, payload?: any): void;
  subscribe(listener: () => void): () => void;
  getModuleSetting(moduleId: string, key: string): unknown;
}

export interface AppState {
  groups: Group[];
  phrases: Phrase[];
  minusWords: MinusWord[];
  minusWordGroups: MinusWordGroup[];
  selectedGroupIds: Set<KCID>;
  selectedPhraseIds: Set<KCID>;
  activeGroupId: KCID | null;
  ui: UIState;
}

export interface UIState {
  leftPanel: {
    open: boolean;
    width: number;
    module: string | null;
  };
  rightPanel: {
    open: boolean;
    width: number;
  };
  ribbon: {
    activeTab: string;
  };
  theme: 'light' | 'dark' | 'dark-pro';
  modulesLoading: boolean;
  failedModules: string[];
  dbPersistenceEnabled: boolean;
  columnAutoResizeTrigger: number;
  columnVisibility: Record<string, boolean>;
  columnLabels: Record<string, string>;
  columnColors: Record<string, string>;
  multigroupMode: boolean;
}

export interface DevtoolsState {
  devtoolsOpen: boolean;
  devtoolsTab: 'modules' | 'logs' | 'errors' | 'events' | 'inspector' | 'network' | 'snapshots' | 'api';
}
