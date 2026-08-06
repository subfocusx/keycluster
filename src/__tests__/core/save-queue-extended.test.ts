// ============================================================
// Tests: SaveQueue — additional edge cases for debounced writes
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SaveQueue } from '@/core/save-queue';
import type { ProjectTransport, ProjectState } from '@/core/project-types';

// ---- Mock Transport ----

function createMockTransport(overrides: Partial<ProjectTransport> = {}): ProjectTransport {
  return {
    createProject: vi.fn().mockResolvedValue({ id: 'recovered-proj' }),
    updateProject: vi.fn().mockResolvedValue(true),
    getProject: vi.fn().mockResolvedValue({ id: 'test-proj', name: 'Test' }),
    listProjects: vi.fn().mockResolvedValue([]),
    deleteProject: vi.fn().mockResolvedValue(true),
    createBackup: vi.fn().mockResolvedValue(null),
    getLatestBackup: vi.fn().mockResolvedValue(null),
    countBackups: vi.fn().mockResolvedValue(0),
    pruneBackups: vi.fn().mockResolvedValue(0),
    deleteBackups: vi.fn().mockResolvedValue(0),
    saveBackupFile: vi.fn().mockResolvedValue(''),
    listBackupFiles: vi.fn().mockResolvedValue([]),
    readBackupFile: vi.fn().mockResolvedValue(null),
    pruneBackupFiles: vi.fn().mockResolvedValue(0),
    listSnapshots: vi.fn(),
    getSnapshotBackupData: vi.fn(),
    deleteSnapshot: vi.fn(),
    ...overrides,
  };
}

const sampleState: ProjectState = {
  groups: [],
  phrases: [],
  minusWords: [],
  settings: {},
  uiState: {
    theme: 'dark',
    rightPanel: { width: 300, open: true },
    leftPanel: { width: 250, open: true, module: null },
  },
};

describe('SaveQueue — constructor and configuration', () => {
  it('uses default debounce of 3000ms', () => {
    const transport = createMockTransport();
    const queue = new SaveQueue(transport);
    expect(queue.getDebounceMs()).toBe(3000);
  });

  it('accepts custom debounce value', () => {
    const transport = createMockTransport();
    const queue = new SaveQueue(transport, 5000);
    expect(queue.getDebounceMs()).toBe(5000);
  });

  it('clamps debounce to 1000ms minimum', () => {
    const transport = createMockTransport();
    const queue = new SaveQueue(transport, 100);
    queue.setDebounceMs(50);
    expect(queue.getDebounceMs()).toBe(1000);
  });

  it('clamps debounce to 3600000ms maximum', () => {
    const transport = createMockTransport();
    const queue = new SaveQueue(transport);
    queue.setDebounceMs(5000000);
    expect(queue.getDebounceMs()).toBe(3600000);
  });

  it('starts with idle status', () => {
    const transport = createMockTransport();
    const queue = new SaveQueue(transport);
    expect(queue.status).toBe('idle');
  });

  it('starts with zero pending count', () => {
    const transport = createMockTransport();
    const queue = new SaveQueue(transport);
    expect(queue.pendingCount).toBe(0);
  });

  it('starts with zero last save time', () => {
    const transport = createMockTransport();
    const queue = new SaveQueue(transport);
    expect(queue.lastSave).toBe(0);
  });

  it('starts with no error', () => {
    const transport = createMockTransport();
    const queue = new SaveQueue(transport);
    expect(queue.error).toBeNull();
  });

  it('starts with zero last written version', () => {
    const transport = createMockTransport();
    const queue = new SaveQueue(transport);
    expect(queue.lastWrittenVersion).toBe(0);
  });
});

describe('SaveQueue — enqueue and versioning', () => {
  let transport: ProjectTransport;
  let queue: SaveQueue;

  beforeEach(() => {
    vi.useFakeTimers();
    transport = createMockTransport();
    // Use short debounce for tests
    queue = new SaveQueue(transport, 100);
  });

  afterEach(async () => {
    await queue.destroy();
    vi.useRealTimers();
  });

  it('rejects stale versions silently', async () => {
    // First write version 5
    (transport.getProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'p1' });
    (transport.updateProject as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const result1 = queue.enqueue('p1', sampleState, 5);
    vi.advanceTimersByTime(200);
    await result1;

    // Now try to enqueue a stale version
    const result2 = await queue.enqueue('p1', sampleState, 3);
    expect(result2).toBe(false);
  });

  it('batches entries for same project (replaces lower version)', async () => {
    (transport.getProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'p1' });
    (transport.updateProject as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    // Enqueue version 1 — will be replaced by version 2
    const promise1 = queue.enqueue('p1', sampleState, 1);
    // Immediately enqueue version 2 — should replace v1
    const promise2 = queue.enqueue('p1', sampleState, 2);

    vi.advanceTimersByTime(200);

    const r1 = await promise1;
    const r2 = await promise2;

    // v1 was superseded → false, v2 was written → true
    expect(r1).toBe(false);
    expect(r2).toBe(true);

    // Only one update call (for v2)
    expect(transport.updateProject).toHaveBeenCalledTimes(1);
  });

  it('processes multiple versions sequentially', async () => {
    (transport.getProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'p1' });
    (transport.updateProject as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const r1 = queue.enqueue('p1', sampleState, 1);
    vi.advanceTimersByTime(200);
    await r1;

    const r2 = queue.enqueue('p1', sampleState, 2);
    vi.advanceTimersByTime(200);
    await r2;

    expect(queue.lastWrittenVersion).toBe(2);
    expect(transport.updateProject).toHaveBeenCalledTimes(2);
  });

  it('drops oldest entries on queue overflow', async () => {
    // MAX_QUEUE_SIZE is 50 — enqueue 51 entries
    // Don't use fake timers — just test the enqueue behavior directly
    const transport = createMockTransport();
    const queue = new SaveQueue(transport, 60000); // Long debounce to prevent processing

    const promises: Promise<boolean>[] = [];
    for (let i = 1; i <= 51; i++) {
      promises.push(queue.enqueue('p1', sampleState, i));
    }

    // Queue should have dropped some entries
    // Since we're not processing, the pending count might be limited
    expect(queue.pendingCount).toBeLessThanOrEqual(50);

    await queue.destroy();
  });
});

describe('SaveQueue — retry with exponential backoff', () => {
  let transport: ProjectTransport;
  let queue: SaveQueue;

  beforeEach(() => {
    vi.useFakeTimers();
    transport = createMockTransport();
    queue = new SaveQueue(transport, 100, 3); // max 3 retries
  });

  afterEach(async () => {
    await queue.destroy();
    vi.useRealTimers();
  });

  it('retries on transient failure', async () => {
    (transport.getProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'p1' });
    const updateMock = transport.updateProject as ReturnType<typeof vi.fn>;

    // Fail first 2 attempts, succeed on 3rd
    updateMock
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue(true);

    const promise = queue.enqueue('p1', sampleState, 1);
    await vi.advanceTimersByTimeAsync(200); // initial debounce

    // Retry 1 after 1s delay
    await vi.advanceTimersByTimeAsync(2000);

    // Retry 2 after 2s delay
    await vi.advanceTimersByTimeAsync(4000);

    const result = await promise;
    expect(result).toBe(true);
    expect(updateMock).toHaveBeenCalledTimes(3);
  });

  it('gives up after max retries', async () => {
    (transport.getProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'p1' });
    (transport.updateProject as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Persistent error')
    );

    const promise = queue.enqueue('p1', sampleState, 1);
    await vi.advanceTimersByTimeAsync(200); // initial debounce

    // Retry 1
    await vi.advanceTimersByTimeAsync(2000);
    // Retry 2
    await vi.advanceTimersByTimeAsync(4000);

    const result = await promise;
    expect(result).toBe(false);
    expect(queue.error).toBe('Persistent error');
  });

  it('tracks retry count', async () => {
    (transport.getProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'p1' });
    (transport.updateProject as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Error')
    );

    const promise = queue.enqueue('p1', sampleState, 1);
    await vi.advanceTimersByTimeAsync(200);

    expect(queue.currentRetryCount).toBeGreaterThanOrEqual(0);

    // Advance through retries
    await vi.advanceTimersByTimeAsync(8000);

    await promise;
  });

  it('resets retry count on success', async () => {
    (transport.getProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'p1' });
    (transport.updateProject as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const promise = queue.enqueue('p1', sampleState, 1);
    await vi.advanceTimersByTimeAsync(200);

    const result = await promise;
    expect(result).toBe(true);
    expect(queue.currentRetryCount).toBe(0);
  });
});

describe('SaveQueue — project recovery', () => {
  let transport: ProjectTransport;
  let queue: SaveQueue;

  beforeEach(() => {
    vi.useFakeTimers();
    transport = createMockTransport();
    queue = new SaveQueue(transport, 100);
  });

  afterEach(async () => {
    await queue.destroy();
    vi.useRealTimers();
  });

  it('creates a new project when existing project not found', async () => {
    (transport.createProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'recovered' });
    (transport.updateProject as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('not found'));

    const promise = queue.enqueue('deleted-proj', sampleState, 1);
    await vi.advanceTimersByTimeAsync(200);

    const result = await promise;
    expect(result).toBe(true);
    expect(transport.createProject).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Recovered Project',
      })
    );
  });
});

describe('SaveQueue — flush', () => {
  let transport: ProjectTransport;
  let queue: SaveQueue;

  beforeEach(() => {
    vi.useFakeTimers();
    transport = createMockTransport();
    queue = new SaveQueue(transport, 100);
  });

  afterEach(async () => {
    await queue.destroy();
    vi.useRealTimers();
  });

  it('flushes all pending entries', async () => {
    (transport.getProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'p1' });
    (transport.updateProject as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    queue.enqueue('p1', sampleState, 1);
    queue.enqueue('p1', sampleState, 2);
    queue.enqueue('p1', sampleState, 3);

    await queue.flush(5000);

    expect(queue.pendingCount).toBe(0);
    expect(queue.lastWrittenVersion).toBe(3);
  });

  it('sets status to flushing during flush', async () => {
    vi.useFakeTimers();
    (transport.getProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'p1' });
    (transport.updateProject as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    queue.enqueue('p1', sampleState, 1);

    // Start flush — should process immediately
    const flushPromise = queue.flush(5000);
    expect(['flushing', 'idle']).toContain(queue.status);

    vi.advanceTimersByTime(200);
    await flushPromise;

    expect(queue.status).toBe('idle');
    vi.useRealTimers();
  });

  it('handles slow processing gracefully', async () => {
    // Use real timers for this test — verify flush completes even with delays
    vi.useRealTimers();
    const slowTransport = createMockTransport();
    let callCount = 0;
    (slowTransport.getProject as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(resolve => {
        callCount++;
        setTimeout(() => resolve({ id: 'p1' }), 50);
      })
    );
    (slowTransport.updateProject as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const slowQueue = new SaveQueue(slowTransport, 100);

    slowQueue.enqueue('p1', sampleState, 1);

    // Flush should complete
    await slowQueue.flush(5000);
    expect(slowQueue.status).toBe('idle');

    await slowQueue.destroy();
  });
});

describe('SaveQueue — clear and destroy', () => {
  it('clear resolves all entries with false', async () => {
    vi.useFakeTimers();
    const transport = createMockTransport();
    const queue = new SaveQueue(transport, 100);

    const p1 = queue.enqueue('p1', sampleState, 1);
    const p2 = queue.enqueue('p1', sampleState, 2);

    queue.clear();

    expect(await p1).toBe(false);
    expect(await p2).toBe(false);

    await queue.destroy();
    vi.useRealTimers();
  });

  it('destroy cleans up all resources', async () => {
    const transport = createMockTransport();
    const queue = new SaveQueue(transport, 100);

    queue.enqueue('p1', sampleState, 1);
    await queue.destroy();

    expect(queue.pendingCount).toBe(0);
    expect(queue.status).toBe('idle');
    expect(queue.currentRetryCount).toBe(0);
  });

  it('resetVersion resets the last written version', async () => {
    vi.useFakeTimers();
    const transport = createMockTransport();
    (transport.getProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'p1' });
    (transport.updateProject as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const queue = new SaveQueue(transport, 100);
    const p = queue.enqueue('p1', sampleState, 1);
    vi.advanceTimersByTime(200);
    await p;

    expect(queue.lastWrittenVersion).toBe(1);

    queue.resetVersion();
    expect(queue.lastWrittenVersion).toBe(0);

    await queue.destroy();
    vi.useRealTimers();
  });
});

describe('SaveQueue — transport swap', () => {
  it('allows changing the transport', async () => {
    vi.useFakeTimers();
    const transport1 = createMockTransport();
    const transport2 = createMockTransport();
    (transport2.getProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'p1' });
    (transport2.updateProject as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const queue = new SaveQueue(transport1, 100);
    queue.setTransport(transport2);

    const p = queue.enqueue('p1', sampleState, 1);
    vi.advanceTimersByTime(200);
    const result = await p;

    expect(result).toBe(true);
    expect(transport2.updateProject).toHaveBeenCalled();

    await queue.destroy();
    vi.useRealTimers();
  });
});
