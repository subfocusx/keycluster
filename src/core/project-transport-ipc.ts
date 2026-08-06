// ============================================================
// KeyCluster Project System — IPC Transport (Tauri)
// ============================================================
//
// Implements ProjectTransport interface using Tauri IPC invoke()
// calls to the Rust backend. Replaces the old HTTP transport.
// ============================================================

import { invoke } from '@tauri-apps/api/core';
import type {
  ProjectTransport,
  ProjectRecord,
  ProjectListItem,
  SnapshotItem,
} from './project-types';
import { getEventBus } from './event-bus';
import { LogStore } from './logging/LogStore';

async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    LogStore._log('error', 'ipc', `IPC error [${cmd}]: ${msg}`, { command: cmd, args, error: err });
    try { getEventBus().emit('ipc:error', { command: cmd, error: err }); } catch { /* bus not ready */ }
    throw err;
  }
}

function safeJsonParse<T>(raw: string | undefined | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function parseProjectRecord(row: any): ProjectRecord {
  let dataObj: Record<string, any> = {};
  try {
    dataObj = typeof row.data === 'string' ? JSON.parse(row.data) : row.data || {};
  } catch { /* use empty */ }

  const groups: any[] = safeJsonParse(dataObj.groups, []);
  const phrases: any[] = safeJsonParse(dataObj.phrases, []);
  const minusWords: any[] = safeJsonParse(dataObj.minusWords, []);
  const settings: Record<string, any> = safeJsonParse(dataObj.settings, {});
  const uiState: Record<string, any> = safeJsonParse(dataObj.uiState, {});

  return {
    id: row.id,
    name: row.name,
    version: dataObj.version || row.version || '1.0',
    groups,
    phrases,
    minusWords,
    settings,
    uiState,
    isBackup: false,
    parentProjectId: null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function parseProjectListItem(row: any): ProjectListItem {
  return {
    id: row.id,
    name: row.name,
    version: row.version || '1.0',
    phraseCount: row.phrase_count || 0,
    groupCount: 0,
    isBackup: false,
    parentProjectId: null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export const ipcTransport: ProjectTransport = {
  async createProject(params): Promise<{ id: string }> {
    return safeInvoke('create_project', {
      input: {
        name: params.name,
        version: params.version,
        groups: params.groups,
        phrases: params.phrases,
        phrase_count: params.phraseCount,
        minus_words: params.minusWords,
        settings: params.settings,
        ui_state: params.uiState,
        is_backup: params.isBackup,
        parent_project_id: params.parentProjectId,
      },
    });
  },

  async updateProject(id: string, params): Promise<boolean> {
    return safeInvoke('update_project', {
      id,
      input: {
        name: params.name,
        version: params.version,
        groups: params.groups,
        phrases: params.phrases,
        phrase_count: params.phraseCount,
        minus_words: params.minusWords,
        settings: params.settings,
        ui_state: params.uiState,
      },
    });
  },

  async getProject(id: string): Promise<ProjectRecord | null> {
    const row = await safeInvoke<any | null>('get_project', { id });
    if (!row) return null;
    return parseProjectRecord(row);
  },

  async listProjects(_includeBackups?: boolean): Promise<ProjectListItem[]> {
    const rows = await safeInvoke<any[]>('list_projects');
    return rows.map(parseProjectListItem);
  },

  async deleteProject(id: string): Promise<boolean> {
    return safeInvoke('delete_project', { id });
  },

  async createBackup(parentProjectId: string): Promise<{ id: string } | null> {
    return safeInvoke('create_backup', { parentId: parentProjectId });
  },

  async getLatestBackup(parentProjectId: string): Promise<ProjectRecord | null> {
    const row = await safeInvoke<any | null>('get_backup', { parentId: parentProjectId });
    if (!row) return null;
    return {
      id: row.id,
      name: '',
      version: row.data?.version || '1.0',
      groups: row.data?.groups ? JSON.parse(row.data.groups) : [],
      phrases: row.data?.phrases ? JSON.parse(row.data.phrases) : [],
      minusWords: row.data?.minusWords ? JSON.parse(row.data.minusWords) : [],
      settings: row.data?.settings ? JSON.parse(row.data.settings) : {},
      uiState: row.data?.uiState ? JSON.parse(row.data.uiState) : {},
      isBackup: true,
      parentProjectId: row.parentProjectId,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.createdAt).toISOString(),
    };
  },

  async countBackups(parentProjectId: string): Promise<number> {
    const backups = await safeInvoke<any[]>('list_backup_files', { projectId: parentProjectId });
    return backups.length;
  },

  async pruneBackups(parentProjectId: string, keepCount: number): Promise<number> {
    return safeInvoke('prune_backup_files', { projectId: parentProjectId, keepCount });
  },

  async deleteBackups(parentProjectId: string): Promise<number> {
    return safeInvoke('prune_backup_files', { projectId: parentProjectId, keepCount: 0 });
  },

  async saveBackupFile(projectId: string, _projectName: string, data: string): Promise<string> {
    const meta = await safeInvoke<any>('save_backup_file', { projectId, stateJson: data });
    return meta.filename;
  },

  async listBackupFiles(projectId: string): Promise<string[]> {
    return safeInvoke('list_backup_files', { projectId });
  },

  async readBackupFile(_projectId: string, _filename: string): Promise<string | null> {
    // Backup files are stored as rows in the DB; use get_backup instead
    return null;
  },

  async pruneBackupFiles(projectId: string, keepCount: number): Promise<number> {
    return invoke('prune_backup_files', { projectId, keepCount });
  },

  async listSnapshots(projectId: string): Promise<SnapshotItem[]> {
    const rows = await safeInvoke<any[]>('list_snapshots', { parentId: projectId });
    return rows.map(r => ({
      id: r.id,
      parentId: r.parent_id,
      createdAt: r.created_at,
      label: r.label ?? '',
      auto: r.auto ?? false,
      phraseCount: r.phrase_count ?? 0,
      groupCount: r.group_count ?? 0,
    }));
  },

  async getSnapshotBackupData(backupId: string): Promise<string | null> {
    return safeInvoke<string | null>('get_snapshot', { id: backupId });
  },

  async deleteSnapshot(backupId: string): Promise<boolean> {
    return safeInvoke<boolean>('delete_snapshot', { id: backupId });
  },
};
