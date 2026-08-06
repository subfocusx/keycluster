// AI Queue Manager — centralized batch task orchestration
// Controls concurrency, priorities, retries, timeouts, and cancellation.

import { useAIStore } from './store';
import { AIService } from './service';
import type { AIToolId } from './types';

export interface AIQueueTaskDef {
  toolId: AIToolId;
  label: string;
  priority: number;
  run: (service: AIService, signal: AbortSignal) => Promise<void>;
}

interface InternalTask extends AIQueueTaskDef {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  controller?: AbortController;
}

let taskIdCounter = 0;
function nextId(): string {
  return `aiq-${Date.now()}-${++taskIdCounter}`;
}

export class AIQueueManager {
  private static instance: AIQueueManager;

  private tasks: InternalTask[] = [];
  private activeCount = 0;
  private concurrencyLimit: number;
  private batchSessionId: string | null = null;
  private running = false;

  private constructor(concurrency = 2) {
    this.concurrencyLimit = concurrency;
  }

  static reset(): void {
    if (AIQueueManager.instance) {
      AIQueueManager.instance.cancelAll();
    }
    AIQueueManager.instance = null as unknown as AIQueueManager;
  }

  static getInstance(concurrency?: number): AIQueueManager {
    if (!AIQueueManager.instance) {
      AIQueueManager.instance = new AIQueueManager(concurrency ?? 2);
    } else if (concurrency !== undefined) {
      AIQueueManager.instance.setConcurrency(concurrency);
    }
    return AIQueueManager.instance;
  }

  setConcurrency(limit: number): void {
    this.concurrencyLimit = Math.max(1, Math.min(limit, 8));
  }

  enqueue(def: AIQueueTaskDef): string {
    const id = nextId();
    const task: InternalTask = { ...def, id, status: 'pending' };

    const store = useAIStore.getState();
    store.addQueueItem(def.toolId, def.label, 1);

    this.tasks.push(task);
    this.tryProcess();
    return id;
  }

  enqueueBatch(defs: AIQueueTaskDef[]): string[] {
    const ids: string[] = [];
    const sessionId = `batch-${Date.now()}`;
    this.batchSessionId = sessionId;

    const store = useAIStore.getState();
    for (const def of defs) {
      const id = nextId();
      this.tasks.push({ ...def, id, status: 'pending' });
      ids.push(id);
      store.addQueueItem(def.toolId, def.label, defs.length);
    }

    this.tryProcess();
    return ids;
  }

  private tryProcess(): void {
    if (this.running) return;
    this.running = true;

    const process = (): void => {
      while (this.activeCount < this.concurrencyLimit) {
        const store = useAIStore.getState();
        const pending = this.tasks
          .filter(t => t.status === 'pending')
          .sort((a, b) => b.priority - a.priority);

        if (pending.length === 0) break;

        const task = pending[0];
        this.executeTask(task);
      }
    };

    try { process(); } finally { this.running = false; }
  }

  private async executeTask(task: InternalTask): Promise<void> {
    const store = useAIStore.getState();
    const controller = new AbortController();
    task.controller = controller;
    task.status = 'processing';
    this.activeCount++;

    store.setActiveToolLock(task.id);
    store.registerAbortController(task.id, controller);
    store.addLog('info', `[AI] Queue: ${task.label}`);

    try {
      const svc = store.service;
      if (!svc) throw new Error('AI service not available');

      await task.run(svc, controller.signal);

      task.status = 'completed';
      store.updateQueueItem(task.id, { status: 'completed' });
      store.addLog('info', `[AI] Completed: ${task.label}`);
    } catch (err: unknown) {
      if (controller.signal.aborted || store.cancelledIds.has(task.id)) {
        task.status = 'cancelled';
        store.updateQueueItem(task.id, { status: 'cancelled' });
      } else {
        task.status = 'failed';
        const msg = err instanceof Error ? err.message : 'Unknown error';
        task.error = msg;
        store.updateQueueItem(task.id, { status: 'failed', error: msg });
        store.addLog('error', `[AI] Failed: ${task.label} — ${msg}`);
      }
    } finally {
      store.unregisterAbortController(task.id);
      store.setActiveToolLock(null);
      this.activeCount--;
      this.tryProcess();
    }
  }

  cancelAll(): void {
    const store = useAIStore.getState();
    for (const task of this.tasks) {
      if (task.status === 'pending') {
        task.status = 'cancelled';
        store.cancelQueueItem(task.id);
      } else if (task.status === 'processing' && task.controller) {
        task.controller.abort();
        task.status = 'cancelled';
      }
    }
    this.tasks = [];
    this.activeCount = 0;
    this.batchSessionId = null;
  }

  cancelTask(id: string): void {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;
    if (task.controller && task.status === 'processing') {
      task.controller.abort();
    }
    task.status = 'cancelled';
    useAIStore.getState().cancelQueueItem(id);
  }

  getQueueState(): { active: number; pending: number; completed: number; failed: number; total: number } {
    return {
      active: this.activeCount,
      pending: this.tasks.filter(t => t.status === 'pending').length,
      completed: this.tasks.filter(t => t.status === 'completed').length,
      failed: this.tasks.filter(t => t.status === 'failed').length,
      total: this.tasks.length,
    };
  }

  isBusy(): boolean {
    return this.activeCount > 0 || this.tasks.some(t => t.status === 'pending');
  }

  getBatchSessionId(): string | null {
    return this.batchSessionId;
  }

  clearCompleted(): void {
    this.tasks = this.tasks.filter(t => t.status === 'pending' || t.status === 'processing');
  }

  reset(): void {
    this.cancelAll();
    this.tasks = [];
    this.activeCount = 0;
    this.batchSessionId = null;
  }
}

export const aiQueueManager = AIQueueManager.getInstance();
