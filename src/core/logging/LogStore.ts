import type { LogEntry, LogLevel, LogFilter } from './types';
import { getEventBus } from '../event-bus';
import { globalEventFilter } from '../observability/event-filter';
import { filterOrPass } from '../utils/filter';
import { tauriLogger } from '../tauri-logger';
import { globalErrorCollector } from '../errors/ErrorCollector';

type Unsubscribe = () => void;

function fmt(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

class LogStoreInstance {
  private buffer: LogEntry[] = [];
  private readonly maxSize = 2000;
  private listeners = new Set<() => void>();
  private busEnabled = false;

  private add(entry: LogEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
    if (this.busEnabled && !globalEventFilter.isBlocked('log:entry')) {
      try {
        getEventBus()?.emit('log:entry', entry);
      } catch { /* event bus may not be ready */ }
    }
    for (const fn of this.listeners) {
      try { fn(); } catch { /* ignore */ }
    }
  }

  enableEventBus(): void {
    this.busEnabled = true;
  }

  getAll(): LogEntry[] {
    return [...this.buffer];
  }

  getFiltered(filter: LogFilter): LogEntry[] {
    let result = this.buffer;
    result = filterOrPass(result, filter.level ? e => e.level === filter.level : null);
    result = filterOrPass(result, filter.module ? e => e.module === filter.module : null);
    if (filter.search) {
      const q = filter.search.toLowerCase();
      result = filterOrPass(result, e => {
        const dataStr = e.data !== undefined ? JSON.stringify(e.data) : '';
        return e.message.toLowerCase().includes(q) || dataStr.toLowerCase().includes(q);
      });
    }
    return result;
  }

  clear(): void {
    this.buffer = [];
    for (const fn of this.listeners) {
      try { fn(); } catch { /* ignore */ }
    }
  }

  subscribe(fn: () => void): Unsubscribe {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  exportText(filter?: LogFilter): string {
    const entries = filter ? this.getFiltered(filter) : this.buffer;
    return entries.map(e => {
      const ts = fmt(e.timestamp);
      const level = e.level.toUpperCase().padEnd(5);
      const dur = e.duration !== undefined ? ` (${e.duration.toFixed(0)}ms)` : '';
      const data = e.data !== undefined ? ` | ${JSON.stringify(e.data)}` : '';
      return `[${ts}] [${level}] [${e.module}] ${e.message}${data}${dur}`;
    }).join('\n');
  }

  exportJSON(filter?: LogFilter): string {
    const entries = filter ? this.getFiltered(filter) : this.buffer;
    return JSON.stringify(entries, null, 2);
  }

  _log(level: LogLevel, module: string, message: string, data?: unknown): LogEntry {
    const entry: LogEntry = {
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      level,
      module,
      message,
      data,
    };
    this.add(entry);

    if (level === 'error') {
      try {
        globalErrorCollector.add(module, 'runtime', data ?? message);
      } catch {
        // don't break logging if collector fails
      }
    }

    if (level === 'warn' || level === 'error') {
      const logFn = level === 'warn' ? tauriLogger.warn : tauriLogger.error;
      logFn(`[${module}] ${message}`);
    }

    if (import.meta.env.DEV) {
      const colors: Record<LogLevel, string> = { debug: '#888', info: '#0af', warn: '#fa0', error: '#f44' };
      const prefix = `%c[${module}] %c[${level.toUpperCase()}]%c`;
      const styles = ['font-weight:bold;color:#aaa', `font-weight:bold;color:${colors[level]}`, 'color:inherit'];
      if (data !== undefined) {
        console.log(prefix, ...styles, message, data);
      } else {
        console.log(prefix, ...styles, message);
      }
    }
    return entry;
  }

  _logDuration(module: string, label: string, durationMs: number): void {
    const entry: LogEntry = {
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      level: 'info',
      module,
      message: label,
      duration: durationMs,
    };
    this.add(entry);
    if (import.meta.env.DEV) {
      console.log(`%c[${module}] %c[INFO]%c ${label} — ${durationMs.toFixed(0)}ms`,
        'font-weight:bold;color:#aaa', 'font-weight:bold;color:#0af', 'color:inherit');
    }
  }
}

export const LogStore = new LogStoreInstance();
