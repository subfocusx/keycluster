// ============================================================
// Tests for Plugin Lifecycle — enablePlugin/disablePlugin
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AppModule } from '@/plugin-sdk';
import { createRuntime } from '@/core/module-runtime';
import { createStoreAccess } from '@/core/store';
import { executionGate } from '@/core/module-execution-gate';
import { createEventBus } from '@/core/event-bus';
import { pluginRegistry } from '@/core/plugin-registry';

// Mock module-loader для enablePlugin (dynamic import)
vi.mock('@/core/module-loader', () => ({
  loadModule: vi.fn(async (id: string, source: string) => {
    // Return a test module
    const mod: AppModule = {
      manifest: {
        id,
        name: `Test ${id}`,
        version: '1.0.0',
        description: `Test module ${id}`,
        slot: ['ribbon:tools'],
        dependencies: [],
        settingsSchema: [],
      },
      init(ctx) {
        ctx.registerCommand('test', () => {});
      },
      destroy() {},
    };
    return mod;
  }),
  getBuiltinModuleIds: () => [],
  getLocalModuleIds: () => [],
  getUserPluginIds: () => [],
  removeFromModuleCache: vi.fn(),
  getModuleCacheKeys: vi.fn().mockReturnValue([]),
  ModuleLoadError: class extends Error {
    moduleId: string;
    cause: unknown;
    constructor(id: string, cause: unknown) {
      super(`Failed to load "${id}": ${cause}`);
      this.moduleId = id;
      this.cause = cause;
    }
  },
}));

describe('Plugin Lifecycle', () => {
  let eventBus: ReturnType<typeof createEventBus>;
  let storeAccess: ReturnType<typeof createStoreAccess>;

  beforeEach(() => {
    eventBus = createEventBus();
    (eventBus as { clear(): void }).clear();
    storeAccess = createStoreAccess();
    pluginRegistry.clear();
    executionGate.clear();
  });

  describe('initOne()', () => {
    it('should initialize a single module after register', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const mod: AppModule = {
        manifest: { id: 'test-mod', name: 'Test', version: '1.0', description: '', slot: [], dependencies: [], settingsSchema: [] },
        init: vi.fn(),
        destroy: vi.fn(),
      };

      runtime.register(mod);
      const result = await runtime.initOne('test-mod');
      expect(result).toBe(true);
      expect(mod.init).toHaveBeenCalledOnce();
    });

    it('should return false for unknown module', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const result = await runtime.initOne('unknown');
      expect(result).toBe(false);
    });

    it('should return true if module already initialized', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const mod: AppModule = {
        manifest: { id: 'test-mod', name: 'Test', version: '1.0', description: '', slot: [], dependencies: [], settingsSchema: [] },
        init: vi.fn(),
        destroy: vi.fn(),
      };

      runtime.register(mod);
      await runtime.initOne('test-mod');
      const result = await runtime.initOne('test-mod');
      expect(result).toBe(true);
      expect(mod.init).toHaveBeenCalledOnce(); // Not called again
    });

    it('should return false and emit module:error when init throws', async () => {
      const errorSpy = vi.fn();
      eventBus.on('module:error', errorSpy);

      const runtime = createRuntime(eventBus, storeAccess);
      const mod: AppModule = {
        manifest: { id: 'failing-mod', name: 'Fail', version: '1.0', description: '', slot: [], dependencies: [], settingsSchema: [] },
        init: () => { throw new Error('Init failed!'); },
        destroy: vi.fn(),
      };

      runtime.register(mod);
      const result = await runtime.initOne('failing-mod');
      expect(result).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ moduleId: 'failing-mod', phase: 'init' }),
      );
    });
  });

  describe('destroyOne()', () => {
    it('should destroy a module and clean up contributions', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const destroyFn = vi.fn();
      const mod: AppModule = {
        manifest: { id: 'test-mod', name: 'Test', version: '1.0', description: '', slot: [], dependencies: [], settingsSchema: [] },
        init(ctx) {
          ctx.registerCommand('test', () => {});
        },
        destroy: destroyFn,
      };

      runtime.register(mod);
      await runtime.initOne('test-mod');

      // Verify command was registered
      expect(runtime.getCommands().has('test-mod:test')).toBe(true);

      // Destroy
      await runtime.destroyOne('test-mod');
      expect(destroyFn).toHaveBeenCalledOnce();

      // Verify command was cleaned up
      expect(runtime.getCommands().has('test-mod:test')).toBe(false);

      // Verify module is now disabled
      expect(runtime.isModuleDisabled('test-mod')).toBe(true);
    });

    it('should emit module:disabled event', async () => {
      const disabledSpy = vi.fn();
      eventBus.on('module:disabled', disabledSpy);

      const runtime = createRuntime(eventBus, storeAccess);
      const mod: AppModule = {
        manifest: { id: 'test-mod', name: 'Test', version: '1.0', description: '', slot: [], dependencies: [], settingsSchema: [] },
        init: vi.fn(),
        destroy: vi.fn(),
      };

      runtime.register(mod);
      await runtime.initOne('test-mod');
      await runtime.destroyOne('test-mod');

      expect(disabledSpy).toHaveBeenCalledWith({ id: 'test-mod' });
    });
  });

  describe('enablePlugin()', () => {
    it('should enable a plugin: install in registry + register + init', async () => {
      pluginRegistry.install('test-plugin', 'user');
      pluginRegistry.disable('test-plugin');

      const runtime = createRuntime(eventBus, storeAccess);
      const result = await runtime.enablePlugin('test-plugin');

      expect(result).toBe(true);
      expect(pluginRegistry.isEnabled('test-plugin')).toBe(true);
    });

    it('should throw if plugin not installed in registry', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      await expect(runtime.enablePlugin('nonexistent')).rejects.toThrow('not installed');
    });

    it('should just enable if module already registered and initialized', async () => {
      pluginRegistry.install('test-plugin', 'user');

      const runtime = createRuntime(eventBus, storeAccess);
      const mod: AppModule = {
        manifest: { id: 'test-plugin', name: 'Test', version: '1.0', description: '', slot: [], dependencies: [], settingsSchema: [] },
        init: vi.fn(),
        destroy: vi.fn(),
      };

      runtime.register(mod);
      await runtime.initOne('test-plugin');
      await runtime.disableModule('test-plugin');

      const result = await runtime.enablePlugin('test-plugin');
      expect(result).toBe(true);
      expect(pluginRegistry.isEnabled('test-plugin')).toBe(true);
    });

    it('should return false if init fails during enable', async () => {
      pluginRegistry.install('failing-plugin', 'user');
      pluginRegistry.disable('failing-plugin');

      // Override the mock to return a failing module
      const { loadModule } = await import('@/core/module-loader');
      (loadModule as any).mockImplementationOnce(async () => ({
        manifest: { id: 'failing-plugin', name: 'Fail', version: '1.0', description: '', slot: [], dependencies: [], settingsSchema: [] },
        init: () => { throw new Error('Init failed!'); },
        destroy: () => {},
      }));

      const runtime = createRuntime(eventBus, storeAccess);
      const result = await runtime.enablePlugin('failing-plugin');

      expect(result).toBe(false);
    });
  });

  describe('disablePlugin()', () => {
    it('should disable a plugin: destroy + registry sync', async () => {
      pluginRegistry.install('test-plugin', 'user');

      const runtime = createRuntime(eventBus, storeAccess);
      const mod: AppModule = {
        manifest: { id: 'test-plugin', name: 'Test', version: '1.0', description: '', slot: [], dependencies: [], settingsSchema: [] },
        init(ctx) {
          ctx.registerCommand('test', () => {});
        },
        destroy: vi.fn(),
      };

      runtime.register(mod);
      await runtime.initOne('test-plugin');

      // Disable
      await runtime.disablePlugin('test-plugin');

      expect(pluginRegistry.isEnabled('test-plugin')).toBe(false);
      expect(runtime.isModuleDisabled('test-plugin')).toBe(true);
      expect(runtime.getCommands().has('test-plugin:test')).toBe(false);
    });
  });

  describe('toggle enable→disable→enable cycle', () => {
    it('should restore contributions after enable→disable→enable', async () => {
      pluginRegistry.install('test-plugin', 'user');

      const runtime = createRuntime(eventBus, storeAccess);
      const mod: AppModule = {
        manifest: { id: 'test-plugin', name: 'Test', version: '1.0', description: '', slot: [], dependencies: [], settingsSchema: [] },
        init(ctx) {
          ctx.registerCommand('action', () => {});
        },
        destroy: vi.fn(),
      };

      // Enable
      runtime.register(mod);
      await runtime.initOne('test-plugin');
      expect(runtime.getCommands().has('test-plugin:action')).toBe(true);

      // Disable
      await runtime.disablePlugin('test-plugin');
      expect(runtime.getCommands().has('test-plugin:action')).toBe(false);

      // Re-enable
      const result = await runtime.enablePlugin('test-plugin');
      expect(result).toBe(true);
      // After enable, module should be active again
      expect(pluginRegistry.isEnabled('test-plugin')).toBe(true);
    });
  });

  describe('error isolation', () => {
    it('should not break registry when init fails during enable', async () => {
      pluginRegistry.install('failing-plugin', 'user');

      const { loadModule } = await import('@/core/module-loader');
      (loadModule as any).mockImplementationOnce(async () => ({
        manifest: { id: 'failing-plugin', name: 'Fail', version: '1.0', description: '', slot: [], dependencies: [], settingsSchema: [] },
        init: () => { throw new Error('Init failed!'); },
        destroy: () => {},
      }));

      const runtime = createRuntime(eventBus, storeAccess);
      await runtime.enablePlugin('failing-plugin');

      // Registry should still be intact
      expect(pluginRegistry.isInstalled('failing-plugin')).toBe(true);
      // Module should be marked as failed
      expect(runtime.isModuleFailed('failing-plugin')).toBe(true);
    });
  });

  // ============================================================
  // FIXED: disablePlugin lifecycle tests
  // ============================================================

  describe('disablePlugin — hard stop', () => {
    it('disables module in runtime and registry', async () => {
      pluginRegistry.install('test-plugin', 'user');

      const runtime = createRuntime(eventBus, storeAccess);
      const mod: AppModule = {
        manifest: { id: 'test-plugin', name: 'Test', version: '1.0', description: '', slot: [], dependencies: [], settingsSchema: [] },
        init: vi.fn(),
        destroy: vi.fn(),
      };

      runtime.register(mod);
      await runtime.initOne('test-plugin');

      await runtime.disablePlugin('test-plugin');

      expect(runtime.isModuleDisabled('test-plugin')).toBe(true);
      expect(pluginRegistry.isEnabled('test-plugin')).toBe(false);
    });

    it('emits module:disabled exactly once', async () => {
      pluginRegistry.install('test-plugin', 'user');
      const disabledHandler = vi.fn();
      eventBus.on('module:disabled', disabledHandler);

      const runtime = createRuntime(eventBus, storeAccess);
      const mod: AppModule = {
        manifest: { id: 'test-plugin', name: 'Test', version: '1.0', description: '', slot: [], dependencies: [], settingsSchema: [] },
        init: vi.fn(),
        destroy: vi.fn(),
      };

      runtime.register(mod);
      await runtime.initOne('test-plugin');
      await runtime.disablePlugin('test-plugin');

      // FIXED: was 2 before (destroyOne + disablePlugin), now 1
      expect(disabledHandler).toHaveBeenCalledTimes(1);
      expect(disabledHandler).toHaveBeenCalledWith({ id: 'test-plugin' });
    });
  });

  describe('enablePlugin after disablePlugin', () => {
    it('re-initializes module and clears disabled state', async () => {
      pluginRegistry.install('test-plugin', 'user');

      const runtime = createRuntime(eventBus, storeAccess);
      const mod: AppModule = {
        manifest: { id: 'test-plugin', name: 'Test', version: '1.0', description: '', slot: [], dependencies: [], settingsSchema: [] },
        init: vi.fn(),
        destroy: vi.fn(),
      };

      runtime.register(mod);
      await runtime.initOne('test-plugin');
      expect(mod.init).toHaveBeenCalledTimes(1);

      await runtime.disablePlugin('test-plugin');
      const result = await runtime.enablePlugin('test-plugin');

      expect(result).toBe(true);
      expect(runtime.isModuleDisabled('test-plugin')).toBe(false);
      expect(pluginRegistry.isEnabled('test-plugin')).toBe(true);
      expect(mod.init).toHaveBeenCalledTimes(2);
    });

    it('emits module:enabled on successful enable', async () => {
      pluginRegistry.install('test-plugin', 'user');
      const enabledHandler = vi.fn();
      eventBus.on('module:enabled', enabledHandler);

      const runtime = createRuntime(eventBus, storeAccess);
      const mod: AppModule = {
        manifest: { id: 'test-plugin', name: 'Test', version: '1.0', description: '', slot: [], dependencies: [], settingsSchema: [] },
        init: vi.fn(),
        destroy: vi.fn(),
      };

      runtime.register(mod);
      runtime.initOne('test-plugin');
      runtime.disablePlugin('test-plugin');
      await runtime.enablePlugin('test-plugin');

      expect(enabledHandler).toHaveBeenCalledTimes(1);
      expect(enabledHandler).toHaveBeenCalledWith({ id: 'test-plugin' });
    });
  });

  // ============================================================
  // FIXED: initAll respects registry disabled state
  // ============================================================

  describe('initAll respects registry', () => {
    it('skips module disabled in registry', async () => {
      pluginRegistry.install('mod-a', 'builtin');
      pluginRegistry.install('mod-b', 'user');
      pluginRegistry.disable('mod-b');

      const runtime = createRuntime(eventBus, storeAccess);
      const modA: AppModule = {
        manifest: { id: 'mod-a', name: 'A', version: '1.0', description: '', slot: [], dependencies: [], settingsSchema: [] },
        init: vi.fn(),
        destroy: vi.fn(),
      };
      const modB: AppModule = {
        manifest: { id: 'mod-b', name: 'B', version: '1.0', description: '', slot: [], dependencies: [], settingsSchema: [] },
        init: vi.fn(),
        destroy: vi.fn(),
      };

      runtime.register(modA);
      runtime.register(modB);
      await runtime.initAll();

      expect(modA.init).toHaveBeenCalledTimes(1);
      // FIXED: was called before — now skipped due to registry check
      expect(modB.init).not.toHaveBeenCalled();
      expect(runtime.isModuleDisabled('mod-b')).toBe(true);
    });
  });

  // ============================================================
  // FIXED: executionGate sync from registry
  // ============================================================

  describe('executionGate sync from registry', () => {
    it('disabled modules are blocked in execution gate', () => {
      pluginRegistry.install('test-plugin', 'user');
      pluginRegistry.disable('test-plugin');

      executionGate.clear();
      for (const record of pluginRegistry.getAll()) {
        if (!record.enabled) executionGate.disable(record.id);
      }

      expect(executionGate.isAllowed('test-plugin')).toBe(false);
      expect(executionGate.isBlocked('test-plugin')).toBe(true);
    });

    it('enabled modules are allowed in execution gate', () => {
      pluginRegistry.install('test-plugin', 'user');

      executionGate.clear();
      for (const record of pluginRegistry.getAll()) {
        if (!record.enabled) executionGate.disable(record.id);
      }

      expect(executionGate.isAllowed('test-plugin')).toBe(true);
    });
  });
});
