import type { ModuleSource } from './module-loader';
import { LogStore } from './logging/LogStore';
import { storageGet, storageSet, storageRemove, STORAGE_KEYS } from './storage/local-storage';
import { getEventBus } from './event-bus';

export type { ModuleSource } from './module-loader';
export type { ModuleSource as PluginSource } from './module-loader';

const VALID_SOURCES: ReadonlySet<string> = new Set<ModuleSource>(['builtin', 'user']);

export interface PluginRecord {
  id: string;
  enabled: boolean;
  installedAt: number;
  source: ModuleSource;
  name?: string;
}

export class PluginRegistry {
  private records: Map<string, PluginRecord> = new Map();
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  private scheduleSave(): void {
    if (this.disposed) return;
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      if (!this.disposed) this.save();
    }, 50);
  }

  load(): PluginRecord[] {
    try {
      if (typeof window === 'undefined') return [];
      const parsed = storageGet<PluginRecord[]>(STORAGE_KEYS.PLUGIN_REGISTRY);
      if (!parsed) return [];
      this.records.clear();
      for (const rec of parsed) {
        this.records.set(rec.id, rec);
      }
      return parsed;
    } catch (err) {
      console.error('[PluginRegistry] Failed to load from localStorage:', err);
      return [];
    }
  }

  save(records?: PluginRecord[]): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    try {
      if (typeof window === 'undefined') return;
      const data = records ?? Array.from(this.records.values());
      storageSet(STORAGE_KEYS.PLUGIN_REGISTRY, data);
    } catch (err) {
      const isQuota = err instanceof DOMException && (
        err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      );
      const msg = isQuota
        ? 'localStorage переполнен — реестр плагинов не сохранён. Освободите место или очистите данные браузера.'
        : `Не удалось сохранить реестр плагинов: ${err instanceof Error ? err.message : String(err)}`;

      console.error('[PluginRegistry]', msg, err);
      LogStore._log('error', 'plugin-registry', msg);

      try {
        const bus = getEventBus();
        bus.emit('plugin:registry-save-failed', { error: msg, isQuota });
        console.error('[PluginRegistry] Save failed, storage quota exceeded');
      } catch {
        // eventBus может быть недоступен до bootstrap
      }
    }
  }

  install(id: string, source: ModuleSource, name?: string): void {
    const existing = this.records.get(id);
    if (existing) {
      // re-enable only when source changes (e.g. builtin → user)
      if (existing.source !== source) existing.enabled = true;
      existing.source = source;
      if (name) existing.name = name;
      this.scheduleSave();
      return;
    }
    const record: PluginRecord = {
      id,
      enabled: true,
      installedAt: Date.now(),
      source,
      name,
    };
    this.records.set(id, record);
    this.scheduleSave();
  }

  uninstall(id: string): void {
    const record = this.records.get(id);
    if (!record) {
      throw new Error(`Plugin "${id}" is not installed.`);
    }
    if (record.source === 'builtin') {
      throw new Error(`Cannot uninstall builtin plugin "${id}".`);
    }
    this.records.delete(id);
    this.save();
    LogStore._log('info', 'plugin-registry', `Uninstalled plugin "${id}" (hard delete from registry)`);
  }

  enable(id: string): void {
    const record = this.records.get(id);
    if (!record) {
      throw new Error(`Plugin "${id}" is not installed.`);
    }
    record.enabled = true;
    this.scheduleSave();
  }

  disable(id: string): void {
    const record = this.records.get(id);
    if (!record) {
      throw new Error(`Plugin "${id}" is not installed.`);
    }
    record.enabled = false;
    this.scheduleSave();
  }

  isEnabled(id: string): boolean {
    return this.records.get(id)?.enabled ?? false;
  }

  isInstalled(id: string): boolean {
    return this.records.has(id);
  }

  get(id: string): PluginRecord | undefined {
    return this.records.get(id);
  }

  getAll(): PluginRecord[] {
    return Array.from(this.records.values());
  }

  updateName(id: string, name: string): void {
    const record = this.records.get(id);
    if (record) {
      record.name = name;
      this.scheduleSave();
    }
  }

  flush(): void {
    if (this.disposed) return;
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.save();
  }

  dispose(): void {
    this.disposed = true;
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
  }

  disposeRuntime(): void {
    this.disposed = true;
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
  }

  purge(id: string): void {
    this.records.delete(id);
    this.save();
  }

  clear(): void {
    this.records.clear();
    try {
      if (typeof window !== 'undefined') {
        storageRemove(STORAGE_KEYS.PLUGIN_REGISTRY);
      }
    } catch {
      // ignore
    }
  }

  reconcile(knownIds: string[], userPluginIdsOnDisk: string[]): { purged: string[]; imported: string[]; enabled: number; disabled: number } {
    const purged: string[] = [];
    const imported: string[] = [];

    const toPurge: string[] = [];
    for (const record of this.getAll()) {
      if (record.source === 'builtin' && !knownIds.includes(record.id)) {
        toPurge.push(record.id);
        continue;
      }
      if (record.source === 'user' && !knownIds.includes(record.id) && !userPluginIdsOnDisk.includes(record.id)) {
        toPurge.push(record.id);
      }
    }

    for (const id of toPurge) {
      this.records.delete(id);
      purged.push(id);
      LogStore._log('warn', 'plugin-registry', `Reconcile: purged "${id}"`);
    }

    for (const pluginId of userPluginIdsOnDisk) {
      if (!this.isInstalled(pluginId)) {
        LogStore._log('info', 'plugin-registry', `Reconcile: found unregistered plugin on disk "${pluginId}", installing`);
        this.install(pluginId, 'user');
        imported.push(pluginId);
      }
    }

    this.save();

    let enabled = 0;
    let disabled = 0;
    for (const record of this.getAll()) {
      if (record.enabled) enabled++; else disabled++;
    }

    LogStore._log('info', 'plugin-registry', `Reconcile complete: ${purged.length} purged, ${imported.length} imported, ${enabled} enabled, ${disabled} disabled`);

    return { purged, imported, enabled, disabled };
  }
}

export const pluginRegistry = new PluginRegistry();
