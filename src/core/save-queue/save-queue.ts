import type { QueueEntry, SaveQueueStatus, ProjectTransport, ProjectState } from './types';
import { RetryHandler, MAX_RETRIES, RETRY_BASE_DELAY_MS } from './retry';
import { LogStore } from '../logging/LogStore';

const DEFAULT_DEBOUNCE_MS = 3000;
const MAX_QUEUE_SIZE = 50;

function log(msg: string, ...args: any[]): void {
  LogStore._log('debug', 'save-queue', msg, args.length > 0 ? args : undefined);
}

export class SaveQueue {
  private queue: QueueEntry[] = [];
  private processing = false;
  private nextId = 0;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private debounceMs: number;
  private transport: ProjectTransport;
  private _status: SaveQueueStatus = 'idle';
  private lastSaveTime = 0;
  private lastError: string | null = null;
  private _lastWrittenVersion = 0;
  private retryHandler: RetryHandler;
  private onProjectRecovered: ((oldId: string, newId: string) => void) | null = null;

  constructor(transport: ProjectTransport, debounceMs = DEFAULT_DEBOUNCE_MS, maxRetries = MAX_RETRIES) {
    this.transport = transport;
    this.debounceMs = debounceMs;
    this.retryHandler = new RetryHandler(maxRetries, RETRY_BASE_DELAY_MS, (entry) => {
      this.queue.unshift(entry);
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  // ---- Public API ----

  get status(): SaveQueueStatus {
    return this._status;
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  get lastSave(): number {
    return this.lastSaveTime;
  }

  get error(): string | null {
    return this.lastError;
  }

  get lastWrittenVersion(): number {
    return this._lastWrittenVersion;
  }

  setProjectRecoveredCallback(cb: (oldId: string, newId: string) => void): void {
    this.onProjectRecovered = cb;
  }

  setDebounceMs(ms: number): void {
    this.debounceMs = Math.max(1000, Math.min(3600000, ms));
  }

  getDebounceMs(): number {
    return this.debounceMs;
  }

  enqueue(projectId: string, state: ProjectState, version: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (version <= this._lastWrittenVersion) {
        log('stale version %d ignored (lastWritten=%d)', version, this._lastWrittenVersion);
        resolve(false);
        return;
      }

      const existingIdx = this.queue.findIndex(
        e => e.projectId === projectId && e.version < version
      );
      if (existingIdx >= 0) {
        const old = this.queue[existingIdx];
        log('batching: replacing queue entry v%d with v%d', old.version, version);
        old.resolve(false);
        this.queue.splice(existingIdx, 1);
      }

      if (this.queue.length >= MAX_QUEUE_SIZE) {
        const dropped = this.queue.shift();
        dropped?.resolve(false);
        log('queue overflow — dropped oldest entry');
      }

      const entry: QueueEntry = {
        id: this.nextId++,
        projectId,
        state,
        version,
        timestamp: Date.now(),
        resolve,
      };

      this.queue.push(entry);
      log('enqueued save v%d for project %s (queue=%d)', version, projectId, this.queue.length);

      this.scheduleProcess();
    });
  }

  async flush(timeoutMs = 10000): Promise<void> {
    if (this._status === 'flushing') {
      log('flush already in progress, waiting...');
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline && this._status === 'flushing') {
        await new Promise(r => setTimeout(r, 50));
      }
      return;
    }
    this._status = 'flushing';
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    const retryEntry = this.retryHandler.cancel();
    if (retryEntry) {
      this.queue.unshift(retryEntry);
    }
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.processing) {
        await new Promise(r => setTimeout(r, 50));
        continue;
      }
      if (this.queue.length === 0) break;
      await this.processNext();
    }
    if (this.queue.length > 0) {
      log('flush timed out with %d entries remaining', this.queue.length);
    }
    this._status = 'idle';
  }

  clear(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    const retryEntry = this.retryHandler.cancel();
    if (retryEntry) {
      retryEntry.resolve(false);
    }
    console.warn('[SaveQueue] Queue cleared, discarding pending entries:', this.queue.length);
    for (const entry of this.queue) {
      entry.resolve(false);
    }
    this.queue = [];
    this._status = 'idle';
  }

  setTransport(transport: ProjectTransport): void {
    this.transport = transport;
  }

  resetVersion(): void {
    this._lastWrittenVersion = 0;
  }

  get currentRetryCount(): number {
    return this.retryHandler.currentRetryCount;
  }

  get maxRetryCount(): number {
    return this.retryHandler.maxRetryCount;
  }

  destroy(): void {
    this.clear();
    this.processing = false;
    this.retryHandler.reset();
    this._status = 'idle';
  }

  // ---- Internal ----

  private scheduleProcess(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.processQueue();
    }, this.debounceMs);
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    this._status = 'saving';

    while (this.queue.length > 0) {
      await this.processNext();
    }

    this.processing = false;
    this._status = 'idle';
  }

  private async processNext(): Promise<void> {
    const entry = this.queue.shift();
    if (!entry) return;

    if (entry.version <= this._lastWrittenVersion) {
      log('skipping stale entry v%d (lastWritten=%d)', entry.version, this._lastWrittenVersion);
      entry.resolve(false);
      return;
    }

    try {
      try {
        await this.transport.updateProject(entry.projectId, {
          groups: JSON.stringify(entry.state.groups),
          phrases: JSON.stringify(entry.state.phrases),
          phraseCount: entry.state.phrases.length,
          minusWords: JSON.stringify(entry.state.minusWords),
          settings: JSON.stringify(entry.state.settings),
          uiState: JSON.stringify(entry.state.uiState),
        });
        log('saved v%d for project %s', entry.version, entry.projectId);
      } catch (updateErr) {
        const msg = updateErr instanceof Error ? updateErr.message : String(updateErr);
        const isNotFound = msg.toLowerCase().includes('not found') || msg.includes('no rows');
        if (isNotFound) {
          const result = await this.transport.createProject({
            name: 'Recovered Project',
            groups: JSON.stringify(entry.state.groups),
            phrases: JSON.stringify(entry.state.phrases),
            phraseCount: entry.state.phrases.length,
            minusWords: JSON.stringify(entry.state.minusWords),
            settings: JSON.stringify(entry.state.settings),
            uiState: JSON.stringify(entry.state.uiState),
          });
          log('recovered project %s from save queue (was v%d)', result.id, entry.version);
          this.onProjectRecovered?.(entry.projectId, result.id);
        } else {
          throw updateErr;
        }
      }

      this.lastSaveTime = Date.now();
      this.lastError = null;
      this._lastWrittenVersion = entry.version;
      this.retryHandler.onSuccess();
      entry.resolve(true);
    } catch (err: any) {
      this.lastError = err.message;
      LogStore._log('error', 'save-queue', `save FAILED for project ${entry.projectId} v${entry.version}: ${err.message} (retry ${this.retryHandler.currentRetryCount + 1}/${this.retryHandler.maxRetryCount})`, { projectId: entry.projectId, version: entry.version, error: err.message, retryCount: this.retryHandler.currentRetryCount + 1 });

      const { retry, delay } = this.retryHandler.handleFailure(entry);
      if (retry) {
        LogStore._log('warn', 'save-queue', `retrying in ${delay}ms...`, { projectId: entry.projectId, delay });
        this.processing = false;
        return;
      }

      LogStore._log('error', 'save-queue', `max retries exhausted for project ${entry.projectId} v${entry.version}`, { projectId: entry.projectId, version: entry.version });
      entry.resolve(false);
    }
  }
}
