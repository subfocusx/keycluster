import type { AppModule, ModuleManifest } from './types';
import { LogStore } from './logging/LogStore';

export type ModuleSource = 'builtin' | 'user';

export interface PluginSourceEntry {
  id: string;
  source: ModuleSource;
  importFn?: () => Promise<Record<string, unknown>>;
  exportName?: string;
}

class PluginSourceRepositoryImpl {
  private sources: Map<string, PluginSourceEntry> = new Map();
  private moduleCache: Map<string, AppModule> = new Map();

  register(entry: PluginSourceEntry): void {
    this.sources.set(entry.id, entry);
    LogStore._log('debug', 'source-repo', `Registered: ${entry.id} (${entry.source})`);
  }

  registerBuiltin(id: string, importFn: () => Promise<Record<string, unknown>>, exportName?: string): void {
    this.register({ id, source: 'builtin', importFn, exportName });
  }

  registerUser(id: string, importFn?: () => Promise<Record<string, unknown>>, exportName?: string): void {
    this.register({ id, source: 'user', importFn, exportName });
  }

  remove(id: string): void {
    this.sources.delete(id);
    this.moduleCache.delete(id);
    LogStore._log('debug', 'source-repo', `Removed: ${id}`);
  }

  get(id: string): PluginSourceEntry | undefined {
    return this.sources.get(id);
  }

  has(id: string): boolean {
    return this.sources.has(id);
  }

  getIds(): string[] {
    return Array.from(this.sources.keys());
  }

  getBySource(source: ModuleSource): PluginSourceEntry[] {
    return Array.from(this.sources.values()).filter(e => e.source === source);
  }

  getAll(): PluginSourceEntry[] {
    return Array.from(this.sources.values());
  }

  clear(): void {
    this.sources.clear();
    this.moduleCache.clear();
  }

  getCachedModule(id: string): AppModule | undefined {
    return this.moduleCache.get(id);
  }

  setCachedModule(id: string, mod: AppModule): void {
    this.moduleCache.set(id, mod);
  }

  deleteCachedModule(id: string): void {
    this.moduleCache.delete(id);
  }

  clearCache(): void {
    this.moduleCache.clear();
  }

  getAllCachedIds(): string[] {
    return Array.from(this.moduleCache.keys());
  }
}

export const pluginSourceRepo = new PluginSourceRepositoryImpl();
