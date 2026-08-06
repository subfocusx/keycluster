import { describe, it, expect, beforeEach } from 'vitest';
import { useAIStore } from '@/plugin-sdk';

describe('use AI Store', () => {
  beforeEach(() => {
    useAIStore.setState({
      connectionStatus: 'disconnected',
      connectionError: null,
      currentModel: null,
      responseTime: null,
      logs: [],
      queue: [],
      cancelledIds: new Set(),
      service: null,
      activeToolLock: null,
      pendingQueue: [],
      debugMode: false,
      abortControllers: new Map(),
      concurrencyLimit: 2,
      activeCount: 0,
      taskQueue: [],
    });
  });

  describe('connection state', () => {
    it('should start disconnected', () => {
      expect(useAIStore.getState().connectionStatus).toBe('disconnected');
    });

    it('should update connection status', () => {
      useAIStore.getState().setConnectionStatus('connected');
      expect(useAIStore.getState().connectionStatus).toBe('connected');
    });

    it('should store connection error', () => {
      useAIStore.getState().setConnectionStatus('error', 'Server unreachable');
      expect(useAIStore.getState().connectionError).toBe('Server unreachable');
    });

    it('should set current model', () => {
      useAIStore.getState().setCurrentModel('qwen2.5:3b');
      expect(useAIStore.getState().currentModel).toBe('qwen2.5:3b');
    });

    it('should set response time', () => {
      useAIStore.getState().setResponseTime(150);
      expect(useAIStore.getState().responseTime).toBe(150);
    });
  });

  describe('debug mode', () => {
    it('should default to false', () => {
      expect(useAIStore.getState().debugMode).toBe(false);
    });

    it('should update debug mode', () => {
      useAIStore.getState().setDebugMode(true);
      expect(useAIStore.getState().debugMode).toBe(true);
    });
  });

  describe('logs', () => {
    it('should start with empty logs', () => {
      expect(useAIStore.getState().logs).toEqual([]);
    });

    it('should add log entry', () => {
      useAIStore.getState().addLog('info', 'Test message');
      const logs = useAIStore.getState().logs;
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('info');
      expect(logs[0].message).toBe('Test message');
    });

    it('should clear logs', () => {
      useAIStore.getState().addLog('info', 'Test');
      useAIStore.getState().clearLogs();
      expect(useAIStore.getState().logs).toEqual([]);
    });

    it('should limit logs to 500 entries', () => {
      for (let i = 0; i < 600; i++) {
        useAIStore.getState().addLog('info', `Log ${i}`);
      }
      expect(useAIStore.getState().logs.length).toBe(500);
    });

    it('should accept extra fields', () => {
      useAIStore.getState().addLog('info', 'Test', { duration: 150, modelName: 'test-model' });
      const log = useAIStore.getState().logs[0];
      expect(log.duration).toBe(150);
      expect(log.modelName).toBe('test-model');
    });
  });

  describe('queue', () => {
    it('should add queue item', () => {
      const id = useAIStore.getState().addQueueItem('rename-groups', 'Test', 5);
      const queue = useAIStore.getState().queue;
      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe(id);
      expect(queue[0].label).toBe('Test');
      expect(queue[0].total).toBe(5);
      expect(queue[0].status).toBe('pending');
    });

    it('should update queue item', () => {
      const id = useAIStore.getState().addQueueItem('group-notes', 'Notes', 3);
      useAIStore.getState().updateQueueItem(id, { status: 'processing', progress: 50 });
      const item = useAIStore.getState().queue[0];
      expect(item.status).toBe('processing');
      expect(item.progress).toBe(50);
    });

    it('should remove queue item', () => {
      const id = useAIStore.getState().addQueueItem('rename-groups', 'R', 2);
      expect(useAIStore.getState().queue).toHaveLength(1);
      useAIStore.getState().removeQueueItem(id);
      expect(useAIStore.getState().queue).toHaveLength(0);
    });

    it('should clear queue', () => {
      useAIStore.getState().addQueueItem('rename-groups', 'A', 1);
      useAIStore.getState().addQueueItem('group-notes', 'B', 2);
      useAIStore.getState().clearQueue();
      expect(useAIStore.getState().queue).toHaveLength(0);
    });

    it('should cancel queue item', () => {
      const id = useAIStore.getState().addQueueItem('rename-groups', 'Test', 5);
      useAIStore.getState().cancelQueueItem(id);
      const item = useAIStore.getState().queue[0];
      expect(item.status).toBe('cancelled');
      expect(useAIStore.getState().isCancelled(id)).toBe(true);
    });
  });
});
