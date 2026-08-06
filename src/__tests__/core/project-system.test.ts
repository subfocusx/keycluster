// ============================================================
// Tests: Project System — Production Hardening
// Tests .kcproj serialization, validation, parsing, pure state
// functions, save queue versioning, migration chain, backup
// checksum, double-load protection, and crash flush.
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { exportToKcproj, parseKcproj } from '@/core/project-file';
import type { ProjectFile, ProjectState, ProjectTransport, ProjectRecord } from '@/core/project-types';
import { useAppStore } from '@/plugin-sdk';
import { migrateProject, isVersionCompatible, registerMigration } from '@/core/migration-manager';
import { BackupManager } from '@/core/backup-manager';
import { SaveQueue } from '@/core/save-queue';
import { useSettingsStore } from '@/plugin-sdk';
import { extractProjectState, restoreToPartialState, createSnapshot } from '@/core/project-store-sync';

function createSampleState(): ProjectState {
  return {
    groups: [
      { id: 'g1', name: 'Group 1', parentId: null, isExpanded: true, isTrash: false, createdAt: Date.now() },
    ],
    phrases: [
      { id: 'p1', text: 'тестовая фраза', groupId: 'g1', frequency: 100, kei: 5, cpc: 10.0, createdAt: Date.now() },
    ],
    minusWords: [
      { id: 'mw1', text: 'бесплатно', isExact: false, groupId: null, searchType: 'broad' as const, createdAt: Date.now() },
    ],
    settings: { clustering: { threshold: 0.5 } },
    uiState: { theme: 'light' },
  };
}

// ---- Mock Transport Factory ----

function createMockTransport(): ProjectTransport & {
  updateCalls: any[];
  createCalls: any[];
  projects: Map<string, ProjectRecord>;
} {
  const projects = new Map<string, ProjectRecord>();
  let idCounter = 0;

  return {
    updateCalls: [],
    createCalls: [],
    projects,

    createProject: async (params) => {
      createMockTransport;
      const id = `mock-${++idCounter}`;
      const record: ProjectRecord = {
        id,
        name: params.name,
        version: params.version ?? '1.0',
        groups: JSON.parse(params.groups),
        phrases: JSON.parse(params.phrases),
        minusWords: JSON.parse(params.minusWords),
        settings: JSON.parse(params.settings ?? '{}'),
        uiState: JSON.parse(params.uiState ?? '{}'),
        isBackup: params.isBackup ?? false,
        parentProjectId: params.parentProjectId ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      projects.set(id, record);
      return { id };
    },

    updateProject: async (id, params) => {
      const existing = projects.get(id);
      if (!existing) return false;
      if (params.groups !== undefined) existing.groups = JSON.parse(params.groups);
      if (params.phrases !== undefined) existing.phrases = JSON.parse(params.phrases);
      if (params.minusWords !== undefined) existing.minusWords = JSON.parse(params.minusWords);
      existing.updatedAt = new Date().toISOString();
      return true;
    },

    getProject: async (id) => projects.get(id) ?? null,

    listProjects: async (includeBackups = false) => {
      const items: any[] = [];
      for (const [id, r] of projects) {
        if (!includeBackups && r.isBackup) continue;
        items.push({
          id, name: r.name, version: r.version,
          phraseCount: r.phrases.length, groupCount: r.groups.filter(g => !g.isTrash).length,
          isBackup: r.isBackup, parentProjectId: r.parentProjectId,
          createdAt: r.createdAt, updatedAt: r.updatedAt,
        });
      }
      return items;
    },

    deleteProject: async (id) => projects.delete(id),

    createBackup: async () => ({ id: `backup-${++idCounter}` }),
    getLatestBackup: async () => null,
    countBackups: async () => 0,
    pruneBackups: async () => 0,
    deleteBackups: async () => 0,

    saveBackupFile: async () => `backup_${Date.now()}.kcproj`,
    listBackupFiles: async () => [],
    readBackupFile: async () => null,
    pruneBackupFiles: async () => 0,
    listSnapshots: vi.fn(),
    getSnapshotBackupData: vi.fn(),
    deleteSnapshot: vi.fn(),
  };
}

// ---- File Export/Import Tests ----

describe('Project File — Export', () => {
  it('should export a valid .kcproj JSON string', () => {
    const state = createSampleState();
    const json = exportToKcproj('Test Project', state);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe('1.0');
    expect(parsed.name).toBe('Test Project');
    expect(parsed.state.groups).toHaveLength(1);
    expect(parsed.state.phrases).toHaveLength(1);
  });

  it('should handle empty state', () => {
    const emptyState: ProjectState = { groups: [], phrases: [], minusWords: [], settings: {}, uiState: {} };
    const json = exportToKcproj('Empty', emptyState);
    const parsed = JSON.parse(json);
    expect(parsed.state.groups).toHaveLength(0);
  });

  it('should round-trip correctly', () => {
    const state = createSampleState();
    const json = exportToKcproj('Round Trip', state);
    const reimported = parseKcproj(json);
    expect(reimported.name).toBe('Round Trip');
    expect(reimported.state.groups).toHaveLength(1);
  });
});

describe('Project File — Parse & Validate', () => {
  it('should reject non-object JSON', () => {
    expect(() => parseKcproj('"hello"')).toThrow('not a JSON object');
  });

  it('should reject missing version field', () => {
    const invalid = JSON.stringify({ name: 'Test', state: { groups: [], phrases: [], minusWords: [] } });
    expect(() => parseKcproj(invalid)).toThrow('missing "version"');
  });

  it('should reject incompatible major version', () => {
    const incompatible = JSON.stringify({ version: '2.0', name: 'Future', state: { groups: [], phrases: [], minusWords: [] } });
    expect(() => parseKcproj(incompatible)).toThrow('Incompatible');
  });

  it('should accept compatible minor version', () => {
    const compatible = JSON.stringify({ version: '1.5', name: 'OK', state: { groups: [], phrases: [], minusWords: [] } });
    const result = parseKcproj(compatible);
    expect(result.version).toBe('1.5');
  });
});

// ---- Store Sync Tests ----

describe('Project Store Sync', () => {
  beforeEach(() => { useAppStore.getState().clearAll(); });

  it('should extract state from Zustand', () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('Test Group');
    store.addPhrases(['фраза 1', 'фраза 2'], gid, [{ frequency: 100 }]);

    const appState = useAppStore.getState();
    const settingsState = useSettingsStore.getState();
    const state = extractProjectState({
      groups: appState.groups, phrases: appState.phrases, minusWords: appState.minusWords,
      settings: settingsState.settings, ui: appState.ui,
    });

    expect(state.groups.length).toBeGreaterThanOrEqual(1);
    expect(state.phrases.length).toBe(2);
  });

  it('should produce partial state for Zustand setState', () => {
    const state = createSampleState();
    const partial = restoreToPartialState(state);
    expect(partial.groups).toHaveLength(1);
    expect(partial.selectedGroupIds?.size ?? 0).toBe(0);
    expect(partial.activeGroupId).toBeNull();
  });

  it('should clean _originalGroupId during extraction', () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('Test');
    store.addPhrases(['тест'], gid);
    const pid = useAppStore.getState().phrases[0].id;
    store.moveToTrash([pid]);

    const appState = useAppStore.getState();
    const settingsState = useSettingsStore.getState();
    const state = extractProjectState({
      groups: appState.groups, phrases: appState.phrases, minusWords: appState.minusWords,
      settings: settingsState.settings, ui: appState.ui,
    });
    for (const phrase of state.phrases) {
      expect((phrase as any)._originalGroupId).toBeUndefined();
    }
  });

  it('should create a deep-cloned snapshot for rollback', () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('Snapshot');
    store.addPhrases(['фраза 1'], gid);

    const appState = useAppStore.getState();
    const snapshot = createSnapshot({
      groups: appState.groups, phrases: appState.phrases, minusWords: appState.minusWords,
      activeGroupId: appState.activeGroupId, selectedGroupIds: appState.selectedGroupIds,
      selectedPhraseIds: appState.selectedPhraseIds,
    });

    expect(snapshot.phrases).toHaveLength(1);
    store.addPhrases(['фраза 2'], gid);
    expect(snapshot.phrases).toHaveLength(1); // Deep copy
  });
});

// ---- Migration Manager Tests ----

describe('Migration Manager', () => {
  it('should return same state for current version', () => {
    const state = createSampleState();
    const result = migrateProject('1.0', state);
    expect(result.success).toBe(true);
    expect(result.state).toBeDefined();
    expect(result.appliedMigrations).toEqual([]);
  });

  it('should reject a newer major version', () => {
    const state = createSampleState();
    const result = migrateProject('2.0', state);
    expect(result.success).toBe(false);
    expect(result.error).toContain('newer');
  });

  it('should check version compatibility', () => {
    expect(isVersionCompatible('1.0')).toBe(true);
    expect(isVersionCompatible('2.0')).toBe(false);
  });

  it('should apply migrations in chain', async () => {
    // Register chain: 1.0 → 1.1 → 1.2
    // We need to test that chain execution works.
    // Since PROJECT_FORMAT_VERSION is '1.0', we test with fileVersion '0.9'
    // and register migrations for 0.9.1 and 0.9.2
    registerMigration({
      version: '0.9.1',
      migrate: (data) => ({
        ...data,
        phrases: data.phrases.map(p => ({ ...p, competition: (p as any).competition ?? -1 })),
      }),
    });
    registerMigration({
      version: '0.9.2',
      migrate: (data) => ({
        ...data,
        phrases: data.phrases.map(p => ({ ...p, notes: (p as any).notes ?? 'migrated' })),
      }),
    });

    const state = createSampleState();
    const result = migrateProject('0.9', state);

    expect(result.success).toBe(true);
    expect(result.appliedMigrations).toContain('0.9.1');
    expect(result.appliedMigrations).toContain('0.9.2');
    expect(result.state!.phrases[0].competition).toBe(-1);
    expect(result.state!.phrases[0].notes).toBe('migrated');
  });

  it('should fallback on migration failure', () => {
    registerMigration({
      version: '0.5',
      migrate: () => { throw new Error('Test migration failure'); },
    });

    const state = createSampleState();
    const result = migrateProject('0.4', state);

    expect(result.success).toBe(false);
    expect(result.error).toContain('failed');
  });
});

// ---- Save Queue Tests (Production) ----

describe('Save Queue — Versioning & Race Conditions', () => {
  function createQueueTransport() {
    const transport = createMockTransport();
    transport.getProject = async (id) => transport.projects.get(id) ?? null;
    return transport;
  }

  it('should initialize with idle status', () => {
    const transport = createQueueTransport();
    const queue = new SaveQueue(transport, 50);
    expect(queue.status).toBe('idle');
  });

  it('should enqueue with version and process', async () => {
    const transport = createQueueTransport();
    const queue = new SaveQueue(transport, 30);
    const state = createSampleState();

    // Create a project first
    await transport.createProject({
      name: 'Test', groups: '[]', phrases: '[]', phraseCount: 0, minusWords: '[]',
    });
    // Get the project ID
    const projId = transport.projects.keys().next().value!;

    const result = await queue.enqueue(projId, state, 1);
    await queue.flush();

    expect(result).toBe(true);
    expect(queue.lastWrittenVersion).toBe(1);
  });

  it('should ignore stale versions (race condition protection)', async () => {
    const transport = createQueueTransport();
    const queue = new SaveQueue(transport, 30);
    const state = createSampleState();

    await transport.createProject({ name: 'Test', groups: '[]', phrases: '[]', phraseCount: 0, minusWords: '[]' });
    const projId = transport.projects.keys().next().value!;

    // Enqueue v2 and flush
    await queue.enqueue(projId, state, 2);
    await queue.flush();
    expect(queue.lastWrittenVersion).toBe(2);

    // Try to enqueue v1 (stale) — should be rejected
    const result = await queue.enqueue(projId, state, 1);
    expect(result).toBe(false);
  });

  it('should batch: replace older version in queue', async () => {
    const transport = createQueueTransport();
    const queue = new SaveQueue(transport, 30000); // Long debounce
    const state1 = createSampleState();
    const state2 = { ...createSampleState(), phrases: [] };

    await transport.createProject({ name: 'Test', groups: '[]', phrases: '[]', phraseCount: 0, minusWords: '[]' });
    const projId = transport.projects.keys().next().value!;

    // Enqueue v1, then v2 (should replace v1 in queue)
    queue.enqueue(projId, state1, 1);
    queue.enqueue(projId, state2, 2);

    await queue.flush();
    expect(queue.lastWrittenVersion).toBe(2);
    expect(queue.pendingCount).toBe(0);
  });

  it('should process multiple entries for different projects sequentially', async () => {
    const transport = createQueueTransport();
    let updateCount = 0;
    transport.updateProject = async () => { updateCount++; return true; };
    transport.getProject = async (id) => transport.projects.get(id) ?? null;

    const queue = new SaveQueue(transport, 10);
    const state = createSampleState();

    // Create two different projects
    await transport.createProject({ name: 'Test1', groups: '[]', phrases: '[]', phraseCount: 0, minusWords: '[]' });
    await transport.createProject({ name: 'Test2', groups: '[]', phrases: '[]', phraseCount: 0, minusWords: '[]' });
    const projIds = [...transport.projects.keys()];

    // Enqueue for different projects — no batching across projects
    queue.enqueue(projIds[0], state, 1);
    queue.enqueue(projIds[1], state, 1);
    queue.enqueue(projIds[0], state, 2); // This replaces the v1 entry for projIds[0]

    await queue.flush();
    // Expect 2 writes: projIds[0] v2 and projIds[1] v1 (v1 for projIds[0] was batched away)
    expect(updateCount).toBe(2);
    expect(queue.lastWrittenVersion).toBe(2);
  });

  it('should flush with timeout', async () => {
    const transport = createQueueTransport();
    transport.getProject = async (id) => transport.projects.get(id) ?? null;
    transport.updateProject = async () => true;

    const queue = new SaveQueue(transport, 10);
    const state = createSampleState();

    await transport.createProject({ name: 'Test', groups: '[]', phrases: '[]', phraseCount: 0, minusWords: '[]' });
    const projId = transport.projects.keys().next().value!;

    queue.enqueue(projId, state, 1);
    await queue.flush(5000);
    expect(queue.status).toBe('idle');
  });

  it('should clear the queue', () => {
    const transport = createQueueTransport();
    const queue = new SaveQueue(transport, 10000);
    const state = createSampleState();

    queue.enqueue('proj1', state, 1);
    queue.clear();
    expect(queue.pendingCount).toBe(0);
    expect(queue.status).toBe('idle');
  });

  it('should destroy the queue', async () => {
    const transport = createQueueTransport();
    const queue = new SaveQueue(transport, 10000);
    queue.enqueue('proj1', createSampleState(), 1);
    await queue.destroy();
    expect(queue.pendingCount).toBe(0);
  });

  it('should set debounce interval', () => {
    const transport = createQueueTransport();
    const queue = new SaveQueue(transport, 100);
    queue.setDebounceMs(5000);
    expect(queue.getDebounceMs()).toBe(5000);
  });

  it('should clamp debounce interval to min 1s', () => {
    const transport = createQueueTransport();
    const queue = new SaveQueue(transport, 100);
    queue.setDebounceMs(100); // Too low
    expect(queue.getDebounceMs()).toBe(1000);
  });

  it('should reset version', async () => {
    const transport = createQueueTransport();
    const queue = new SaveQueue(transport, 10);
    const state = createSampleState();

    await transport.createProject({ name: 'Test', groups: '[]', phrases: '[]', phraseCount: 0, minusWords: '[]' });
    const projId = transport.projects.keys().next().value!;

    await queue.enqueue(projId, state, 5);
    await queue.flush();
    expect(queue.lastWrittenVersion).toBe(5);

    queue.resetVersion();
    expect(queue.lastWrittenVersion).toBe(0);
  });
});

// ---- Backup Manager Tests ----

describe('Backup Manager — Checksum', () => {
  it('should create a backup with checksum', async () => {
    const transport = createMockTransport();
    const backupData: { content: string | null } = { content: null };

    // Override saveBackupFile to capture content
    transport.saveBackupFile = async (_projectId, _projectName, data) => {
      backupData.content = data;
      return 'backup_2026.kcproj';
    };

    const manager = new BackupManager(transport, 10);
    const state = createSampleState();
    const filename = await manager.createBackup({ projectId: 'proj1', projectName: 'Test Project', state: state });

    expect(filename).toBeTruthy();

    // Verify the backup contains checksum envelope
    const envelope = JSON.parse(backupData.content!);
    expect(envelope.checksum).toBeTruthy();
    expect(envelope.data).toBeTruthy();
  });

  it('should validate checksum on read', async () => {
    const transport = createMockTransport();
    const state = createSampleState();

    // Create a valid backup
    const savedBackups: Map<string, string> = new Map();
    transport.saveBackupFile = async (projectId, _projectName, data) => {
      savedBackups.set(`${projectId}:backup.kcproj`, data);
      return 'backup.kcproj';
    };
    transport.listBackupFiles = async () => ['backup.kcproj'];
    transport.readBackupFile = async (projectId, filename) => {
      return savedBackups.get(`${projectId}:${filename}`) ?? null;
    };

    const manager = new BackupManager(transport, 10);
    await manager.createBackup({ projectId: 'proj1', projectName: 'Test', state: state });

    // Read it back — should succeed
    const readState = await manager.readBackup('proj1', 'backup.kcproj');
    expect(readState).not.toBeNull();
    expect(readState!.groups).toHaveLength(1);
  });

  it('should reject corrupted backup (checksum mismatch)', async () => {
    const transport = createMockTransport();

    // Save a valid backup, then corrupt it
    const savedBackups: Map<string, string> = new Map();
    transport.saveBackupFile = async (projectId, _projectName, data) => {
      savedBackups.set(`${projectId}:backup.kcproj`, data);
      return 'backup.kcproj';
    };
    transport.listBackupFiles = async () => ['backup.kcproj'];
    transport.readBackupFile = async (projectId, filename) => {
      const content = savedBackups.get(`${projectId}:${filename}`) ?? null;
      if (!content) return null;
      // Corrupt the data
      const envelope = JSON.parse(content);
      envelope.data = envelope.data.replace('Group 1', 'CORRUPTED');
      return JSON.stringify(envelope);
    };

    const manager = new BackupManager(transport, 10);
    const state = createSampleState();
    await manager.createBackup({ projectId: 'proj1', projectName: 'Test', state: state });

    // Read corrupted backup — should fail
    const readState = await manager.readBackup('proj1', 'backup.kcproj');
    expect(readState).toBeNull();
  });
});

// ---- Project Service Integration Tests ----

describe('Project Service — Integration', () => {
  let mockTransport: ReturnType<typeof createMockTransport>;

  beforeEach(async () => {
    useAppStore.getState().clearAll();
    mockTransport = createMockTransport();
    const { setTransport, setCurrentProjectId, setCurrentProjectName, disableAutoSave, resetUnsaved, destroy } = await import('@/core/project-service');
    setTransport(mockTransport);
    setCurrentProjectId(null);
    setCurrentProjectName(null);
    disableAutoSave();
    resetUnsaved();
  });

  it('should save and load a project', async () => {
    const { saveProjectAs, loadProject } = await import('@/core/project-service');
    const store = useAppStore.getState();
    store.addGroup('Group to Save');

    const saveResult = await saveProjectAs('Project A');
    expect(saveResult.success).toBe(true);

    useAppStore.getState().clearAll();
    expect(useAppStore.getState().groups).toHaveLength(0);

    const loadResult = await loadProject(saveResult.projectId);
    expect(loadResult.success).toBe(true);
  });

  it('should track unsaved changes', async () => {
    const { getHasUnsavedChanges, markUnsaved, resetUnsaved, getUnloadWarning } = await import('@/core/project-service');

    expect(getHasUnsavedChanges()).toBe(false);
    expect(getUnloadWarning()).toBeNull();

    markUnsaved();
    expect(getHasUnsavedChanges()).toBe(true);
    expect(getUnloadWarning()).toBeTruthy();

    resetUnsaved();
    expect(getHasUnsavedChanges()).toBe(false);
  });

  it('should track state version', async () => {
    const { incrementStateVersion, getStateVersion } = await import('@/core/project-service');

    const v1 = getStateVersion();
    incrementStateVersion();
    incrementStateVersion();
    expect(getStateVersion()).toBe(v1 + 2);
  });

  it('should import a project from a .kcproj string', async () => {
    const { importProjectFromString } = await import('@/core/project-service');
    useAppStore.getState().clearAll();

    const kcprojJson = JSON.stringify({
      version: '1.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      name: 'Import Test',
      state: {
        groups: [{ id: 'ig1', name: 'Imported', parentId: null, isExpanded: true, isTrash: false, createdAt: Date.now() }],
        phrases: [{ id: 'ip1', text: 'импорт', groupId: 'ig1', frequency: 50, createdAt: Date.now() }],
        minusWords: [],
        settings: {},
        uiState: {},
      },
    });

    const result = await importProjectFromString(kcprojJson);
    expect(result.success).toBe(true);
    expect(useAppStore.getState().phrases.some(p => p.text === 'импорт')).toBe(true);

    useAppStore.getState().clearAll();
  });

  it('should set and get auto-save interval', async () => {
    const { setAutoSaveIntervalMinutes, getAutoSaveIntervalMinutes } = await import('@/core/project-service');

    setAutoSaveIntervalMinutes(5);
    expect(getAutoSaveIntervalMinutes()).toBe(5);

    setAutoSaveIntervalMinutes(30);
    expect(getAutoSaveIntervalMinutes()).toBe(30);
  });

  it('should clamp auto-save interval to 1-60 min', async () => {
    const { setAutoSaveIntervalMinutes, getAutoSaveIntervalMinutes } = await import('@/core/project-service');

    setAutoSaveIntervalMinutes(0);
    expect(getAutoSaveIntervalMinutes()).toBe(1);

    setAutoSaveIntervalMinutes(100);
    expect(getAutoSaveIntervalMinutes()).toBe(60);
  });

  it('should have isLoadingProject flag', async () => {
    const { getIsLoadingProject } = await import('@/core/project-service');
    expect(getIsLoadingProject()).toBe(false);
  });

  it('should destroy cleanly', async () => {
    const { destroy, getCurrentProjectId } = await import('@/core/project-service');
    await destroy();
    expect(getCurrentProjectId()).toBeNull();
  });
});

// ---- Double Load Protection Test ----

describe('Project Service — Double Load Protection', () => {
  let mockTransport: ReturnType<typeof createMockTransport>;

  beforeEach(async () => {
    useAppStore.getState().clearAll();
    mockTransport = createMockTransport();
    const { setTransport, setCurrentProjectId, setCurrentProjectName, disableAutoSave, resetUnsaved } = await import('@/core/project-service');
    setTransport(mockTransport);
    setCurrentProjectId(null);
    setCurrentProjectName(null);
    disableAutoSave();
    resetUnsaved();
  });

  it('should handle rapid double loadProject calls', async () => {
    const { saveProjectAs, loadProject } = await import('@/core/project-service');
    const store = useAppStore.getState();
    store.addGroup('Double Load Test');

    const saveResult = await saveProjectAs('DoubleLoad');
    expect(saveResult.success).toBe(true);

    // Call loadProject twice simultaneously
    const [result1, result2] = await Promise.all([
      loadProject(saveResult.projectId),
      loadProject(saveResult.projectId),
    ]);

    // Both should succeed (second call returns the same promise result)
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
  });
});
