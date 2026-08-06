// ============================================================
// Tests: Project System — Service Layer & Transport
// Tests the project service API, transport layer, and
// overall project lifecycle using a mock transport.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProjectListItem } from '@/plugin-sdk';
import type { ProjectTransport, ProjectRecord } from '@/core/project-types';
import { useSettingsStore } from '@/plugin-sdk';
import { useAppStore } from '@/core/store';

function createMockTransport(): ProjectTransport {
  const projects = new Map<string, ProjectRecord>();
  let idCounter = 0;

  return {
    createProject: async (params) => {
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
      if (params.name !== undefined) existing.name = params.name;
      if (params.version !== undefined) existing.version = params.version;
      if (params.groups !== undefined) existing.groups = JSON.parse(params.groups);
      if (params.phrases !== undefined) existing.phrases = JSON.parse(params.phrases);
      if (params.minusWords !== undefined) existing.minusWords = JSON.parse(params.minusWords);
      if (params.settings !== undefined) existing.settings = JSON.parse(params.settings);
      if (params.uiState !== undefined) existing.uiState = JSON.parse(params.uiState);
      existing.updatedAt = new Date().toISOString();
      return true;
    },

    getProject: async (id) => {
      return projects.get(id) ?? null;
    },

    listProjects: async (includeBackups = false) => {
      const items: ProjectListItem[] = [];
      for (const [id, r] of projects) {
        if (!includeBackups && r.isBackup) continue;
        items.push({
          id,
          name: r.name,
          version: r.version,
          phraseCount: r.phrases.length,
          groupCount: r.groups.filter(g => !g.isTrash).length,
          isBackup: r.isBackup,
          parentProjectId: r.parentProjectId,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        });
      }
      return items;
    },

    deleteProject: async (id) => {
      return projects.delete(id);
    },

    createBackup: async (parentProjectId) => {
      const original = projects.get(parentProjectId);
      if (!original) return null;
      const backupId = `backup-${++idCounter}`;
      const backup: ProjectRecord = {
        ...original,
        id: backupId,
        name: `${original.name} (backup)`,
        isBackup: true,
        parentProjectId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      projects.set(backupId, backup);
      return { id: backupId };
    },

    getLatestBackup: async (parentProjectId) => {
      let latest: ProjectRecord | null = null;
      for (const r of projects.values()) {
        if (r.isBackup && r.parentProjectId === parentProjectId) {
          if (!latest || r.updatedAt > latest.updatedAt) {
            latest = r;
          }
        }
      }
      return latest;
    },

    countBackups: async (parentProjectId) => {
      let count = 0;
      for (const r of projects.values()) {
        if (r.isBackup && r.parentProjectId === parentProjectId) count++;
      }
      return count;
    },

    pruneBackups: async (parentProjectId, keepCount) => {
      const backups = [];
      for (const [id, r] of projects) {
        if (r.isBackup && r.parentProjectId === parentProjectId) {
          backups.push({ id, updatedAt: r.updatedAt });
        }
      }
      backups.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      const toDelete = backups.slice(keepCount);
      for (const { id } of toDelete) {
        projects.delete(id);
      }
      return toDelete.length;
    },

    deleteBackups: async (parentProjectId) => {
      let count = 0;
      for (const [id, r] of projects) {
        if (r.isBackup && r.parentProjectId === parentProjectId) {
          projects.delete(id);
          count++;
        }
      }
      return count;
    },

    saveBackupFile: async () => 'backup.kcproj',
    listBackupFiles: async () => [],
    readBackupFile: async () => null,
    pruneBackupFiles: async () => 0,
    listSnapshots: vi.fn(),
    getSnapshotBackupData: vi.fn(),
    deleteSnapshot: vi.fn(),
  };
}

// ---- Service Layer Unit Tests ----

describe('Project Service — Unit Tests', () => {
  beforeEach(() => {
    useAppStore.getState().clearAll();
  });

  it('should have saveProjectAs function', async () => {
    const mod = await import('@/core/project-service');
    expect(typeof mod.saveProjectAs).toBe('function');
  });

  it('should have loadProject function', async () => {
    const mod = await import('@/core/project-service');
    expect(typeof mod.loadProject).toBe('function');
  });

  it('should have listProjects function', async () => {
    const mod = await import('@/core/project-service');
    expect(typeof mod.listProjects).toBe('function');
  });

  it('should have deleteProject function', async () => {
    const mod = await import('@/core/project-service');
    expect(typeof mod.deleteProject).toBe('function');
  });

  it('should have exportProject function', async () => {
    const mod = await import('@/core/project-service');
    expect(typeof mod.exportProject).toBe('function');
  });

  it('should have importProject function', async () => {
    const mod = await import('@/core/project-service');
    expect(typeof mod.importProject).toBe('function');
  });

  it('should have enableAutoSave / disableAutoSave functions', async () => {
    const mod = await import('@/core/project-service');
    expect(typeof mod.enableAutoSave).toBe('function');
    expect(typeof mod.disableAutoSave).toBe('function');
    expect(typeof mod.isAutoSaveEnabled).toBe('function');
  });

  it('should have recoverFromCrash function', async () => {
    const mod = await import('@/core/project-service');
    expect(typeof mod.recoverFromCrash).toBe('function');
  });

  it('should have getCurrentProjectId / setCurrentProjectId functions', async () => {
    const mod = await import('@/core/project-service');
    expect(typeof mod.getCurrentProjectId).toBe('function');
    expect(typeof mod.setCurrentProjectId).toBe('function');
  });

  it('should have hasUnsavedChanges tracking', async () => {
    const mod = await import('@/core/project-service');
    expect(typeof mod.getHasUnsavedChanges).toBe('function');
    expect(typeof mod.markUnsaved).toBe('function');
    expect(typeof mod.resetUnsaved).toBe('function');
    expect(typeof mod.getUnloadWarning).toBe('function');
  });

  it('should have flushSaveQueue function', async () => {
    const mod = await import('@/core/project-service');
    expect(typeof mod.flushSaveQueue).toBe('function');
  });

  it('should track current project ID', async () => {
    const mod = await import('@/core/project-service');
    mod.setCurrentProjectId(null);
    expect(mod.getCurrentProjectId()).toBeNull();
    mod.setCurrentProjectId('test-id');
    expect(mod.getCurrentProjectId()).toBe('test-id');
    mod.setCurrentProjectId(null);
  });
});

// ---- Service with Mock Transport (Integration) ----

describe('Project Service — Integration with Mock Transport', () => {
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

  it('should save a project via transport', async () => {
    const { saveProjectAs, getCurrentProjectId } = await import('@/core/project-service');
    const store = useAppStore.getState();
    store.addGroup('Test Group');

    const result = await saveProjectAs('Test Project');

    expect(result.success).toBe(true);
    expect(result.projectId).toBeTruthy();
    expect(getCurrentProjectId()).toBe(result.projectId);
  });

  it('should load a project via transport', async () => {
    const { saveProjectAs, loadProject, getCurrentProjectId } = await import('@/core/project-service');
    const store = useAppStore.getState();
    store.addGroup('Group to Save');

    // Save
    const saveResult = await saveProjectAs('Project A');
    expect(saveResult.success).toBe(true);

    // Clear Zustand
    useAppStore.getState().clearAll();
    expect(useAppStore.getState().groups).toHaveLength(0);

    // Load
    const loadResult = await loadProject(saveResult.projectId);
    expect(loadResult.success).toBe(true);
    expect(getCurrentProjectId()).toBe(saveResult.projectId);
  });

  it('should list projects via transport', async () => {
    const { saveProjectAs, listProjects } = await import('@/core/project-service');
    const store = useAppStore.getState();
    store.addGroup('List Test');

    await saveProjectAs('Project 1');
    await saveProjectAs('Project 2');

    const result = await listProjects();
    expect(result.success).toBe(true);
    expect(result.projects.length).toBeGreaterThanOrEqual(2);
  });

  it('should delete a project via transport', async () => {
    const { saveProjectAs, deleteProject, getCurrentProjectId } = await import('@/core/project-service');
    const store = useAppStore.getState();
    store.addGroup('Delete Test');

    const saveResult = await saveProjectAs('To Delete');
    expect(saveResult.success).toBe(true);

    const deleteResult = await deleteProject(saveResult.projectId);
    expect(deleteResult.success).toBe(true);
    expect(getCurrentProjectId()).toBeNull();
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

  it('should import a project from a .kcproj string', async () => {
    const { importProjectFromString, getCurrentProjectId } = await import('@/core/project-service');
    useAppStore.getState().clearAll();

    const kcprojJson = JSON.stringify({
      version: '1.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      name: 'Import Test',
      state: {
        groups: [{ id: 'ig1', name: 'Imported Group', parentId: null, isExpanded: true, isTrash: false, createdAt: Date.now() }],
        phrases: [{ id: 'ip1', text: 'импортированная фраза', groupId: 'ig1', frequency: 50, createdAt: Date.now() }],
        minusWords: [],
        settings: {},
        uiState: {},
      },
    });

    const result = await importProjectFromString(kcprojJson);
    expect(result.success).toBe(true);
    expect(result.projectId).toBeTruthy();

    // Verify data was loaded into Zustand
    const state = useAppStore.getState();
    expect(state.phrases.some(p => p.text === 'импортированная фраза')).toBe(true);

    useAppStore.getState().clearAll();
  });
});

// ---- Project Types Validation ----

describe('Project Types', () => {
  it('should have correct PROJECT_FORMAT_VERSION', async () => {
    const mod = await import('@/core/project-types');
    expect(mod.PROJECT_FORMAT_VERSION).toBe('1.0');
  });

  it('should define ProjectTransport interface', async () => {
    const mod = await import('@/core/project-types');
    // Type-only checks — verify the module exports exist
    expect(mod.PROJECT_FORMAT_VERSION).toBeTruthy();
  });
});
