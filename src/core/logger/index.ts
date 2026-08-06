import type { LogEntry, LogLevel, LogFilter, Logger } from '../logging/types';
import { LogStore } from '../logging/LogStore';

export type { LogEntry, LogLevel, LogFilter, Logger };

export function createLogger(moduleName: string): Logger {
  return {
    debug: (message, data) => { LogStore._log('debug', moduleName, message, data); },
    info: (message, data) => { LogStore._log('info', moduleName, message, data); },
    warn: (message, data) => { LogStore._log('warn', moduleName, message, data); },
    error: (message, data) => { LogStore._log('error', moduleName, message, data); },
    time: (label: string) => {
      const start = performance.now();
      return () => {
        const duration = performance.now() - start;
        LogStore._logDuration(moduleName, label, duration);
      };
    },
    group: (label: string) => {
      LogStore._log('debug', moduleName, `▸ ${label}`);
      if (import.meta.env.DEV) console.group(`%c[${moduleName}] %c${label}`, 'font-weight:bold;color:#888', 'font-weight:bold');
      return () => {
        LogStore._log('debug', moduleName, `◂ ${label}`);
        if (import.meta.env.DEV) console.groupEnd();
      };
    },
  };
}

export { LogStore };
