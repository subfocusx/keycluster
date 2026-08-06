// ╔══════════════════════════════════════════════════════════╗
// ║  @core — ЯДРО KEYCLUSTER                                 ║
// ║  Плагины НЕ ДОЛЖНЫ импортировать этот файл напрямую.    ║
// ╚══════════════════════════════════════════════════════════╝
import { useAppStore } from './store';
import { useSettingsStore } from './settings-store';
import { getEventBus } from './event-bus';
import { extractProjectState, restoreToPartialState } from './project-store-sync';
import type { ProjectState } from './project-types';
import { tauriLogger } from './tauri-logger';

let currentProjectId: string | null = null;
let currentProjectName: string | null = null;
let hasUnsavedChanges = false;
let stateVersion = 0;
let isLoadingProject = false;

export function getCurrentProjectId(): string | null { return currentProjectId; }
export function setCurrentProjectId(id: string | null): void { currentProjectId = id; }
export function getCurrentProjectName(): string | null { return currentProjectName; }
export function setCurrentProjectName(name: string | null): void { currentProjectName = name; }
export function getHasUnsavedChanges(): boolean { return hasUnsavedChanges; }
export function markUnsaved(): void { hasUnsavedChanges = true; }
export function resetUnsaved(): void { hasUnsavedChanges = false; }

export function getUnloadWarning(): string | null {
  if (hasUnsavedChanges) return 'У вас есть несохранённые изменения. Вы уверены, что хотите закрыть проект?';
  return null;
}

export function incrementStateVersion(): number { return ++stateVersion; }
export function getStateVersion(): number { return stateVersion; }
export function resetStateVersion(): void { stateVersion = 0; }

export function getIsLoadingProject(): boolean { return isLoadingProject; }
export function setIsLoadingProject(v: boolean): void { isLoadingProject = v; }

export function setUnsavedChanges(v: boolean): void { hasUnsavedChanges = v; }

export function restoreIntoStore(state: ProjectState): void {
  if (state.uiState?.theme) {
    const theme = state.uiState.theme;
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      const isDark = theme === 'dark' || theme === 'dark-pro';
      document.documentElement.classList.toggle('dark', isDark);
    }
    useAppStore.getState().setTheme(theme);
  }

  const partial = restoreToPartialState(state);
  useAppStore.setState({
    ...partial,
    undoStack: [],
    redoStack: [],
  });

  if (state.settings && Object.keys(state.settings).length > 0) {
    const settingsStore = useSettingsStore.getState();
    for (const [moduleId, moduleSettings] of Object.entries(state.settings)) {
      for (const [key, value] of Object.entries(moduleSettings as Record<string, unknown>)) {
        settingsStore.setModuleSetting(moduleId, key, value);
      }
    }
  }

  if (state.uiState) {
    if (state.uiState.rightPanel) {
      useAppStore.getState().setRightPanelWidth(state.uiState.rightPanel.width);
    }
    if (state.uiState.leftPanel) {
      useAppStore.getState().setLeftPanelWidth(state.uiState.leftPanel.width);
    }
  }
}

export function getCurrentProjectState(): ProjectState {
  const appState = useAppStore.getState();
  const settingsState = useSettingsStore.getState();
  return extractProjectState({
    groups: appState.groups,
    phrases: appState.phrases,
    minusWords: appState.minusWords,
    settings: settingsState.settings,
    ui: appState.ui,
  });
}

export function emitProjectSaved(projectId: string, name: string): void {
  try {
    getEventBus().emit('project:updated', { projectId, name, action: 'saved' });
  } catch { }
}

export function emitProjectLoaded(projectId: string, name: string): void {
  try {
    const bus = getEventBus();
    bus.emit('project:loaded', { projectId, name });
    bus.emit('project:updated', { projectId, name, action: 'loaded' });
  } catch { }
}

export function emitProjectDeleted(projectId: string): void {
  try {
    getEventBus().emit('project:updated', { projectId, action: 'deleted' });
  } catch { }
}

export function resetState(): void {
  currentProjectId = null;
  currentProjectName = null;
  hasUnsavedChanges = false;
  isLoadingProject = false;
  stateVersion = 0;
}

export function log(msg: string, ...args: any[]): void {
  tauriLogger.info(`[ProjectService] ${msg}`, ...args);
}
