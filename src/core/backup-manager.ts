// ============================================================
// KeyCluster Project System — Backup Manager (Production)
// ============================================================
//
// Manages file-based backups for projects with checksum validation.
// Before loading a new project, a backup of the current state
// is saved to the filesystem via the transport layer.
//
// Storage path (server-side): /userData/backups/{projectId}/
// Backup format: .kcproj JSON files with embedded checksum
// Keeps last N backups (configurable), prunes older ones.
// ============================================================

import type { ProjectTransport, ProjectState, SnapshotItem } from './project-types';
import { PROJECT_FORMAT_VERSION } from './project-types';

// ---- Configuration ----

const DEFAULT_KEEP_COUNT = 10;
const AUTO_SNAPSHOT_LIMIT = 50;

// ---- Checksum ----

/** Simple checksum using SubtleCrypto (available in browsers and Node 18+) */
async function computeChecksum(data: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const buffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback: simple hash for environments without SubtleCrypto
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const chr = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}

// ---- Backup Manager Class ----

export class BackupManager {
  private transport: ProjectTransport;
  private keepCount: number;

  constructor(transport: ProjectTransport, keepCount = DEFAULT_KEEP_COUNT) {
    this.transport = transport;
    this.keepCount = keepCount;
  }

  /**
   * Create a backup with checksum.
   * Returns the backup DB id on success, or null on failure.
   */
  async createBackup(params: {
    projectId: string;
    projectName: string;
    state: ProjectState;
    label?: string;
    auto?: boolean;
  }): Promise<string | null> {
    try {
      const backupPayload = this.serializeBackup(params.projectName, params.state, params.label);
      const checksum = await computeChecksum(backupPayload);

      const backupData = JSON.stringify({
        checksum,
        label: params.label ?? '',
        auto: params.auto ?? false,
        phraseCount: params.state.phrases.length,
        groupCount: params.state.groups.length,
        data: backupPayload,
      });

      const filename = await this.transport.saveBackupFile(
        params.projectId,
        params.projectName,
        backupData
      );

      if (params.auto) {
        await this.pruneAutoSnapshots(params.projectId);
      }

      log('backup created: %s (checksum=%s, auto=%s)', filename, checksum.substring(0, 8), params.auto);
      return filename;
    } catch (err) {
      log('backup FAILED: %s', (err as Error).message);
      return null;
    }
  }

  /**
   * Read a specific backup file, validate checksum, and return the parsed state.
   * Returns null if the file is not found or checksum validation fails.
   */
  async readBackup(projectId: string, filename: string): Promise<ProjectState | null> {
    try {
      const content = await this.transport.readBackupFile(projectId, filename);
      if (!content) return null;

      return await this.parseBackupData(content);
    } catch (err) {
      log('backup read FAILED for %s: %s', filename, (err as Error).message);
      return null;
    }
  }

  /**
   * Read a snapshot by its DB backup id.
   */
  async readSnapshotById(backupId: string): Promise<ProjectState | null> {
    try {
      const content = await this.transport.getSnapshotBackupData(backupId);
      if (!content) return null;
      return await this.parseBackupData(content);
    } catch (err) {
      log('snapshot read FAILED: %s', (err as Error).message);
      return null;
    }
  }

  /**
   * List snapshot metadata for a project.
   */
  async listSnapshots(projectId: string): Promise<SnapshotItem[]> {
    try {
      return await this.transport.listSnapshots(projectId);
    } catch {
      return [];
    }
  }

  /**
   * Restore project state from a snapshot backup.
   * Returns the ProjectState on success, or null on failure.
   */
  async restoreFromSnapshot(backupId: string): Promise<ProjectState | null> {
    return this.readSnapshotById(backupId);
  }

  /**
   * Prune only auto snapshots — keeps the most recent `limit`.
   */
  async pruneAutoSnapshots(projectId: string): Promise<number> {
    try {
      const snapshots = await this.listSnapshots(projectId);
      const autoSnapshots = snapshots.filter(s => s.auto);
      if (autoSnapshots.length <= AUTO_SNAPSHOT_LIMIT) return 0;

      const sorted = [...autoSnapshots].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      const toDelete = sorted.slice(AUTO_SNAPSHOT_LIMIT);
      for (const s of toDelete) {
        await this.transport.deleteSnapshot(s.id);
      }
      log('pruned %d auto snapshots (limit=%d)', toDelete.length, AUTO_SNAPSHOT_LIMIT);
      return toDelete.length;
    } catch (err) {
      log('pruneAutoSnapshots FAILED: %s', (err as Error).message);
      return 0;
    }
  }

  /**
   * List all backup files for a project (legacy).
   */
  async listBackups(projectId: string): Promise<string[]> {
    try {
      return await this.transport.listBackupFiles(projectId);
    } catch {
      return [];
    }
  }

  /**
   * Read the most recent backup for a project.
   */
  async readLatestBackup(projectId: string): Promise<ProjectState | null> {
    const files = await this.listBackups(projectId);
    if (files.length === 0) return null;

    for (let i = files.length - 1; i >= 0; i--) {
      const state = await this.readBackup(projectId, files[i]);
      if (state) return state;
    }

    return null;
  }

  /**
   * Prune old backup files beyond the keep count (legacy).
   */
  async pruneOldBackups(projectId: string): Promise<number> {
    return this.transport.pruneBackupFiles(projectId, this.keepCount);
  }

  /**
   * Set the number of backups to keep.
   */
  setKeepCount(count: number): void {
    this.keepCount = count;
  }

  /**
   * Update the transport (for IPC swap).
   */
  setTransport(transport: ProjectTransport): void {
    this.transport = transport;
  }

  // ---- Helpers ----

  private async parseBackupData(content: string): Promise<ProjectState | null> {
    try {
      const envelope = JSON.parse(content);

      if (envelope.checksum && envelope.data) {
        const expectedChecksum = envelope.checksum;
        const actualChecksum = await computeChecksum(envelope.data);

        if (expectedChecksum !== actualChecksum) {
          log('checksum MISMATCH');
          return null;
        }

        const parsed = JSON.parse(envelope.data);
        if (parsed && parsed.state) {
          return parsed.state as ProjectState;
        }
      }

      if (envelope.state) {
        return envelope.state as ProjectState;
      }

      return null;
    } catch {
      return null;
    }
  }

  private serializeBackup(projectName: string, state: ProjectState, label?: string): string {
    const now = new Date().toISOString();
    return JSON.stringify({
      version: PROJECT_FORMAT_VERSION,
      createdAt: now,
      updatedAt: now,
      name: label ? `${projectName} (${label})` : `${projectName} (backup)`,
      label: label ?? '',
      state,
    });
  }
}

// ---- Minimal Logging ----

function log(msg: string, ...args: any[]): void {
  if (typeof console !== 'undefined') {
    console.log(`[Backup] ${msg}`, ...args);
  }
}
