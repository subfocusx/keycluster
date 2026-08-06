// ╔══════════════════════════════════════════════════════════╗
// ║  @core — ЯДРО KEYCLUSTER                                 ║
// ║  Этот файл является частью ядра приложения.              ║
// ║  НЕ ИЗМЕНЯТЬ логику без явного решения команды.         ║
// ║  Плагины НЕ ДОЛЖНЫ импортировать этот файл напрямую.    ║
// ╚══════════════════════════════════════════════════════════╝
// ============================================================
// KeyCluster EventBus — lightweight pub/sub with scope support
// ============================================================

import type { EventBus, EventHandler } from './types';

class EventBusImpl implements EventBus {
  private listeners = new Map<string, Set<EventHandler>>();
  private scopeRegistrations = new Map<string, Array<{ event: string; handler: EventHandler }>>();
  private alive = true;

  on<T>(event: string, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as EventHandler);
    return () => this.off(event, handler);
  }

  onScoped<T>(event: string, scope: string, handler: EventHandler<T>): () => void {
    const unsub = this.on(event, handler);
    const entry = { event, handler: handler as EventHandler };
    const arr = this.scopeRegistrations.get(scope);
    if (arr) {
      arr.push(entry);
    } else {
      this.scopeRegistrations.set(scope, [entry]);
    }
    return () => {
      unsub();
      const a = this.scopeRegistrations.get(scope);
      if (a) {
        const idx = a.indexOf(entry);
        if (idx !== -1) a.splice(idx, 1);
      }
    };
  }

  off<T>(event: string, handler: EventHandler<T>): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler as EventHandler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  emit<T>(event: string, payload?: T): void {
    if (!this.alive) {
      const current = instance;
      if (current && current !== this) {
        current.emit(event, payload);
      }
      return;
    }
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(payload);
        } catch (err) {
          console.error(`[EventBus] Error in handler for "${event}":`, err);
        }
      }
    }
  }

  once<T>(event: string, handler: EventHandler<T>): () => void {
    const wrapper: EventHandler<T> = (payload) => {
      this.off(event, wrapper);
      handler(payload);
    };
    return this.on(event, wrapper);
  }

  offAll(scopeId?: string): void {
    if (!scopeId) {
      this.listeners.clear();
      this.scopeRegistrations.clear();
      return;
    }
    const registrations = this.scopeRegistrations.get(scopeId);
    if (registrations) {
      for (const { event, handler } of [...registrations]) {
        this.off(event, handler);
      }
      this.scopeRegistrations.delete(scopeId);
    }
  }

  clear(): void {
    this.listeners.clear();
    this.scopeRegistrations.clear();
  }

  reset(): void {
    this.listeners.clear();
    this.scopeRegistrations.clear();
    this.alive = false;
  }
}

let instance: EventBus | null = null;

export function createEventBus(): EventBus {
  if (!instance) {
    instance = new EventBusImpl();
  }
  return instance;
}

export function getEventBus(): EventBus {
  if (!instance) {
    instance = new EventBusImpl();
  }
  return instance;
}

export function resetEventBus(): void {
  if (instance) {
    (instance as EventBusImpl).reset();
  }
  instance = null;
}

// Guard against double initialization in tests
if (typeof window !== 'undefined' && (window as any).__KEYCLUSTER_EVENTBUS__) {
  instance = (window as any).__KEYCLUSTER_EVENTBUS__;
} else if (typeof window !== 'undefined') {
  (window as any).__KEYCLUSTER_EVENTBUS__ = instance;
}
