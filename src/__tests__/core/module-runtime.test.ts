// ============================================================
// Tests: core/module-runtime.ts
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AppModule, ModuleContext } from '@/plugin-sdk';
import { createRuntime } from '@/core/module-runtime';
import { createStoreAccess } from '@/core/store';
import { createEventBus } from '@/core/event-bus';
import { pluginRegistry } from '@/core/plugin-registry';

function createTestModule(id: string, init = vi.fn(), destroy = vi.fn(), deps?: string[]): AppModule {
  return {
    manifest: {
      id,
      name: id,
      version: '1.0.0',
      description: `Test module ${id}`,
      dependencies: deps ?? [],
      settingsSchema: [],
      slot: ['left-panel'],
    },
    init,
    destroy,
  };
}

describe('ModuleRuntime', () => {
  let eventBus: ReturnType<typeof createEventBus>;
  let storeAccess: ReturnType<typeof createStoreAccess>;

  beforeEach(() => {
    eventBus = createEventBus();
    (eventBus as { clear(): void }).clear();
    storeAccess = createStoreAccess();
    pluginRegistry.clear();
  });

  afterEach(() => {
    pluginRegistry.clear();
  });

  it('should create a runtime instance', () => {
    const runtime = createRuntime(eventBus, storeAccess);
    expect(runtime).toBeDefined();
  });

  // ---- register ----

  it('should register a module', () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const mod = createTestModule('test');
    runtime.register(mod);
    expect(runtime.getModule('test')).toBe(mod);
  });

  it('should emit module:registered event on register', () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const handler = vi.fn();
    eventBus.on('module:registered', handler);
    const mod = createTestModule('test');
    runtime.register(mod);
    expect(handler).toHaveBeenCalledWith({ id: 'test' });
  });

  it('should skip duplicate module registration', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const runtime = createRuntime(eventBus, storeAccess);
    const mod = createTestModule('test');
    runtime.register(mod);
    runtime.register(mod); // duplicate
    expect(consoleWarn).toHaveBeenCalled();
    consoleWarn.mockRestore();
  });

  // ---- initAll ----

  it('should initialize registered modules', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const mod = createTestModule('test');
    runtime.register(mod);
    await runtime.initAll();
    expect(mod.init).toHaveBeenCalledOnce();
  });

  it('should pass ModuleContext to init', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    let receivedCtx: ModuleContext | undefined;
    const mod: AppModule = {
      manifest: { id: 'ctx-test', name: 'Ctx Test', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
      init(ctx) { receivedCtx = ctx; },
      destroy() {},
    };
    runtime.register(mod);
    await runtime.initAll();
    expect(receivedCtx).toBeDefined();
    expect(receivedCtx!.eventBus).toBe(eventBus);
    expect(receivedCtx!.store.getState).toBeTypeOf('function');
    expect(receivedCtx!.registerUI).toBeTypeOf('function');
    expect(receivedCtx!.registerCommand).toBeTypeOf('function');
  });

  it('should initialize modules in dependency order', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const order: string[] = [];
    const modA: AppModule = {
      manifest: { id: 'a', name: 'A', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
      init() { order.push('a'); },
      destroy() {},
    };
    const modB: AppModule = {
      manifest: { id: 'b', name: 'B', version: '1.0.0', description: '', dependencies: ['a'], settingsSchema: [], slot: ['left-panel'] },
      init() { order.push('b'); },
      destroy() {},
    };
    const modC: AppModule = {
      manifest: { id: 'c', name: 'C', version: '1.0.0', description: '', dependencies: ['b'], settingsSchema: [], slot: ['left-panel'] },
      init() { order.push('c'); },
      destroy() {},
    };

    // Register in reverse order — should still init in dep order
    runtime.register(modC);
    runtime.register(modB);
    runtime.register(modA);
    await runtime.initAll();
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('should warn about circular dependencies', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const runtime = createRuntime(eventBus, storeAccess);
    const modA: AppModule = {
      manifest: { id: 'a', name: 'A', version: '1.0.0', description: '', dependencies: ['b'], settingsSchema: [], slot: ['left-panel'] },
      init() {},
      destroy() {},
    };
    const modB: AppModule = {
      manifest: { id: 'b', name: 'B', version: '1.0.0', description: '', dependencies: ['a'], settingsSchema: [], slot: ['left-panel'] },
      init() {},
      destroy() {},
    };
    runtime.register(modA);
    runtime.register(modB);
    await runtime.initAll();
    expect(consoleWarn).toHaveBeenCalled();
    consoleWarn.mockRestore();
  });

  it('should warn about missing dependencies', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const runtime = createRuntime(eventBus, storeAccess);
    const mod: AppModule = {
      manifest: { id: 'test', name: 'Test', version: '1.0.0', description: '', dependencies: ['nonexistent'], settingsSchema: [], slot: ['left-panel'] },
      init() {},
      destroy() {},
    };
    runtime.register(mod);
    await runtime.initAll();
    expect(consoleWarn).toHaveBeenCalled();
    consoleWarn.mockRestore();
  });

  it('should emit module:initialized event for each module', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const handler = vi.fn();
    eventBus.on('module:initialized', handler);
    runtime.register(createTestModule('a'));
    runtime.register(createTestModule('b'));
    await runtime.initAll();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('should not init twice', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const runtime = createRuntime(eventBus, storeAccess);
    runtime.register(createTestModule('test'));
    await runtime.initAll();
    await runtime.initAll(); // second call
    expect(consoleWarn).toHaveBeenCalled();
    consoleWarn.mockRestore();
  });

  // ---- destroyAll ----

  it('should destroy all modules in reverse order', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const order: string[] = [];
    const modA: AppModule = {
      manifest: { id: 'a', name: 'A', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
      init() {},
      destroy() { order.push('a'); },
    };
    const modB: AppModule = {
      manifest: { id: 'b', name: 'B', version: '1.0.0', description: '', dependencies: ['a'], settingsSchema: [], slot: ['left-panel'] },
      init() {},
      destroy() { order.push('b'); },
    };
    runtime.register(modA);
    runtime.register(modB);
    await runtime.initAll();
    await runtime.destroyAll();
    expect(order).toEqual(['b', 'a']);
  });

  it('should clear state after destroyAll', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    runtime.register(createTestModule('test'));
    await runtime.initAll();
    await runtime.destroyAll();
    expect(runtime.getModule('test')).toBeUndefined();
  });

  // ---- UI Contributions ----

  it('should register and retrieve UI contributions', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const DummyComp = () => null;
    const mod: AppModule = {
      manifest: { id: 'ui-test', name: 'UI Test', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
      init(ctx) {
        ctx.registerUI({ slot: 'left-panel', label: 'Test Panel', component: DummyComp, order: 10 });
      },
      destroy() {},
    };
    runtime.register(mod);
    await runtime.initAll();
    const contribs = runtime.getUIContributions('left-panel');
    expect(contribs).toHaveLength(1);
    expect(contribs[0].label).toBe('Test Panel');
  });

  it('should sort UI contributions by order', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const Dummy = () => null;
    const mod: AppModule = {
      manifest: { id: 'sort-test', name: 'Sort Test', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
      init(ctx) {
        ctx.registerUI({ slot: 'left-panel', label: 'Second', component: Dummy, order: 20 });
        ctx.registerUI({ slot: 'left-panel', label: 'First', component: Dummy, order: 5 });
        ctx.registerUI({ slot: 'left-panel', label: 'Third', component: Dummy, order: 30 });
      },
      destroy() {},
    };
    runtime.register(mod);
    await runtime.initAll();
    const contribs = runtime.getUIContributions('left-panel');
    expect(contribs.map(c => c.label)).toEqual(['First', 'Second', 'Third']);
  });

  it('should return empty array for slot with no contributions', () => {
    const runtime = createRuntime(eventBus, storeAccess);
    expect(runtime.getUIContributions('right-panel')).toEqual([]);
  });

  // ---- Commands ----

  it('should register and execute commands', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const handler = vi.fn();
    const mod: AppModule = {
      manifest: { id: 'cmd-test', name: 'Cmd Test', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
      init(ctx) {
        ctx.registerCommand('do-thing', handler);
      },
      destroy() {},
    };
    runtime.register(mod);
    await runtime.initAll();
    runtime.executeCommand('cmd-test:do-thing');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('should warn when executing unknown command', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const runtime = createRuntime(eventBus, storeAccess);
    runtime.executeCommand('nonexistent');
    expect(consoleWarn).toHaveBeenCalled();
    consoleWarn.mockRestore();
  });

  // ---- getManifests ----

  it('should return all module manifests', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    runtime.register(createTestModule('a'));
    runtime.register(createTestModule('b'));
    const manifests = runtime.getManifests();
    expect(manifests).toHaveLength(2);
    expect(manifests.map(m => m.id)).toContain('a');
    expect(manifests.map(m => m.id)).toContain('b');
  });
});

// ============================================================
// Branch coverage — edge cases
// Цель: branches ≥80%, statements ≥85%
// ============================================================

describe('branch coverage — edge cases', () => {
  let eventBus: ReturnType<typeof createEventBus>;
  let storeAccess: ReturnType<typeof createStoreAccess>;

  beforeEach(() => {
    eventBus = createEventBus();
    (eventBus as { clear(): void }).clear();
    storeAccess = createStoreAccess();
    pluginRegistry.clear();
  });

  afterEach(() => {
    pluginRegistry.clear();
  });

  // ============================================================
  // Группа A — Ошибки при инициализации модуля
  // ============================================================

  describe('A — Init errors', () => {
    it('A1: module.init() throws sync error → module in failed state, others continue', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const runtime = createRuntime(eventBus, storeAccess);
      const errorHandler = vi.fn();
      eventBus.on('module:error', errorHandler);

      const badMod: AppModule = {
        manifest: { id: 'bad', name: 'Bad', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init() { throw new Error('sync init fail'); },
        destroy() {},
      };
      const goodMod = createTestModule('good');

      runtime.register(badMod);
      runtime.register(goodMod);
      await runtime.initAll();

      // bad module is failed
      expect(runtime.isModuleFailed('bad')).toBe(true);
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ moduleId: 'bad', phase: 'init' }),
      );
      // good module still initialized
      expect(goodMod.init).toHaveBeenCalledOnce();
      consoleError.mockRestore();
    });

    it('A1b: init error string (non-Error) is captured', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const runtime = createRuntime(eventBus, storeAccess);
      const errorHandler = vi.fn();
      eventBus.on('module:error', errorHandler);

      const mod: AppModule = {
        manifest: { id: 'str-err', name: 'StrErr', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init() { throw 'string error'; },
        destroy() {},
      };
      runtime.register(mod);
      await runtime.initAll();

      expect(runtime.isModuleFailed('str-err')).toBe(true);
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ moduleId: 'str-err', error: 'string error' }),
      );
      consoleError.mockRestore();
    });

    it('A2: initAll skips disabled modules', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const mod = createTestModule('skipped');
      runtime.register(mod);
      await runtime.disableModule('skipped');
      await runtime.initAll();
      expect(mod.init).not.toHaveBeenCalled();
      expect(runtime.isModuleDisabled('skipped')).toBe(true);
    });

    it('A4: module with dependency on unregistered dep still inits (deps not checked at runtime)', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const runtime = createRuntime(eventBus, storeAccess);
      const mod: AppModule = {
        manifest: {
          id: 'orphan', name: 'Orphan', version: '1.0.0', description: '',
          dependencies: ['nonexistent-dep'],
          settingsSchema: [],
          slot: ['left-panel'],
        },
        init() {},
        destroy() {},
      };
      runtime.register(mod);
      // Should not throw — just warns about missing dep
      await runtime.initAll();
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('depends on "nonexistent-dep"'),
      );
      // Module still initializes
      expect(runtime.getContext('orphan')).toBeDefined();
      consoleWarn.mockRestore();
    });
  });

  // ============================================================
  // Группа B — Ошибки при уничтожении модуля
  // ============================================================

  describe('B — Destroy errors', () => {
    it('B1: destroyAll — module.destroy() throws → error logged, runtime continues', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const runtime = createRuntime(eventBus, storeAccess);
      const errorHandler = vi.fn();
      eventBus.on('module:error', errorHandler);

      const badMod: AppModule = {
        manifest: { id: 'destroy-bad', name: 'DestroyBad', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init() {},
        destroy() { throw new Error('destroy fail'); },
      };
      const goodMod: AppModule = {
        manifest: { id: 'destroy-good', name: 'DestroyGood', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init() {},
        destroy() {},
      };

      runtime.register(badMod);
      runtime.register(goodMod);
      await runtime.initAll();
      await runtime.destroyAll();

      // Error was emitted for bad module
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ moduleId: 'destroy-bad', phase: 'destroy' }),
      );
      // State cleared despite error
      expect(runtime.getModule('destroy-bad')).toBeUndefined();
      consoleError.mockRestore();
    });

    it('B1b: destroy error string (non-Error) is captured', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const runtime = createRuntime(eventBus, storeAccess);
      const mod: AppModule = {
        manifest: { id: 'str-destroy', name: 'StrDestroy', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init() {},
        destroy() { throw 'destroy string error'; },
      };
      runtime.register(mod);
      await runtime.initAll();
      await runtime.destroyAll();
      expect(consoleError).toHaveBeenCalled();
      expect(runtime.getModule('str-destroy')).toBeUndefined();
      consoleError.mockRestore();
    });

    it('B2: destroyAll on already-failed module does not throw', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const runtime = createRuntime(eventBus, storeAccess);
      const mod: AppModule = {
        manifest: { id: 'fail-then-destroy', name: 'FailDestroy', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init() { throw new Error('init fail'); },
        destroy: vi.fn(),
      };
      runtime.register(mod);
      await runtime.initAll();
      expect(runtime.isModuleFailed('fail-then-destroy')).toBe(true);
      // destroyAll should not throw even though module is failed
      await expect(runtime.destroyAll()).resolves.toBeUndefined();
      expect(mod.destroy).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  // ============================================================
  // Группа C — Hot reload
  // ============================================================

  describe('C — Hot reload', () => {
    it('C1: reloadModule on unknown module → returns false, warns', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const runtime = createRuntime(eventBus, storeAccess);
      const result = await runtime.reloadModule('nonexistent');
      expect(result).toBe(false);
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Cannot reload unknown module'),
      );
      consoleWarn.mockRestore();
    });

    it('C2: reloadModule success → returns true, emits module:reloaded', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const reloadHandler = vi.fn();
      eventBus.on('module:reloaded', reloadHandler);

      const mod = createTestModule('reload-me');
      runtime.register(mod);
      await runtime.initAll();

      const result = await runtime.reloadModule('reload-me');
      expect(result).toBe(true);
      expect(mod.destroy).toHaveBeenCalledTimes(1);
      expect(mod.init).toHaveBeenCalledTimes(2); // initAll + reload
      expect(reloadHandler).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'reload-me' }),
      );
    });

    it('C3: reloadModule where init() throws → returns false, failed state', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const runtime = createRuntime(eventBus, storeAccess);
      const errorHandler = vi.fn();
      eventBus.on('module:error', errorHandler);

      let shouldFail = false;
      const mod: AppModule = {
        manifest: { id: 'reload-fail', name: 'ReloadFail', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init() { if (shouldFail) throw new Error('reload init fail'); },
        destroy() { shouldFail = true; },
      };

      runtime.register(mod);
      await runtime.initAll();
      expect(runtime.isModuleFailed('reload-fail')).toBe(false);

      const result = await runtime.reloadModule('reload-fail');
      expect(result).toBe(false);
      expect(runtime.isModuleFailed('reload-fail')).toBe(true);
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ moduleId: 'reload-fail', phase: 'init' }),
      );
      consoleError.mockRestore();
    });

    it('C4: reloadModule where destroy() throws → continues to init', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const runtime = createRuntime(eventBus, storeAccess);
      const mod: AppModule = {
        manifest: { id: 'reload-destroy-fail', name: 'ReloadDestroyFail', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init() {},
        destroy() { throw new Error('destroy during reload'); },
      };
      runtime.register(mod);
      await runtime.initAll();

      const result = await runtime.reloadModule('reload-destroy-fail');
      // Should still succeed because init() doesn't throw
      expect(result).toBe(true);
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it('C5: reloadModule cleans up contributions, commands, keybindings, hooks', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      let initCount = 0;
      const cmdHandler = vi.fn();
      const mod: AppModule = {
        manifest: { id: 'cleanup-test', name: 'Cleanup', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init(ctx) {
          initCount++;
          if (initCount === 1) {
            // Only register on first init, so we can verify cleanup after reload
            ctx.registerUI({ slot: 'custom-slot', label: 'Old', component: () => null });
            ctx.registerCommand('my-cmd', cmdHandler);
            ctx.registerKeybinding('ctrl+k', 'my-cmd');
            ctx.registerLifecycleHook('beforeDestroy', vi.fn());
          }
        },
        destroy() {},
      };
      runtime.register(mod);
      await runtime.initAll();

      // Verify contributions exist
      expect(runtime.getUIContributions('custom-slot')).toHaveLength(1);
      runtime.executeCommand('cleanup-test:my-cmd'); // Should not throw

      // Reload with no-op init (second init does nothing)
      await runtime.reloadModule('cleanup-test');

      // Contributions should be cleared (no new ones registered in 2nd init)
      expect(runtime.getUIContributions('custom-slot')).toHaveLength(0);
      // Command should be cleared
      const cmdMap = runtime.getCommands();
      expect(cmdMap.has('cleanup-test:my-cmd')).toBe(false);
      // Keybindings should be cleared
      expect(runtime.getKeybindings()).toHaveLength(0);
    });
  });

  // ============================================================
  // Группа D — Состояния и переходы
  // ============================================================

  describe('D — States and transitions', () => {
    it('D1: initAll on already-initialized runtime → warns, does not re-init', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const runtime = createRuntime(eventBus, storeAccess);
      const mod = createTestModule('dup');
      runtime.register(mod);
      await runtime.initAll();
      await runtime.initAll();
      expect(mod.init).toHaveBeenCalledTimes(1);
      consoleWarn.mockRestore();
    });

    it('D2: disableModule on unknown → warns', () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const runtime = createRuntime(eventBus, storeAccess);
      runtime.disableModule('ghost');
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Cannot destroy unknown module'),
      );
      consoleWarn.mockRestore();
    });

    it('D3: enableModule on unknown → warns', () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const runtime = createRuntime(eventBus, storeAccess);
      runtime.enableModule('ghost');
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Cannot enable unknown module'),
      );
      consoleWarn.mockRestore();
    });

    it('D4: enableModule on failed module calls initOne — still failed if init throws', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const runtime = createRuntime(eventBus, storeAccess);

      const initFn = vi.fn(() => { throw new Error('fail'); });
      const mod: AppModule = {
        manifest: { id: 'fail-clear', name: 'FailClear', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init: initFn,
        destroy() {},
      };
      runtime.register(mod);
      await runtime.initAll();
      expect(runtime.isModuleFailed('fail-clear')).toBe(true);
      expect(initFn).toHaveBeenCalledTimes(1);

      const result = await runtime.enableModule('fail-clear');
      expect(result).toBe(false);
      expect(runtime.isModuleFailed('fail-clear')).toBe(true);
      expect(initFn).toHaveBeenCalledTimes(2);
      consoleError.mockRestore();
    });

    it('D5: getModuleStatuses returns correct status for all states', async () => {
      const runtime = createRuntime(eventBus, storeAccess);

      // Module that will init ok
      const okMod = createTestModule('ok-mod');
      runtime.register(okMod);

      // Module that will fail init
      const failMod: AppModule = {
        manifest: { id: 'fail-mod', name: 'FailMod', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init() { throw new Error('boom'); },
        destroy() {},
      };
      runtime.register(failMod);

      // Module that will be disabled
      const disabledMod = createTestModule('disabled-mod');
      runtime.register(disabledMod);
      runtime.disableModule('disabled-mod');

      await runtime.initAll();

      const statuses = runtime.getModuleStatuses();
      const byId = Object.fromEntries(statuses.map(s => [s.id, s.status]));

      expect(byId['ok-mod']).toBe('ok');
      expect(byId['fail-mod']).toBe('failed');
      expect(byId['disabled-mod']).toBe('disabled');
    });

    it('D5b: getModuleStatuses — not-loaded status for registered-but-not-initialized', () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const mod = createTestModule('not-loaded');
      runtime.register(mod);
      // Do NOT call initAll

      const statuses = runtime.getModuleStatuses();
      const s = statuses.find(s => s.id === 'not-loaded');
      expect(s?.status).toBe('not-loaded');
      expect(s?.enabled).toBe(true);
    });

    it('D6: isModuleFailed / isModuleDisabled', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const runtime = createRuntime(eventBus, storeAccess);

      const failMod: AppModule = {
        manifest: { id: 'check-fail', name: 'CheckFail', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init() { throw new Error('x'); },
        destroy() {},
      };
      runtime.register(failMod);
      runtime.register(createTestModule('check-normal'));

      await runtime.initAll();
      await runtime.disableModule('check-normal');

      expect(runtime.isModuleFailed('check-fail')).toBe(true);
      expect(runtime.isModuleDisabled('check-normal')).toBe(true);
      expect(runtime.isModuleFailed('check-normal')).toBe(false);
      expect(runtime.isModuleDisabled('check-fail')).toBe(false);
      consoleError.mockRestore();
    });

    it('D7: initOne on unknown module → returns false, warns', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const runtime = createRuntime(eventBus, storeAccess);
      expect(await runtime.initOne('ghost')).toBe(false);
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Cannot init unknown module'),
      );
      consoleWarn.mockRestore();
    });

    it('D8: initOne on already-initialized module → returns true, warns', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const runtime = createRuntime(eventBus, storeAccess);
      const mod = createTestModule('double-init');
      runtime.register(mod);
      await runtime.initAll();
      const result = await runtime.initOne('double-init');
      expect(result).toBe(true);
      expect(mod.init).toHaveBeenCalledTimes(1); // Not re-initialized
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('already initialized'),
      );
      consoleWarn.mockRestore();
    });

    it('D9: initOne failure → returns false, failed state, error event', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const runtime = createRuntime(eventBus, storeAccess);
      const errorHandler = vi.fn();
      eventBus.on('module:error', errorHandler);

      const mod: AppModule = {
        manifest: { id: 'initone-fail', name: 'InitOneFail', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init() { throw new Error('initone fail'); },
        destroy() {},
      };
      runtime.register(mod);
      const result = await runtime.initOne('initone-fail');
      expect(result).toBe(false);
      expect(runtime.isModuleFailed('initone-fail')).toBe(true);
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ moduleId: 'initone-fail', phase: 'init' }),
      );
      consoleError.mockRestore();
    });

    it('D10: initOne success → emits module:initialized', async () => {
      const initHandler = vi.fn();
      eventBus.on('module:initialized', initHandler);
      const runtime = createRuntime(eventBus, storeAccess);
      const mod = createTestModule('initone-ok');
      runtime.register(mod);
      const result = await runtime.initOne('initone-ok');
      expect(result).toBe(true);
      expect(initHandler).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'initone-ok', initTimeMs: expect.any(Number) }),
      );
    });

    it('D11: enableModule re-initializes disabled module and clears gate', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const mod = createTestModule('reenabled');
      const initHandler = vi.fn();
      mod.init = initHandler;
      runtime.register(mod);
      await runtime.initAll();
      expect(runtime.isModuleDisabled('reenabled')).toBe(false);
      expect(initHandler).toHaveBeenCalledTimes(1);
      await runtime.disableModule('reenabled');
      expect(runtime.isModuleDisabled('reenabled')).toBe(true);
      const result = await runtime.enableModule('reenabled');
      expect(result).toBe(true);
      expect(runtime.isModuleDisabled('reenabled')).toBe(false);
      expect(initHandler).toHaveBeenCalledTimes(2);
    });

    it('D12: destroyOne on unknown module → warns', () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const runtime = createRuntime(eventBus, storeAccess);
      runtime.destroyOne('ghost');
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Cannot destroy unknown module'),
      );
      consoleWarn.mockRestore();
    });

    it('D13: destroyOne cleans up state, adds to disabled, emits event', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const disabledHandler = vi.fn();
      eventBus.on('module:disabled', disabledHandler);

      const mod: AppModule = {
        manifest: { id: 'destroyone', name: 'DestroyOne', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init(ctx) {
          ctx.registerUI({ slot: 'my-slot', label: 'Test', component: () => null });
          ctx.registerCommand('my-cmd', vi.fn());
          ctx.registerKeybinding('ctrl+d', 'my-cmd');
          ctx.registerLifecycleHook('beforeDestroy', vi.fn());
        },
        destroy: vi.fn(),
      };
      runtime.register(mod);
      await runtime.initAll();

      // Verify keybinding exists before destroy
      expect(runtime.getKeybindings()).toHaveLength(1);

      await runtime.destroyOne('destroyone');

      // Module disabled
      expect(runtime.isModuleDisabled('destroyone')).toBe(true);
      // Context cleared
      expect(runtime.getContext('destroyone')).toBeUndefined();
      // Contributions cleared
      expect(runtime.getUIContributions('my-slot')).toHaveLength(0);
      // Commands cleared
      expect(runtime.getCommands().has('destroyone:my-cmd')).toBe(false);
      // Keybindings cleared
      expect(runtime.getKeybindings()).toHaveLength(0);
      // destroy called
      expect(mod.destroy).toHaveBeenCalled();
      // Event emitted
      expect(disabledHandler).toHaveBeenCalledWith({ id: 'destroyone' });
    });

    it('D14: destroyOne where destroy() throws → still cleans up', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const runtime = createRuntime(eventBus, storeAccess);

      const mod: AppModule = {
        manifest: { id: 'destroyone-err', name: 'DestroyOneErr', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init() {},
        destroy() { throw new Error('destroyone err'); },
      };
      runtime.register(mod);
      await runtime.initAll();

      // Should not throw
      runtime.destroyOne('destroyone-err');
      expect(runtime.isModuleDisabled('destroyone-err')).toBe(true);
      expect(runtime.getContext('destroyone-err')).toBeUndefined();
      consoleError.mockRestore();
    });
  });

  // ============================================================
  // Группа E — EventBus интеграция
  // ============================================================

  describe('E — EventBus integration', () => {
    it('E1: module:initialized event includes initTimeMs', async () => {
      const handler = vi.fn();
      eventBus.on('module:initialized', handler);
      const runtime = createRuntime(eventBus, storeAccess);
      runtime.register(createTestModule('timing'));
      await runtime.initAll();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'timing', initTimeMs: expect.any(Number) }),
      );
      const timeMs = handler.mock.calls[0][0].initTimeMs as number;
      expect(timeMs).toBeGreaterThanOrEqual(0);
    });

    it('E2: module:error event on init failure includes error and phase', async () => {
      const handler = vi.fn();
      eventBus.on('module:error', handler);
      const runtime = createRuntime(eventBus, storeAccess);

      const mod: AppModule = {
        manifest: { id: 'evt-err', name: 'EvtErr', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init() { throw new Error('event test error'); },
        destroy() {},
      };
      runtime.register(mod);
      await runtime.initAll();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          moduleId: 'evt-err',
          phase: 'init',
          error: expect.any(Error),
        }),
      );
      expect((handler.mock.calls[0][0] as { error: Error }).error.message).toBe('event test error');
    });

    it('E3: module:disabled event on disableModule', async () => {
      const handler = vi.fn();
      eventBus.on('module:disabled', handler);
      const runtime = createRuntime(eventBus, storeAccess);
      runtime.register(createTestModule('dis-evt'));
      await runtime.disableModule('dis-evt');
      expect(handler).toHaveBeenCalledWith({ id: 'dis-evt' });
    });

    it('E4: module:enabled event on enableModule', async () => {
      const handler = vi.fn();
      eventBus.on('module:enabled', handler);
      const runtime = createRuntime(eventBus, storeAccess);
      runtime.register(createTestModule('en-evt'));
      await runtime.disableModule('en-evt');
      await runtime.enableModule('en-evt');
      expect(handler).toHaveBeenCalledWith({ id: 'en-evt' });
    });

    it('E5: module:reloaded event on successful reload', async () => {
      const handler = vi.fn();
      eventBus.on('module:reloaded', handler);
      const runtime = createRuntime(eventBus, storeAccess);
      runtime.register(createTestModule('reload-evt'));
      await runtime.initAll();
      await runtime.reloadModule('reload-evt');
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'reload-evt', initTimeMs: expect.any(Number) }),
      );
    });
  });

  // ============================================================
  // F — declareSlot, getSlotOptions, getDeclaredSlots
  // ============================================================

  describe('F — Slot management', () => {
    it('F1: declareSlot creates new slot', () => {
      const runtime = createRuntime(eventBus, storeAccess);
      runtime.declareSlot('my-slot', { label: 'My Slot', defaultVisible: false });
      const slots = runtime.getDeclaredSlots();
      expect(slots).toContain('my-slot');
      const opts = runtime.getSlotOptions('my-slot');
      expect(opts?.label).toBe('My Slot');
      expect(opts?.defaultVisible).toBe(false);
    });

    it('F2: declareSlot updates options for existing slot', () => {
      const runtime = createRuntime(eventBus, storeAccess);
      runtime.declareSlot('update-slot', { label: 'Original', defaultVisible: true });
      runtime.declareSlot('update-slot', { label: 'Updated' });
      const opts = runtime.getSlotOptions('update-slot');
      expect(opts?.label).toBe('Updated');
      // defaultVisible not changed (not passed in second call)
      expect(opts?.defaultVisible).toBe(true);
    });

    it('F3: getSlotOptions returns undefined for unknown slot', () => {
      const runtime = createRuntime(eventBus, storeAccess);
      expect(runtime.getSlotOptions('nonexistent')).toBeUndefined();
    });

    it('F4: declareSlot defaults when no options given', () => {
      const runtime = createRuntime(eventBus, storeAccess);
      runtime.declareSlot('defaults');
      const opts = runtime.getSlotOptions('defaults');
      expect(opts?.label).toBe('defaults');
      expect(opts?.defaultVisible).toBe(true);
    });
  });

  // ============================================================
  // G — getUIContributions filtering
  // ============================================================

  describe('G — getUIContributions filtering', () => {
    it('G1: filters out contributions from failed modules', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const runtime = createRuntime(eventBus, storeAccess);
      const Dummy = () => null;

      const okMod: AppModule = {
        manifest: { id: 'ok-contrib', name: 'Ok', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init(ctx) {
          ctx.registerUI({ slot: 'shared', label: 'OK', component: Dummy });
        },
        destroy() {},
      };
      const failMod: AppModule = {
        manifest: { id: 'fail-contrib', name: 'Fail', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init(ctx) {
          ctx.registerUI({ slot: 'shared', label: 'FAIL', component: Dummy });
          throw new Error('fail after registering');
        },
        destroy() {},
      };

      runtime.register(okMod);
      runtime.register(failMod);
      await runtime.initAll();

      const contribs = runtime.getUIContributions('shared');
      const labels = contribs.map(c => c.label);
      expect(labels).toContain('OK');
      expect(labels).not.toContain('FAIL');
      consoleError.mockRestore();
    });

    it('G2: filters out contributions from disabled modules', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const Dummy = () => null;

      const mod: AppModule = {
        manifest: { id: 'dis-contrib', name: 'Disabled', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init(ctx) {
          ctx.registerUI({ slot: 'dis-slot', label: 'Disabled Contribution', component: Dummy });
        },
        destroy() {},
      };
      runtime.register(mod);
      await runtime.initAll();

      expect(runtime.getUIContributions('dis-slot')).toHaveLength(1);
      await runtime.disableModule('dis-contrib');
      expect(runtime.getUIContributions('dis-slot')).toHaveLength(0);
    });

    it('G3: sorts contributions by priority desc, then order asc', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const Dummy = () => null;
      const mod: AppModule = {
        manifest: { id: 'prio-test', name: 'Prio', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init(ctx) {
          ctx.registerUI({ slot: 'prio-slot', label: 'Low', component: Dummy, priority: 1, order: 5 });
          ctx.registerUI({ slot: 'prio-slot', label: 'High', component: Dummy, priority: 10, order: 99 });
          ctx.registerUI({ slot: 'prio-slot', label: 'Med', component: Dummy, priority: 5, order: 1 });
        },
        destroy() {},
      };
      runtime.register(mod);
      await runtime.initAll();

      const labels = runtime.getUIContributions('prio-slot').map(c => c.label);
      expect(labels).toEqual(['High', 'Med', 'Low']);
    });

    it('G4: getUIContributions filters by when (contextKeys)', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const Dummy = () => null;

      const mod: AppModule = {
        manifest: { id: 'when-test', name: 'When', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init(ctx) {
          ctx.registerUI({ slot: 'when-slot', label: 'Always', component: Dummy }); // no when
          ctx.registerUI({ slot: 'when-slot', label: 'Conditional', component: Dummy, when: 'someKey' });
        },
        destroy() {},
      };
      runtime.register(mod);
      await runtime.initAll();

      const contribs = runtime.getUIContributions('when-slot');
      // 'Always' has no when → included
      // 'Conditional' has when='someKey' → depends on contextKeys evaluate
      // Without setting the key, evaluate returns false → filtered out
      expect(contribs).toHaveLength(1);
      expect(contribs[0].label).toBe('Always');
    });
  });

  // ============================================================
  // H — handleKeybinding, getKeybindings, triggerSettingsChange
  // ============================================================

  describe('H — Keybindings and commands', () => {
    it('H1: handleKeybinding dispatches to command', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const cmdHandler = vi.fn();
      const mod: AppModule = {
        manifest: { id: 'kb-test', name: 'KB', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init(ctx) {
          ctx.registerCommand('do-it', cmdHandler);
          ctx.registerKeybinding('Ctrl+K', 'do-it');
        },
        destroy() {},
      };
      runtime.register(mod);
      await runtime.initAll();

      const result = runtime.handleKeybinding('ctrl+k');
      expect(result).toBe(true);
      expect(cmdHandler).toHaveBeenCalledOnce();
    });

    it('H2: handleKeybinding returns false for unknown binding', () => {
      const runtime = createRuntime(eventBus, storeAccess);
      expect(runtime.handleKeybinding('ctrl+shift+xyz')).toBe(false);
    });

    it('H3: handleKeybinding returns false when binding exists but command missing', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const mod: AppModule = {
        manifest: { id: 'kb-orphan', name: 'KB Orphan', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init(ctx) {
          ctx.registerKeybinding('Ctrl+Z', 'nonexistent-cmd');
        },
        destroy() {},
      };
      runtime.register(mod);
      await runtime.initAll();
      // Binding registered but command doesn't exist
      expect(runtime.handleKeybinding('ctrl+z')).toBe(false);
    });

    it('H4: getKeybindings returns all registered keybindings', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const mod: AppModule = {
        manifest: { id: 'kb-list', name: 'KB List', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init(ctx) {
          ctx.registerCommand('a', vi.fn());
          ctx.registerCommand('b', vi.fn());
          ctx.registerKeybinding('Ctrl+A', 'a');
          ctx.registerKeybinding('Ctrl+B', 'b');
        },
        destroy() {},
      };
      runtime.register(mod);
      await runtime.initAll();

      const bindings = runtime.getKeybindings();
      expect(bindings).toHaveLength(2);
      const keys = bindings.map(b => b.keys);
      expect(keys).toContain('ctrl+a');
      expect(keys).toContain('ctrl+b');
    });

    it('H5: registerKeybinding overrides existing binding (warns)', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const runtime = createRuntime(eventBus, storeAccess);

      const mod1: AppModule = {
        manifest: { id: 'kb-mod1', name: 'KB1', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init(ctx) {
          ctx.registerCommand('do', vi.fn());
          ctx.registerKeybinding('Ctrl+D', 'do');
        },
        destroy() {},
      };
      const mod2: AppModule = {
        manifest: { id: 'kb-mod2', name: 'KB2', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init(ctx) {
          ctx.registerCommand('do2', vi.fn());
          ctx.registerKeybinding('Ctrl+D', 'do2'); // override
        },
        destroy() {},
      };

      runtime.register(mod1);
      runtime.register(mod2);
      await runtime.initAll();

      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('already registered by "kb-mod1"'),
      );
      consoleWarn.mockRestore();
    });

    it('H6: getCommands returns command map', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const handler = vi.fn();
      const mod: AppModule = {
        manifest: { id: 'cmd-map', name: 'CmdMap', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init(ctx) {
          ctx.registerCommand('test', handler);
        },
        destroy() {},
      };
      runtime.register(mod);
      await runtime.initAll();

      const cmds = runtime.getCommands();
      expect(cmds.has('cmd-map:test')).toBe(true);
      expect(cmds.get('cmd-map:test')).toBe(handler);
    });
  });

  // ============================================================
  // I — triggerSettingsChange
  // ============================================================

  describe('I — triggerSettingsChange', () => {
    it('I1: calls matching module hooks', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const hook = vi.fn();
      const mod: AppModule = {
        manifest: { id: 'settings-mod', name: 'Settings', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init(ctx) {
          ctx.registerLifecycleHook('onSettingsChange', hook);
        },
        destroy() {},
      };
      runtime.register(mod);
      await runtime.initAll();

      runtime.triggerSettingsChange('settings-mod', 'threshold', 50);
      expect(hook).toHaveBeenCalledWith({ moduleId: 'settings-mod', key: 'threshold', value: 50 });
    });

    it('I2: wildcard hook "*" catches all modules', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const wildcardHook = vi.fn();
      const specificHook = vi.fn();

      const mod1: AppModule = {
        manifest: { id: 'wc-mod1', name: 'WC1', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init(ctx) {
          ctx.registerLifecycleHook('onSettingsChange', wildcardHook);
        },
        destroy() {},
      };
      // Manually set moduleId to '*' for wildcard
      const mod2: AppModule = {
        manifest: { id: 'wc-mod2', name: 'WC2', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init(ctx) {
          ctx.registerLifecycleHook('onSettingsChange', specificHook);
        },
        destroy() {},
      };

      runtime.register(mod1);
      runtime.register(mod2);
      await runtime.initAll();

      // Trigger for different module — only wildcard fires if moduleId matches
      runtime.triggerSettingsChange('wc-mod2', 'key', 'val');
      expect(specificHook).toHaveBeenCalledWith({ moduleId: 'wc-mod2', key: 'key', value: 'val' });
    });

    it('I3: hook error is caught and logged', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const runtime = createRuntime(eventBus, storeAccess);
      const badHook = vi.fn(() => { throw new Error('hook error'); });

      const mod: AppModule = {
        manifest: { id: 'hook-err', name: 'HookErr', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init(ctx) {
          ctx.registerLifecycleHook('onSettingsChange', badHook);
        },
        destroy() {},
      };
      runtime.register(mod);
      await runtime.initAll();

      // Should not throw
      runtime.triggerSettingsChange('hook-err', 'k', 'v');
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  // ============================================================
  // J — Lifecycle hooks (registerLifecycleHook, runLifecycleHooks)
  // ============================================================

  describe('J — Lifecycle hooks', () => {
    it('J1: beforeDestroy hook fires on destroyAll', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const hook = vi.fn();
      const mod: AppModule = {
        manifest: { id: 'lifecycle-test', name: 'Lifecycle', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init(ctx) {
          ctx.registerLifecycleHook('beforeDestroy', hook);
        },
        destroy() {},
      };
      runtime.register(mod);
      await runtime.initAll();
      await runtime.destroyAll();
      expect(hook).toHaveBeenCalledOnce();
    });

    it('J2: beforeDestroy hook error is caught', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const runtime = createRuntime(eventBus, storeAccess);
      const mod: AppModule = {
        manifest: { id: 'hook-destroy-err', name: 'HookDestroyErr', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init(ctx) {
          ctx.registerLifecycleHook('beforeDestroy', () => { throw new Error('hook destroy err'); });
        },
        destroy() {},
      };
      runtime.register(mod);
      await runtime.initAll();
      await runtime.destroyAll();
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it('J3: registerLifecycleHook returns unsubscribe function', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      let unsub: (() => void) | undefined;
      const hook = vi.fn();
      const mod: AppModule = {
        manifest: { id: 'unsub-test', name: 'Unsub', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init(ctx) {
          unsub = ctx.registerLifecycleHook('onSettingsChange', hook);
        },
        destroy() {},
      };
      runtime.register(mod);
      await runtime.initAll();

      // Hook fires
      runtime.triggerSettingsChange('unsub-test', 'k', 'v');
      expect(hook).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsub!();
      runtime.triggerSettingsChange('unsub-test', 'k2', 'v2');
      expect(hook).toHaveBeenCalledTimes(1); // Not called again
    });

    it('J4: beforeDestroy hook fires during reloadModule', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const hook = vi.fn();
      const mod: AppModule = {
        manifest: { id: 'reload-hook', name: 'ReloadHook', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init(ctx) {
          ctx.registerLifecycleHook('beforeDestroy', hook);
        },
        destroy() {},
      };
      runtime.register(mod);
      await runtime.initAll();
      await runtime.reloadModule('reload-hook');
      expect(hook).toHaveBeenCalledTimes(1); // Once from reload
    });
  });

  // ============================================================
  // K — getContext, getModule, getAllContributionsBySlot
  // ============================================================

  describe('K — Getters', () => {
    it('K1: getContext returns context after init', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      runtime.register(createTestModule('ctx-get'));
      await runtime.initAll();
      expect(runtime.getContext('ctx-get')).toBeDefined();
    });

    it('K2: getContext returns undefined for unknown module', () => {
      const runtime = createRuntime(eventBus, storeAccess);
      expect(runtime.getContext('ghost')).toBeUndefined();
    });

    it('K3: getModule returns undefined for unknown module', () => {
      const runtime = createRuntime(eventBus, storeAccess);
      expect(runtime.getModule('ghost')).toBeUndefined();
    });

    it('K4: getAllContributionsBySlot returns all contributions', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const Dummy = () => null;
      const mod: AppModule = {
        manifest: { id: 'all-contrib', name: 'AllContrib', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init(ctx) {
          ctx.registerUI({ slot: 'slot-a', label: 'A', component: Dummy });
          ctx.registerUI({ slot: 'slot-b', label: 'B', component: Dummy });
        },
        destroy() {},
      };
      runtime.register(mod);
      await runtime.initAll();

      const all = runtime.getAllContributionsBySlot();
      expect(Object.keys(all)).toContain('slot-a');
      expect(Object.keys(all)).toContain('slot-b');
      expect(all['slot-a']).toHaveLength(1);
      expect(all['slot-b']).toHaveLength(1);
    });
  });

  // ============================================================
  // L — declareSlot from context (ctx.declareSlot)
  // ============================================================

  describe('L — ctx.declareSlot', () => {
    it('L1: module can declare a custom slot via context', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const mod: AppModule = {
        manifest: { id: 'ctx-slot', name: 'CtxSlot', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init(ctx) {
          ctx.declareSlot('my-custom-slot', { label: 'Custom Slot' });
        },
        destroy() {},
      };
      runtime.register(mod);
      await runtime.initAll();
      expect(runtime.getDeclaredSlots()).toContain('my-custom-slot');
      expect(runtime.getSlotOptions('my-custom-slot')?.label).toBe('Custom Slot');
    });

    it('L2: ctx.declareSlot updates existing slot options', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      runtime.declareSlot('ctx-update-slot', { label: 'Original' });

      const mod: AppModule = {
        manifest: { id: 'ctx-update', name: 'CtxUpdate', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init(ctx) {
          ctx.declareSlot('ctx-update-slot', { label: 'Updated From Ctx', defaultVisible: false });
        },
        destroy() {},
      };
      runtime.register(mod);
      await runtime.initAll();

      const opts = runtime.getSlotOptions('ctx-update-slot');
      expect(opts?.label).toBe('Updated From Ctx');
      expect(opts?.defaultVisible).toBe(false);
    });
  });

  // ============================================================
  // M — enablePlugin / disablePlugin (full lifecycle with pluginRegistry)
  // ============================================================

  describe('M — enablePlugin / disablePlugin', () => {
    it('M1: enablePlugin throws if plugin not installed in registry', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      await expect(runtime.enablePlugin('ghost-plugin')).rejects.toThrow('is not installed');
    });

    it('M2: disablePlugin calls destroyOne + pluginRegistry.disable', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const mod = createTestModule('plugin-toggle');
      runtime.register(mod);
      pluginRegistry.install('plugin-toggle', 'user');

      await runtime.initAll();
      await runtime.disablePlugin('plugin-toggle');

      expect(runtime.isModuleDisabled('plugin-toggle')).toBe(true);
      expect(pluginRegistry.isEnabled('plugin-toggle')).toBe(false);
    });

    it('M3: enablePlugin on already-initialized module just enables', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const mod = createTestModule('re-enable');
      runtime.register(mod);
      pluginRegistry.install('re-enable', 'user');

      await runtime.initAll();
      await runtime.disableModule('re-enable');
      const result = await runtime.enablePlugin('re-enable');

      expect(result).toBe(true);
      expect(runtime.isModuleDisabled('re-enable')).toBe(false);
      expect(pluginRegistry.isEnabled('re-enable')).toBe(true);
    });

    it('M4: enablePlugin on registered-but-not-initialized module calls initOne', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const mod = createTestModule('init-on-enable');
      runtime.register(mod);
      pluginRegistry.install('init-on-enable', 'user');
      // Do NOT call initAll

      const result = await runtime.enablePlugin('init-on-enable');
      expect(result).toBe(true);
      expect(mod.init).toHaveBeenCalledOnce();
    });

    it('M5: enablePlugin when initOne fails → returns false', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const runtime = createRuntime(eventBus, storeAccess);
      const mod: AppModule = {
        manifest: { id: 'enable-fail', name: 'EnableFail', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init() { throw new Error('enable fail'); },
        destroy() {},
      };
      runtime.register(mod);
      pluginRegistry.install('enable-fail', 'user');

      const result = await runtime.enablePlugin('enable-fail');
      expect(result).toBe(false);
      expect(runtime.isModuleFailed('enable-fail')).toBe(true);
      consoleError.mockRestore();
    });

    it('M6: enablePlugin fails gracefully when dynamic import fails', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const runtime = createRuntime(eventBus, storeAccess);
      // Install in registry but NOT register in runtime — will try dynamic import
      pluginRegistry.install('dynamic-fail', 'user');

      const result = await runtime.enablePlugin('dynamic-fail');
      expect(result).toBe(false);
      expect(runtime.isModuleFailed('dynamic-fail')).toBe(true);
      consoleError.mockRestore();
    });
  });

  // ============================================================
  // N — registerUI auto-creates slot
  // ============================================================

  describe('N — registerUI auto-creates slot', () => {
    it('N1: registerUI creates slot if it does not exist', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const Dummy = () => null;
      const mod: AppModule = {
        manifest: { id: 'auto-slot', name: 'AutoSlot', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init(ctx) {
          ctx.registerUI({ slot: 'brand-new-slot', label: 'Auto Created', component: Dummy });
        },
        destroy() {},
      };
      runtime.register(mod);
      await runtime.initAll();

      expect(runtime.getDeclaredSlots()).toContain('brand-new-slot');
      const contribs = runtime.getUIContributions('brand-new-slot');
      expect(contribs).toHaveLength(1);
      expect(contribs[0].label).toBe('Auto Created');
    });

    it('N2: registerUI assigns default order if not provided', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const Dummy = () => null;
      const mod: AppModule = {
        manifest: { id: 'default-order', name: 'DefaultOrder', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
        init(ctx) {
          ctx.registerUI({ slot: 'order-slot', label: 'First', component: Dummy });
          ctx.registerUI({ slot: 'order-slot', label: 'Second', component: Dummy });
        },
        destroy() {},
      };
      runtime.register(mod);
      await runtime.initAll();

      const contribs = runtime.getUIContributions('order-slot');
      expect(contribs[0].order).toBe(0);
      expect(contribs[1].order).toBe(1);
    });
  });

  // ============================================================
  // O — Singleton: getRuntime / createRuntime
  // ============================================================

  describe('O — Singleton', () => {
    it('O1: getRuntime returns the created runtime instance', async () => {
      const { getRuntime } = await import('@/core/module-runtime');
      const runtime = createRuntime(eventBus, storeAccess);
      expect(getRuntime()).toBe(runtime);
    });
  });

  // ============================================================
  // P — CRITICAL: disableModule MUST stop execution (HARD STOP)
  // ============================================================

  describe('P — Hard stop on disable', () => {
    it('P1: disableModule calls destroy and cleans up state', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const mod = createTestModule('hard-stop');
      runtime.register(mod);
      expect(mod.init).toHaveBeenCalledTimes(0);
      await runtime.disableModule('hard-stop');
      expect(mod.destroy).toHaveBeenCalledTimes(1);
      expect(runtime.isModuleDisabled('hard-stop')).toBe(true);
      expect(runtime.getModule('hard-stop')).toBe(mod);
    });

    it('P2: disableModule removes contributions, commands, keybindings', () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const mod = createTestModule('hard-cleanup');
      runtime.register(mod);
      runtime.getUIContributions('left-panel');
      runtime.disableModule('hard-cleanup');
      expect(runtime.getContext('hard-cleanup')).toBeUndefined();
    });

    it('P3: disableModule emits module:disabled event', async () => {
      const handler = vi.fn();
      eventBus.on('module:disabled', handler);
      const runtime = createRuntime(eventBus, storeAccess);
      runtime.register(createTestModule('event-check'));
      await runtime.disableModule('event-check');
      expect(handler).toHaveBeenCalledWith({ id: 'event-check' });
    });

    it('P4: disableModule then enableModule re-initializes the module', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const mod = createTestModule('re-init');
      runtime.register(mod);
      await runtime.disableModule('re-init');
      expect(mod.destroy).toHaveBeenCalledTimes(1);
      expect(runtime.isModuleDisabled('re-init')).toBe(true);

      const result = await runtime.enableModule('re-init');
      expect(result).toBe(true);
      expect(mod.init).toHaveBeenCalledTimes(1);
      expect(runtime.isModuleDisabled('re-init')).toBe(false);
      expect(runtime.getContext('re-init')).toBeDefined();
    });

    it('P5: disablePlugin also hard-stops via destroyOne', async () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const mod = createTestModule('plugin-stop');
      runtime.register(mod);
      await runtime.disableModule('plugin-stop');
      expect(mod.destroy).toHaveBeenCalledTimes(1);
      expect(runtime.isModuleDisabled('plugin-stop')).toBe(true);
    });
  });

  // ============================================================
  // Q — Execution Gate integration (CRITICAL: must not execute)
  // ============================================================

  describe('Q — Execution Gate integration', () => {
    it('Q1: initOne on execution-gate-disabled module returns false and does not init', async () => {
      const { executionGate } = await import('@/core/module-execution-gate');
      const runtime = createRuntime(eventBus, storeAccess);
      const mod = createTestModule('gate-blocked');
      runtime.register(mod);

      executionGate.disable('gate-blocked');
      runtime.initOne('gate-blocked');

      expect(mod.init).not.toHaveBeenCalled();
      expect(runtime.isModuleDisabled('gate-blocked')).toBe(false);
    });

    it('Q2: initAll skips execution-gate-disabled modules', async () => {
      const { executionGate } = await import('@/core/module-execution-gate');
      const runtime = createRuntime(eventBus, storeAccess);
      const mod = createTestModule('gate-skip');
      runtime.register(mod);

      executionGate.disable('gate-skip');
      await runtime.initAll();

      expect(mod.init).not.toHaveBeenCalled();
    });

    it('Q3: reloadModule on execution-gate-disabled module returns false', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { executionGate } = await import('@/core/module-execution-gate');
      const runtime = createRuntime(eventBus, storeAccess);
      const mod = createTestModule('gate-reload');
      runtime.register(mod);
      await runtime.initAll();

      executionGate.disable('gate-reload');
      const result = await runtime.reloadModule('gate-reload');

      expect(result).toBe(false);
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Cannot reload blocked module'),
      );
      consoleWarn.mockRestore();
    });

    it('Q4: enableModule clears execution gate and re-inits with fresh init', async () => {
      const { executionGate } = await import('@/core/module-execution-gate');
      const runtime = createRuntime(eventBus, storeAccess);
      const mod = createTestModule('fresh-init');
      runtime.register(mod);

      // Init once via initOne
      await runtime.initOne('fresh-init');
      expect(mod.init).toHaveBeenCalledTimes(1);

      // Disable
      await runtime.disableModule('fresh-init');
      expect(runtime.isModuleDisabled('fresh-init')).toBe(true);
      expect(executionGate.isBlocked('fresh-init')).toBe(true);

      // Re-enable — should clear gate and call init again
      const result = await runtime.enableModule('fresh-init');
      expect(result).toBe(true);
      expect(executionGate.isBlocked('fresh-init')).toBe(false);
      expect(mod.init).toHaveBeenCalledTimes(2);
    });

    it('Q5: disableModule cleans up runtime handles (timers, intervals, unsubscribers)', () => {
      const runtime = createRuntime(eventBus, storeAccess);
      const mod = createTestModule('handle-clean');
      runtime.register(mod);

      const handle = runtime.getHandle('handle-clean');
      handle.timers.add(42 as unknown as ReturnType<typeof setTimeout>);
      handle.intervals.add(99 as unknown as ReturnType<typeof setInterval>);
      handle.unsubscribers.add(() => {});

      runtime.disableModule('handle-clean');

      const newHandle = runtime.getHandle('handle-clean');
      expect(newHandle.timers.size).toBe(0);
      expect(newHandle.intervals.size).toBe(0);
      expect(newHandle.unsubscribers.size).toBe(0);
    });
  });
});
