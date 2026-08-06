// ============================================================
// KeyCluster Project System — Types & Interfaces
// ============================================================
//
// Defines the project data format (.kcproj), API contracts,
// transport interface, migration types, and all result types
// for the multi-project management system.
// ============================================================

import type { Group, Phrase, MinusWord, UIState } from './types';
import type { ModuleSettingsMap } from './settings-store';

// ---- Project File Format (.kcproj) ----

export const PROJECT_FORMAT_VERSION = '1.0';

export interface SnapshotItem {
  id: string;
  parentId: string;
  createdAt: number;
  label: string;
  auto: boolean;
  phraseCount: number;
  groupCount: number;
}

export interface ProjectState {
  groups: Group[];
  phrases: Phrase[];
  minusWords: MinusWord[];
  settings: ModuleSettingsMap;
  uiState: Partial<UIState>;
}

export interface ProjectFile {
  /** Format version for forward compatibility */
  version: string;
  /** ISO timestamp of project creation */
  createdAt: string;
  /** ISO timestamp of last save */
  updatedAt: string;
  /** Human-readable project name */
  name: string;
  /** Full project state snapshot */
  state: ProjectState;
}

// ---- DB Project Record ----

export interface ProjectRecord {
  id: string;
  name: string;
  version: string;
  groups: Group[];
  phrases: Phrase[];
  minusWords: MinusWord[];
  settings: ModuleSettingsMap;
  uiState: Partial<UIState>;
  isBackup: boolean;
  parentProjectId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---- Project List Item (lightweight, for UI) ----

export interface ProjectListItem {
  id: string;
  name: string;
  version: string;
  phraseCount: number;
  groupCount: number;
  isBackup: boolean;
  parentProjectId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---- Service Result Types ----

export interface SaveResult {
  success: boolean;
  projectId: string;
  error?: string;
}

export interface LoadResult {
  success: boolean;
  project?: ProjectRecord;
  error?: string;
}

export interface ListResult {
  success: boolean;
  projects: ProjectListItem[];
  error?: string;
}

export interface DeleteResult {
  success: boolean;
  error?: string;
}

export interface ExportResult {
  success: boolean;
  data?: string; // JSON string of ProjectFile
  error?: string;
}

export interface ImportResult {
  success: boolean;
  projectId?: string;
  error?: string;
}

// ---- Transport Interface ----
// Abstract transport for DB operations.
// HTTP implementation for web, IPC for Electron (future).

export interface ProjectTransport {
  /** Create a new project in the database */
  createProject(params: {
    name: string;
    version?: string;
    groups: string;
    phrases: string;
    phraseCount: number;
    minusWords: string;
    settings?: string;
    uiState?: string;
    isBackup?: boolean;
    parentProjectId?: string | null;
  }): Promise<{ id: string }>;

  /** Update an existing project */
  updateProject(
    id: string,
    params: {
      name?: string;
      version?: string;
      groups?: string;
      phrases?: string;
      phraseCount?: number;
      minusWords?: string;
      settings?: string;
      uiState?: string;
    }
  ): Promise<boolean>;

  /** Get a full project record by ID */
  getProject(id: string): Promise<ProjectRecord | null>;

  /** List all projects */
  listProjects(includeBackups?: boolean): Promise<ProjectListItem[]>;

  /** Delete a project by ID */
  deleteProject(id: string): Promise<boolean>;

  /** Create a backup of a project */
  createBackup(parentProjectId: string): Promise<{ id: string } | null>;

  /** Get the most recent backup for a project */
  getLatestBackup(parentProjectId: string): Promise<ProjectRecord | null>;

  /** Count backups for a project */
  countBackups(parentProjectId: string): Promise<number>;

  /** Prune old backups, keeping only the N most recent */
  pruneBackups(parentProjectId: string, keepCount: number): Promise<number>;

  /** Delete all backups for a given parent project */
  deleteBackups(parentProjectId: string): Promise<number>;

  /** Save a backup file (for file-based backup system) */
  saveBackupFile(projectId: string, projectName: string, data: string): Promise<string>;

  /** List backup files for a project */
  listBackupFiles(projectId: string): Promise<string[]>;

  /** Read a backup file */
  readBackupFile(projectId: string, filename: string): Promise<string | null>;

  /** Delete old backup files beyond the keep count */
  pruneBackupFiles(projectId: string, keepCount: number): Promise<number>;

  /** List snapshot metadata for a project */
  listSnapshots(projectId: string): Promise<SnapshotItem[]>;

  /** Get full backup data by backup DB id */
  getSnapshotBackupData(backupId: string): Promise<string | null>;

  /** Delete a single snapshot by its id */
  deleteSnapshot(backupId: string): Promise<boolean>;
}

// ---- Migration Types ----

export type MigrationFunction = (data: ProjectState) => ProjectState;

export interface MigrationEntry {
  version: string;
  migrate: MigrationFunction;
}

// ---- Save Queue Types ----

export interface SaveQueueItem {
  id: number;
  projectId: string;
  state: ProjectState;
  timestamp: number;
}

export type SaveQueueStatus = 'idle' | 'saving' | 'flushing';
