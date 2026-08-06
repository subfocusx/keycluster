export type NetworkRequestStatus = 'pending' | 'success' | 'error' | 'aborted';

export interface NetworkRecord {
  id: string;
  moduleId: string;
  method: string;
  url: string;
  status: NetworkRequestStatus;
  statusCode?: number;
  startedAt: number;
  durationMs?: number;
  error?: string;
  requestSize?: number;
  responseSize?: number;
}

const SENSITIVE_QUERY_PARAMS = new Set([
  'key', 'api_key', 'token', 'secret', 'apikey',
  'user', 'password', 'pass', 'auth',
]);

export function maskSensitiveUrl(url: string): string {
  try {
    const parsed = new URL(url);
    for (const [key] of parsed.searchParams.entries()) {
      if (SENSITIVE_QUERY_PARAMS.has(key.toLowerCase())) {
        parsed.searchParams.set(key, '***');
      }
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

const MAX_RECORDS = 500;

class NetworkStoreInstance {
  private records: NetworkRecord[] = [];
  private listeners = new Set<() => void>();
  private idCounter = 0;

  add(record: Omit<NetworkRecord, 'id'>): string {
    const id = `net-${Date.now()}-${++this.idCounter}`;
    this.records.push({ ...record, url: maskSensitiveUrl(record.url), id });
    if (this.records.length > MAX_RECORDS) this.records.shift();
    this.notify();
    return id;
  }

  update(id: string, patch: Partial<NetworkRecord>): void {
    const rec = this.records.find(r => r.id === id);
    if (rec) {
      Object.assign(rec, patch);
      this.notify();
    }
  }

  getAll(): NetworkRecord[] {
    return [...this.records];
  }

  getByModule(moduleId: string): NetworkRecord[] {
    return this.records.filter(r => r.moduleId === moduleId);
  }

  getFiltered(moduleId?: string, statusFilter?: NetworkRequestStatus | 'all'): NetworkRecord[] {
    return this.records.filter(r => {
      if (moduleId && !r.moduleId.includes(moduleId)) return false;
      if (statusFilter && statusFilter !== 'all' && r.status !== statusFilter) return false;
      return true;
    });
  }

  clear(): void {
    this.records = [];
    this.notify();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    for (const fn of this.listeners) {
      try { fn(); } catch { }
    }
  }
}

export const NetworkStore = new NetworkStoreInstance();
