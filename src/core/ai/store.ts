// AI Store — centralized task management
// Supports: global AbortController registry, cancelAll(), concurrency control

import { create } from 'zustand';
import type { AILogEntry, AIQueueItem, ConnectionStatus, AIToolId } from './types';

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface AIQueueTask {
  id: string;
  toolId: AIToolId;
  label: string;
  priority: number;
  run: (service: import('./service').AIService, signal: AbortSignal) => Promise<void>;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

interface AIStore {
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  currentModel: string | null;
  responseTime: number | null;
  logs: AILogEntry[];
  queue: AIQueueItem[];
  cancelledIds: Set<string>;
  service: import('./service').AIService | null;
  activeToolLock: string | null;
  pendingQueue: Array<{ toolId: AIToolId; label: string; }>;
  debugMode: boolean;
  queueManager: import('./queue-manager').AIQueueManager | null;

  // Task manager
  abortControllers: Map<string, AbortController>;
  concurrencyLimit: number;
  activeCount: number;
  taskQueue: AIQueueTask[];

  setConnectionStatus: (status: ConnectionStatus, error?: string | null) => void;
  setCurrentModel: (model: string | null) => void;
  setResponseTime: (ms: number | null) => void;
  setService: (svc: import('./service').AIService | null) => void;
  setDebugMode: (enabled: boolean) => void;
  setQueueManager: (manager: import('./queue-manager').AIQueueManager) => void;

  addLog: (level: AILogEntry['level'], message: string, extra?: Partial<Pick<AILogEntry, 'duration' | 'promptTokens' | 'completionTokens' | 'totalTokens' | 'modelName'>>) => void;
  clearLogs: () => void;

  addQueueItem: (toolId: AIToolId, label: string, total: number) => string;
  updateQueueItem: (id: string, partial: Partial<AIQueueItem>) => void;
  removeQueueItem: (id: string) => void;
  clearQueue: () => void;
  cancelQueueItem: (id: string) => void;
  cancelAll: () => void;
  isCancelled: (id: string) => boolean;

  setActiveToolLock: (id: string | null) => void;
  enqueuePending: (toolId: AIToolId, label: string) => void;
  dequeuePending: () => { toolId: AIToolId; label: string } | undefined;

  registerAbortController: (id: string, controller: AbortController) => void;
  unregisterAbortController: (id: string) => void;
  abortTask: (id: string) => void;
}

export const useAIStore = create<AIStore>((set, get) => ({
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
  queueManager: null,

  abortControllers: new Map(),
  concurrencyLimit: 2,
  activeCount: 0,
  taskQueue: [],

  setConnectionStatus: (status, error) =>
    set({ connectionStatus: status, connectionError: error ?? null }),

  setCurrentModel: (model) => set({ currentModel: model }),

  setResponseTime: (ms) => set({ responseTime: ms }),

  setService: (svc) => set({ service: svc }),

  setDebugMode: (enabled) => set({ debugMode: enabled }),

  setQueueManager: (manager) => set({ queueManager: manager }),

  addLog: (level, message, extra) =>
    set((s) => ({
      logs: [
        ...s.logs.slice(-499),
        { id: makeId(), timestamp: Date.now(), level, message, ...extra },
      ],
    })),

  clearLogs: () => set({ logs: [] }),

  addQueueItem: (toolId, label, total) => {
    const id = makeId();
    const item: AIQueueItem = {
      id,
      toolId,
      label,
      status: 'pending',
      progress: 0,
      total,
      processed: 0,
    };
    set((s) => ({ queue: [...s.queue, item] }));
    return id;
  },

  clearQueue: () => set({ queue: [] }),

  cancelQueueItem: (id) => {
    const s = get();
    const controller = s.abortControllers.get(id);
    if (controller) {
      controller.abort();
      s.unregisterAbortController(id);
    }
    set((s) => {
      const ids = new Set(s.cancelledIds);
      ids.add(id);
      return {
        queue: s.queue.map((item) =>
          item.id === id ? { ...item, status: 'cancelled' as const } : item,
        ),
        cancelledIds: ids,
        taskQueue: s.taskQueue.filter(t => t.id !== id),
      };
    });
  },

  removeQueueItem: (id) =>
    set((s) => {
      const next = new Set(s.cancelledIds);
      next.delete(id);
      return {
        queue: s.queue.filter((item) => item.id !== id),
        cancelledIds: next,
      };
    }),

  updateQueueItem: (id, partial) =>
    set((s) => {
      const next = new Set(s.cancelledIds);
      if (partial.status === 'completed' || partial.status === 'failed') {
        next.delete(id);
      }
      return {
        queue: s.queue.map((item) =>
          item.id === id ? { ...item, ...partial } : item,
        ),
        cancelledIds: next,
      };
    }),

  cancelAll: () => {
    const s = get();
    // Cancel current request
    s.service?.cancel();

    // Abort all registered controllers
    for (const [id, controller] of s.abortControllers) {
      try { controller.abort(); } catch { /* ignore */ }
    }

    // Collect only current queue IDs — don't accumulate old cancelledIds
    const ids = new Set(s.queue.map(item => item.id));

    set({
      abortControllers: new Map(),
      activeCount: 0,
      taskQueue: [],
      queue: s.queue.map(item => ({ ...item, status: 'cancelled' as const })),
      cancelledIds: ids,
      pendingQueue: [],
      activeToolLock: null,
    });

    // If QueueManager has tasks, clear them too
    get().queueManager?.cancelAll();
  },

  isCancelled: (id) => get().cancelledIds.has(id),

  setActiveToolLock: (id) => set({ activeToolLock: id }),

  enqueuePending: (toolId, label) =>
    set((s) => ({ pendingQueue: [...s.pendingQueue, { toolId, label }] })),

  dequeuePending: () => {
    const s = get();
    if (s.pendingQueue.length === 0) return undefined;
    const [first, ...rest] = s.pendingQueue;
    set({ pendingQueue: rest });
    return first;
  },

  registerAbortController: (id, controller) => {
    set((s) => {
      const next = new Map(s.abortControllers);
      next.set(id, controller);
      return { abortControllers: next };
    });
  },

  unregisterAbortController: (id) => {
    set((s) => {
      const next = new Map(s.abortControllers);
      next.delete(id);
      return { abortControllers: next };
    });
  },

  abortTask: (id) => {
    const controller = get().abortControllers.get(id);
    if (controller) {
      controller.abort();
      get().unregisterAbortController(id);
    }
  },
}));
