import type { EventBus, EventHandler } from '../types';

export class EventFilter {
  private blockedPrefixes = new Set<string>();
  private blockedExact = new Set<string>();
  private unblockedExact = new Set<string>();

  blockPrefix(prefix: string): void {
    this.blockedPrefixes.add(prefix);
  }

  unblockPrefix(prefix: string): void {
    this.blockedPrefixes.delete(prefix);
  }

  blockExact(event: string): void {
    this.blockedExact.add(event);
    this.unblockedExact.delete(event);
  }

  unblockExact(event: string): void {
    this.unblockedExact.add(event);
    this.blockedExact.delete(event);
  }

  isBlocked(event: string): boolean {
    if (this.unblockedExact.has(event)) return false;
    if (this.blockedExact.has(event)) return true;
    for (const prefix of this.blockedPrefixes) {
      if (event.startsWith(prefix)) return true;
    }
    return false;
  }

  on(bus: EventBus, event: string, handler: EventHandler): () => void {
    return bus.on(event, (payload: unknown) => {
      if (this.isBlocked(event)) return;
      handler(payload);
    });
  }
}

export const globalEventFilter = new EventFilter();
