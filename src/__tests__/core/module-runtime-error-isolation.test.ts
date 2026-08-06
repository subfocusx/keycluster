// ============================================================
// Tests: module-runtime — error isolation, ModuleStatus,
//        enable/disable, reloadModule, getModuleStatuses
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRuntime } from '@/core/module-runtime';
import { createStoreAccess } from '@/core/store';
import type { AppModule } from '@/core/types';
import { createEventBus } from '@/core/event-bus';

function createTestModule(id: string, deps?: string[]): AppModule & { initFn: ReturnType<typeof vi.fn>; destroyFn: ReturnType<typeof vi.fn> } {
  const initFn = vi.fn();
  const destroyFn = vi.fn();
  return {
    manifest: {
      id,
      name: `Module ${id}`,
      version: '1.0.0',
      description: `Test module ${id}`,
      dependencies: deps ?? [],
      settingsSchema: [],
      slot: ['left-panel'],
    },
    init: initFn,
    destroy: destroyFn,
    initFn,
    destroyFn,
  };
}

describe('ModuleRuntime — Error Isolation + ModuleStatus', () => {
  let eventBus: ReturnType<typeof createEventBus>;
  let storeAccess: ReturnType<typeof createStoreAccess>;

  beforeEach(() => {
    eventBus = createEventBus();
    (eventBus as { clear(): void }).clear();
    storeAccess = createStoreAccess();
  });

  // ---- Error Isolation ----

  it('should emit module:error and continue when init() throws', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const handler = vi.fn();
    eventBus.on('module:error', handler);

    const failingModule: AppModule = {
      manifest: { id: 'failing', name: 'Failing', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
      init() { throw new Error('Init failed!'); },
      destroy() {},
    };
    const goodModule = createTestModule('good');

    runtime.register(failingModule);
    runtime.register(goodModule);
    await runtime.initAll();

    // Error event emitted
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleId: 'failing',
        phase: 'init',
      }),
    );

    // Good module still initialized
    expect(goodModule.initFn).toHaveBeenCalledOnce();
  });

  it('should mark module as failed when init() throws', async () => {
    const runtime = createRuntime(eventBus, storeAccess);

    const failingModule: AppModule = {
      manifest: { id: 'fail-mod', name: 'Fail', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
      init() { throw new Error('Boom'); },
      destroy() {},
    };

    runtime.register(failingModule);
    await runtime.initAll();

    expect(runtime.isModuleFailed('fail-mod')).toBe(true);
  });

  it('should skip failed module contributions from getUIContributions()', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const DummyComp = () => null;

    const failingModule: AppModule = {
      manifest: { id: 'fail-ui', name: 'Fail UI', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
      init(ctx) {
        ctx.registerUI({ slot: 'left-panel', label: 'Failing Panel', component: DummyComp });
        throw new Error('Init failed after registerUI');
      },
      destroy() {},
    };

    runtime.register(failingModule);
    await runtime.initAll();

    // Contributions from failed module should be filtered out
    const contribs = runtime.getUIContributions('left-panel');
    expect(contribs).toHaveLength(0);
  });

  it('should emit module:error when destroy() throws', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const handler = vi.fn();
    eventBus.on('module:error', handler);

    const failDestroy: AppModule = {
      manifest: { id: 'fail-destroy', name: 'Fail Destroy', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
      init() {},
      destroy() { throw new Error('Destroy failed!'); },
    };

    runtime.register(failDestroy);
    await runtime.initAll();
    await runtime.destroyAll();

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleId: 'fail-destroy',
        phase: 'destroy',
      }),
    );
  });

  // ---- ModuleStatus ----

  it('should return correct ModuleStatus for all modules', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const mod = createTestModule('status-test');

    runtime.register(mod);
    await runtime.initAll();

    const statuses = runtime.getModuleStatuses();
    expect(statuses).toHaveLength(1);
    expect(statuses[0].id).toBe('status-test');
    expect(statuses[0].status).toBe('ok');
    expect(statuses[0].enabled).toBe(true);
  });

  it('should show failed status for module that threw in init', async () => {
    const runtime = createRuntime(eventBus, storeAccess);

    const fail: AppModule = {
      manifest: { id: 'fail-status', name: 'Fail', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
      init() { throw new Error('Fail!'); },
      destroy() {},
    };

    runtime.register(fail);
    await runtime.initAll();

    const statuses = runtime.getModuleStatuses();
    const failStatus = statuses.find(s => s.id === 'fail-status');
    expect(failStatus?.status).toBe('failed');
    expect(failStatus?.error).toBe('Fail!');
  });

  // ---- Enable/Disable ----

  it('should disable a module and mark it as disabled', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const mod = createTestModule('dis-mod');

    runtime.register(mod);
    await runtime.initAll();

    await runtime.disableModule('dis-mod');

    expect(runtime.isModuleDisabled('dis-mod')).toBe(true);

    const statuses = runtime.getModuleStatuses();
    const disStatus = statuses.find(s => s.id === 'dis-mod');
    expect(disStatus?.status).toBe('disabled');
    expect(disStatus?.enabled).toBe(false);
  });

  it('should skip disabled module contributions from getUIContributions()', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const DummyComp = () => null;

    const mod: AppModule = {
      manifest: { id: 'dis-ui', name: 'Dis UI', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
      init(ctx) {
        ctx.registerUI({ slot: 'left-panel', label: 'Panel', component: DummyComp });
      },
      destroy() {},
    };

    runtime.register(mod);
    await runtime.initAll();

    // Before disable
    expect(runtime.getUIContributions('left-panel')).toHaveLength(1);

    // After disable
    await runtime.disableModule('dis-ui');
    expect(runtime.getUIContributions('left-panel')).toHaveLength(0);
  });

  it('should emit module:disabled event', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const handler = vi.fn();
    eventBus.on('module:disabled', handler);

    runtime.register(createTestModule('dis-event'));
    await runtime.initAll();

    await runtime.disableModule('dis-event');
    expect(handler).toHaveBeenCalledWith({ id: 'dis-event' });
  });

  it('should re-enable a disabled module', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    runtime.register(createTestModule('reenable'));
    await runtime.initAll();

    await runtime.disableModule('reenable');
    expect(runtime.isModuleDisabled('reenable')).toBe(true);

    await runtime.enableModule('reenable');
    expect(runtime.isModuleDisabled('reenable')).toBe(false);

    const statuses = runtime.getModuleStatuses();
    const s = statuses.find(x => x.id === 'reenable');
    expect(s?.status).toBe('ok');
    expect(s?.enabled).toBe(true);
  });

  it('should emit module:enabled event', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const handler = vi.fn();
    eventBus.on('module:enabled', handler);

    runtime.register(createTestModule('en-event'));
    await runtime.initAll();

    await runtime.disableModule('en-event');
    await runtime.enableModule('en-event');
    expect(handler).toHaveBeenCalledWith({ id: 'en-event' });
  });

  // ---- Reload ----

  it('should reload a module (destroy + init)', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    let initCount = 0;
    let destroyCount = 0;

    const mod: AppModule = {
      manifest: { id: 'reload-mod', name: 'Reload', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
      init() { initCount++; },
      destroy() { destroyCount++; },
    };

    runtime.register(mod);
    await runtime.initAll();
    expect(initCount).toBe(1);

    const result = await runtime.reloadModule('reload-mod');
    expect(result).toBe(true);
    expect(destroyCount).toBe(1);
    expect(initCount).toBe(2);
  });

  it('should emit module:reloaded event on successful reload', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const handler = vi.fn();
    eventBus.on('module:reloaded', handler);

    runtime.register(createTestModule('reload-event'));
    await runtime.initAll();

    await runtime.reloadModule('reload-event');
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'reload-event' }),
    );
  });

  it('should mark module as failed if reload init throws', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    let initCount = 0;

    const mod: AppModule = {
      manifest: { id: 'reload-fail', name: 'RF', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
      init() {
        initCount++;
        if (initCount > 1) throw new Error('Reload failed!');
      },
      destroy() {},
    };

    runtime.register(mod);
    await runtime.initAll();

    const result = await runtime.reloadModule('reload-fail');
    expect(result).toBe(false);
    expect(runtime.isModuleFailed('reload-fail')).toBe(true);
  });

  it('should return false for reloading unknown module', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const result = await runtime.reloadModule('nonexistent');
    expect(result).toBe(false);
  });

  // ---- getCommands / getAllContributionsBySlot ----

  it('should return registered commands via getCommands()', async () => {
    const runtime = createRuntime(eventBus, storeAccess);

    const mod: AppModule = {
      manifest: { id: 'cmd-mod', name: 'Cmd', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
      init(ctx) {
        ctx.registerCommand('test-cmd', () => {});
      },
      destroy() {},
    };

    runtime.register(mod);
    await runtime.initAll();

    const cmds = runtime.getCommands();
    expect(cmds.has('cmd-mod:test-cmd')).toBe(true);
  });

  it('should return contributions by slot via getAllContributionsBySlot()', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const DummyComp = () => null;

    const mod: AppModule = {
      manifest: { id: 'contrib-mod', name: 'Contrib', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
      init(ctx) {
        ctx.registerUI({ slot: 'left-panel', label: 'Panel 1', component: DummyComp });
        ctx.registerUI({ slot: 'right-panel', label: 'Panel 2', component: DummyComp });
      },
      destroy() {},
    };

    runtime.register(mod);
    await runtime.initAll();

    const contribs = runtime.getAllContributionsBySlot();
    expect(contribs['left-panel']).toHaveLength(1);
    expect(contribs['right-panel']).toHaveLength(1);
    expect(contribs['left-panel'][0].label).toBe('Panel 1');
  });

  // ---- moduleId in contributions ----

  it('should automatically set moduleId on registered UI contributions', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const DummyComp = () => null;

    const mod: AppModule = {
      manifest: { id: 'mid-test', name: 'MID', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
      init(ctx) {
        ctx.registerUI({ slot: 'left-panel', label: 'Panel', component: DummyComp });
      },
      destroy() {},
    };

    runtime.register(mod);
    await runtime.initAll();

    const contribs = runtime.getUIContributions('left-panel');
    expect(contribs[0].moduleId).toBe('mid-test');
  });
});
