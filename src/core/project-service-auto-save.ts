// ╔══════════════════════════════════════════════════════════╗
// ║  @core — ЯДРО KEYCLUSTER                                 ║
// ║  Плагины НЕ ДОЛЖНЫ импортировать этот файл напрямую.    ║
// ╚══════════════════════════════════════════════════════════╝
import type { SaveQueue as SQ } from './save-queue';
import { useAppStore } from './store';
import { useSettingsStore } from './settings-store';
import { extractProjectState } from './project-store-sync';
import { pluginRegistry } from './plugin-registry';
import { storageGet, storageSet, STORAGE_KEYS } from './storage/local-storage';
import {
  getCurrentProjectId,
  getIsLoadingProject,
  incrementStateVersion,
  setUnsavedChanges,
  log,
} from './project-service-state';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const DEFAULT_AUTO_SAVE_INTERVAL_MS = 3 * 60 * 1000;

let autoSaveEnabled = false;
let autoSaveUnsubscribe: (() => void) | null = null;
let autoSaveIntervalMs = storageGet<number>(STORAGE_KEYS.AUTO_SAVE_INTERVAL) ?? DEFAULT_AUTO_SAVE_INTERVAL_MS;
let saveQueueRef: SQ | null = null;

export function setSaveQueueRef(ref: typeof saveQueueRef): void {
  saveQueueRef = ref;
}

let beforeunloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;

export function enableAutoSave(): void {
  if (autoSaveEnabled) return;
  autoSaveEnabled = true;

  autoSaveUnsubscribe = useAppStore.subscribe((state, prevState) => {
    if (getIsLoadingProject()) return;

    if (
      state.groups !== prevState.groups ||
      state.phrases !== prevState.phrases ||
      state.minusWords !== prevState.minusWords
    ) {
      setUnsavedChanges(true);

      const pid = getCurrentProjectId();
      if (pid && saveQueueRef) {
        const settingsState = useSettingsStore.getState();
        const projectState = extractProjectState({
          groups: state.groups,
          phrases: state.phrases,
          minusWords: state.minusWords,
          settings: settingsState.settings,
          ui: state.ui,
        });
        saveQueueRef.enqueue(pid, projectState, incrementStateVersion()).catch(err => {
          log('auto-save enqueue failed: %s', err.message);
        });
      }
    }
  });

  registerCrashHandlers();
  log('auto-save enabled (interval=%dms)', autoSaveIntervalMs);
}

export function disableAutoSave(): void {
  autoSaveEnabled = false;
  if (autoSaveUnsubscribe) {
    autoSaveUnsubscribe();
    autoSaveUnsubscribe = null;
  }
  unregisterCrashHandlers();
  log('auto-save disabled');
}

export function isAutoSaveEnabled(): boolean { return autoSaveEnabled; }
export function getAutoSaveIntervalMs(): number { return autoSaveIntervalMs; }

export function setAutoSaveIntervalMs(ms: number): void {
  autoSaveIntervalMs = Math.max(60000, Math.min(3600000, ms));
  storageSet(STORAGE_KEYS.AUTO_SAVE_INTERVAL, autoSaveIntervalMs);
  if (saveQueueRef) saveQueueRef.setDebounceMs(autoSaveIntervalMs);
  log('auto-save interval set to %dms (%d min)', autoSaveIntervalMs, Math.round(autoSaveIntervalMs / 60000));
}

export function setAutoSaveIntervalMinutes(minutes: number): void {
  setAutoSaveIntervalMs(minutes * 60 * 1000);
}

export function getAutoSaveIntervalMinutes(): number {
  return Math.round(autoSaveIntervalMs / 60000);
}

export function getSaveStatus(): SaveStatus {
  if (!saveQueueRef) return 'idle';
  const qs = saveQueueRef.status;
  if (qs === 'saving' || qs === 'flushing') return 'saving';
  if (saveQueueRef.error) return 'error';
  if (saveQueueRef.lastSave > 0 && getCurrentProjectId()) return 'saved';
  return 'idle';
}

export function getLastSaveTime(): number {
  return saveQueueRef?.lastSave ?? 0;
}

export function getLastSaveError(): string | null {
  return saveQueueRef?.error ?? null;
}

export async function flushSaveQueue(timeoutMs = 2000): Promise<void> {
  log('flushing save queue...');
  if (saveQueueRef) await saveQueueRef.flush(timeoutMs);
  log('save queue flushed');
}

function registerCrashHandlers(): void {
  if (typeof window === 'undefined') return;
  if (beforeunloadHandler) return;

  beforeunloadHandler = (e: BeforeUnloadEvent) => {
    pluginRegistry.flush();
    if (getCurrentProjectId() && autoSaveEnabled) {
      flushSaveQueue(2000).catch(() => {});
      e.preventDefault();
      e.returnValue = '';
    }
  };

  window.addEventListener('beforeunload', beforeunloadHandler);
}

function unregisterCrashHandlers(): void {
  if (typeof window === 'undefined') return;
  if (beforeunloadHandler) {
    window.removeEventListener('beforeunload', beforeunloadHandler);
    beforeunloadHandler = null;
  }
}

export function resetAutoSave(): void {
  autoSaveEnabled = false;
  autoSaveUnsubscribe = null;
  autoSaveIntervalMs = DEFAULT_AUTO_SAVE_INTERVAL_MS;
  saveQueueRef = null;
  beforeunloadHandler = null;
}
