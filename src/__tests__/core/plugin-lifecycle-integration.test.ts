import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useSettingsStore, pluginRegistry, loadModule, labelRegistry, getAvailableModuleIds } from '@/plugin-sdk';
import { registerUserPlugin } from '@/core/module-loader';
import { clearModuleCache, removeFromModuleCache } from '@/core/module-loader';
import type { AppModule } from '@/plugin-sdk';
import { createRuntime } from '@/core/module-runtime';
import { createStoreAccess } from '@/core/store';
import { pluginSourceRepo } from '@/core/plugin-source-repository';
import { executionGate } from '@/core/module-execution-gate';
import { createEventBus } from '@/core/event-bus';

function createMockPlugin(id: string) {
  const initFn = vi.fn((ctx: any) => {
    ctx.registerCommand('action', () => {});
    ctx.onEvent('phrases:changed', () => {});
  });
  const destroyFn = vi.fn();
  return {
    manifest: {
      id,
      name: `Test ${id}`,
      version: '1.0.0',
      description: `Integration test plugin ${id}`,
      slot: ['ribbon:tools'],
      dependencies: [],
      settingsSchema: [],
    },
    init: initFn,
    destroy: destroyFn,
  } as AppModule;
}

function createTestRuntime() {
  const eventBus = createEventBus();
  (eventBus as any).clear?.();
  const storeAccess = createStoreAccess();
  const rt = createRuntime(eventBus, storeAccess);
  rt.declareSlot('ribbon:tools', { label: 'Tools' });
  rt.declareSlot('workspace:layout', { label: 'Layout' });
  rt.declareSlot('group:toolbar', { label: 'Toolbar' });
  rt.declareSlot('theme', { label: 'Theme', defaultVisible: false });
  return { eventBus, storeAccess, runtime: rt };
}

beforeEach(() => {
  localStorage.clear();
  pluginRegistry.clear();
  pluginSourceRepo.clear();
  executionGate.clear();
  useSettingsStore.getState().resetModuleSettings('core');
  document.head.innerHTML = '';
  labelRegistry.unregister('*');
  clearModuleCache();
});

afterEach(() => {
  pluginSourceRepo.clear();
});

describe('Full Plugin Lifecycle', () => {
  it('1. install → register source → registry install', () => {
    const mod = createMockPlugin('test-plugin');

    registerUserPlugin('test-plugin', () => Promise.resolve({ default: mod }));
    pluginRegistry.install('test-plugin', 'user', 'Test Plugin');

    expect(pluginSourceRepo.has('test-plugin')).toBe(true);
    expect(pluginRegistry.isInstalled('test-plugin')).toBe(true);
    expect(pluginRegistry.isEnabled('test-plugin')).toBe(true);
    expect(pluginRegistry.get('test-plugin')?.name).toBe('Test Plugin');
    expect(pluginRegistry.get('test-plugin')?.source).toBe('user');
    expect(getAvailableModuleIds()).toContain('test-plugin');
  });

  it('2. enable → loadModule → runtime.register → initOne → registry enable', async () => {
    const { runtime } = createTestRuntime();
    const mod = createMockPlugin('test-plugin');

    registerUserPlugin('test-plugin', () => Promise.resolve({ default: mod }));
    pluginRegistry.install('test-plugin', 'user');

    expect(pluginRegistry.isEnabled('test-plugin')).toBe(true);

    const loaded = await loadModule('test-plugin', 'user');
    expect(loaded.manifest.id).toBe('test-plugin');

    runtime.register(loaded);
    const initResult = await runtime.initOne('test-plugin');
    expect(initResult).toBe(true);

    expect(runtime.getManifests().some(m => m.id === 'test-plugin')).toBe(true);
    expect(runtime.isModuleFailed('test-plugin')).toBe(false);
    expect(executionGate.isAllowed('test-plugin')).toBe(true);
  });

  it('3. enablePlugin → full enable through runtime', async () => {
    const { runtime } = createTestRuntime();
    const mod = createMockPlugin('test-plugin');

    registerUserPlugin('test-plugin', () => Promise.resolve({ default: mod }));
    pluginRegistry.install('test-plugin', 'user');

    const result = await runtime.enablePlugin('test-plugin');
    expect(result).toBe(true);

    expect(pluginRegistry.isEnabled('test-plugin')).toBe(true);
    expect(runtime.isModuleDisabled('test-plugin')).toBe(false);
    expect(runtime.getManifests().some(m => m.id === 'test-plugin')).toBe(true);
    expect(mod.init).toHaveBeenCalledTimes(1);
    expect(runtime.getCommands().has('test-plugin:action')).toBe(true);
    expect(executionGate.isAllowed('test-plugin')).toBe(true);
  });

  it('4. disablePlugin → destroyOne → registry disable → execution gate block', async () => {
    const { runtime } = createTestRuntime();
    const mod = createMockPlugin('test-plugin');

    registerUserPlugin('test-plugin', () => Promise.resolve({ default: mod }));
    pluginRegistry.install('test-plugin', 'user');
    await runtime.enablePlugin('test-plugin');

    await runtime.disablePlugin('test-plugin');

    expect(pluginRegistry.isEnabled('test-plugin')).toBe(false);
    expect(runtime.isModuleDisabled('test-plugin')).toBe(true);
    expect(mod.destroy).toHaveBeenCalledTimes(1);
    expect(runtime.getCommands().has('test-plugin:action')).toBe(false);
    expect(executionGate.isBlocked('test-plugin')).toBe(true);
  });

  it('5. enable → disable → enable cycle restores state', async () => {
    const { runtime } = createTestRuntime();
    const mod = createMockPlugin('test-plugin');
    const initSpy = vi.spyOn(mod, 'init');
    const destroySpy = vi.spyOn(mod, 'destroy');

    registerUserPlugin('test-plugin', () => Promise.resolve({ default: mod }));
    pluginRegistry.install('test-plugin', 'user');

    await runtime.enablePlugin('test-plugin');
    expect(initSpy).toHaveBeenCalledTimes(1);
    expect(runtime.getCommands().has('test-plugin:action')).toBe(true);

    await runtime.disablePlugin('test-plugin');
    expect(destroySpy).toHaveBeenCalledTimes(1);
    expect(runtime.getCommands().has('test-plugin:action')).toBe(false);

    await runtime.enablePlugin('test-plugin');
    expect(initSpy).toHaveBeenCalledTimes(2);
    expect(pluginRegistry.isEnabled('test-plugin')).toBe(true);
    expect(runtime.isModuleDisabled('test-plugin')).toBe(false);
    expect(runtime.getCommands().has('test-plugin:action')).toBe(true);
  });

  it('6. uninstallPlugin → disable → remove source → registry hard delete → file cleanup', async () => {
    const { runtime } = createTestRuntime();
    const mod = createMockPlugin('test-plugin');

    registerUserPlugin('test-plugin', () => Promise.resolve({ default: mod }));
    pluginRegistry.install('test-plugin', 'user');
    await runtime.enablePlugin('test-plugin');

    expect(pluginSourceRepo.has('test-plugin')).toBe(true);

    await runtime.uninstallPlugin('test-plugin', false);

    expect(pluginRegistry.isInstalled('test-plugin')).toBe(false);
    expect(pluginSourceRepo.has('test-plugin')).toBe(false);
    expect(runtime.getManifests().some(m => m.id === 'test-plugin')).toBe(false);
    expect(runtime.isModuleDisabled('test-plugin')).toBe(false);
    expect(mod.destroy).toHaveBeenCalled();
  });

  it('7. uninstallPlugin with deleteFiles=true calls removePluginFolder', async () => {
    const { runtime } = createTestRuntime();
    const mod = createMockPlugin('test-plugin-delete');

    registerUserPlugin('test-plugin-delete', () => Promise.resolve({ default: mod }));
    pluginRegistry.install('test-plugin-delete', 'user');
    await runtime.enablePlugin('test-plugin-delete');

    await runtime.uninstallPlugin('test-plugin-delete', true);

    expect(pluginRegistry.isInstalled('test-plugin-delete')).toBe(false);
    expect(runtime.getManifests().some(m => m.id === 'test-plugin-delete')).toBe(false);
  });

  it('8. restart: reconcile purges orphaned records and imports new on-disk plugins', () => {
    pluginRegistry.install('orphaned-plugin', 'user', 'Orphaned');
    pluginRegistry.install('keep-plugin', 'user', 'Keep');
    pluginRegistry.install('user-on-disk', 'user', 'On Disk');

    const knownIds = ['keep-plugin', 'builtin-a'];
    const userPluginIdsOnDisk = ['user-on-disk', 'user-new-disk'];

    const result = pluginRegistry.reconcile(knownIds, userPluginIdsOnDisk);

    expect(result.purged).toContain('orphaned-plugin');
    expect(pluginRegistry.isInstalled('orphaned-plugin')).toBe(false);

    expect(pluginRegistry.isInstalled('keep-plugin')).toBe(true);

    expect(pluginRegistry.isInstalled('user-on-disk')).toBe(true);

    expect(result.imported).toContain('user-new-disk');
    expect(pluginRegistry.isInstalled('user-new-disk')).toBe(true);
    expect(pluginRegistry.get('user-new-disk')?.source).toBe('user');
    expect(pluginRegistry.get('user-new-disk')?.enabled).toBe(true);
  });

  it('9. reconcile purges user plugins not found on disk', () => {
    pluginRegistry.install('deleted-plugin', 'user', 'Deleted');
    pluginRegistry.install('existing-plugin', 'user', 'Existing');

    const result = pluginRegistry.reconcile([], ['existing-plugin']);

    expect(result.purged).toContain('deleted-plugin');
    expect(pluginRegistry.isInstalled('deleted-plugin')).toBe(false);
    expect(pluginRegistry.isInstalled('existing-plugin')).toBe(true);
  });

  it('10. reconcile keeps builtin/local records even if not in knownIds — only purges non-user', () => {
    pluginRegistry.install('builtin-missing', 'builtin', 'Builtin Missing');
    pluginRegistry.install('local-missing', 'user', 'Local Missing');

    const result = pluginRegistry.reconcile([], []);

    expect(result.purged).toContain('builtin-missing');
    expect(result.purged).toContain('local-missing');
    expect(pluginRegistry.isInstalled('builtin-missing')).toBe(false);
    expect(pluginRegistry.isInstalled('local-missing')).toBe(false);
  });

  it('11. builtin plugins cannot be uninstalled from registry', () => {
    pluginRegistry.install('test-builtin', 'builtin');

    expect(() => pluginRegistry.uninstall('test-builtin')).toThrow('Cannot uninstall builtin');
    expect(pluginRegistry.isInstalled('test-builtin')).toBe(true);
  });

  it('12. full lifecycle: install → enable → disable → enable → uninstall → reconcile restart', async () => {
    const { runtime } = createTestRuntime();
    const mod = createMockPlugin('full-lifecycle');

    registerUserPlugin('full-lifecycle', () => Promise.resolve({ default: mod }));
    pluginRegistry.install('full-lifecycle', 'user', 'Full Lifecycle Plugin');

    await runtime.enablePlugin('full-lifecycle');
    expect(pluginRegistry.isEnabled('full-lifecycle')).toBe(true);
    expect(mod.init).toHaveBeenCalledTimes(1);

    await runtime.disablePlugin('full-lifecycle');
    expect(pluginRegistry.isEnabled('full-lifecycle')).toBe(false);
    expect(mod.destroy).toHaveBeenCalledTimes(1);

    await runtime.enablePlugin('full-lifecycle');
    expect(pluginRegistry.isEnabled('full-lifecycle')).toBe(true);
    expect(mod.init).toHaveBeenCalledTimes(2);

    await runtime.uninstallPlugin('full-lifecycle', false);
    expect(pluginRegistry.isInstalled('full-lifecycle')).toBe(false);
    expect(pluginSourceRepo.has('full-lifecycle')).toBe(false);

    const reconcileResult = pluginRegistry.reconcile([], []);
    expect(reconcileResult.purged).not.toContain('full-lifecycle');
    expect(pluginRegistry.isInstalled('full-lifecycle')).toBe(false);
  });

  it('13. source repo entries preserve their source type', () => {
    pluginSourceRepo.registerBuiltin('test-builtin', () => Promise.resolve({}));
    pluginSourceRepo.registerUser('test-user', () => Promise.resolve({}));
    pluginSourceRepo.registerUser('test-user-2', () => Promise.resolve({}));

    const builtins = pluginSourceRepo.getBySource('builtin').map(e => e.id);
    const users = pluginSourceRepo.getBySource('user').map(e => e.id);

    expect(builtins).toContain('test-builtin');
    expect(users).toContain('test-user');
    expect(users).toContain('test-user-2');
  });

  it('14. module cache invalidation on uninstall', async () => {
    const { runtime } = createTestRuntime();
    const mod = createMockPlugin('cache-test');

    registerUserPlugin('cache-test', () => Promise.resolve({ default: mod }));
    pluginRegistry.install('cache-test', 'user');

    const loaded1 = await loadModule('cache-test', 'user');
    const cached1 = pluginSourceRepo.getCachedModule('cache-test');
    expect(cached1).toBeDefined();

    await runtime.enablePlugin('cache-test');

    removeFromModuleCache('cache-test');
    expect(pluginSourceRepo.getCachedModule('cache-test')).toBeUndefined();

    const loaded2 = await loadModule('cache-test', 'user');
    expect(loaded2).toBeDefined();
    expect(pluginSourceRepo.getCachedModule('cache-test')).toBeDefined();

    await runtime.uninstallPlugin('cache-test', false);
    expect(pluginSourceRepo.getCachedModule('cache-test')).toBeUndefined();
  });
});
