// ============================================================
// Tests for ClusteringWorkerBridge
// ============================================================
// Covers: worker init, cluster success, progress, error handling,
//         sequential calls, terminate, reject on terminated worker
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted runs BEFORE static imports
const { getWorkerRef } = vi.hoisted(() => {
  // This object IS the worker instance. The mock constructor returns it directly.
  const workerRef = {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    onmessage: null as ((e: MessageEvent) => void) | null,
    onerror: null as ((e: ErrorEvent) => void) | null,
  };

  // Use a class constructor that returns the shared object
  const MockWorker = vi.fn(function WorkerMock() {
    return workerRef;
  });

  vi.stubGlobal('Worker', MockWorker);

  return { getWorkerRef: () => workerRef };
});

import { ClusteringWorkerBridge } from '@user-plugins/clustering/worker-bridge';

describe('ClusteringWorkerBridge', () => {
  beforeEach(() => {
    const w = getWorkerRef();
    w.postMessage.mockReset();
    w.terminate.mockReset();
    w.onmessage = null;
    w.onerror = null;
  });

  it('should create a Worker on construction', () => {
    new ClusteringWorkerBridge();
    expect(getWorkerRef().onmessage).not.toBeNull();
    expect(getWorkerRef().onerror).not.toBeNull();
  });

  it('should register onmessage and onerror handlers', () => {
    new ClusteringWorkerBridge();
    const w = getWorkerRef();
    expect(typeof w.onmessage).toBe('function');
    expect(typeof w.onerror).toBe('function');
  });

  it('should send CLUSTER message and resolve with result on success', async () => {
    const bridge = new ClusteringWorkerBridge();
    const w = getWorkerRef();

    const phrases = ['купить телефон', 'телефон купить'];
    const threshold = 0.5;
    const clusterPromise = bridge.cluster(phrases, threshold);

    expect(w.postMessage).toHaveBeenCalledWith({
      type: 'CLUSTER',
      phrases,
      threshold,
    });

    w.onmessage!(
      new MessageEvent('message', {
        data: {
          type: 'CLUSTER_RESULT',
          clusters: [['купить телефон', 'телефон купить']],
          duration: 42,
        },
      }),
    );

    const result = await clusterPromise;
    expect(result).toEqual({
      clusters: [['купить телефон', 'телефон купить']],
      duration: 42,
    });
  });

  it('should call onProgress callback on CLUSTER_PROGRESS', async () => {
    const bridge = new ClusteringWorkerBridge();
    const w = getWorkerRef();
    const onProgress = vi.fn();

    const clusterPromise = bridge.cluster(['test'], 0.5, onProgress);

    w.onmessage!(
      new MessageEvent('message', {
        data: { type: 'CLUSTER_PROGRESS', percent: 25 },
      }),
    );
    w.onmessage!(
      new MessageEvent('message', {
        data: { type: 'CLUSTER_PROGRESS', percent: 50 },
      }),
    );

    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(1, 25);
    expect(onProgress).toHaveBeenNthCalledWith(2, 50);

    // Resolve
    w.onmessage!(
      new MessageEvent('message', {
        data: { type: 'CLUSTER_RESULT', clusters: [['test']], duration: 10 },
      }),
    );
    await clusterPromise;
  });

  it('should work without onProgress callback', async () => {
    const bridge = new ClusteringWorkerBridge();
    const w = getWorkerRef();

    const clusterPromise = bridge.cluster(['test'], 0.5);

    w.onmessage!(
      new MessageEvent('message', {
        data: { type: 'CLUSTER_PROGRESS', percent: 75 },
      }),
    );

    w.onmessage!(
      new MessageEvent('message', {
        data: { type: 'CLUSTER_RESULT', clusters: [['test']], duration: 5 },
      }),
    );

    const result = await clusterPromise;
    expect(result.clusters).toEqual([['test']]);
  });

  it('should reject with error on worker onerror', async () => {
    const bridge = new ClusteringWorkerBridge();
    const w = getWorkerRef();

    const clusterPromise = bridge.cluster(['test'], 0.5);

    w.onerror!(
      new ErrorEvent('error', {
        message: 'Something went wrong in worker',
        filename: 'worker.js',
        lineno: 42,
      }),
    );

    await expect(clusterPromise).rejects.toThrow(
      'Worker error: Something went wrong in worker',
    );
  });

  it('should handle unknown message types silently', async () => {
    const bridge = new ClusteringWorkerBridge();
    const w = getWorkerRef();

    const clusterPromise = bridge.cluster(['test'], 0.5);

    w.onmessage!(
      new MessageEvent('message', {
        data: { type: 'UNKNOWN_TYPE', foo: 'bar' },
      }),
    );

    w.onmessage!(
      new MessageEvent('message', {
        data: { type: 'CLUSTER_RESULT', clusters: [['test']], duration: 1 },
      }),
    );

    const result = await clusterPromise;
    expect(result.clusters).toEqual([['test']]);
  });

  it('should throw "Worker is terminated" after terminate()', async () => {
    const bridge = new ClusteringWorkerBridge();
    bridge.terminate();

    expect(getWorkerRef().terminate).toHaveBeenCalled();

    await expect(bridge.cluster(['test'], 0.5)).rejects.toThrow(
      'Worker is terminated',
    );
  });

  it('should reject pending promise on terminate during cluster()', async () => {
    const bridge = new ClusteringWorkerBridge();
    const clusterPromise = bridge.cluster(['test'], 0.5);

    bridge.terminate();

    await expect(clusterPromise).rejects.toThrow('Worker terminated');
  });

  it('should handle sequential cluster calls', async () => {
    const bridge = new ClusteringWorkerBridge();
    const w = getWorkerRef();

    const promise1 = bridge.cluster(['a', 'b'], 0.5);
    w.onmessage!(
      new MessageEvent('message', {
        data: { type: 'CLUSTER_RESULT', clusters: [['a', 'b']], duration: 10 },
      }),
    );
    const result1 = await promise1;
    expect(result1.clusters).toEqual([['a', 'b']]);

    const promise2 = bridge.cluster(['c', 'd'], 0.7);
    expect(w.postMessage).toHaveBeenCalledTimes(2);
    w.onmessage!(
      new MessageEvent('message', {
        data: { type: 'CLUSTER_RESULT', clusters: [['c', 'd']], duration: 20 },
      }),
    );
    const result2 = await promise2;
    expect(result2.clusters).toEqual([['c', 'd']]);
  });

  it('should not resolve twice on duplicate CLUSTER_RESULT', async () => {
    const bridge = new ClusteringWorkerBridge();
    const w = getWorkerRef();

    const clusterPromise = bridge.cluster(['test'], 0.5);

    w.onmessage!(
      new MessageEvent('message', {
        data: { type: 'CLUSTER_RESULT', clusters: [['first']], duration: 1 },
      }),
    );

    const result = await clusterPromise;
    expect(result.duration).toBe(1);

    // Second result — pendingResolve already null, no error
    w.onmessage!(
      new MessageEvent('message', {
        data: { type: 'CLUSTER_RESULT', clusters: [['second']], duration: 2 },
      }),
    );
  });

  it('should clear pending handlers after onerror', async () => {
    const bridge = new ClusteringWorkerBridge();
    const w = getWorkerRef();

    const clusterPromise = bridge.cluster(['test'], 0.5);

    w.onerror!(
      new ErrorEvent('error', { message: 'boom' }),
    );
    await expect(clusterPromise).rejects.toThrow('Worker error: boom');

    // Subsequent result should not throw
    w.onmessage!(
      new MessageEvent('message', {
        data: { type: 'CLUSTER_RESULT', clusters: [['x']], duration: 1 },
      }),
    );
  });

  it('should handle terminate when no pending promise', () => {
    const bridge = new ClusteringWorkerBridge();
    bridge.terminate();
    expect(getWorkerRef().terminate).toHaveBeenCalled();
  });

  it('should handle double terminate gracefully', () => {
    const bridge = new ClusteringWorkerBridge();
    bridge.terminate();
    bridge.terminate();
    expect(getWorkerRef().terminate).toHaveBeenCalledTimes(1);
  });

  it('should not crash on onerror with no pending reject', () => {
    const bridge = new ClusteringWorkerBridge();
    const w = getWorkerRef();

    w.onerror!(
      new ErrorEvent('error', { message: 'no pending' }),
    );
    // No error thrown
  });
});
