// ============================================================
// Tests: clustering/clustering.worker.ts — Web Worker logic
// ============================================================
//
// The worker uses self.onmessage / self.postMessage.
// We simulate the worker environment by stubbing postMessage
// and triggering onmessage directly.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('clustering.worker', () => {
  let postMessageMock: ReturnType<typeof vi.fn>;
  let originalPostMessage: typeof self.postMessage;

  function resultMessage(): any {
    return postMessageMock.mock.calls.find(
      (call: any[]) => call[0].type === 'CLUSTER_RESULT',
    )?.[0];
  }

  beforeEach(async () => {
    originalPostMessage = self.postMessage;
    postMessageMock = vi.fn();
    (self as any).postMessage = postMessageMock;
    await import('@user-plugins/clustering/clustering.worker');
  });

  afterEach(() => {
    (self as any).postMessage = originalPostMessage;
    vi.restoreAllMocks();
  });

  const triggerOnMessage = (data: any) => {
    const handler = (self as any).onmessage;
    if (!handler) throw new Error('onmessage not set');
    handler({ data });
  };

  it('should ignore non-CLUSTER messages', () => {
    triggerOnMessage({ type: 'UNKNOWN' });
    expect(postMessageMock).not.toHaveBeenCalled();
  });

  it('should return CLUSTER_RESULT with empty clusters for empty input', () => {
    triggerOnMessage({ type: 'CLUSTER', phrases: [], threshold: 0.5 });
    const msg = resultMessage();
    expect(msg.clusters).toEqual([]);
  });

  it('should return CLUSTER_RESULT with duration', () => {
    triggerOnMessage({ type: 'CLUSTER', phrases: ['test'], threshold: 0.5 });
    const msg = resultMessage();
    expect(msg.duration).toBeTypeOf('number');
  });

  it('should cluster identical phrases', () => {
    triggerOnMessage({
      type: 'CLUSTER',
      phrases: ['word1 word2', 'word1 word2'],
      threshold: 0.5,
    });
    const msg = resultMessage();
    expect(msg.clusters.length).toBe(1);
    expect(msg.clusters[0]).toHaveLength(2);
  });

  it('should not cluster unrelated phrases with high threshold', () => {
    triggerOnMessage({
      type: 'CLUSTER',
      phrases: ['foo bar', 'baz qux'],
      threshold: 0.9,
    });
    const msg = resultMessage();
    expect(msg.clusters.length).toBe(2);
    expect(msg.clusters[0]).toHaveLength(1);
    expect(msg.clusters[1]).toHaveLength(1);
  });

  it('should cluster similar phrases with low threshold', () => {
    triggerOnMessage({
      type: 'CLUSTER',
      phrases: ['apple pie', 'apple cake', 'orange juice'],
      threshold: 0.3,
    });
    const msg = resultMessage();
    const allPhrases = msg.clusters.flat();
    expect(allPhrases).toContain('apple pie');
    expect(allPhrases).toContain('apple cake');
    expect(allPhrases).toContain('orange juice');
  });

  it('should send progress updates', () => {
    triggerOnMessage({
      type: 'CLUSTER',
      phrases: Array.from({ length: 15 }, (_, i) => `phrase ${i}`),
      threshold: 0.3,
    });
    const progressCalls = postMessageMock.mock.calls.filter(
      (call: any[]) => call[0].type === 'CLUSTER_PROGRESS',
    );
    expect(progressCalls.length).toBeGreaterThan(0);
    expect(progressCalls[0][0].percent).toBeTypeOf('number');
  });

  it('should send 100% progress at the end', () => {
    triggerOnMessage({ type: 'CLUSTER', phrases: ['a', 'b'], threshold: 0.3 });
    const progressCalls = postMessageMock.mock.calls.filter(
      (call: any[]) => call[0].type === 'CLUSTER_PROGRESS',
    );
    const lastProgress = progressCalls[progressCalls.length - 1][0];
    expect(lastProgress.percent).toBe(100);
  });

  it('should handle case-insensitive matching', () => {
    triggerOnMessage({
      type: 'CLUSTER',
      phrases: ['Hello World', 'hello world'],
      threshold: 0.9,
    });
    const msg = resultMessage();
    expect(msg.clusters.length).toBe(1);
  });
});
