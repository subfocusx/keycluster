import type { ErrorRecord, ErrorFilter } from './types';
import { filterOrPass } from '../utils/filter';

type Unsubscribe = () => void;

function uid(): string {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const MAX_ERRORS = 500;

export class ErrorCollector {
  private errors = new Map<string, ErrorRecord>();
  private listeners = new Set<() => void>();

  private makeKey(moduleId: string, message: string): string {
    return `${moduleId}:${message}`;
  }

  private notify(): void {
    for (const fn of this.listeners) {
      try { fn(); } catch { /* ignore */ }
    }
  }

  private evictOne(): void {
    if (this.errors.size <= MAX_ERRORS) return;
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, rec] of this.errors) {
      if (rec.lastOccurrence < oldestTime) {
        oldestTime = rec.lastOccurrence;
        oldestKey = key;
      }
    }
    if (oldestKey) this.errors.delete(oldestKey);
  }

  add(moduleId: string, phase: ErrorRecord['phase'], error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    const key = this.makeKey(moduleId, message);

    if (this.errors.has(key)) {
      const existing = this.errors.get(key)!;
      existing.count++;
      existing.lastOccurrence = Date.now();
      existing.stack = stack ?? existing.stack;
    } else {
      this.errors.set(key, {
        id: uid(),
        moduleId,
        timestamp: Date.now(),
        phase,
        message,
        stack,
        count: 1,
        lastOccurrence: Date.now(),
        resolved: false,
      });
      this.evictOne();
    }
    this.notify();
  }

  getAll(): ErrorRecord[] {
    return [...this.errors.values()].sort((a, b) => b.lastOccurrence - a.lastOccurrence);
  }

  getFiltered(filter: ErrorFilter): ErrorRecord[] {
    let result = this.getAll();
    result = filterOrPass(result, filter.moduleId ? e => e.moduleId === filter.moduleId : null);
    result = filterOrPass(result, filter.phase ? e => e.phase === filter.phase : null);
    result = filterOrPass(result, filter.resolved !== undefined ? e => e.resolved === filter.resolved : null);
    return result;
  }

  getByModule(moduleId: string): ErrorRecord[] {
    return this.getFiltered({ moduleId });
  }

  getUnresolved(): ErrorRecord[] {
    return this.getFiltered({ resolved: false });
  }

  markResolved(id: string): void {
    for (const [, record] of this.errors) {
      if (record.id === id) {
        record.resolved = true;
        this.notify();
        return;
      }
    }
  }

  clear(): void {
    this.errors.clear();
    this.notify();
  }

  clearForModule(moduleId: string): void {
    for (const [key, record] of this.errors) {
      if (record.moduleId === moduleId) this.errors.delete(key);
    }
    this.notify();
  }

  subscribe(fn: () => void): Unsubscribe {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }
}

export const globalErrorCollector = new ErrorCollector();
