import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

import { ipcTransport } from '@/core/project-transport-ipc';

describe('ipc Transport', () => {
  it('should invoke create_project with mapped params', async () => {
    mockInvoke.mockResolvedValue({ id: 'proj-1' });

    const result = await ipcTransport.createProject({
      name: 'Test Project',
      version: '2.0',
      groups: '[]',
      phrases: '[]',
      phraseCount: 0,
      minusWords: '[]',
      settings: '{}',
      uiState: '{}',
    });

    expect(mockInvoke).toHaveBeenCalledWith('create_project', {
      input: {
        name: 'Test Project',
        version: '2.0',
        groups: '[]',
        phrases: '[]',
        phrase_count: 0,
        minus_words: '[]',
        settings: '{}',
        ui_state: '{}',
        is_backup: undefined,
        parent_project_id: undefined,
      },
    });
    expect(result).toEqual({ id: 'proj-1' });
  });

  it('should pass isBackup and parentProjectId when provided', async () => {
    mockInvoke.mockResolvedValue({ id: 'proj-2' });

    await ipcTransport.createProject({
      name: 'Backup',
      groups: '[]',
      phrases: '[]',
      phraseCount: 0,
      minusWords: '[]',
      isBackup: true,
      parentProjectId: 'proj-1',
    });

    expect(mockInvoke).toHaveBeenCalledWith('create_project', {
      input: expect.objectContaining({
        is_backup: true,
        parent_project_id: 'proj-1',
      }),
    });
  });
});

describe('ipcTransport.updateProject', () => {
  it('should invoke update_project with mapped params', async () => {
    mockInvoke.mockResolvedValue(true);

    const result = await ipcTransport.updateProject('proj-1', {
      name: 'Updated',
      version: '2.1',
      phraseCount: 5,
    });

    expect(mockInvoke).toHaveBeenCalledWith('update_project', {
      id: 'proj-1',
      input: {
        name: 'Updated',
        version: '2.1',
        groups: undefined,
        phrases: undefined,
        phrase_count: 5,
        minus_words: undefined,
        settings: undefined,
        ui_state: undefined,
      },
    });
    expect(result).toBe(true);
  });
});

describe('ipcTransport.getProject', () => {
  it('should return parsed ProjectRecord from DB row', async () => {
    mockInvoke.mockResolvedValue({
      id: 'proj-1',
      name: 'My Project',
      version: '2.0',
      data: JSON.stringify({
        version: '2.0',
        groups: JSON.stringify([{ id: 'g1', name: 'Group 1' }]),
        phrases: JSON.stringify([{ id: 'p1', text: 'hello' }]),
        minusWords: JSON.stringify(['bad']),
        settings: JSON.stringify({ theme: 'dark' }),
        uiState: JSON.stringify({ theme: 'dark' }),
      }),
      created_at: '2026-01-15T10:00:00.000Z',
      updated_at: '2026-01-15T12:00:00.000Z',
    });

    const result = await ipcTransport.getProject('proj-1');

    expect(result).toEqual({
      id: 'proj-1',
      name: 'My Project',
      version: '2.0',
      groups: [{ id: 'g1', name: 'Group 1' }],
      phrases: [{ id: 'p1', text: 'hello' }],
      minusWords: ['bad'],
      settings: { theme: 'dark' },
      uiState: { theme: 'dark' },
      isBackup: false,
      parentProjectId: null,
      createdAt: '2026-01-15T10:00:00.000Z',
      updatedAt: '2026-01-15T12:00:00.000Z',
    });
  });

  it('should return null when no row found', async () => {
    mockInvoke.mockResolvedValue(null);
    const result = await ipcTransport.getProject('nonexistent');
    expect(result).toBeNull();
  });

  it('should handle row with no data field', async () => {
    mockInvoke.mockResolvedValue({
      id: 'proj-1',
      name: 'Minimal',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });

    const result = await ipcTransport.getProject('proj-1');
    expect(result?.groups).toEqual([]);
    expect(result?.phrases).toEqual([]);
    expect(result?.version).toBe('1.0');
  });

  it('should handle row with pre-parsed data as a raw object (not JSON string)', async () => {
    mockInvoke.mockResolvedValue({
      id: 'proj-parse',
      name: 'RawObject',
      data: {
        version: '2.5',
        groups: JSON.stringify([{ id: 'g1' }]),
        phrases: JSON.stringify([]),
        minusWords: JSON.stringify([]),
      },
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    const result = await ipcTransport.getProject('proj-parse');
    expect(result?.groups).toEqual([{ id: 'g1' }]);
    expect(result?.version).toBe('2.5');
  });

  it('should handle row with pre-parsed data object', async () => {
    mockInvoke.mockResolvedValue({
      id: 'proj-1',
      name: 'Parsed',
      data: {
        version: '3.0',
        groups: JSON.stringify([{ id: 'g1' }]),
        phrases: JSON.stringify([]),
        minusWords: JSON.stringify([]),
      },
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });

    const result = await ipcTransport.getProject('proj-1');
    expect(result?.groups).toEqual([{ id: 'g1' }]);
    expect(result?.version).toBe('3.0');
  });

  it('should use top-level version when data.version is missing', async () => {
    mockInvoke.mockResolvedValue({
      id: 'proj-1',
      name: 'TopVersion',
      version: '3.0',
      data: JSON.stringify({
        groups: JSON.stringify([]),
        phrases: JSON.stringify([]),
        minusWords: JSON.stringify([]),
      }),
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    const result = await ipcTransport.getProject('proj-1');
    expect(result?.version).toBe('3.0');
  });

  it('should handle malformed JSON in data fields gracefully', async () => {
    mockInvoke.mockResolvedValue({
      id: 'proj-1',
      name: 'Broken',
      data: JSON.stringify({
        groups: '{invalid',
        phrases: 'not json',
      }),
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });

    const result = await ipcTransport.getProject('proj-1');
    expect(result?.groups).toEqual([]);
    expect(result?.phrases).toEqual([]);
  });
});

describe('ipcTransport.listProjects', () => {
  it('should return mapped ProjectListItem array', async () => {
    mockInvoke.mockResolvedValue([
      {
        id: 'proj-1',
        name: 'A',
        version: '2.0',
        phrase_count: 10,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'proj-2',
        name: 'B',
        created_at: '2026-01-02T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
    ]);

    const result = await ipcTransport.listProjects();
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('proj-1');
    expect(result[0].phraseCount).toBe(10);
    expect(result[0].version).toBe('2.0');
    expect(result[1].version).toBe('1.0');
    expect(result[1].phraseCount).toBe(0);
  });
});

describe('ipcTransport.deleteProject', () => {
  it('should invoke delete_project', async () => {
    mockInvoke.mockResolvedValue(true);
    const result = await ipcTransport.deleteProject('proj-1');
    expect(mockInvoke).toHaveBeenCalledWith('delete_project', { id: 'proj-1' });
    expect(result).toBe(true);
  });
});

describe('ipcTransport.createBackup', () => {
  it('should invoke create_backup with parentId', async () => {
    mockInvoke.mockResolvedValue({ id: 'backup-1' });
    const result = await ipcTransport.createBackup('proj-1');
    expect(mockInvoke).toHaveBeenCalledWith('create_backup', { parentId: 'proj-1' });
    expect(result).toEqual({ id: 'backup-1' });
  });

  it('should return null when backup fails', async () => {
    mockInvoke.mockResolvedValue(null);
    const result = await ipcTransport.createBackup('proj-1');
    expect(result).toBeNull();
  });
});

describe('ipcTransport.getLatestBackup', () => {
  it('should return parsed ProjectRecord for backup', async () => {
    mockInvoke.mockResolvedValue({
      id: 'backup-1',
      data: {
        version: '2.0',
        groups: JSON.stringify([]),
        phrases: JSON.stringify([]),
        minusWords: JSON.stringify([]),
      },
      parentProjectId: 'proj-1',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    const result = await ipcTransport.getLatestBackup('proj-1');
    expect(result).not.toBeNull();
    expect(result!.isBackup).toBe(true);
    expect(result!.parentProjectId).toBe('proj-1');
  });

  it('should return null when no backup exists', async () => {
    mockInvoke.mockResolvedValue(null);
    const result = await ipcTransport.getLatestBackup('proj-1');
    expect(result).toBeNull();
  });
});

describe('ipcTransport countBackups / pruneBackups / deleteBackups', () => {
  it('countBackups should invoke list_backup_files and return length', async () => {
    mockInvoke.mockResolvedValue(['f1', 'f2', 'f3']);
    const result = await ipcTransport.countBackups('proj-1');
    expect(mockInvoke).toHaveBeenCalledWith('list_backup_files', { projectId: 'proj-1' });
    expect(result).toBe(3);
  });

  it('pruneBackups should invoke prune_backup_files', async () => {
    mockInvoke.mockResolvedValue(5);
    const result = await ipcTransport.pruneBackups('proj-1', 10);
    expect(mockInvoke).toHaveBeenCalledWith('prune_backup_files', { projectId: 'proj-1', keepCount: 10 });
    expect(result).toBe(5);
  });

  it('deleteBackups should invoke prune_backup_files with keepCount 0', async () => {
    mockInvoke.mockResolvedValue(3);
    const result = await ipcTransport.deleteBackups('proj-1');
    expect(mockInvoke).toHaveBeenCalledWith('prune_backup_files', { projectId: 'proj-1', keepCount: 0 });
    expect(result).toBe(3);
  });
});

describe('ipcTransport saveBackupFile / listBackupFiles / readBackupFile / pruneBackupFiles', () => {
  it('saveBackupFile should invoke save_backup_file and return filename', async () => {
    mockInvoke.mockResolvedValue({ filename: 'backup_2026-01-01.json' });
    const result = await ipcTransport.saveBackupFile('proj-1', 'My Project', '{}');
    expect(mockInvoke).toHaveBeenCalledWith('save_backup_file', { projectId: 'proj-1', stateJson: '{}' });
    expect(result).toBe('backup_2026-01-01.json');
  });

  it('listBackupFiles should invoke list_backup_files', async () => {
    mockInvoke.mockResolvedValue(['f1.json', 'f2.json']);
    const result = await ipcTransport.listBackupFiles('proj-1');
    expect(mockInvoke).toHaveBeenCalledWith('list_backup_files', { projectId: 'proj-1' });
    expect(result).toEqual(['f1.json', 'f2.json']);
  });

  it('readBackupFile should return null (deprecated)', async () => {
    const result = await ipcTransport.readBackupFile('proj-1', 'f.json');
    expect(result).toBeNull();
  });

  it('pruneBackupFiles should invoke prune_backup_files', async () => {
    mockInvoke.mockResolvedValue(2);
    const result = await ipcTransport.pruneBackupFiles('proj-1', 5);
    expect(mockInvoke).toHaveBeenCalledWith('prune_backup_files', { projectId: 'proj-1', keepCount: 5 });
    expect(result).toBe(2);
  });
});
