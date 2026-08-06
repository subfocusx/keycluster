// ============================================================
// Tests: Project Service — Extended Coverage
// Comprehensive tests for project-service.ts including
// state versioning, project tracking, unsaved changes,
// auto-save, save status, CRUD operations, import/export,
// crash recovery, and destroy.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProjectListItem } from '@/plugin-sdk';
import type { ProjectTransport, ProjectRecord } from '@/core/project-types';

vi.mock('@/core/app-store', () => ({
  useAppStore: {
    getState: vi.fn(() => ({
      groups: [],
      phrases: [],
      minusWords: [],
      activeGroupId: null,
      selectedGroupIds: [],
      selectedPhraseIds: [],
      ui: {
        theme: 'light',
        rightPanel: { width: 300, open: true },
        leftPanel: { width: 300, open: true, module: null },
      },
      setTheme: vi.fn(),
      setRightPanelWidth: vi.fn(),
      setLeftPanelWidth: vi.fn(),
    })),
    setState: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  },
}));

// ---- Mock: settings-store ----

vi.mock('@/core/settings-store', () => ({
  useSettingsStore: {
    getState: vi.fn(() => ({
      settings: {},
      setModuleSetting: vi.fn(),
    })),
  },
}));

// ---- Mock: event-bus ----

vi.mock('@/core/event-bus', () => ({
  getEventBus: vi.fn(() => ({
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  })),
}));

// ---- Mock: project-file ----

vi.mock('@/core/project-file', () => ({
  exportToKcproj: vi.fn(() => '{}'),
  downloadKcprojFile: vi.fn(),
  readKcprojFile: vi.fn(),
  parseKcproj: vi.fn(),
}));

// ---- Mock: save-queue (class-based for `new` compatibility) ----

let mockSaveQueueInstance: any;

vi.mock('@/core/save-queue', () => {
  class MockSaveQueue {
    enqueue = vi.fn().mockResolvedValue(true);
    resetVersion = vi.fn();
    setDebounceMs = vi.fn();
    setProjectRecoveredCallback = vi.fn();
    flush = vi.fn().mockResolvedValue(undefined);
    destroy = vi.fn();
    status: string = 'idle';
    error: string | null = null;
    lastSave: number = 0;
    constructor() {
      mockSaveQueueInstance = this;
    }
  }
  return { SaveQueue: MockSaveQueue };
});

// ---- Mock: backup-manager (class-based for `new` compatibility) ----

let mockBackupManagerInstance: any;

vi.mock('@/core/backup-manager', () => {
  class MockBackupManager {
    createBackup = vi.fn().mockResolvedValue('backup.json');
    readBackup = vi.fn();
    listBackups = vi.fn().mockResolvedValue([]);
    pruneOldBackups = vi.fn().mockResolvedValue(0);
    setTransport = vi.fn();
    constructor() {
      mockBackupManagerInstance = this;
    }
  }
  return { BackupManager: MockBackupManager };
});

// ---- Mock: migration-manager ----

vi.mock('@/core/migration-manager', () => ({
  migrateProject: vi.fn().mockImplementation((_version: string, state: any) => ({
    success: true,
    state,
    fromVersion: '1.0',
    toVersion: '1.0',
    appliedMigrations: [],
  })),
}));

// ---- Mock: project-store-sync ----

vi.mock('@/core/project-store-sync', () => ({
  extractProjectState: vi.fn(() => ({
    groups: [],
    phrases: [],
    minusWords: [],
    settings: {},
    uiState: {},
  })),
  restoreToPartialState: vi.fn(() => ({})),
  createSnapshot: vi.fn(() => ({
    groups: [],
    phrases: [],
    minusWords: [],
    activeGroupId: null,
    selectedGroupIds: [],
    selectedPhraseIds: [],
  })),
}));

// ---- Import after mocks ----

import {
  getCurrentProjectId,
  isAutoSaveEnabled,
  enableAutoSave,
  disableAutoSave,
  getAutoSaveIntervalMs,
  setAutoSaveIntervalMs,
  setAutoSaveIntervalMinutes,
  getAutoSaveIntervalMinutes,
  getSaveStatus,
  getLastSaveTime,
  getLastSaveError,
  saveProjectAs,
  saveCurrentProject,
  loadProject,
  listProjects,
  deleteProject,
  exportProject,
  importProjectFromString,
  flushSaveQueue,
  recoverFromCrash,
  hasCrashRecovery,
} from '@/plugin-sdk';
import {
  destroy,
  setTransport,
  incrementStateVersion,
  getStateVersion,
  getIsLoadingProject,
  setCurrentProjectId,
  getCurrentProjectName,
  setCurrentProjectName,
  getHasUnsavedChanges,
  markUnsaved,
  resetUnsaved,
  getUnloadWarning,
} from '@/core/project-service';
import { extractProjectState } from '@/core/project-store-sync';
import { parseKcproj } from '@/core/project-file';
import { migrateProject } from '@/core/migration-manager';

// ---- Mock Transport Factory ----

function createMockTransport(): ProjectTransport {
  const projects = new Map<string, ProjectRecord>();
  let idCounter = 0;

  return {
    createProject: vi.fn(async (params) => {
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
    }),

    updateProject: vi.fn(async (id, _params) => {
      return projects.has(id);
    }),

    getProject: vi.fn(async (id) => projects.get(id) ?? null),

    listProjects: vi.fn(async (includeBackups = false) => {
      const items: ProjectListItem[] = [];
      for (const [id, r] of projects) {
        if (!includeBackups && r.isBackup) continue;
        items.push({
          id,
          name: r.name,
          version: r.version,
          phraseCount: r.phrases.length,
          groupCount: r.groups.length,
          isBackup: r.isBackup,
          parentProjectId: r.parentProjectId,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        });
      }
      return items;
    }),

    deleteProject: vi.fn(async (id) => {
      return projects.delete(id);
    }),

    createBackup: vi.fn(async () => ({ id: `backup-${++idCounter}` })),
    getLatestBackup: vi.fn(async () => null),
    countBackups: vi.fn(async () => 0),
    pruneBackups: vi.fn(async () => 0),
    deleteBackups: vi.fn(async () => 0),

    saveBackupFile: vi.fn(async () => `backup_${Date.now()}.kcproj`),
    listBackupFiles: vi.fn(async () => []),
    readBackupFile: vi.fn(async () => null),
    pruneBackupFiles: vi.fn(async () => 0),
    listSnapshots: vi.fn(),
    getSnapshotBackupData: vi.fn(),
    deleteSnapshot: vi.fn(),
  };
}

// ============================================================
// Test Suite
// ============================================================

describe('Project Service — Extended', () => {
  // ---- Reset module state between tests ----
  beforeEach(async () => {
    await destroy();
  });

  // ============================================================
  // 1. State Version
  // ============================================================

  describe('State Version', () => {
    it('should start at 0 after destroy', () => {
      expect(getStateVersion()).toBe(0);
    });

    it('should increment and return the new version', () => {
      const v = incrementStateVersion();
      expect(v).toBe(1);
      expect(getStateVersion()).toBe(1);
    });

    it('should increment multiple times', () => {
      incrementStateVersion();
      incrementStateVersion();
      incrementStateVersion();
      expect(getStateVersion()).toBe(3);
    });

    it('should reset to 0 on destroy', async () => {
      incrementStateVersion();
      incrementStateVersion();
      expect(getStateVersion()).toBe(2);
      await destroy();
      expect(getStateVersion()).toBe(0);
    });
  });

  // ============================================================
  // 2. Project Tracking — ID and Name
  // ============================================================

  describe('Project Tracking', () => {
    it('should have null project ID initially', () => {
      expect(getCurrentProjectId()).toBeNull();
    });

    it('should have null project name initially', () => {
      expect(getCurrentProjectName()).toBeNull();
    });

    it('should set and get project ID', () => {
      setCurrentProjectId('proj-123');
      expect(getCurrentProjectId()).toBe('proj-123');
    });

    it('should set and get project name', () => {
      setCurrentProjectName('My Project');
      expect(getCurrentProjectName()).toBe('My Project');
    });

    it('should allow setting project ID to null', () => {
      setCurrentProjectId('proj-123');
      setCurrentProjectId(null);
      expect(getCurrentProjectId()).toBeNull();
    });

    it('should allow setting project name to null', () => {
      setCurrentProjectName('My Project');
      setCurrentProjectName(null);
      expect(getCurrentProjectName()).toBeNull();
    });

    it('should reset project ID and name on destroy', async () => {
      setCurrentProjectId('proj-123');
      setCurrentProjectName('My Project');
      await destroy();
      expect(getCurrentProjectId()).toBeNull();
      expect(getCurrentProjectName()).toBeNull();
    });
  });

  // ============================================================
  // 3. Unsaved Changes
  // ============================================================

  describe('Unsaved Changes', () => {
    it('should start with no unsaved changes', () => {
      expect(getHasUnsavedChanges()).toBe(false);
    });

    it('should mark as unsaved', () => {
      markUnsaved();
      expect(getHasUnsavedChanges()).toBe(true);
    });

    it('should reset unsaved changes', () => {
      markUnsaved();
      resetUnsaved();
      expect(getHasUnsavedChanges()).toBe(false);
    });

    it('should reset unsaved on destroy', async () => {
      markUnsaved();
      await destroy();
      expect(getHasUnsavedChanges()).toBe(false);
    });

    it('should return null unload warning when no unsaved changes', () => {
      expect(getUnloadWarning()).toBeNull();
    });

    it('should return warning string when there are unsaved changes', () => {
      markUnsaved();
      const warning = getUnloadWarning();
      expect(warning).toBeTruthy();
      expect(typeof warning).toBe('string');
    });

    it('should return null warning after resetting unsaved', () => {
      markUnsaved();
      resetUnsaved();
      expect(getUnloadWarning()).toBeNull();
    });
  });

  // ============================================================
  // 4. Auto-save Interval
  // ============================================================

  describe('Auto-save Interval', () => {
    it('should have default interval of 3 minutes (180000ms)', () => {
      expect(getAutoSaveIntervalMs()).toBe(180000);
    });

    it('should set interval in ms', () => {
      const transport = createMockTransport();
      setTransport(transport);
      setAutoSaveIntervalMs(120000);
      expect(getAutoSaveIntervalMs()).toBe(120000);
    });

    it('should clamp interval to minimum 60000ms (1 minute)', () => {
      const transport = createMockTransport();
      setTransport(transport);
      setAutoSaveIntervalMs(1000);
      expect(getAutoSaveIntervalMs()).toBe(60000);
    });

    it('should clamp interval to maximum 3600000ms (1 hour)', () => {
      const transport = createMockTransport();
      setTransport(transport);
      setAutoSaveIntervalMs(5000000);
      expect(getAutoSaveIntervalMs()).toBe(3600000);
    });

    it('should set interval in minutes', () => {
      const transport = createMockTransport();
      setTransport(transport);
      setAutoSaveIntervalMinutes(5);
      expect(getAutoSaveIntervalMs()).toBe(300000);
    });

    it('should get interval in minutes', () => {
      const transport = createMockTransport();
      setTransport(transport);
      setAutoSaveIntervalMs(120000);
      expect(getAutoSaveIntervalMinutes()).toBe(2);
    });

    it('should round interval in minutes correctly', () => {
      const transport = createMockTransport();
      setTransport(transport);
      // 180000ms = 3 min exactly
      expect(getAutoSaveIntervalMinutes()).toBe(3);
    });

    it('should clamp minutes to 1 min minimum', () => {
      const transport = createMockTransport();
      setTransport(transport);
      setAutoSaveIntervalMinutes(0);
      expect(getAutoSaveIntervalMs()).toBe(60000);
      expect(getAutoSaveIntervalMinutes()).toBe(1);
    });

    it('should clamp minutes to 60 min maximum', () => {
      const transport = createMockTransport();
      setTransport(transport);
      setAutoSaveIntervalMinutes(100);
      expect(getAutoSaveIntervalMs()).toBe(3600000);
      expect(getAutoSaveIntervalMinutes()).toBe(60);
    });

    it('should reset interval on destroy', async () => {
      const transport = createMockTransport();
      setTransport(transport);
      setAutoSaveIntervalMinutes(10);
      await destroy();
      expect(getAutoSaveIntervalMs()).toBe(180000);
    });

    it('should call setDebounceMs on the save queue', () => {
      const transport = createMockTransport();
      setTransport(transport);
      setAutoSaveIntervalMs(120000);
      expect(mockSaveQueueInstance.setDebounceMs).toHaveBeenCalledWith(120000);
    });
  });

  // ============================================================
  // 5. Auto-save Enable/Disable
  // ============================================================

  describe('Auto-save Enable/Disable', () => {
    it('should start disabled', () => {
      expect(isAutoSaveEnabled()).toBe(false);
    });

    it('should be enabled after calling enableAutoSave', () => {
      enableAutoSave();
      expect(isAutoSaveEnabled()).toBe(true);
    });

    it('should be disabled after calling disableAutoSave', () => {
      enableAutoSave();
      disableAutoSave();
      expect(isAutoSaveEnabled()).toBe(false);
    });

    it('should be disabled after destroy', async () => {
      enableAutoSave();
      await destroy();
      expect(isAutoSaveEnabled()).toBe(false);
    });

    it('should be idempotent — calling enable twice does not break', () => {
      enableAutoSave();
      enableAutoSave();
      expect(isAutoSaveEnabled()).toBe(true);
      disableAutoSave();
      expect(isAutoSaveEnabled()).toBe(false);
    });
  });

  // ============================================================
  // 6. Save Status
  // ============================================================

  describe('Save Status', () => {
    it('should return idle when no save queue exists', () => {
      expect(getSaveStatus()).toBe('idle');
    });

    it('should return idle when save queue is idle and no lastSave', () => {
      setTransport(createMockTransport());
      expect(getSaveStatus()).toBe('idle');
    });

    it('should return saved when queue has lastSave and no unsaved changes', () => {
      setTransport(createMockTransport());
      setCurrentProjectId('test-proj');
      mockSaveQueueInstance.lastSave = Date.now();
      mockSaveQueueInstance.status = 'idle';
      mockSaveQueueInstance.error = null;
      expect(getSaveStatus()).toBe('saved');
    });

    it('should return idle when queue has lastSave but unsaved changes exist', () => {
      setTransport(createMockTransport());
      mockSaveQueueInstance.lastSave = Date.now();
      mockSaveQueueInstance.status = 'idle';
      mockSaveQueueInstance.error = null;
      markUnsaved();
      expect(getSaveStatus()).toBe('idle');
    });

    it('should return saving when queue status is saving', () => {
      setTransport(createMockTransport());
      mockSaveQueueInstance.status = 'saving';
      mockSaveQueueInstance.error = null;
      expect(getSaveStatus()).toBe('saving');
    });

    it('should return saving when queue status is flushing', () => {
      setTransport(createMockTransport());
      mockSaveQueueInstance.status = 'flushing';
      mockSaveQueueInstance.error = null;
      expect(getSaveStatus()).toBe('saving');
    });

    it('should return error when queue has an error', () => {
      setTransport(createMockTransport());
      mockSaveQueueInstance.status = 'idle';
      mockSaveQueueInstance.error = 'Network error';
      expect(getSaveStatus()).toBe('error');
    });
  });

  // ============================================================
  // 7. Last Save Time / Error
  // ============================================================

  describe('Last Save Time / Error', () => {
    it('should return 0 for last save time when no queue', () => {
      expect(getLastSaveTime()).toBe(0);
    });

    it('should return null for last save error when no queue', () => {
      expect(getLastSaveError()).toBeNull();
    });

    it('should return last save time from queue', () => {
      setTransport(createMockTransport());
      mockSaveQueueInstance.lastSave = 1234567890;
      expect(getLastSaveTime()).toBe(1234567890);
    });

    it('should return last save error from queue', () => {
      setTransport(createMockTransport());
      mockSaveQueueInstance.error = 'Failed to save';
      expect(getLastSaveError()).toBe('Failed to save');
    });
  });

  // ============================================================
  // 8. Loading Flag
  // ============================================================

  describe('Loading Flag', () => {
    it('should start as false', () => {
      expect(getIsLoadingProject()).toBe(false);
    });

    it('should reset to false on destroy', async () => {
      await destroy();
      expect(getIsLoadingProject()).toBe(false);
    });
  });

  // ============================================================
  // 9. saveProjectAs
  // ============================================================

  describe('saveProjectAs', () => {
    it('should save a new project successfully', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      const result = await saveProjectAs('Test Project');

      expect(result.success).toBe(true);
      expect(result.projectId).toBeTruthy();
      expect(transport.createProject).toHaveBeenCalledOnce();
    });

    it('should set current project ID and name after saving', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      await saveProjectAs('My Project');

      expect(getCurrentProjectId()).toBeTruthy();
      expect(getCurrentProjectName()).toBe('My Project');
    });

    it('should clear unsaved changes after saving', async () => {
      const transport = createMockTransport();
      setTransport(transport);
      markUnsaved();

      await saveProjectAs('My Project');

      expect(getHasUnsavedChanges()).toBe(false);
    });

    it('should reset save queue version after saving', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      await saveProjectAs('My Project');

      expect(mockSaveQueueInstance.resetVersion).toHaveBeenCalled();
    });

    it('should return error when transport fails', async () => {
      const transport = createMockTransport();
      (transport.createProject as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('DB error')
      );
      setTransport(transport);

      const result = await saveProjectAs('Failing Project');

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
    });
  });

  // ============================================================
  // 10. saveCurrentProject
  // ============================================================

  describe('saveCurrentProject', () => {
    it('should create new project if no current project ID', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      const result = await saveCurrentProject();

      expect(result.success).toBe(true);
      expect(transport.createProject).toHaveBeenCalled();
    });

    it('should update existing project via save queue when project ID is set', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      setCurrentProjectId('existing-proj');
      setCurrentProjectName('Existing Project');

      const result = await saveCurrentProject();

      expect(result.success).toBe(true);
      expect(result.projectId).toBe('existing-proj');
      expect(mockSaveQueueInstance.enqueue).toHaveBeenCalled();
    });

    it('should clear unsaved changes after successful update', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      setCurrentProjectId('existing-proj');
      markUnsaved();

      await saveCurrentProject();

      expect(getHasUnsavedChanges()).toBe(false);
    });

    it('should not clear unsaved changes if queue enqueue fails', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      setCurrentProjectId('existing-proj');
      markUnsaved();
      mockSaveQueueInstance.enqueue.mockResolvedValueOnce(false);

      await saveCurrentProject();

      expect(getHasUnsavedChanges()).toBe(true);
    });

    it('should use provided name when updating existing project', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      setCurrentProjectId('existing-proj');

      const result = await saveCurrentProject('Custom Name');

      expect(result.success).toBe(true);
    });

    it('should return error on exception', async () => {
      const transport = createMockTransport();
      (transport.createProject as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Unexpected error')
      );
      setTransport(transport);

      const result = await saveCurrentProject();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected error');
    });
  });

  // ============================================================
  // 11. loadProject
  // ============================================================

  describe('loadProject', () => {
    it('should load a project successfully', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      const createResult = await transport.createProject({
        name: 'Load Test',
        version: '1.0',
        groups: '[]',
        phrases: '[]',
        phraseCount: 0,
        minusWords: '[]',
        settings: '{}',
        uiState: '{}',
      });

      const result = await loadProject(createResult.id);

      expect(result.success).toBe(true);
      expect(result.project).toBeDefined();
      expect(result.project!.name).toBe('Load Test');
    });

    it('should set current project ID and name after loading', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      const createResult = await transport.createProject({
        name: 'Loaded Project',
        version: '1.0',
        groups: '[]',
        phrases: '[]',
        phraseCount: 0,
        minusWords: '[]',
        settings: '{}',
        uiState: '{}',
      });

      await loadProject(createResult.id);

      expect(getCurrentProjectId()).toBe(createResult.id);
      expect(getCurrentProjectName()).toBe('Loaded Project');
    });

    it('should clear unsaved changes after loading', async () => {
      const transport = createMockTransport();
      setTransport(transport);
      markUnsaved();

      const createResult = await transport.createProject({
        name: 'Test',
        version: '1.0',
        groups: '[]',
        phrases: '[]',
        phraseCount: 0,
        minusWords: '[]',
        settings: '{}',
        uiState: '{}',
      });

      await loadProject(createResult.id);

      expect(getHasUnsavedChanges()).toBe(false);
    });

    it('should reset state version after loading', async () => {
      const transport = createMockTransport();
      setTransport(transport);
      incrementStateVersion();
      incrementStateVersion();

      const createResult = await transport.createProject({
        name: 'Test',
        version: '1.0',
        groups: '[]',
        phrases: '[]',
        phraseCount: 0,
        minusWords: '[]',
        settings: '{}',
        uiState: '{}',
      });

      await loadProject(createResult.id);

      expect(getStateVersion()).toBe(0);
    });

    it('should reset save queue version after loading', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      const createResult = await transport.createProject({
        name: 'Test',
        version: '1.0',
        groups: '[]',
        phrases: '[]',
        phraseCount: 0,
        minusWords: '[]',
        settings: '{}',
        uiState: '{}',
      });

      await loadProject(createResult.id);

      expect(mockSaveQueueInstance.resetVersion).toHaveBeenCalled();
    });

    it('should return error when project not found', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      const result = await loadProject('nonexistent-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Project not found');
    });

    it('should not set current project ID when project not found', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      await loadProject('nonexistent-id');

      expect(getCurrentProjectId()).toBeNull();
    });

    it('should reset loading flag after not found', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      await loadProject('nonexistent-id');

      expect(getIsLoadingProject()).toBe(false);
    });

    it('should provide double-load protection', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      const createResult = await transport.createProject({
        name: 'Double Load',
        version: '1.0',
        groups: '[]',
        phrases: '[]',
        phraseCount: 0,
        minusWords: '[]',
        settings: '{}',
        uiState: '{}',
      });

      // Call loadProject twice simultaneously — both should succeed
      const [result1, result2] = await Promise.all([
        loadProject(createResult.id),
        loadProject(createResult.id),
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it('should handle migration failure gracefully', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      vi.mocked(migrateProject).mockReturnValueOnce({
        success: false,
        error: 'Migration failed: incompatible version',
      } as any);

      const createResult = await transport.createProject({
        name: 'Migration Fail',
        version: '1.0',
        groups: '[]',
        phrases: '[]',
        phraseCount: 0,
        minusWords: '[]',
        settings: '{}',
        uiState: '{}',
      });

      const result = await loadProject(createResult.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Migration failed');
      expect(getIsLoadingProject()).toBe(false);
    });

    it('should reset loading flag after transport error', async () => {
      const transport = createMockTransport();
      (transport.getProject as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network failure')
      );
      setTransport(transport);

      await loadProject('some-id');

      expect(getIsLoadingProject()).toBe(false);
    });

    it('should create backup before loading if there are unsaved changes', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      setCurrentProjectId('old-project');
      setCurrentProjectName('Old Project');
      markUnsaved();

      const createResult = await transport.createProject({
        name: 'New Project',
        version: '1.0',
        groups: '[]',
        phrases: '[]',
        phraseCount: 0,
        minusWords: '[]',
        settings: '{}',
        uiState: '{}',
      });

      await loadProject(createResult.id);

      expect(mockBackupManagerInstance.createBackup).toHaveBeenCalled();
    });
  });

  // ============================================================
  // 12. listProjects
  // ============================================================

  describe('listProjects', () => {
    it('should list projects successfully', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      await transport.createProject({
        name: 'Project A',
        groups: '[]',
        phrases: '[]',
        phraseCount: 0,
        minusWords: '[]',
      });
      await transport.createProject({
        name: 'Project B',
        groups: '[]',
        phrases: '[]',
        phraseCount: 0,
        minusWords: '[]',
      });

      const result = await listProjects();

      expect(result.success).toBe(true);
      expect(result.projects).toHaveLength(2);
    });

    it('should return empty list when no projects', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      const result = await listProjects();

      expect(result.success).toBe(true);
      expect(result.projects).toHaveLength(0);
    });

    it('should return success with empty list on transport error', async () => {
      const transport = createMockTransport();
      (transport.listProjects as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('DB down')
      );
      setTransport(transport);

      const result = await listProjects();

      expect(result.success).toBe(true);
      expect(result.projects).toHaveLength(0);
      expect(result.error).toBe('DB down');
    });
  });

  // ============================================================
  // 13. deleteProject
  // ============================================================

  describe('deleteProject', () => {
    it('should delete a project successfully', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      const createResult = await transport.createProject({
        name: 'To Delete',
        groups: '[]',
        phrases: '[]',
        phraseCount: 0,
        minusWords: '[]',
      });

      const result = await deleteProject(createResult.id);

      expect(result.success).toBe(true);
      expect(transport.deleteProject).toHaveBeenCalledWith(createResult.id);
    });

    it('should clear current project if it is the one deleted', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      const createResult = await transport.createProject({
        name: 'Current Project',
        groups: '[]',
        phrases: '[]',
        phraseCount: 0,
        minusWords: '[]',
      });

      setCurrentProjectId(createResult.id);
      setCurrentProjectName('Current Project');

      await deleteProject(createResult.id);

      expect(getCurrentProjectId()).toBeNull();
      expect(getCurrentProjectName()).toBeNull();
    });

    it('should not clear current project if a different one is deleted', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      const createResult = await transport.createProject({
        name: 'Other Project',
        groups: '[]',
        phrases: '[]',
        phraseCount: 0,
        minusWords: '[]',
      });

      setCurrentProjectId('current-proj');
      setCurrentProjectName('Current');

      await deleteProject(createResult.id);

      expect(getCurrentProjectId()).toBe('current-proj');
      expect(getCurrentProjectName()).toBe('Current');
    });

    it('should attempt to delete backups when deleting a project', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      const createResult = await transport.createProject({
        name: 'With Backups',
        groups: '[]',
        phrases: '[]',
        phraseCount: 0,
        minusWords: '[]',
      });

      await deleteProject(createResult.id);

      expect(transport.deleteBackups).toHaveBeenCalledWith(createResult.id);
    });

    it('should return error on transport failure', async () => {
      const transport = createMockTransport();
      (transport.deleteProject as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Cannot delete')
      );
      setTransport(transport);

      const result = await deleteProject('some-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot delete');
    });
  });

  // ============================================================
  // 14. exportProject
  // ============================================================

  describe('exportProject', () => {
    it('should export project successfully', () => {
      setCurrentProjectName('Export Test');

      const result = exportProject();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should use provided name for export', () => {
      const result = exportProject('Custom Export Name');

      expect(result.success).toBe(true);
    });

    it('should use current project name when no name provided', () => {
      setCurrentProjectName('Current Name');

      const result = exportProject();

      expect(result.success).toBe(true);
    });

    it('should return error on exception', () => {
      vi.mocked(extractProjectState).mockImplementationOnce(() => {
        throw new Error('Extraction failed');
      });

      const result = exportProject();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Extraction failed');
    });
  });

  // ============================================================
  // 15. importProjectFromString
  // ============================================================

  describe('importProjectFromString', () => {
    it('should import a valid .kcproj JSON string', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      vi.mocked(parseKcproj).mockReturnValueOnce({
        version: '1.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        name: 'Import Test',
        state: {
          groups: [],
          phrases: [],
          minusWords: [],
          settings: {},
          uiState: {},
        },
      });

      const result = await importProjectFromString('{}');

      expect(result.success).toBe(true);
      expect(result.projectId).toBeTruthy();
    });

    it('should override project name when provided', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      vi.mocked(parseKcproj).mockReturnValueOnce({
        version: '1.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        name: 'Original Name',
        state: {
          groups: [],
          phrases: [],
          minusWords: [],
          settings: {},
          uiState: {},
        },
      });

      await importProjectFromString('{}', 'Custom Name');

      expect(getCurrentProjectName()).toBe('Custom Name');
    });

    it('should set current project ID and name after import', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      vi.mocked(parseKcproj).mockReturnValueOnce({
        version: '1.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        name: 'Imported Project',
        state: {
          groups: [],
          phrases: [],
          minusWords: [],
          settings: {},
          uiState: {},
        },
      });

      await importProjectFromString('{}');

      expect(getCurrentProjectId()).toBeTruthy();
      expect(getCurrentProjectName()).toBe('Imported Project');
    });

    it('should reset state version after import', async () => {
      const transport = createMockTransport();
      setTransport(transport);
      incrementStateVersion();

      vi.mocked(parseKcproj).mockReturnValueOnce({
        version: '1.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        name: 'Import Test',
        state: {
          groups: [],
          phrases: [],
          minusWords: [],
          settings: {},
          uiState: {},
        },
      });

      await importProjectFromString('{}');

      expect(getStateVersion()).toBe(0);
    });

    it('should return error on parse failure', async () => {
      vi.mocked(parseKcproj).mockImplementationOnce(() => {
        throw new Error('Invalid JSON format');
      });

      const result = await importProjectFromString('not valid json');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid JSON format');
    });

    it('should return error on migration failure', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      vi.mocked(parseKcproj).mockReturnValueOnce({
        version: '2.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        name: 'Future Project',
        state: {
          groups: [],
          phrases: [],
          minusWords: [],
          settings: {},
          uiState: {},
        },
      });

      vi.mocked(migrateProject).mockReturnValueOnce({
        success: false,
        error: 'Incompatible version',
      } as any);

      const result = await importProjectFromString('{}');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Incompatible version');
    });

    it('should return error on transport failure', async () => {
      const transport = createMockTransport();
      (transport.createProject as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('DB write failed')
      );
      setTransport(transport);

      vi.mocked(parseKcproj).mockReturnValueOnce({
        version: '1.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        name: 'Import Fail',
        state: {
          groups: [],
          phrases: [],
          minusWords: [],
          settings: {},
          uiState: {},
        },
      });

      const result = await importProjectFromString('{}');

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB write failed');
    });
  });

  // ============================================================
  // 16. flushSaveQueue
  // ============================================================

  describe('flushSaveQueue', () => {
    it('should delegate to save queue flush', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      await flushSaveQueue();

      expect(mockSaveQueueInstance.flush).toHaveBeenCalled();
    });
  });

  // ============================================================
  // 17. destroy
  // ============================================================

  describe('destroy', () => {
    it('should reset all module state', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      setCurrentProjectId('proj-1');
      setCurrentProjectName('Test');
      markUnsaved();
      incrementStateVersion();
      incrementStateVersion();
      setAutoSaveIntervalMinutes(10);

      await destroy();

      expect(getCurrentProjectId()).toBeNull();
      expect(getCurrentProjectName()).toBeNull();
      expect(getHasUnsavedChanges()).toBe(false);
      expect(getStateVersion()).toBe(0);
      expect(getAutoSaveIntervalMs()).toBe(180000);
      expect(isAutoSaveEnabled()).toBe(false);
      expect(getIsLoadingProject()).toBe(false);
    });

    it('should destroy save queue if it exists', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      await destroy();

      expect(mockSaveQueueInstance.destroy).toHaveBeenCalled();
    });

    it('should be safe to call destroy when no queue exists', () => {
      expect(() => destroy()).not.toThrow();
    });

    it('should disable auto-save on destroy', async () => {
      enableAutoSave();
      await destroy();
      expect(isAutoSaveEnabled()).toBe(false);
    });

    it('should clear current load promise on destroy', async () => {
      // Ensure no pending load promise
      await destroy();
      expect(getIsLoadingProject()).toBe(false);
    });
  });

  // ============================================================
  // 18. recoverFromCrash
  // ============================================================

  describe('recoverFromCrash', () => {
    it('should recover using the latest non-backup project', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      const createResult = await transport.createProject({
        name: 'Recoverable',
        version: '1.0',
        groups: '[]',
        phrases: '[]',
        phraseCount: 0,
        minusWords: '[]',
        settings: '{}',
        uiState: '{}',
      });

      const result = await recoverFromCrash();

      expect(result.success).toBe(true);
      expect(result.project).toBeDefined();
      expect(result.project!.id).toBe(createResult.id);
    });

    it('should return error when no projects or backups found', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      const result = await recoverFromCrash();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No projects');
    });

    it('should handle transport error', async () => {
      const transport = createMockTransport();
      (transport.listProjects as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Connection failed')
      );
      setTransport(transport);

      const result = await recoverFromCrash();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
    });
  });

  // ============================================================
  // 19. hasCrashRecovery
  // ============================================================

  describe('hasCrashRecovery', () => {
    it('should return true when projects exist', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      await transport.createProject({
        name: 'Existing',
        groups: '[]',
        phrases: '[]',
        phraseCount: 0,
        minusWords: '[]',
      });

      expect(await hasCrashRecovery()).toBe(true);
    });

    it('should return false when no projects exist', async () => {
      const transport = createMockTransport();
      setTransport(transport);

      expect(await hasCrashRecovery()).toBe(false);
    });

    it('should return false on transport error', async () => {
      const transport = createMockTransport();
      (transport.listProjects as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      );
      setTransport(transport);

      expect(await hasCrashRecovery()).toBe(false);
    });
  });
});
