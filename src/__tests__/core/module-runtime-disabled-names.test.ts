import { describe, it, expect, beforeEach } from 'vitest';
import { getRuntime, pluginRegistry } from '@/plugin-sdk';
import { createRuntime } from '@/core/module-runtime';
import { createStoreAccess } from '@/core/store';
import { createEventBus } from '@/core/event-bus';

describe('module-runtime disabled-at-boot names', () => {
  beforeEach(() => {
    pluginRegistry.clear();
  });

  it('getModuleStatuses returns name from PluginRecord for disabled-at-boot modules', () => {
    const eventBus = createEventBus();
    const storeAccess = createStoreAccess();
    const runtime = createRuntime(eventBus, storeAccess);

    pluginRegistry.install('test-disabled', 'user', 'Test Disabled Plugin');
    pluginRegistry.disable('test-disabled');

    const statuses = runtime.getModuleStatuses();
    const s = statuses.find(m => m.id === 'test-disabled');

    expect(s).toBeDefined();
    expect(s!.name).toBe('Test Disabled Plugin');
    expect(s!.status).toBe('disabled');
  });

  it('getModuleStatuses falls back to id when PluginRecord has no name', () => {
    const eventBus = createEventBus();
    const storeAccess = createStoreAccess();
    const runtime = createRuntime(eventBus, storeAccess);

    pluginRegistry.install('no-name-plugin', 'user');
    pluginRegistry.disable('no-name-plugin');

    const statuses = runtime.getModuleStatuses();
    const s = statuses.find(m => m.id === 'no-name-plugin');

    expect(s).toBeDefined();
    expect(s!.name).toBe('no-name-plugin');
  });
});
