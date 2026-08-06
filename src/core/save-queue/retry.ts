import type { QueueEntry } from './types';

export const MAX_RETRIES = 3;
export const RETRY_BASE_DELAY_MS = 1000;

function log(msg: string, ...args: any[]): void {
  if (typeof console !== 'undefined') {
    console.log(`[SaveQueue] ${msg}`, ...args);
  }
}

export class RetryHandler {
  private retryCount = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryEntry: QueueEntry | null = null;
  private maxRetries: number;
  private retryBaseDelayMs: number;
  private onRetry: (entry: QueueEntry) => void;

  constructor(maxRetries: number, retryBaseDelayMs: number, onRetry: (entry: QueueEntry) => void) {
    this.maxRetries = maxRetries;
    this.retryBaseDelayMs = retryBaseDelayMs;
    this.onRetry = onRetry;
  }

  get currentRetryCount(): number {
    return this.retryCount;
  }

  get maxRetryCount(): number {
    return this.maxRetries;
  }

  /** Handle a failed save. Returns true if a retry was scheduled, false if max retries exhausted. */
  handleFailure(entry: QueueEntry): { retry: boolean; delay: number } {
    this.retryCount++;
    if (this.retryCount < this.maxRetries) {
      const delay = this.retryBaseDelayMs * Math.pow(2, this.retryCount - 1);
      this.retryEntry = entry;
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        const retryEntry = this.retryEntry;
        if (retryEntry) {
          this.retryEntry = null;
          this.onRetry(retryEntry);
        }
      }, delay);
      return { retry: true, delay };
    }
    this.retryCount = 0;
    return { retry: false, delay: 0 };
  }

  /** Called on successful save — resets retry count */
  onSuccess(): void {
    this.retryCount = 0;
  }

  /** Cancel pending retry and return the entry (for flush/clear) */
  cancel(): QueueEntry | null {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    const entry = this.retryEntry;
    this.retryEntry = null;
    return entry;
  }

  /** Full reset: cancel + zero retry count */
  reset(): void {
    this.cancel();
    this.retryCount = 0;
  }
}
