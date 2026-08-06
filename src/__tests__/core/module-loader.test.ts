// ============================================================
// Module Loader Tests
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAvailableModuleIds, ModuleLoadError } from '@/plugin-sdk';
import { clearModuleCache, registerModulePath } from '@/core/module-loader';
import type { AppModule } from '@/core/types';

// Create a mock module
function createMockModule(id: string): AppModule {
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
  };
}

describe('ModuleLoader', () => {
  beforeEach(() => {
    clearModuleCache();
  });

  // ---- getAvailableModuleIds ----

  it('should return all 7 built-in module ids', () => {
    const ids = getAvailableModuleIds();
    expect(ids).toContain('groups');
    expect(ids).toContain('phrases');
    expect(ids).toContain('clustering');
    expect(ids).toContain('minus-words');
    expect(ids).toContain('cross-search');
    expect(ids).toContain('find-replace');
    expect(ids).toContain('import-export');
    expect(ids).toContain('deduplicator');
    expect(ids.length).toBeGreaterThanOrEqual(8);
  });

  // ---- registerModulePath + dynamic load ----

  it('should load a module via registered custom path', async () => {
    const mockModule = createMockModule('test-custom');
    registerModulePath(
      'test-custom',
      () => Promise.resolve({ testCustomModule: mockModule }),
      'testCustomModule',
    );

    const { loadModule } = await import('@/core/module-loader');
    const mod = await loadModule('test-custom');
    expect(mod).toBe(mockModule);
    expect(mod.manifest.id).toBe('test-custom');
  });

  it('should cache loaded modules', async () => {
    let callCount = 0;
    const mockModule = createMockModule('cache-test');
    registerModulePath(
      'cache-test',
      () => {
        callCount++;
        return Promise.resolve({ cacheTestModule: mockModule });
      },
      'cacheTestModule',
    );

    const { loadModule } = await import('@/core/module-loader');
    const mod1 = await loadModule('cache-test');
    const mod2 = await loadModule('cache-test');
    expect(mod1).toBe(mod2);
    expect(callCount).toBe(1);
  });

  it('should throw ModuleLoadError for unknown module id', async () => {
    const { loadModule } = await import('@/core/module-loader');
    await expect(loadModule('nonexistent-module')).rejects.toThrow(ModuleLoadError);
  });

  it('should throw ModuleLoadError when export is missing', async () => {
    registerModulePath(
      'bad-export',
      () => Promise.resolve({ wrongName: createMockModule('x') }),
      'expectedName',
    );

    const { loadModule } = await import('@/core/module-loader');
    await expect(loadModule('bad-export')).rejects.toThrow(ModuleLoadError);
  });

  it('should throw ModuleLoadError when module does not implement AppModule', async () => {
    registerModulePath(
      'bad-interface',
      () => Promise.resolve({ badModule: { manifest: {} } as any }),
      'badModule',
    );

    const { loadModule } = await import('@/core/module-loader');
    await expect(loadModule('bad-interface')).rejects.toThrow(ModuleLoadError);
  });

  it('should throw ModuleLoadError when import fails', async () => {
    registerModulePath(
      'failing-module',
      () => Promise.reject(new Error('Network error')),
    );

    const { loadModule } = await import('@/core/module-loader');
    await expect(loadModule('failing-module')).rejects.toThrow(ModuleLoadError);
    await expect(loadModule('failing-module')).rejects.toThrow('Network error');
  });

  it('should clear cache with clearModuleCache', async () => {
    let callCount = 0;
    const mockModule = createMockModule('clear-test');
    registerModulePath(
      'clear-test',
      () => {
        callCount++;
        return Promise.resolve({ clearTestModule: mockModule });
      },
      'clearTestModule',
    );

    const { loadModule } = await import('@/core/module-loader');
    await loadModule('clear-test');
    expect(callCount).toBe(1);

    clearModuleCache();
    await loadModule('clear-test');
    expect(callCount).toBe(2);
  });

  // ---- ModuleLoadError ----

  it('should have correct properties on ModuleLoadError', () => {
    const err = new ModuleLoadError('test-mod', 'some reason');
    expect(err.name).toBe('ModuleLoadError');
    expect(err.moduleId).toBe('test-mod');
    expect(err.message).toContain('test-mod');
    expect(err.message).toContain('some reason');
  });

  it('should wrap Error cause in ModuleLoadError', () => {
    const cause = new Error('original error');
    const err = new ModuleLoadError('mod', cause);
    expect(err.cause).toBe(cause);
    expect(err.message).toContain('original error');
  });
});
