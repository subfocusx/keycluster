import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AppModule, ModuleUIContribution } from '@/plugin-sdk';
import { createRuntime } from '@/core/module-runtime';
import { createStoreAccess } from '@/core/store';
import { executionGate } from '@/core/module-execution-gate';
import { createEventBus } from '@/core/event-bus';
import { pluginRegistry } from '@/core/plugin-registry';
import { registerUserPlugin, getUserPluginPaths } from '@/core/module-loader';

describe('create Runtime', () => {
  let eventBus: ReturnType<typeof createEventBus>;
  let storeAccess: ReturnType<typeof createStoreAccess>;

  beforeEach(() => {
    eventBus = createEventBus();
    (eventBus as { clear(): void }).clear();
    storeAccess = createStoreAccess();
    pluginRegistry.clear();
    executionGate.clear();
  });

  it('1. loadModule success — my-plugin exports AppModule with default', async () => {
    registerUserPlugin('my-plugin', () => Promise.resolve({
      default: {
        manifest: { id: 'my-plugin', name: 'Мой плагин', version: '1.0.0', description: '', slot: ['ribbon:tools'], dependencies: [], settingsSchema: [] },
        init: vi.fn(),
        destroy: vi.fn(),
      } as AppModule,
    }));

    const paths = getUserPluginPaths();
    expect(paths['my-plugin']).toBeDefined();

    const modExports = await paths['my-plugin']();
    const mod = modExports.default as AppModule;
    expect(mod).toBeDefined();
    expect(mod.manifest.id).toBe('my-plugin');
    expect(mod.init).toBeDefined();
    expect(mod.destroy).toBeDefined();
  });

  it('2. runtime.register + initOne success', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const initFn = vi.fn();
    const mod: AppModule = {
      manifest: { id: 'my-plugin', name: 'Мой плагин', version: '1.0.0', description: '', slot: ['ribbon:tools'], dependencies: [], settingsSchema: [] },
      init: initFn,
      destroy: vi.fn(),
    };

    runtime.register(mod);
    const result = await runtime.initOne('my-plugin');
    expect(result).toBe(true);
    expect(initFn).toHaveBeenCalledOnce();
  });

  it('3. registerUI adds contribution to slotRegistry', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const mod: AppModule = {
      manifest: { id: 'my-plugin', name: 'Мой плагин', version: '1.0.0', description: '', slot: ['ribbon:tools'], dependencies: [], settingsSchema: [] },
      init(ctx) {
        ctx.registerUI({
          slot: 'ribbon:tools',
          label: 'Мой плагин',
          icon: 'sell',
          component: () => null,
          order: 100,
        });
      },
      destroy: vi.fn(),
    };

    runtime.register(mod);
    await runtime.initOne('my-plugin');

    const contributions = runtime.getUIContributions('ribbon:tools');
    expect(contributions.length).toBeGreaterThan(0);
    expect(contributions[0].moduleId).toBe('my-plugin');
    expect(contributions[0].label).toBe('Мой плагин');
    expect(contributions[0].icon).toBe('sell');
  });

  it('4. full bootstrap-like flow — install → enablePlugin → contributions present', async () => {
    const runtime = createRuntime(eventBus, storeAccess);

    pluginRegistry.install('my-plugin', 'user', 'Мой плагин');
    expect(pluginRegistry.isInstalled('my-plugin')).toBe(true);
    expect(pluginRegistry.isEnabled('my-plugin')).toBe(true);

    const mod: AppModule = {
      manifest: { id: 'my-plugin', name: 'Мой плагин', version: '1.0.0', description: '', slot: ['ribbon:tools'], dependencies: [], settingsSchema: [] },
      init(ctx) {
        ctx.registerUI({
          slot: 'ribbon:tools',
          label: 'Мой плагин',
          icon: 'sell',
          component: () => null,
          order: 100,
        });
      },
      destroy: vi.fn(),
    };

    runtime.register(mod);
    const initResult = await runtime.initOne('my-plugin');
    expect(initResult).toBe(true);

    const contributions = runtime.getUIContributions('ribbon:tools');
    expect(contributions.some(c => c.moduleId === 'my-plugin')).toBe(true);
  });

  it('5. after disable/enable cycle UI is restored', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const initFn = vi.fn((ctx: any) => {
      ctx.registerUI({
        slot: 'ribbon:tools',
        label: 'Мой плагин',
        icon: 'sell',
        component: () => null,
        order: 100,
      });
    });

    pluginRegistry.install('my-plugin', 'user');
    const mod: AppModule = {
      manifest: { id: 'my-plugin', name: 'Мой плагин', version: '1.0.0', description: '', slot: ['ribbon:tools'], dependencies: [], settingsSchema: [] },
      init: initFn,
      destroy: vi.fn(),
    };

    runtime.register(mod);
    await runtime.initOne('my-plugin');
    expect(runtime.getUIContributions('ribbon:tools').length).toBe(1);

    await runtime.disablePlugin('my-plugin');
    expect(runtime.isModuleDisabled('my-plugin')).toBe(true);
    expect(runtime.getUIContributions('ribbon:tools').length).toBe(0);

    const reResult = await runtime.enablePlugin('my-plugin');
    expect(reResult).toBe(true);
    expect(runtime.isModuleDisabled('my-plugin')).toBe(false);
    expect(runtime.getUIContributions('ribbon:tools').length).toBe(1);
    expect(runtime.getUIContributions('ribbon:tools')[0].moduleId).toBe('my-plugin');
  });
});
