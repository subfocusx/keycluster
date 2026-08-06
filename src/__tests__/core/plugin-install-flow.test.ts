import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AppModule } from '@/plugin-sdk';
import { createRuntime } from '@/core/module-runtime';
import { createStoreAccess } from '@/core/store';
import { executionGate } from '@/core/module-execution-gate';
import { createEventBus } from '@/core/event-bus';
import { pluginRegistry } from '@/core/plugin-registry';

vi.mock('@/core/module-loader', () => ({
  loadModule: vi.fn(async (id: string) => ({
    manifest: { id, name: `Test ${id}`, version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['ribbon:tools'] },
    init(ctx: any) { ctx.registerCommand('action', () => {}); },
    destroy() {},
  })),
  getBuiltinModuleIds: () => [],
  getLocalModuleIds: () => [],
  getUserPluginIds: () => [],
  removeFromModuleCache: vi.fn(),
  getModuleCacheKeys: vi.fn().mockReturnValue([]),
  ModuleLoadError: class extends Error {
    moduleId: string; cause: unknown;
    constructor(id: string, cause: unknown) {
      super(`Failed to load "${id}": ${cause}`);
      this.moduleId = id; this.cause = cause;
    }
  },
}));

describe('full plugin install → enable → disable flow', () => {
  let eventBus: ReturnType<typeof createEventBus>;
  let storeAccess: ReturnType<typeof createStoreAccess>;

  beforeEach(() => {
    eventBus = createEventBus();
    (eventBus as any).clear?.();
    storeAccess = createStoreAccess();
    pluginRegistry.clear();
    executionGate.clear();
  });

  it('installed plugin appears in getModuleStatuses', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const mod: AppModule = {
      manifest: { id: 'mock-plugin', name: 'Mock', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: [] },
      init: vi.fn(),
      destroy: vi.fn(),
    };
    pluginRegistry.install('mock-plugin', 'user');
    runtime.register(mod);
    await runtime.enablePlugin('mock-plugin');
    const statuses = runtime.getModuleStatuses();
    expect(statuses.find(m => m.id === 'mock-plugin')?.status).toBe('ok');
  });

  it('uninstall removes from registry and disables', () => {
    pluginRegistry.install('mock-plugin', 'user');
    expect(pluginRegistry.isInstalled('mock-plugin')).toBe(true);
    pluginRegistry.uninstall('mock-plugin');
    expect(pluginRegistry.isInstalled('mock-plugin')).toBe(false);
  });

  it('module:enabled emitted after successful install', async () => {
    const events: string[] = [];
    eventBus.on('module:enabled', (data: any) => events.push(data.id));

    const runtime = createRuntime(eventBus, storeAccess);
    const mod: AppModule = {
      manifest: { id: 'mock-plugin', name: 'Mock', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: [] },
      init: vi.fn(),
      destroy: vi.fn(),
    };
    pluginRegistry.install('mock-plugin', 'user');
    runtime.register(mod);
    await runtime.enablePlugin('mock-plugin');

    expect(events).toContain('mock-plugin');
  });
});
