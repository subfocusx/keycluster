// ============================================================
// Tests: Backup Manager
// ============================================================
// Comprehensive tests for the BackupManager class:
//   - createBackup: valid state, transport failure
//   - readBackup: valid new-format, corrupted checksum,
//     legacy format, transport returns null
//   - listBackups: success and failure
//   - readLatestBackup: multiple files, no files
//   - setKeepCount / setTransport
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackupManager } from '@/core/backup-manager';
import type { ProjectState } from '@/core/project-types';

// ---- Mock Transport Factory ----

function createMockTransport() {
  return {
    createProject: vi.fn(),
    updateProject: vi.fn(),
    getProject: vi.fn(),
    listProjects: vi.fn(),
    deleteProject: vi.fn(),
    createBackup: vi.fn(),
    getLatestBackup: vi.fn(),
    countBackups: vi.fn(),
    pruneBackups: vi.fn(),
    deleteBackups: vi.fn(),
    saveBackupFile: vi.fn(),
    listBackupFiles: vi.fn(),
    readBackupFile: vi.fn(),
    pruneBackupFiles: vi.fn(),
    listSnapshots: vi.fn(),
    getSnapshotBackupData: vi.fn(),
    deleteSnapshot: vi.fn(),
  };
}

// ---- Sample State ----

const sampleState: ProjectState = {
  groups: [
    { id: 'g1', name: 'Test', parentId: null, isExpanded: true, isTrash: false, color: '', createdAt: Date.now() },
  ],
  phrases: [],
  minusWords: [],
  settings: {},
  uiState: {},
};

// ============================================================
// createBackup
// ============================================================

describe('BackupManager — createBackup', () => {
  let mockTransport: ReturnType<typeof createMockTransport>;
  let manager: BackupManager;

  beforeEach(() => {
    mockTransport = createMockTransport();
    manager = new BackupManager(mockTransport, 10);
  });

  it('returns filename and calls saveBackupFile with checksum envelope', async () => {
    mockTransport.saveBackupFile.mockResolvedValue('backup_2026.kcproj');
    mockTransport.pruneBackupFiles.mockResolvedValue(0);

    const filename = await manager.createBackup({ projectId: 'proj1', projectName: 'Test Project', state: sampleState });

    expect(filename).toBe('backup_2026.kcproj');
    expect(mockTransport.saveBackupFile).toHaveBeenCalledTimes(1);

    // Verify the saved data has a checksum envelope
    const savedData = mockTransport.saveBackupFile.mock.calls[0][2] as string;
    const envelope = JSON.parse(savedData);
    expect(envelope.checksum).toBeTruthy();
    expect(typeof envelope.checksum).toBe('string');
    expect(envelope.data).toBeTruthy();
    expect(typeof envelope.data).toBe('string');

    // The inner data should contain the state
    const innerParsed = JSON.parse(envelope.data);
    expect(innerParsed.state).toBeDefined();
    expect(innerParsed.state.groups).toHaveLength(1);
    expect(innerParsed.state.groups[0].name).toBe('Test');
  });

  it('prunes auto snapshots after creating an auto backup', async () => {
    mockTransport.saveBackupFile.mockResolvedValue('backup_2026.kcproj');
    mockTransport.listSnapshots.mockResolvedValue([]);

    await manager.createBackup({ projectId: 'proj1', projectName: 'Test Project', state: sampleState, auto: true });

    expect(mockTransport.listSnapshots).toHaveBeenCalledWith('proj1');
    expect(mockTransport.deleteSnapshot).not.toHaveBeenCalled();
  });

  it('returns null when transport.saveBackupFile throws', async () => {
    mockTransport.saveBackupFile.mockRejectedValue(new Error('Disk full'));

    const filename = await manager.createBackup({ projectId: 'proj1', projectName: 'Test Project', state: sampleState });

    expect(filename).toBeNull();
  });

  it('returns null when transport.saveBackupFile returns a falsy value', async () => {
    mockTransport.saveBackupFile.mockResolvedValue(null as any);

    const filename = await manager.createBackup({ projectId: 'proj1', projectName: 'Test Project', state: sampleState });

    expect(filename).toBeNull();
  });
});

// ============================================================
// readBackup
// ============================================================

describe('BackupManager — readBackup', () => {
  let mockTransport: ReturnType<typeof createMockTransport>;
  let manager: BackupManager;

  beforeEach(() => {
    mockTransport = createMockTransport();
    manager = new BackupManager(mockTransport, 10);
  });

  it('returns state for valid new-format backup with checksum', async () => {
    // Create a valid backup first
    mockTransport.saveBackupFile.mockImplementation(
      async (_projectId, _projectName, data) => {
        return 'valid_backup.kcproj';
      }
    );
    mockTransport.pruneBackupFiles.mockResolvedValue(0);

    // Capture the saved data
    let savedContent = '';
    mockTransport.saveBackupFile.mockImplementation(
      async (_projectId, _projectName, data) => {
        savedContent = data;
        return 'valid_backup.kcproj';
      }
    );

    await manager.createBackup({ projectId: 'proj1', projectName: 'Test', state: sampleState });

    // Now read it back
    mockTransport.readBackupFile.mockResolvedValue(savedContent);

    const state = await manager.readBackup('proj1', 'valid_backup.kcproj');

    expect(state).not.toBeNull();
    expect(state!.groups).toHaveLength(1);
    expect(state!.groups[0].name).toBe('Test');
  });

  it('returns null for corrupted checksum', async () => {
    // Create a valid backup, then corrupt the data field
    let savedContent = '';
    mockTransport.saveBackupFile.mockImplementation(
      async (_projectId, _projectName, data) => {
        savedContent = data;
        return 'corrupted.kcproj';
      }
    );
    mockTransport.pruneBackupFiles.mockResolvedValue(0);

    await manager.createBackup({ projectId: 'proj1', projectName: 'Test', state: sampleState });

    // Corrupt the data field in the envelope
    const envelope = JSON.parse(savedContent);
    envelope.data = envelope.data.replace('Test', 'CORRUPTED');
    mockTransport.readBackupFile.mockResolvedValue(JSON.stringify(envelope));

    const state = await manager.readBackup('proj1', 'corrupted.kcproj');

    expect(state).toBeNull();
  });

  it('returns state for legacy format (no checksum, has state directly)', async () => {
    // Legacy format: JSON with a `state` field directly (no checksum envelope)
    const legacyData = JSON.stringify({
      version: '1.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      name: 'Legacy Project',
      state: sampleState,
    });

    mockTransport.readBackupFile.mockResolvedValue(legacyData);

    const state = await manager.readBackup('proj1', 'legacy.kcproj');

    expect(state).not.toBeNull();
    expect(state!.groups).toHaveLength(1);
    expect(state!.groups[0].name).toBe('Test');
  });

  it('returns null when transport returns null', async () => {
    mockTransport.readBackupFile.mockResolvedValue(null);

    const state = await manager.readBackup('proj1', 'nonexistent.kcproj');

    expect(state).toBeNull();
  });

  it('returns null when backup content is unparseable JSON', async () => {
    mockTransport.readBackupFile.mockResolvedValue('not valid json {{{');

    const state = await manager.readBackup('proj1', 'broken.kcproj');

    expect(state).toBeNull();
  });

  it('returns null for backup with neither checksum envelope nor state field', async () => {
    mockTransport.readBackupFile.mockResolvedValue(
      JSON.stringify({ version: '1.0', name: 'No state' })
    );

    const state = await manager.readBackup('proj1', 'nostate.kcproj');

    expect(state).toBeNull();
  });
});

// ============================================================
// listBackups
// ============================================================

describe('BackupManager — listBackups', () => {
  let mockTransport: ReturnType<typeof createMockTransport>;
  let manager: BackupManager;

  beforeEach(() => {
    mockTransport = createMockTransport();
    manager = new BackupManager(mockTransport, 10);
  });

  it('returns backup file list from transport', async () => {
    mockTransport.listBackupFiles.mockResolvedValue([
      'backup_1.kcproj',
      'backup_2.kcproj',
    ]);

    const files = await manager.listBackups('proj1');

    expect(files).toEqual(['backup_1.kcproj', 'backup_2.kcproj']);
    expect(mockTransport.listBackupFiles).toHaveBeenCalledWith('proj1');
  });

  it('returns empty array on transport error', async () => {
    mockTransport.listBackupFiles.mockRejectedValue(new Error('Network error'));

    const files = await manager.listBackups('proj1');

    expect(files).toEqual([]);
  });

  it('returns empty array when no backups exist', async () => {
    mockTransport.listBackupFiles.mockResolvedValue([]);

    const files = await manager.listBackups('proj1');

    expect(files).toEqual([]);
  });
});

// ============================================================
// readLatestBackup
// ============================================================

describe('BackupManager — readLatestBackup', () => {
  let mockTransport: ReturnType<typeof createMockTransport>;
  let manager: BackupManager;

  beforeEach(() => {
    mockTransport = createMockTransport();
    manager = new BackupManager(mockTransport, 10);
  });

  it('returns most recent valid backup when multiple files exist', async () => {
    // List files (oldest to newest)
    mockTransport.listBackupFiles.mockResolvedValue([
      'backup_old.kcproj',
      'backup_mid.kcproj',
      'backup_new.kcproj',
    ]);

    // Old and mid are corrupted, new is valid
    mockTransport.readBackupFile.mockImplementation(
      async (_projectId, filename) => {
        if (filename === 'backup_new.kcproj') {
          // Return a valid legacy format
          return JSON.stringify({
            version: '1.0',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            name: 'New Backup',
            state: sampleState,
          });
        }
        // Corrupted
        if (filename === 'backup_old.kcproj' || filename === 'backup_mid.kcproj') {
          const envelope = { checksum: 'bad', data: 'corrupted' };
          return JSON.stringify(envelope);
        }
        return null;
      }
    );

    const state = await manager.readLatestBackup('proj1');

    expect(state).not.toBeNull();
    expect(state!.groups).toHaveLength(1);
  });

  it('returns the most recent file if all are valid', async () => {
    mockTransport.listBackupFiles.mockResolvedValue([
      'backup_1.kcproj',
      'backup_2.kcproj',
    ]);

    // Both are valid legacy format — should return the last one
    let readOrder: string[] = [];
    mockTransport.readBackupFile.mockImplementation(
      async (_projectId, filename) => {
        readOrder.push(filename);
        return JSON.stringify({
          version: '1.0',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          name: `Backup ${filename}`,
          state: { ...sampleState, groups: [{ ...sampleState.groups[0], name: filename }] },
        });
      }
    );

    const state = await manager.readLatestBackup('proj1');

    expect(state).not.toBeNull();
    // Should read from most recent first (backup_2.kcproj)
    expect(readOrder[0]).toBe('backup_2.kcproj');
    expect(state!.groups[0].name).toBe('backup_2.kcproj');
  });

  it('returns null when no backup files exist', async () => {
    mockTransport.listBackupFiles.mockResolvedValue([]);

    const state = await manager.readLatestBackup('proj1');

    expect(state).toBeNull();
  });

  it('returns null when all backups are corrupted', async () => {
    mockTransport.listBackupFiles.mockResolvedValue([
      'backup_1.kcproj',
      'backup_2.kcproj',
    ]);

    // All have corrupted checksums
    mockTransport.readBackupFile.mockResolvedValue(
      JSON.stringify({ checksum: 'bad', data: 'corrupted' })
    );

    const state = await manager.readLatestBackup('proj1');

    expect(state).toBeNull();
  });
});

// ============================================================
// pruneOldBackups
// ============================================================

describe('BackupManager — pruneOldBackups', () => {
  let mockTransport: ReturnType<typeof createMockTransport>;
  let manager: BackupManager;

  beforeEach(() => {
    mockTransport = createMockTransport();
    manager = new BackupManager(mockTransport, 5);
  });

  it('delegates to transport.pruneBackupFiles with correct keepCount', async () => {
    mockTransport.pruneBackupFiles.mockResolvedValue(3);

    const pruned = await manager.pruneOldBackups('proj1');

    expect(pruned).toBe(3);
    expect(mockTransport.pruneBackupFiles).toHaveBeenCalledWith('proj1', 5);
  });
});

// ============================================================
// setKeepCount
// ============================================================

describe('BackupManager — setKeepCount', () => {
  it('updates the keep count used by pruning', async () => {
    const mockTransport = createMockTransport();
    const manager = new BackupManager(mockTransport, 10);

    mockTransport.pruneBackupFiles.mockResolvedValue(0);

    manager.setKeepCount(3);
    await manager.pruneOldBackups('proj1');

    expect(mockTransport.pruneBackupFiles).toHaveBeenCalledWith('proj1', 3);
  });

  it('allows setting keep count to 1', async () => {
    const mockTransport = createMockTransport();
    const manager = new BackupManager(mockTransport, 10);

    mockTransport.pruneBackupFiles.mockResolvedValue(0);

    manager.setKeepCount(1);
    await manager.pruneOldBackups('proj1');

    expect(mockTransport.pruneBackupFiles).toHaveBeenCalledWith('proj1', 1);
  });
});

// ============================================================
// setTransport
// ============================================================

describe('BackupManager — setTransport', () => {
  it('switches to a new transport for subsequent operations', async () => {
    const transport1 = createMockTransport();
    const transport2 = createMockTransport();

    const manager = new BackupManager(transport1, 10);

    transport1.listBackupFiles.mockResolvedValue(['old_backup.kcproj']);
    transport2.listBackupFiles.mockResolvedValue(['new_backup.kcproj']);

    // Initially uses transport1
    let files = await manager.listBackups('proj1');
    expect(files).toEqual(['old_backup.kcproj']);
    expect(transport1.listBackupFiles).toHaveBeenCalled();

    // Switch to transport2
    manager.setTransport(transport2);

    files = await manager.listBackups('proj1');
    expect(files).toEqual(['new_backup.kcproj']);
    expect(transport2.listBackupFiles).toHaveBeenCalledWith('proj1');
  });

  it('new transport is used for createBackup', async () => {
    const transport1 = createMockTransport();
    const transport2 = createMockTransport();

    const manager = new BackupManager(transport1, 10);

    transport2.saveBackupFile.mockResolvedValue('backup_new_transport.kcproj');
    transport2.pruneBackupFiles.mockResolvedValue(0);

    manager.setTransport(transport2);
    const filename = await manager.createBackup({ projectId: 'proj1', projectName: 'Test', state: sampleState });

    expect(filename).toBe('backup_new_transport.kcproj');
    expect(transport2.saveBackupFile).toHaveBeenCalled();
    expect(transport1.saveBackupFile).not.toHaveBeenCalled();
  });
});

// ============================================================
// Constructor with default keepCount
// ============================================================

describe('BackupManager — constructor', () => {
  it('uses default keepCount of 10 when not specified', async () => {
    const mockTransport = createMockTransport();
    const manager = new BackupManager(mockTransport);

    mockTransport.pruneBackupFiles.mockResolvedValue(0);
    await manager.pruneOldBackups('proj1');

    expect(mockTransport.pruneBackupFiles).toHaveBeenCalledWith('proj1', 10);
  });

  it('uses custom keepCount when specified', async () => {
    const mockTransport = createMockTransport();
    const manager = new BackupManager(mockTransport, 25);

    mockTransport.pruneBackupFiles.mockResolvedValue(0);
    await manager.pruneOldBackups('proj1');

    expect(mockTransport.pruneBackupFiles).toHaveBeenCalledWith('proj1', 25);
  });
});
