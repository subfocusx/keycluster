// ╔══════════════════════════════════════════════════════════╗
// ║  @core — ЯДРО KEYCLUSTER                                 ║
// ║  Плагины НЕ ДОЛЖНЫ импортировать этот файл напрямую.    ║
// ╚══════════════════════════════════════════════════════════╝
import { ipcTransport } from './project-transport-ipc';
import type { ProjectTransport } from './project-types';
import {
  exportToKcproj,
  downloadKcprojFile,
  readKcprojFile,
  parseKcproj,
  sanitizeFilename,
} from './project-file';
import { useAppStore } from './store';
import { SaveQueue } from './save-queue';
import { BackupManager } from './backup-manager';
import { migrateProject } from './migration-manager';
import { LogStore } from './logging/LogStore';
import type {
  SaveResult, LoadResult, ListResult, DeleteResult, ExportResult, ImportResult, ProjectState,
} from './project-types';
import { PROJECT_FORMAT_VERSION } from './project-types';
import { createSnapshot } from './project-store-sync';
import {
  getCurrentProjectId, setCurrentProjectId, getCurrentProjectName, setCurrentProjectName,
  getHasUnsavedChanges, setUnsavedChanges, resetUnsaved,
  incrementStateVersion, getStateVersion, resetStateVersion,
  getIsLoadingProject, setIsLoadingProject,
  restoreIntoStore, getCurrentProjectState,
  emitProjectSaved, emitProjectLoaded, emitProjectDeleted,
  resetState, log,
} from './project-service-state';
import {
  type SaveStatus, enableAutoSave, disableAutoSave, isAutoSaveEnabled,
  getAutoSaveIntervalMs, setAutoSaveIntervalMs, setAutoSaveIntervalMinutes, getAutoSaveIntervalMinutes,
  getSaveStatus, getLastSaveTime, getLastSaveError,
  flushSaveQueue,
  setSaveQueueRef, resetAutoSave,
} from './project-service-auto-save';

export type { SaveStatus } from './project-service-auto-save';
export {
  enableAutoSave, disableAutoSave, isAutoSaveEnabled,
  getAutoSaveIntervalMs, setAutoSaveIntervalMs, setAutoSaveIntervalMinutes, getAutoSaveIntervalMinutes,
  getSaveStatus, getLastSaveTime, getLastSaveError,
  flushSaveQueue,
};

export {
  getCurrentProjectId, setCurrentProjectId, getCurrentProjectName, setCurrentProjectName,
  getHasUnsavedChanges, markUnsaved, resetUnsaved, getUnloadWarning,
  incrementStateVersion, getStateVersion, getIsLoadingProject,
} from './project-service-state';

const MAX_BACKUPS = 10;
const FLUSH_TIMEOUT_MS = 2000;
let currentLoadPromise: { id: string; promise: Promise<LoadResult> } | null = null;

let transport: ProjectTransport | null = null;
let saveQueue: SaveQueue | null = null;
let backupManager: BackupManager | null = null;

function getTransport(): ProjectTransport {
  if (!transport) transport = ipcTransport;
  return transport;
}

function getSaveQueue(): SaveQueue {
  if (!saveQueue) {
    saveQueue = new SaveQueue(getTransport(), getAutoSaveIntervalMs());
    saveQueue.setProjectRecoveredCallback((oldId, newId) => {
      if (getCurrentProjectId() === oldId) setCurrentProjectId(newId);
    });
    setSaveQueueRef(saveQueue);
  }
  return saveQueue;
}

function getBackupManager(): BackupManager {
  if (!backupManager) backupManager = new BackupManager(getTransport(), MAX_BACKUPS);
  return backupManager;
}

export function getBackupManagerInstance(): BackupManager {
  return getBackupManager();
}

export function setTransport(t: ProjectTransport): void {
  transport = t;
  saveQueue = new SaveQueue(t, getAutoSaveIntervalMs());
  saveQueue.setProjectRecoveredCallback((oldId, newId) => {
    if (getCurrentProjectId() === oldId) setCurrentProjectId(newId);
  });
  setSaveQueueRef(saveQueue);
  backupManager = new BackupManager(t, MAX_BACKUPS);
}

export async function saveProjectAs(name: string): Promise<SaveResult> {
  try {
    const state = getCurrentProjectState();
    const result = await getTransport().createProject({
      name, version: PROJECT_FORMAT_VERSION,
      groups: JSON.stringify(state.groups), phrases: JSON.stringify(state.phrases),
      phraseCount: state.phrases.length, minusWords: JSON.stringify(state.minusWords),
      settings: JSON.stringify(state.settings), uiState: JSON.stringify(state.uiState),
    });
    setCurrentProjectId(result.id);
    setCurrentProjectName(name);
    resetUnsaved();
    getSaveQueue().resetVersion();
    emitProjectSaved(result.id, name);
    log('saveProjectAs: %s (id=%s)', name, result.id);
    return { success: true, projectId: result.id };
  } catch (error: any) {
    log('saveProjectAs FAILED: %s', error.message);
    return { success: false, projectId: '', error: error.message };
  }
}

export async function saveCurrentProject(name?: string): Promise<SaveResult> {
  try {
    const state = getCurrentProjectState();
    const version = getStateVersion();
    const pid = getCurrentProjectId();

    if (pid) {
      const success = await getSaveQueue().enqueue(pid, state, version);
      if (success) {
        resetUnsaved();
        emitProjectSaved(pid, name ?? getCurrentProjectName() ?? 'Project');
      } else {
        LogStore._log('error', 'project-service', `saveCurrentProject: enqueue returned false for project ${pid}`, { projectId: pid, version, name });
      }
      return { success, projectId: pid };
    } else {
      return saveProjectAs(name ?? `Project ${new Date().toLocaleString()}`);
    }
  } catch (error: any) {
    LogStore._log('error', 'project-service', `saveCurrentProject FAILED: ${error.message}`, { error: error.stack ?? error.message });
    log('saveCurrentProject FAILED: %s', error.message);
    return { success: false, projectId: '', error: error.message };
  }
}

export async function loadProject(projectId: string): Promise<LoadResult> {
  if (currentLoadPromise) {
    if (currentLoadPromise.id === projectId) {
      log('loadProject: already loading project %s, returning existing promise', projectId);
      return currentLoadPromise.promise;
    }
    log('loadProject: loading different project, waiting for current load to finish');
    await currentLoadPromise.promise.catch(() => {});
  }
  const promise = executeLoadProject(projectId);
  currentLoadPromise = { id: projectId, promise };
  try { return await promise; }
  finally { currentLoadPromise = null; }
}

async function executeLoadProject(projectId: string): Promise<LoadResult> {
  try {
    setIsLoadingProject(true);
    const record = await getTransport().getProject(projectId);
    if (!record) {
      setIsLoadingProject(false);
      return { success: false, error: 'Project not found' };
    }

    const migrationResult = migrateProject(record.version, {
      groups: record.groups, phrases: record.phrases, minusWords: record.minusWords,
      settings: record.settings, uiState: record.uiState,
    });
    if (!migrationResult.success) {
      setIsLoadingProject(false);
      return { success: false, error: migrationResult.error };
    }
    const migratedState = migrationResult.state!;

    if (getCurrentProjectId() && getHasUnsavedChanges()) {
      try {
        await getBackupManager().createBackup({
          projectId: getCurrentProjectId()!,
          projectName: getCurrentProjectName() ?? 'Unknown',
          state: getCurrentProjectState(),
          label: 'Before load',
          auto: true,
        });
      } catch (err) { log('backup before load failed (continuing): %s', (err as Error).message); }
    }

    const appState = useAppStore.getState();
    const snapshot = createSnapshot({
      groups: appState.groups, phrases: appState.phrases, minusWords: appState.minusWords,
      activeGroupId: appState.activeGroupId, selectedGroupIds: appState.selectedGroupIds,
      selectedPhraseIds: appState.selectedPhraseIds,
    });

    try {
      restoreIntoStore(migratedState);
    } catch (restoreErr) {
      log('restore FAILED, rolling back: %s', (restoreErr as Error).message);
      useAppStore.setState({
        groups: snapshot.groups, phrases: snapshot.phrases, minusWords: snapshot.minusWords,
        activeGroupId: snapshot.activeGroupId,
        selectedGroupIds: new Set(snapshot.selectedGroupIds),
        selectedPhraseIds: new Set(snapshot.selectedPhraseIds),
      });
      setIsLoadingProject(false);
      return { success: false, error: `Restore failed: ${(restoreErr as Error).message}` };
    }

    setCurrentProjectId(record.id);
    setCurrentProjectName(record.name);
    resetUnsaved();
    resetStateVersion();
    getSaveQueue().resetVersion();

    if (migrationResult.fromVersion !== migrationResult.toVersion) {
      try {
        await getTransport().updateProject(record.id, {
          version: PROJECT_FORMAT_VERSION,
          groups: JSON.stringify(migratedState.groups), phrases: JSON.stringify(migratedState.phrases),
          minusWords: JSON.stringify(migratedState.minusWords),
          settings: JSON.stringify(migratedState.settings), uiState: JSON.stringify(migratedState.uiState),
        });
        log('saved migrated version back to DB: v%s → v%s', migrationResult.fromVersion, migrationResult.toVersion);
      } catch (err) { log('failed to save migrated version: %s', (err as Error).message); }
    }

    setIsLoadingProject(false);
    emitProjectLoaded(record.id, record.name);
    log('loadProject: %s (id=%s)', record.name, record.id);
    return { success: true, project: { ...record, version: PROJECT_FORMAT_VERSION } };
  } catch (error: any) {
    setIsLoadingProject(false);
    log('loadProject FAILED: %s', error.message);
    return { success: false, error: error.message };
  }
}

export async function listProjects(): Promise<ListResult> {
  try {
    const projects = await getTransport().listProjects(false);
    return { success: true, projects };
  } catch (error: any) {
    log('listProjects FAILED: %s', error.message);
    return { success: true, projects: [], error: error.message };
  }
}

export async function deleteProject(projectId: string): Promise<DeleteResult> {
  try {
    const state = getCurrentProjectState();
    if (state.groups.length > 0 || state.phrases.length > 0) {
      try {
        await getBackupManager().createBackup({
          projectId,
          projectName: getCurrentProjectName() ?? 'Unknown',
          state,
          label: `Before delete: ${getCurrentProjectName() ?? projectId}`,
          auto: true,
        });
      } catch { /* backup best-effort */ }
    }
    await getTransport().deleteProject(projectId);
    try { await getTransport().deleteBackups(projectId); } catch { }
    if (getCurrentProjectId() === projectId) {
      setCurrentProjectId(null);
      setCurrentProjectName(null);
    }
    emitProjectDeleted(projectId);
    log('deleteProject: %s', projectId);
    return { success: true };
  } catch (error: any) {
    log('deleteProject FAILED: %s', error.message);
    return { success: false, error: error.message };
  }
}

export async function exportProjectWithDialog(name?: string): Promise<ExportResult> {
  try {
    const projectName = name ?? getCurrentProjectName() ?? 'export';
    let filePath: string | null = null;
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { invoke } = await import('@tauri-apps/api/core');
      filePath = await save({
        defaultPath: sanitizeFilename(projectName) + '.kcproj',
        filters: [{ name: 'KeyCluster Project', extensions: ['kcproj'] }],
      });
    } catch {
      // Not in Tauri environment — fallback to browser download
      exportProject(name);
      return { success: true };
    }
    if (!filePath) return { success: false, error: 'Отменено пользователем' };

    const state = getCurrentProjectState();
    const json = exportToKcproj(projectName, state);
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('export_project_to_file', { path: filePath, content: json });
    LogStore._log('info', 'project-service', `Project exported to ${filePath}`, { path: filePath, name: projectName });
    return { success: true, data: json };
  } catch (error: any) {
    LogStore._log('error', 'project-service', `exportProjectWithDialog FAILED: ${error.message}`, { error: error.stack ?? error.message });
    return { success: false, error: error.message };
  }
}

export function exportProject(name?: string): ExportResult {
  try {
    const state = getCurrentProjectState();
    const projectName = name ?? getCurrentProjectName() ?? `Export ${new Date().toLocaleDateString()}`;
    downloadKcprojFile(projectName, state);
    return { success: true, data: exportToKcproj(projectName, state) };
  } catch (error: any) {
    log('exportProject FAILED: %s', error.message);
    return { success: false, error: error.message };
  }
}

export async function importProject(file: File): Promise<ImportResult> {
  try {
    const projectFile = await readKcprojFile(file);
    const currentPid = getCurrentProjectId();
    if (currentPid) {
      try {
        await getBackupManager().createBackup({
          projectId: currentPid,
          projectName: getCurrentProjectName() ?? 'Unknown',
          state: getCurrentProjectState(),
          label: `Before import: ${file.name}`,
          auto: true,
        });
      } catch { /* backup best-effort */ }
    }
    return await importProjectData(projectFile);
  } catch (error: any) {
    log('importProject FAILED: %s', error.message);
    return { success: false, error: error.message };
  }
}

export async function importProjectFromString(jsonString: string, projectName?: string): Promise<ImportResult> {
  try {
    const projectFile = parseKcproj(jsonString);
    if (projectName) projectFile.name = projectName;
    const currentPid = getCurrentProjectId();
    if (currentPid) {
      try {
        await getBackupManager().createBackup({
          projectId: currentPid,
          projectName: getCurrentProjectName() ?? 'Unknown',
          state: getCurrentProjectState(),
          label: `Before import: ${projectFile.name}`,
          auto: true,
        });
      } catch { /* backup best-effort */ }
    }
    return await importProjectData(projectFile);
  } catch (error: any) {
    log('importProjectFromString FAILED: %s', error.message);
    return { success: false, error: error.message };
  }
}

async function importProjectData(projectFile: import('./project-types').ProjectFile): Promise<ImportResult> {
  const migrationResult = migrateProject(projectFile.version, projectFile.state);
  if (!migrationResult.success) return { success: false, error: migrationResult.error };

  const state = migrationResult.state!;
  const result = await getTransport().createProject({
    name: projectFile.name, version: PROJECT_FORMAT_VERSION,
    groups: JSON.stringify(state.groups), phrases: JSON.stringify(state.phrases),
    phraseCount: state.phrases.length, minusWords: JSON.stringify(state.minusWords),
    settings: JSON.stringify(state.settings), uiState: JSON.stringify(state.uiState),
  });

  setCurrentProjectId(result.id);
  setCurrentProjectName(projectFile.name);
  resetUnsaved();
  resetStateVersion();

  restoreIntoStore(state);
  emitProjectLoaded(result.id, projectFile.name);

  log('importProject: %s (id=%s)', projectFile.name, result.id);
  return { success: true, projectId: result.id };
}

/** Clear all data with auto-snapshot before. */
export async function clearCurrentProject(): Promise<void> {
  const pid = getCurrentProjectId();
  if (pid) {
    try {
      await getBackupManager().createBackup({
        projectId: pid,
        projectName: getCurrentProjectName() ?? 'Unknown',
        state: getCurrentProjectState(),
        label: 'Before clear all',
        auto: true,
      });
    } catch { /* backup best-effort */ }
  }
  useAppStore.getState().clearAll();
  if (pid) {
    await saveCurrentProject();
  }
}

/** Restore project state from a snapshot backup. */
export async function restoreSnapshot(backupId: string): Promise<boolean> {
  try {
    const state = await getBackupManager().restoreFromSnapshot(backupId);
    if (!state) return false;
    restoreIntoStore(state);
    await saveCurrentProject();
    log('restoreSnapshot: %s OK', backupId);
    return true;
  } catch (error: any) {
    log('restoreSnapshot FAILED: %s', error.message);
    return false;
  }
}

export async function destroy(): Promise<void> {
  disableAutoSave();
  if (saveQueue) {
    await flushSaveQueue(FLUSH_TIMEOUT_MS);
    saveQueue.destroy();
    saveQueue = null;
  }
  transport = null;
  backupManager = null;
  currentLoadPromise = null;
  resetState();
  resetAutoSave();
  log('service destroyed');
}

export async function recoverFromCrash(): Promise<LoadResult> {
  try {
    const projects = await getTransport().listProjects(true);
    if (projects.length === 0) return { success: false, error: 'No projects or backups found' };
    const latest = projects.find((p: any) => !p.isBackup) ?? projects[0];
    return loadProject(latest.id);
  } catch (error: any) {
    log('crash recovery FAILED: %s', error.message);
    return { success: false, error: error.message };
  }
}

export async function hasCrashRecovery(): Promise<boolean> {
  try {
    const projects = await getTransport().listProjects(true);
    return projects.length > 0;
  } catch { return false; }
}
