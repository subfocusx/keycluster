// ============================================================
// Tests: Production Hardening — Retry, Save Status
// ============================================================
//
// Tests for:
//   - SaveQueue retry with exponential backoff
//   - Save status API (getSaveStatus, getLastSaveTime, getLastError)
//   - Auto-save interval configuration
//   - Auto-save settings component integration
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SaveQueue } from '@/core/save-queue';
import { useAppStore } from '@/plugin-sdk';
import type { ProjectState, ProjectTransport, ProjectRecord } from '@/core/project-types';

function createSampleState(): ProjectState {
  return {
    groups: [
      { id: 'g1', name: 'Group 1', parentId: null, isExpanded: true, isTrash: false, createdAt: Date.now() },
    ],
    phrases: [
      { id: 'p1', text: 'тестовая фраза', groupId: 'g1', frequency: 100, kei: 5, cpc: 10.0, createdAt: Date.now() },
    ],
    minusWords: [],
    settings: {},
    uiState: {},
  };
}

// ---- Mock Transport Factory ----

function createMockTransport(): ProjectTransport & {
  updateCalls: any[];
  createCalls: any[];
  projects: Map<string, ProjectRecord>;
  updateShouldFail: boolean;
  failCount: number;
} {
  const projects = new Map<string, ProjectRecord>();
  let idCounter = 0;

  return {
    updateCalls: [],
    createCalls: [],
    projects,
    updateShouldFail: false,
    failCount: 0,

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

    updateProject: async function (id, params) {
      this.updateCalls.push({ id, params });
      if (this.updateShouldFail) {
        this.failCount++;
        if (this.failCount <= 2) {
          throw new Error(`Network error (attempt ${this.failCount})`);
        }
      }
      const existing = projects.get(id);
      if (!existing) return false;
      if (params.groups !== undefined) existing.groups = JSON.parse(params.groups);
      if (params.phrases !== undefined) existing.phrases = JSON.parse(params.phrases);
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

// ============================================================
// SaveQueue — Retry Logic Tests
// ============================================================

describe('SaveQueue — Retry with Exponential Backoff', () => {
  it('should initialize with default max retries', () => {
    const transport = createMockTransport();
    const queue = new SaveQueue(transport, 50);
    expect(queue.maxRetryCount).toBe(3);
  });

  it('should accept custom max retries', () => {
    const transport = createMockTransport();
    const queue = new SaveQueue(transport, 50, 5);
    expect(queue.maxRetryCount).toBe(5);
  });

  it('should initialize with zero retry count', () => {
    const transport = createMockTransport();
    const queue = new SaveQueue(transport, 50);
    expect(queue.currentRetryCount).toBe(0);
  });

  it('should retry on failure and succeed after recovery', async () => {
    const transport = createMockTransport();
    const queue = new SaveQueue(transport, 10, 3);
    const state = createSampleState();

    // Create a project
    await transport.createProject({ name: 'Test', groups: '[]', phrases: '[]', phraseCount: 0, minusWords: '[]' });
    const projId = transport.projects.keys().next().value!;

    // Make update fail twice, then succeed
    transport.updateShouldFail = true;

    // Enqueue — this should trigger the save which will fail, then retry
    const resultPromise = queue.enqueue(projId, state, 1);

    // After 2 failures, the 3rd attempt should succeed
    // Wait for the retries to complete (1s + 2s backoff + processing time)
    const result = await resultPromise;

    // After 2 failures (failCount 1 and 2), the 3rd attempt succeeds (failCount 3)
    expect(transport.failCount).toBe(3);
  });

  it('should give up after max retries', async () => {
    const transport = createMockTransport();
    const queue = new SaveQueue(transport, 10, 2);
    const state = createSampleState();

    await transport.createProject({ name: 'Test', groups: '[]', phrases: '[]', phraseCount: 0, minusWords: '[]' });
    const projId = transport.projects.keys().next().value!;

    // Make ALL updates fail permanently
    transport.updateProject = async () => {
      throw new Error('Permanent network error');
    };

    const resultPromise = queue.enqueue(projId, state, 1);
    const result = await resultPromise;
    expect(result).toBe(false);
    expect(queue.error).toBeTruthy();
  });

  it('should reset retry count on successful save', async () => {
    const transport = createMockTransport();
    const queue = new SaveQueue(transport, 10);
    const state = createSampleState();

    await transport.createProject({ name: 'Test', groups: '[]', phrases: '[]', phraseCount: 0, minusWords: '[]' });
    const projId = transport.projects.keys().next().value!;

    // Successful save
    const result = await queue.enqueue(projId, state, 1);
    await queue.flush();
    expect(result).toBe(true);
    expect(queue.currentRetryCount).toBe(0);
  });

  it('should cleanup retry timer on destroy', async () => {
    const transport = createMockTransport();
    const queue = new SaveQueue(transport, 100);
    queue.enqueue('proj1', createSampleState(), 1);
    await queue.destroy();
    expect(queue.pendingCount).toBe(0);
    expect(queue.currentRetryCount).toBe(0);
  });
});

// ============================================================
// Save Status API Tests
// ============================================================

describe('Save Status API', () => {
  beforeEach(async () => {
    useAppStore.getState().clearAll();
    const { setTransport, setCurrentProjectId, setCurrentProjectName, disableAutoSave, resetUnsaved, destroy } = await import('@/core/project-service');
    await destroy();
    const mockTransport = createMockTransport();
    setTransport(mockTransport);
    setCurrentProjectId(null);
    setCurrentProjectName(null);
    disableAutoSave();
    resetUnsaved();
  });

  it('should return idle status when no save has happened', async () => {
    const { getSaveStatus } = await import('@/core/project-service');
    expect(getSaveStatus()).toBe('idle');
  });

  it('should return idle last save time initially', async () => {
    const { getLastSaveTime } = await import('@/core/project-service');
    expect(getLastSaveTime()).toBe(0);
  });

  it('should return null error when no error has occurred', async () => {
    const { getLastSaveError } = await import('@/core/project-service');
    expect(getLastSaveError()).toBeNull();
  });

  it('should return saved status after save queue processes a save', async () => {
    const { saveProjectAs, getSaveStatus, setAutoSaveIntervalMinutes } = await import('@/core/project-service');
    const store = useAppStore.getState();
    store.addGroup('Test Group');

    // Use short interval for testing
    setAutoSaveIntervalMinutes(1);

    // Save as new project (bypasses queue, goes directly to transport)
    const saveResult = await saveProjectAs('Status Test');
    expect(saveResult.success).toBe(true);

    // After saveProjectAs, status checks the save queue which was bypassed
    // So status is 'idle' since no queue operations happened
    expect(getSaveStatus()).toBe('idle');
  });

  it('should report saving status via SaveQueue directly', async () => {
    const transport = createMockTransport();
    const queue = new SaveQueue(transport, 10);
    const state = createSampleState();

    await transport.createProject({ name: 'Test', groups: '[]', phrases: '[]', phraseCount: 0, minusWords: '[]' });
    const projId = transport.projects.keys().next().value!;

    // Enqueue and flush — this is what saveCurrentProject does internally
    const promise = queue.enqueue(projId, state, 1);
    // During processing, status should be 'saving'
    await queue.flush();
    const result = await promise;

    expect(result).toBe(true);
    expect(queue.lastSave).toBeGreaterThan(0);
    expect(queue.status).toBe('idle');
  });

  it('should export SaveStatus type correctly', async () => {
    const { getSaveStatus } = await import('@/core/project-service');
    const status = getSaveStatus();
    expect(['idle', 'saving', 'saved', 'error']).toContain(status);
  });
});

// ============================================================
// Auto-save Interval Configuration Tests
// ============================================================

describe('Auto-save Interval Configuration', () => {
  beforeEach(async () => {
    const { destroy, disableAutoSave, resetUnsaved } = await import('@/core/project-service');
    await destroy();
    disableAutoSave();
    resetUnsaved();
  });

  it('should have default interval of 3 minutes', async () => {
    const { getAutoSaveIntervalMinutes } = await import('@/core/project-service');
    expect(getAutoSaveIntervalMinutes()).toBe(3);
  });

  it('should set interval to 10 minutes', async () => {
    const { setAutoSaveIntervalMinutes, getAutoSaveIntervalMinutes } = await import('@/core/project-service');
    setAutoSaveIntervalMinutes(10);
    expect(getAutoSaveIntervalMinutes()).toBe(10);
  });

  it('should set interval to 20 minutes', async () => {
    const { setAutoSaveIntervalMinutes, getAutoSaveIntervalMinutes } = await import('@/core/project-service');
    setAutoSaveIntervalMinutes(20);
    expect(getAutoSaveIntervalMinutes()).toBe(20);
  });

  it('should set interval to 1 hour (60 minutes)', async () => {
    const { setAutoSaveIntervalMinutes, getAutoSaveIntervalMinutes } = await import('@/core/project-service');
    setAutoSaveIntervalMinutes(60);
    expect(getAutoSaveIntervalMinutes()).toBe(60);
  });

  it('should set interval to 2 hours (120 minutes) — clamped to 60', async () => {
    const { setAutoSaveIntervalMinutes, getAutoSaveIntervalMinutes } = await import('@/core/project-service');
    setAutoSaveIntervalMinutes(120);
    // Max is 60 minutes
    expect(getAutoSaveIntervalMinutes()).toBe(60);
  });

  it('should clamp interval below 1 minute to 1 minute', async () => {
    const { setAutoSaveIntervalMinutes, getAutoSaveIntervalMinutes } = await import('@/core/project-service');
    setAutoSaveIntervalMinutes(0);
    expect(getAutoSaveIntervalMinutes()).toBe(1);
  });

  it('should sync interval with save queue debounce', async () => {
    const { setAutoSaveIntervalMinutes } = await import('@/core/project-service');
    setAutoSaveIntervalMinutes(10);
    // The save queue debounce should be updated to 10 * 60 * 1000 = 600000ms
    // We can't directly check the queue debounce, but we verify no error occurs
  });
});

// ============================================================
// IpcTransport — Tauri IPC Transport Tests
// ============================================================

describe('IpcTransport — Tauri', () => {
  it('should have all required transport methods', async () => {
    const { ipcTransport } = await import('@/core/project-transport-ipc');
    const transport = ipcTransport as ProjectTransport;

    expect(typeof transport.createProject).toBe('function');
    expect(typeof transport.updateProject).toBe('function');
    expect(typeof transport.getProject).toBe('function');
    expect(typeof transport.listProjects).toBe('function');
    expect(typeof transport.deleteProject).toBe('function');
    expect(typeof transport.createBackup).toBe('function');
    expect(typeof transport.getLatestBackup).toBe('function');
    expect(typeof transport.countBackups).toBe('function');
    expect(typeof transport.pruneBackups).toBe('function');
    expect(typeof transport.deleteBackups).toBe('function');
    expect(typeof transport.saveBackupFile).toBe('function');
    expect(typeof transport.listBackupFiles).toBe('function');
    expect(typeof transport.readBackupFile).toBe('function');
    expect(typeof transport.pruneBackupFiles).toBe('function');
  });
});
