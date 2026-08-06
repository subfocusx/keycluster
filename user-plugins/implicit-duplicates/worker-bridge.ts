// ============================================================
// ImplicitDuplicatesWorkerBridge — async/await обёртка для Web Worker
// ============================================================

import type { FindDuplicatesOptions, ImplicitDuplicateGroup } from './utils';

interface FindDuplicatesResult {
  groups: ImplicitDuplicateGroup[];
  duration: number;
}

export class ImplicitDuplicatesWorkerBridge {
  private worker: Worker | null = null;
  private pendingResolve: ((result: FindDuplicatesResult) => void) | null = null;
  private pendingReject: ((error: Error) => void) | null = null;
  private onProgressCallback: ((percent: number) => void) | null = null;

  constructor() {
    this.worker = new Worker(
      new URL('./implicit-duplicates.worker.ts', import.meta.url),
      { type: 'module' },
    );

    this.worker.onmessage = (e: MessageEvent) => {
      const data = e.data;

      if (data.type === 'FIND_DUPLICATES_RESULT') {
        if (this.pendingResolve) {
          this.pendingResolve({
            groups: data.groups,
            duration: data.duration,
          });
          this.pendingResolve = null;
          this.pendingReject = null;
        }
      } else if (data.type === 'FIND_DUPLICATES_PROGRESS') {
        if (this.onProgressCallback) {
          this.onProgressCallback(data.percent);
        }
      }
    };

    this.worker.onerror = (e: ErrorEvent) => {
      if (this.pendingReject) {
        this.pendingReject(new Error(`Worker error: ${e.message}`));
        this.pendingResolve = null;
        this.pendingReject = null;
      }
    };
  }

  async findDuplicates(
    phrases: Array<{ id: string; text: string; frequency?: number }>,
    options: FindDuplicatesOptions,
    onProgress?: (percent: number) => void,
  ): Promise<FindDuplicatesResult> {
    if (!this.worker) {
      throw new Error('Worker is terminated');
    }
    if (this.pendingResolve) {
      throw new Error('Worker is busy. Call terminate() or wait for completion first.');
    }

    this.onProgressCallback = onProgress ?? null;

    return new Promise<FindDuplicatesResult>((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;

      this.worker!.postMessage({
        type: 'FIND_DUPLICATES',
        phrases,
        options,
      });
    });
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    if (this.pendingReject) {
      this.pendingReject(new Error('Worker terminated'));
      this.pendingResolve = null;
      this.pendingReject = null;
    }
  }
}
