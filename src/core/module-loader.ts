import type { AppModule, ModuleManifest, InternalModuleManifest } from './types';
import { pluginSourceRepo, type ModuleSource } from './plugin-source-repository';
import { ModuleLoadError } from './errors/module-load-error';
import { validateModuleManifest, buildInternalModuleManifest } from './validation/module-manifest';

export type { ModuleSource } from './plugin-source-repository';
export { pluginSourceRepo } from './plugin-source-repository';
export { ModuleLoadError } from './errors/module-load-error';

const MODULE_EXPORT_NAMES: Record<string, string> = {
  'devtools': 'devtoolsModule',
  'groups': 'groupsModule',
  'phrases': 'phrasesModule',
};

export async function loadModule(moduleId: string, source?: ModuleSource): Promise<AppModule> {
  const cached = pluginSourceRepo.getCachedModule(moduleId);
  if (cached) return cached;

  const entry = pluginSourceRepo.get(moduleId);
  if (!entry) {
    throw new ModuleLoadError(
      moduleId,
      `No plugin registered for "${moduleId}". Available: [${pluginSourceRepo.getIds().join(', ')}]`,
    );
  }

  if (!entry.importFn) {
    throw new ModuleLoadError(
      moduleId,
      `Plugin "${moduleId}" has no import function registered`,
    );
  }

  try {
    const modExports = await entry.importFn();
    const exportName = entry.exportName ?? MODULE_EXPORT_NAMES[moduleId];
    const mod = exportName
      ? (modExports[exportName] as AppModule | undefined)
      : (modExports.default as AppModule | undefined);

    if (!mod) {
      const hints: string[] = [];
      if (exportName) {
        hints.push(`Expected named export "${exportName}"`);
      } else {
        hints.push(`Expected: export default { manifest, init, destroy }`);
      }
      throw new ModuleLoadError(
        moduleId,
        `Plugin "${moduleId}" found but does not export AppModule.\n${hints.join('\n')}\nAvailable exports: ${Object.keys(modExports).join(', ')}`,
      );
    }

    const missing: string[] = [];
    if (!mod.manifest) missing.push('manifest');
    if (!mod.init) missing.push('init()');
    if (!mod.destroy) missing.push('destroy()');
    if (missing.length > 0) {
      throw new ModuleLoadError(
        moduleId,
        `Plugin "${moduleId}" has invalid structure. Missing: ${missing.join(', ')}.`,
      );
    }

    if (mod.manifest.id !== moduleId) {
      throw new ModuleLoadError(
        moduleId,
        `Plugin "${moduleId}" has mismatched manifest.id="${mod.manifest.id}".`,
      );
    }

    validateModuleManifest(mod.manifest, moduleId);
    mod.manifest = buildInternalModuleManifest(mod.manifest as unknown as ModuleManifest);

    pluginSourceRepo.setCachedModule(moduleId, mod);
    return mod;
  } catch (err) {
    if (err instanceof ModuleLoadError) throw err;
    throw new ModuleLoadError(moduleId, err);
  }
}

export async function loadManifest(moduleId: string, source?: ModuleSource): Promise<InternalModuleManifest> {
  const mod = await loadModule(moduleId, source);
  return mod.manifest;
}

export async function preloadModule(moduleId: string, source?: ModuleSource): Promise<void> {
  await loadModule(moduleId, source);
}

export function getAvailableModuleIds(): string[] {
  return pluginSourceRepo.getIds();
}

export function getBuiltinModuleIds(): string[] {
  return pluginSourceRepo.getBySource('builtin').map(e => e.id);
}

export function getUserPluginIds(): string[] {
  return pluginSourceRepo.getBySource('user').map(e => e.id);
}

export function clearModuleCache(): void {
  pluginSourceRepo.clearCache();
}

export function removeFromModuleCache(moduleId: string): void {
  pluginSourceRepo.deleteCachedModule(moduleId);
}

export function getModuleCacheKeys(): string[] {
  return pluginSourceRepo.getAllCachedIds();
}

export async function reloadModule(moduleId: string, source?: ModuleSource): Promise<AppModule> {
  if (process.env.NODE_ENV !== 'development') {
    throw new ModuleLoadError(
      moduleId,
      'Hot reload is only available in development mode.',
    );
  }

  pluginSourceRepo.deleteCachedModule(moduleId);

  const entry = pluginSourceRepo.get(moduleId);
  if (!entry?.importFn) {
    throw new ModuleLoadError(
      moduleId,
      `No import function for module "${moduleId}". Cannot hot reload.`,
    );
  }

  try {
    const modExports = await entry.importFn();
    const exportName = entry.exportName ?? MODULE_EXPORT_NAMES[moduleId];
    const mod = exportName
      ? (modExports[exportName] as AppModule | undefined)
      : (modExports.default as AppModule | undefined);

    if (!mod) {
      throw new ModuleLoadError(
        moduleId,
        `Module "${moduleId}" does not export "${exportName ?? 'default'}" after reload.`,
      );
    }

    if (!mod.manifest || !mod.init || !mod.destroy) {
      throw new ModuleLoadError(
        moduleId,
        `Module "${moduleId}" does not implement AppModule interface after reload.`,
      );
    }

    validateModuleManifest(mod.manifest, moduleId);
    mod.manifest = buildInternalModuleManifest(mod.manifest as unknown as ModuleManifest);

    pluginSourceRepo.setCachedModule(moduleId, mod);
    return mod;
  } catch (err) {
    if (err instanceof ModuleLoadError) throw err;
    throw new ModuleLoadError(moduleId, err);
  }
}

export function registerModulePath(
  moduleId: string,
  importFn: () => Promise<Record<string, unknown>>,
  exportName?: string,
  source: ModuleSource = 'builtin',
): void {
  pluginSourceRepo.register({ id: moduleId, source, importFn, exportName });
}

export function registerUserPlugin(
  moduleId: string,
  importFn: () => Promise<Record<string, unknown>>,
  exportName?: string,
): void {
  pluginSourceRepo.registerUser(moduleId, importFn, exportName);
}

export async function registerUserPluginModule(moduleId: string, mod: AppModule): Promise<void> {
  validateModuleManifest(mod.manifest, moduleId);
  mod.manifest = buildInternalModuleManifest(mod.manifest as unknown as ModuleManifest);

  const importFn = () => Promise.resolve({ default: mod } as Record<string, unknown>);
  pluginSourceRepo.registerUser(moduleId, importFn);
  pluginSourceRepo.setCachedModule(moduleId, mod);
  const { getRuntime } = await import('./module-runtime');
  const rt = getRuntime();
  if (rt) rt.register(mod);
}

export function getUserPluginPaths(): Record<string, () => Promise<Record<string, unknown>>> {
  const result: Record<string, () => Promise<Record<string, unknown>>> = {};
  for (const entry of pluginSourceRepo.getBySource('user')) {
    if (entry.importFn) {
      result[entry.id] = entry.importFn;
    }
  }
  return result;
}

export async function loadUserPluginManifest(pluginId: string): Promise<ModuleManifest> {
  try {
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    const { appLocalDataDir, join } = await import('@tauri-apps/api/path');
    const base = await appLocalDataDir();
    const path = await join(base, 'user-plugins', pluginId, 'manifest.json');
    const content = await readTextFile(path);
    return JSON.parse(content) as ModuleManifest;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ModuleLoadError(pluginId, `User plugin "${pluginId}" not found in user-plugins/: ${msg}`);
  }
}

pluginSourceRepo.registerBuiltin('devtools', () => import('@/modules/devtools'), 'devtoolsModule');
pluginSourceRepo.registerBuiltin('groups', () => import('@/modules/groups'), 'groupsModule');
pluginSourceRepo.registerBuiltin('phrases', () => import('@/modules/phrases'), 'phrasesModule');

// All plugins use export default → no exportName (third arg omitted)
pluginSourceRepo.registerBuiltin('clustering',          () => import('@user-plugins/clustering'));
pluginSourceRepo.registerBuiltin('import-export',       () => import('@user-plugins/import-export'));
pluginSourceRepo.registerBuiltin('find-replace',        () => import('@user-plugins/find-replace'));
pluginSourceRepo.registerBuiltin('cross-search',        () => import('@user-plugins/cross-search'));
pluginSourceRepo.registerBuiltin('minus-words',         () => import('@user-plugins/minus-words'));
pluginSourceRepo.registerBuiltin('group-analysis',      () => import('@user-plugins/group-analysis'));
pluginSourceRepo.registerBuiltin('ngrams',              () => import('@user-plugins/ngrams'));
pluginSourceRepo.registerBuiltin('tfidf',               () => import('@user-plugins/tfidf'));
pluginSourceRepo.registerBuiltin('implicit-duplicates', () => import('@user-plugins/implicit-duplicates'));
pluginSourceRepo.registerBuiltin('deduplicator',        () => import('@user-plugins/deduplicator'));


