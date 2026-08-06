import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('ClusteringWorkerBridge', () => {
  let WorkerMock: any;
  let onmessageHandler: ((e: MessageEvent) => void) | null;
  let onerrorHandler: ((e: ErrorEvent) => void) | null;

  beforeEach(() => {
    onmessageHandler = null;
    onerrorHandler = null;

    WorkerMock = vi.fn(function(this: any, _workerUrl: any, _options: any) {
      const worker: any = {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        get onmessage() { return null; },
        set onmessage(handler: ((e: MessageEvent) => void) | null) {
          onmessageHandler = handler;
        },
        get onerror() { return null; },
        set onerror(handler: ((e: ErrorEvent) => void) | null) {
          onerrorHandler = handler;
        },
      };
      // Satisfy vitest's "function or class" mock check
      Object.setPrototypeOf(worker, WorkerMock.prototype);
      return worker;
    });

    vi.stubGlobal('Worker', WorkerMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should have cluster and terminate methods', async () => {
    const { ClusteringWorkerBridge } = await import('@user-plugins/clustering/worker-bridge');
    expect(typeof ClusteringWorkerBridge).toBe('function');
    expect(typeof ClusteringWorkerBridge.prototype.cluster).toBe('function');
    expect(typeof ClusteringWorkerBridge.prototype.terminate).toBe('function');
  });

  it('should create worker on construction', async () => {
    const { ClusteringWorkerBridge } = await import('@user-plugins/clustering/worker-bridge');
    new ClusteringWorkerBridge();
    expect(WorkerMock).toHaveBeenCalled();
  });

  it('should post CLUSTER message with phrases and threshold', async () => {
    const { ClusteringWorkerBridge } = await import('@user-plugins/clustering/worker-bridge');
    const bridge = new ClusteringWorkerBridge();
    const phrases = ['phrase1', 'phrase2', 'phrase3'];

    bridge.cluster(phrases, 0.5);

    const workerInstance = WorkerMock.mock.results[0].value;
    expect(workerInstance.postMessage).toHaveBeenCalledWith({
      type: 'CLUSTER',
      phrases,
      threshold: 0.5,
    });

    bridge.terminate();
  });

  it('should resolve promise on CLUSTER_RESULT message', async () => {
    const { ClusteringWorkerBridge } = await import('@user-plugins/clustering/worker-bridge');
    const bridge = new ClusteringWorkerBridge();

    const clusterPromise = bridge.cluster(['a', 'b'], 0.3);

    expect(onmessageHandler).not.toBeNull();
    onmessageHandler!({ data: { type: 'CLUSTER_RESULT', clusters: [['a', 'b']], duration: 100 } } as MessageEvent);

    const result = await clusterPromise;
    expect(result.clusters).toEqual([['a', 'b']]);
    expect(result.duration).toBe(100);

    bridge.terminate();
  });

  it('should call onProgress callback on CLUSTER_PROGRESS', async () => {
    const { ClusteringWorkerBridge } = await import('@user-plugins/clustering/worker-bridge');
    const onProgress = vi.fn();
    const bridge = new ClusteringWorkerBridge();

    const clusterPromise = bridge.cluster(['a', 'b', 'c'], 0.5, onProgress);

    expect(onmessageHandler).not.toBeNull();
    onmessageHandler!({ data: { type: 'CLUSTER_PROGRESS', percent: 50 } } as MessageEvent);
    onmessageHandler!({ data: { type: 'CLUSTER_RESULT', clusters: [], duration: 10 } } as MessageEvent);

    expect(onProgress).toHaveBeenCalledWith(50);
    await clusterPromise;
    bridge.terminate();
  });

  it('should throw error when cluster after terminate', async () => {
    const { ClusteringWorkerBridge } = await import('@user-plugins/clustering/worker-bridge');
    const bridge = new ClusteringWorkerBridge();
    bridge.terminate();

    await expect(bridge.cluster(['test'], 0.5)).rejects.toThrow('Worker is terminated');
  });

  it('should reject promise on worker error', async () => {
    const { ClusteringWorkerBridge } = await import('@user-plugins/clustering/worker-bridge');
    const bridge = new ClusteringWorkerBridge();

    const clusterPromise = bridge.cluster(['a'], 0.5);

    expect(onerrorHandler).not.toBeNull();
    onerrorHandler!({ message: 'Worker failed' } as ErrorEvent);

    await expect(clusterPromise).rejects.toThrow('Worker error: Worker failed');
    bridge.terminate();
  });

  it('should clear pending callbacks on terminate', async () => {
    const { ClusteringWorkerBridge } = await import('@user-plugins/clustering/worker-bridge');
    const bridge = new ClusteringWorkerBridge();

    const clusterPromise = bridge.cluster(['a'], 0.5);
    bridge.terminate();

    await expect(clusterPromise).rejects.toThrow('Worker terminated');
  });

  it('should handle multiple cluster calls', async () => {
    const { ClusteringWorkerBridge } = await import('@user-plugins/clustering/worker-bridge');
    const bridge = new ClusteringWorkerBridge();

    const promise1 = bridge.cluster(['a', 'b'], 0.5);
    onmessageHandler!({ data: { type: 'CLUSTER_RESULT', clusters: [['a', 'b']], duration: 10 } } as MessageEvent);
    const result1 = await promise1;
    expect(result1.clusters).toEqual([['a', 'b']]);

    const promise2 = bridge.cluster(['c', 'd'], 0.3);
    onmessageHandler!({ data: { type: 'CLUSTER_RESULT', clusters: [['c', 'd']], duration: 5 } } as MessageEvent);
    const result2 = await promise2;
    expect(result2.clusters).toEqual([['c', 'd']]);

    bridge.terminate();
  });
});
