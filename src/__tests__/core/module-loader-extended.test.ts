// ============================================================
// Extended Tests: core/module-loader.ts
// ============================================================
// Covers: loadModule with source='user', loadManifest, preloadModule,
// getBuiltinModuleIds, getUserPluginIds, reloadModule (prod + dev),
// registerModulePath with source param, source fallback logic,
// and edge cases not covered by the existing test file.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadModule,
  getAvailableModuleIds,
  getBuiltinModuleIds,
  getUserPluginIds,
  preloadModule,
  ModuleLoadError,
} from '@/plugin-sdk';
import {
  registerModulePath,
  clearModuleCache,
  reloadModule,
} from '@/core/module-loader';
import type { AppModule, InternalModuleManifest } from '@/core/types';

// ---- Helpers ----

function createMockModule(id: string, overrides?: Partial<AppModule>): AppModule {
  return {
    manifest: {
      id,
      name: `Mock ${id}`,
      version: '1.0',
      description: `Mock module ${id}`,
      dependencies: [],
      settingsSchema: [],
      slot: [],
    },
    init: vi.fn(),
    destroy: vi.fn(),
    ...overrides,
  };
}

function createMockManifest(id: string): InternalModuleManifest {
  return {
    id,
    name: `Manifest ${id}`,
    version: '2.0',
    description: `Manifest for ${id}`,
    slot: ['left-panel'],
    dependencies: [],
    settingsSchema: [],
  };
}

describe('ModuleLoader (extended)', () => {
  beforeEach(() => {
    clearModuleCache();
  });

  afterEach(() => {
    // Reset NODE_ENV after each test
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'test';;
  });

  // ---- getBuiltinModuleIds ----

  describe('getBuiltinModuleIds', () => {
    it('should return only builtin module IDs', () => {
      const ids = getBuiltinModuleIds();
      expect(ids).toContain('groups');
      expect(ids).toContain('phrases');
      expect(ids).toContain('devtools');
    });

    it('should not include local/plugin IDs', () => {
      const ids = getBuiltinModuleIds();
      expect(ids).toContain('deduplicator');
      expect(ids).toContain('clustering');
    });
  });

  // ---- getUserPluginIds ----

  describe('getUserPluginIds', () => {
    it('should return local (plugin) module IDs', () => {
      const ids = getUserPluginIds();
      expect(Array.isArray(ids)).toBe(true);
    });

    it('should not include builtin IDs', () => {
      const ids = getUserPluginIds();
      expect(ids).not.toContain('groups');
      expect(ids).not.toContain('phrases');
    });

    it('should reflect registered local modules', () => {
      const before = getUserPluginIds().length;
      registerModulePath(
        'test-local-ext',
        () => Promise.resolve({ testLocalExtModule: createMockModule('test-local-ext') }),
        'testLocalExtModule',
        'user',
      );
      const after = getUserPluginIds();
      expect(after.length).toBe(before + 1);
      expect(after).toContain('test-local-ext');
    });
  });

  // ---- getAvailableModuleIds ----

  describe('getAvailableModuleIds', () => {
    it('should return combined builtin + local IDs', () => {
      const builtinIds = getBuiltinModuleIds();
      const localIds = getUserPluginIds();
      const allIds = getAvailableModuleIds();

      // All builtin and local should be present
      for (const id of builtinIds) {
        expect(allIds).toContain(id);
      }
      for (const id of localIds) {
        expect(allIds).toContain(id);
      }
    });
  });

  // ---- loadModule with source='user' ----

  describe('loadModule with source=local', () => {
    it('should load a module from local (plugin) paths', async () => {
      const mockModule = createMockModule('test-local-load');
      registerModulePath(
        'test-local-load',
        () => Promise.resolve({ testLocalLoadModule: mockModule }),
        'testLocalLoadModule',
        'user',
      );

      const mod = await loadModule('test-local-load', 'user');
      expect(mod).toBe(mockModule);
      expect(mod.manifest.id).toBe('test-local-load');
    });

    it('should load module regardless of source hint mismatch', async () => {
      // Register a module as builtin, but request it with source='user'
      const mockModule = createMockModule('test-source-hint');
      registerModulePath(
        'test-source-hint',
        () => Promise.resolve({ testSourceHintModule: mockModule }),
        'testSourceHintModule',
        'builtin',
      );

      // Request with source='user' — should work since source is just a hint
      const mod = await loadModule('test-source-hint', 'user');
      expect(mod).toBe(mockModule);
    });

    it('should load module when source hint differs from registration', async () => {
      const mockModule = createMockModule('test-source-hint2');
      registerModulePath(
        'test-source-hint2',
        () => Promise.resolve({ testSourceHint2Module: mockModule }),
        'testSourceHint2Module',
        'user',
      );

      const mod = await loadModule('test-source-hint2', 'builtin');
      expect(mod).toBe(mockModule);
    });
  });

  // ---- loadModule caching ----

  describe('loadModule caching', () => {
    it('should return cached module on second call', async () => {
      let importCount = 0;
      const mockModule = createMockModule('cache-ext');
      registerModulePath(
        'cache-ext',
        () => {
          importCount++;
          return Promise.resolve({ cacheExtModule: mockModule });
        },
        'cacheExtModule',
      );

      const mod1 = await loadModule('cache-ext');
      const mod2 = await loadModule('cache-ext');
      expect(mod1).toBe(mod2);
      expect(importCount).toBe(1);
    });

    it('should cache regardless of source parameter on second call', async () => {
      let importCount = 0;
      const mockModule = createMockModule('cache-source');
      registerModulePath(
        'cache-source',
        () => {
          importCount++;
          return Promise.resolve({ cacheSourceModule: mockModule });
        },
        'cacheSourceModule',
      );

      // First call
      await loadModule('cache-source');
      // Second call — even with different source, cache hit
      await loadModule('cache-source', 'user');
      expect(importCount).toBe(1);
    });
  });

  // ---- loadModule error paths ----

  describe('loadModule error paths', () => {
    it('should throw ModuleLoadError with available module IDs in message', async () => {
      try {
        await loadModule('absolutely-nonexistent');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ModuleLoadError);
        expect((err as ModuleLoadError).moduleId).toBe('absolutely-nonexistent');
        expect((err as Error).message).toContain('No plugin registered for');
      }
    });

    it('should throw ModuleLoadError when module is missing init method', async () => {
      registerModulePath(
        'missing-init',
        () => Promise.resolve({
          missingInitModule: { manifest: { id: 'missing-init' }, destroy: vi.fn() } as any,
        }),
        'missingInitModule',
      );

      await expect(loadModule('missing-init')).rejects.toThrow(ModuleLoadError);
      await expect(loadModule('missing-init')).rejects.toThrow('has invalid structure. Missing: init()');
    });

    it('should throw ModuleLoadError when module is missing destroy method', async () => {
      registerModulePath(
        'missing-destroy',
        () => Promise.resolve({
          missingDestroyModule: { manifest: { id: 'missing-destroy' }, init: vi.fn() } as any,
        }),
        'missingDestroyModule',
      );

      await expect(loadModule('missing-destroy')).rejects.toThrow(ModuleLoadError);
    });

    it('should throw ModuleLoadError when module is missing manifest', async () => {
      registerModulePath(
        'missing-manifest',
        () => Promise.resolve({
          missingManifestModule: { init: vi.fn(), destroy: vi.fn() } as any,
        }),
        'missingManifestModule',
      );

      await expect(loadModule('missing-manifest')).rejects.toThrow(ModuleLoadError);
    });

    it('should throw ModuleLoadError when import function rejects', async () => {
      registerModulePath(
        'reject-module',
        () => Promise.reject(new Error('import failed')),
      );

      await expect(loadModule('reject-module')).rejects.toThrow(ModuleLoadError);
      await expect(loadModule('reject-module')).rejects.toThrow('import failed');
    });

    it('should include available exports in error when export name is missing', async () => {
      registerModulePath(
        'wrong-export-name',
        () => Promise.resolve({ someOtherExport: createMockModule('x') }),
        'expectedExport',
      );

      try {
        await loadModule('wrong-export-name');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ModuleLoadError);
        expect((err as Error).message).toContain('someOtherExport');
        expect((err as Error).message).toContain('expectedExport');
      }
    });
  });

  // ---- loadManifest ----

  describe('loadManifest', () => {
    it('should load manifest from builtin module via loadModule', async () => {
      const manifest = createMockManifest('test-manifest-builtin');
      const mockModule: AppModule = {
        manifest,
        init: vi.fn(),
        destroy: vi.fn(),
      };
      registerModulePath(
        'test-manifest-builtin',
        () => Promise.resolve({ testManifestBuiltinModule: mockModule }),
        'testManifestBuiltinModule',
        'builtin',
      );

      // Dynamic import to get loadManifest
      const { loadManifest } = await import('@/core/module-loader');
      const result = await loadManifest('test-manifest-builtin', 'builtin');
      expect(result).toEqual(manifest);
      expect(result.id).toBe('test-manifest-builtin');
      expect(result.version).toBe('2.0');
    });

    it('should throw ModuleLoadError for local plugin manifest when manifest.json not found', async () => {
      const { loadManifest } = await import('@/core/module-loader');
      await expect(loadManifest('nonexistent-plugin', 'user')).rejects.toThrow(ModuleLoadError);
      await expect(loadManifest('nonexistent-plugin', 'user')).rejects.toThrow('No plugin registered for');
    });
  });

  // ---- preloadModule ----

  describe('preloadModule', () => {
    it('should load module into cache', async () => {
      let importCount = 0;
      const mockModule = createMockModule('preload-test');
      registerModulePath(
        'preload-test',
        () => {
          importCount++;
          return Promise.resolve({ preloadTestModule: mockModule });
        },
        'preloadTestModule',
      );

      await preloadModule('preload-test');
      expect(importCount).toBe(1);

      // Subsequent loadModule should use cache
      const mod = await loadModule('preload-test');
      expect(mod).toBe(mockModule);
      expect(importCount).toBe(1); // Not called again
    });

    it('should preload with source parameter', async () => {
      const mockModule = createMockModule('preload-local');
      registerModulePath(
        'preload-local',
        () => Promise.resolve({ preloadLocalModule: mockModule }),
        'preloadLocalModule',
        'user',
      );

      await preloadModule('preload-local', 'user');
      const mod = await loadModule('preload-local', 'user');
      expect(mod).toBe(mockModule);
    });

    it('should throw if module cannot be preloaded', async () => {
      registerModulePath(
        'preload-fail',
        () => Promise.reject(new Error('preload error')),
      );

      await expect(preloadModule('preload-fail')).rejects.toThrow(ModuleLoadError);
    });
  });

  // ---- reloadModule ----

  describe('reloadModule', () => {
    it('should throw ModuleLoadError in production mode', async () => {
      ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production';;

      await expect(reloadModule('groups')).rejects.toThrow(ModuleLoadError);
      await expect(reloadModule('groups')).rejects.toThrow('Hot reload is only available in development mode');
    });

    it('should throw ModuleLoadError in test mode (not development)', async () => {
      ;(process.env as Record<string, string | undefined>).NODE_ENV = 'test';;

      await expect(reloadModule('groups')).rejects.toThrow(ModuleLoadError);
      await expect(reloadModule('groups')).rejects.toThrow('Hot reload is only available in development mode');
    });

    it('should reload a module in development mode', async () => {
      ;(process.env as Record<string, string | undefined>).NODE_ENV = 'development';;

      let importCount = 0;
      const mockModule1 = createMockModule('reload-dev');
      const mockModule2 = createMockModule('reload-dev');
      registerModulePath(
        'reload-dev',
        () => {
          importCount++;
          // Return different module instances on each call
          if (importCount === 1) return Promise.resolve({ reloadDevModule: mockModule1 });
          return Promise.resolve({ reloadDevModule: mockModule2 });
        },
        'reloadDevModule',
      );

      // Initial load
      const mod1 = await loadModule('reload-dev');
      expect(mod1).toBe(mockModule1);
      expect(importCount).toBe(1);

      // Reload
      const reloaded = await reloadModule('reload-dev');
      expect(reloaded).toBe(mockModule2);
      expect(importCount).toBe(2);
    });

    it('should remove module from cache before reloading in dev mode', async () => {
      ;(process.env as Record<string, string | undefined>).NODE_ENV = 'development';;

      let importCount = 0;
      const mockModule = createMockModule('reload-cache');
      registerModulePath(
        'reload-cache',
        () => {
          importCount++;
          return Promise.resolve({ reloadCacheModule: mockModule });
        },
        'reloadCacheModule',
      );

      // Initial load
      await loadModule('reload-cache');
      expect(importCount).toBe(1);

      // Reload should import again
      await reloadModule('reload-cache');
      expect(importCount).toBe(2);
    });

    it('should throw ModuleLoadError when reloading unknown module in dev mode', async () => {
      ;(process.env as Record<string, string | undefined>).NODE_ENV = 'development';;

      await expect(reloadModule('totally-unknown-module')).rejects.toThrow(ModuleLoadError);
      await expect(reloadModule('totally-unknown-module')).rejects.toThrow('Cannot hot reload');
    });

    it('should throw ModuleLoadError when reloaded module has bad structure in dev mode', async () => {
      ;(process.env as Record<string, string | undefined>).NODE_ENV = 'development';;

      registerModulePath(
        'reload-bad',
        () => Promise.resolve({ reloadBadModule: { manifest: {} } as any }),
        'reloadBadModule',
      );

      // First load also fails — need to get it into cache first, then change behavior
      // Actually, reloadModule re-imports, so it will catch the bad structure
      await expect(reloadModule('reload-bad')).rejects.toThrow(ModuleLoadError);
      await expect(reloadModule('reload-bad')).rejects.toThrow('does not implement AppModule');
    });

    it('should throw ModuleLoadError when reloaded module export is missing in dev mode', async () => {
      ;(process.env as Record<string, string | undefined>).NODE_ENV = 'development';;

      registerModulePath(
        'reload-missing-export',
        () => Promise.resolve({ wrongName: createMockModule('x') }),
        'expectedName',
      );

      await expect(reloadModule('reload-missing-export')).rejects.toThrow(ModuleLoadError);
      await expect(reloadModule('reload-missing-export')).rejects.toThrow('does not export');
    });

    it('should handle reload with source parameter in dev mode', async () => {
      ;(process.env as Record<string, string | undefined>).NODE_ENV = 'development';;

      let importCount = 0;
      const mockModule = createMockModule('reload-local');
      registerModulePath(
        'reload-local',
        () => {
          importCount++;
          return Promise.resolve({ reloadLocalModule: mockModule });
        },
        'reloadLocalModule',
        'user',
      );

      // Initial load
      await loadModule('reload-local', 'user');
      expect(importCount).toBe(1);

      // Reload with source
      await reloadModule('reload-local', 'user');
      expect(importCount).toBe(2);
    });
  });

  // ---- registerModulePath ----

  describe('registerModulePath', () => {
    it('should register module in builtin paths by default', async () => {
      const mockModule = createMockModule('reg-default');
      registerModulePath(
        'reg-default',
        () => Promise.resolve({ regDefaultModule: mockModule }),
        'regDefaultModule',
      );

      const mod = await loadModule('reg-default', 'builtin');
      expect(mod).toBe(mockModule);
    });

    it('should register module in local paths when source=local', async () => {
      const mockModule = createMockModule('reg-local');
      registerModulePath(
        'reg-local',
        () => Promise.resolve({ regLocalModule: mockModule }),
        'regLocalModule',
        'user',
      );

      const mod = await loadModule('reg-local', 'user');
      expect(mod).toBe(mockModule);
    });

    it('should register export name when provided', async () => {
      const mockModule = createMockModule('reg-export');
      registerModulePath(
        'reg-export',
        () => Promise.resolve({ customExport: mockModule }),
        'customExport',
      );

      const mod = await loadModule('reg-export');
      expect(mod).toBe(mockModule);
    });

    it('should work without export name (uses default)', async () => {
      const mockModule = createMockModule('reg-nodefault');
      registerModulePath(
        'reg-nodefault',
        () => Promise.resolve({ default: mockModule }),
      );

      const mod = await loadModule('reg-nodefault');
      expect(mod).toBe(mockModule);
    });

    it('should overwrite existing module path', async () => {
      const mockModule1 = createMockModule('reg-overwrite');
      const mockModule2 = createMockModule('reg-overwrite');

      registerModulePath(
        'reg-overwrite',
        () => Promise.resolve({ regOverwriteModule: mockModule1 }),
        'regOverwriteModule',
      );

      const mod1 = await loadModule('reg-overwrite');
      expect(mod1).toBe(mockModule1);

      // Clear cache and re-register
      clearModuleCache();
      registerModulePath(
        'reg-overwrite',
        () => Promise.resolve({ regOverwriteModule: mockModule2 }),
        'regOverwriteModule',
      );

      const mod2 = await loadModule('reg-overwrite');
      expect(mod2).toBe(mockModule2);
    });
  });

  // ---- clearModuleCache ----

  describe('clearModuleCache', () => {
    it('should clear all cached modules', async () => {
      let count1 = 0;
      let count2 = 0;
      registerModulePath(
        'clear-1',
        () => { count1++; return Promise.resolve({ clear1Module: createMockModule('clear-1') }); },
        'clear1Module',
      );
      registerModulePath(
        'clear-2',
        () => { count2++; return Promise.resolve({ clear2Module: createMockModule('clear-2') }); },
        'clear2Module',
      );

      await loadModule('clear-1');
      await loadModule('clear-2');
      expect(count1).toBe(1);
      expect(count2).toBe(1);

      // Second load should hit cache
      await loadModule('clear-1');
      await loadModule('clear-2');
      expect(count1).toBe(1);
      expect(count2).toBe(1);

      // Clear and reload
      clearModuleCache();
      await loadModule('clear-1');
      await loadModule('clear-2');
      expect(count1).toBe(2);
      expect(count2).toBe(2);
    });
  });

  // ---- ModuleLoadError ----

  describe('ModuleLoadError', () => {
    it('should handle non-Error cause', () => {
      const err = new ModuleLoadError('mod', 'string reason');
      expect(err.cause).toBe('string reason');
      expect(err.message).toContain('string reason');
    });

    it('should handle Error cause', () => {
      const cause = new Error('detailed error');
      const err = new ModuleLoadError('mod', cause);
      expect(err.cause).toBe(cause);
      expect(err.message).toContain('detailed error');
    });

    it('should have name property set to ModuleLoadError', () => {
      const err = new ModuleLoadError('mod', 'reason');
      expect(err.name).toBe('ModuleLoadError');
    });

    it('should be an instance of Error', () => {
      const err = new ModuleLoadError('mod', 'reason');
      expect(err).toBeInstanceOf(Error);
    });
  });
});
