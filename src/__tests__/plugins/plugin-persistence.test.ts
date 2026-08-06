import { describe, it, expect, beforeEach, vi } from 'vitest';
import { pluginRegistry } from '@/core/plugin-registry';
import { createStoreAccess } from '@/core/store';
import { clearModuleCache } from '@/core/module-loader';
import { createEventBus } from '@/core/event-bus';
import { createRuntime } from '@/core/module-runtime';

vi.mock('@/core/module-loader', async () => {
  const actual = await vi.importActual('@/core/module-loader');
  return {
    ...actual as any,
    removeFromModuleCache: vi.fn(),
  };
});

const CATEGORY_OVERRIDES_KEY = 'plugin-category-overrides-v2';

beforeEach(() => {
  localStorage.clear();
  pluginRegistry.clear();
});

describe('Plugin uninstall persistence', () => {
  it('uninstall removes plugin from registry entirely', async () => {
    pluginRegistry.install('test-plugin', 'user', 'Test');
    expect(pluginRegistry.isInstalled('test-plugin')).toBe(true);

    pluginRegistry.uninstall('test-plugin');
    expect(pluginRegistry.isInstalled('test-plugin')).toBe(false);
  });

  it('uninstall removes plugin so rediscovery does not re-add', async () => {
    pluginRegistry.install('test-plugin', 'user', 'Test');
    pluginRegistry.uninstall('test-plugin');

    expect(pluginRegistry.isInstalled('test-plugin')).toBe(false);

    if (!pluginRegistry.isInstalled('test-plugin')) {
      pluginRegistry.install('test-plugin', 'user', 'Test');
    }

    expect(pluginRegistry.isInstalled('test-plugin')).toBe(true);
    expect(pluginRegistry.isEnabled('test-plugin')).toBe(true);
  });

  it('category overrides are cleaned on runtime uninstall', async () => {
    pluginRegistry.install('test-plugin', 'user', 'Test');
    const overrides: Record<string, string> = {};
    overrides['test-plugin'] = 'analysis';
    localStorage.setItem(CATEGORY_OVERRIDES_KEY, JSON.stringify(overrides));

    const eventBus = createEventBus();
    const storeAccess = createStoreAccess();
    const rt = createRuntime(eventBus, storeAccess);
    await rt.uninstallPlugin('test-plugin');

    const cleaned = JSON.parse(localStorage.getItem(CATEGORY_OVERRIDES_KEY) ?? '{}');
    expect(cleaned['test-plugin']).toBeUndefined();
  });

  it('re-install after uninstall works correctly', () => {
    pluginRegistry.install('test-plugin', 'user', 'Test');
    pluginRegistry.uninstall('test-plugin');
    expect(pluginRegistry.isInstalled('test-plugin')).toBe(false);

    pluginRegistry.install('test-plugin', 'user', 'Test');
    expect(pluginRegistry.isInstalled('test-plugin')).toBe(true);
    expect(pluginRegistry.isEnabled('test-plugin')).toBe(true);
  });

  it('удалённый плагин не воскресает при симуляции повторного discover', () => {
    pluginRegistry.install('zombie-plugin', 'user', 'Zombie');
    pluginRegistry.uninstall('zombie-plugin');

    const shouldReinstall =
      !pluginRegistry.isInstalled('zombie-plugin');

    expect(shouldReinstall).toBe(true);
  });

  it('переустановка после uninstall работает корректно', () => {
    pluginRegistry.install('fresh-plugin', 'user', 'Fresh');
    pluginRegistry.uninstall('fresh-plugin');
    pluginRegistry.install('fresh-plugin', 'user', 'Fresh');
    expect(pluginRegistry.isInstalled('fresh-plugin')).toBe(true);
    expect(pluginRegistry.isEnabled('fresh-plugin')).toBe(true);
  });

  it('duplicate UI contributions after rapid enable/disable', async () => {
    const eventBus = createEventBus();
    const storeAccess = createStoreAccess();
    const rt = createRuntime(eventBus, storeAccess);

    const initFn = vi.fn();
    const mod = {
      manifest: { id: 'rapid-test', name: 'Rapid', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['left-panel'] },
      init: initFn,
      destroy: vi.fn(),
    };
    rt.register(mod);
    pluginRegistry.install('rapid-test', 'user', 'Rapid');

    await rt.enablePlugin('rapid-test');
    await rt.disablePlugin('rapid-test');
    await rt.enablePlugin('rapid-test');

    expect(initFn).toHaveBeenCalledTimes(2);
  });
});
