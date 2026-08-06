import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TOOL_REGISTRY, getToolsByTab, getEventBus } from '@/plugin-sdk';
import type { ToolId, AppModule } from '@/plugin-sdk';
import { createRuntime } from '@/core/module-runtime';
import { createStoreAccess } from '@/core/store';
import { createEventBus } from '@/core/event-bus';
import { pluginRegistry } from '@/core/plugin-registry';
import { executionGate } from '@/core/module-execution-gate';

function createTestModule(id: string): AppModule {
  return {
    manifest: {
      id,
      name: id,
      version: '1.0.0',
      description: `Test module ${id}`,
      dependencies: [],
      settingsSchema: [],
      slot: [],
    },
    init: vi.fn(),
    destroy: vi.fn(),
  };
}

describe('TOOL_REGISTRY sync with runtime', () => {
  beforeEach(() => {
    Object.keys(TOOL_REGISTRY).forEach(id => {
      TOOL_REGISTRY[id as ToolId].enabled = true;
    });
    executionGate.clear();
    pluginRegistry.clear();
  });

  it('disablePlugin sets TOOL_REGISTRY[id].enabled = false', async () => {
    const eventBus = createEventBus();
    const storeAccess = createStoreAccess();
    const runtime = createRuntime(eventBus, storeAccess);
    const mod = createTestModule('clustering');
    runtime.register(mod);
    pluginRegistry.install('clustering', 'user');
    await runtime.initAll();

    expect(TOOL_REGISTRY['clustering'].enabled).toBe(true);
    await runtime.disablePlugin('clustering');
    expect(TOOL_REGISTRY['clustering'].enabled).toBe(false);
  });

  it('enablePlugin sets TOOL_REGISTRY[id].enabled = true', async () => {
    const eventBus = createEventBus();
    const storeAccess = createStoreAccess();
    const runtime = createRuntime(eventBus, storeAccess);
    const mod = createTestModule('clustering');
    runtime.register(mod);
    pluginRegistry.install('clustering', 'user');
    await runtime.initAll();

    await runtime.disablePlugin('clustering');
    expect(TOOL_REGISTRY['clustering'].enabled).toBe(false);
    await runtime.enablePlugin('clustering');
    expect(TOOL_REGISTRY['clustering'].enabled).toBe(true);
  });

  it('disableModule sets TOOL_REGISTRY[id].enabled = false', async () => {
    const eventBus = createEventBus();
    const storeAccess = createStoreAccess();
    const runtime = createRuntime(eventBus, storeAccess);
    const mod = createTestModule('minus-words');
    runtime.register(mod);

    expect(TOOL_REGISTRY['minus-words'].enabled).toBe(true);
    await runtime.disableModule('minus-words');
    expect(TOOL_REGISTRY['minus-words'].enabled).toBe(false);
  });

  it('enableModule sets TOOL_REGISTRY[id].enabled = true', async () => {
    const eventBus = createEventBus();
    const storeAccess = createStoreAccess();
    const runtime = createRuntime(eventBus, storeAccess);
    const mod = createTestModule('minus-words');
    runtime.register(mod);

    await runtime.disableModule('minus-words');
    expect(TOOL_REGISTRY['minus-words'].enabled).toBe(false);
    await runtime.enableModule('minus-words');
    expect(TOOL_REGISTRY['minus-words'].enabled).toBe(true);
  });

  it('getToolsByTab excludes disabled tools', () => {
    TOOL_REGISTRY['clustering'].enabled = false;
    const tools = getToolsByTab('algorithms');
    expect(tools.find(t => t.id === 'clustering')).toBeUndefined();
  });

  it('getToolsByTab includes enabled tools', () => {
    TOOL_REGISTRY['clustering'].enabled = true;
    const tools = getToolsByTab('algorithms');
    expect(tools.find(t => t.id === 'clustering')).toBeDefined();
  });

  it('module:disabled fires exactly once per disablePlugin', async () => {
    const eventBus = createEventBus();
    const storeAccess = createStoreAccess();
    const runtime = createRuntime(eventBus, storeAccess);
    const mod = createTestModule('ngrams');
    runtime.register(mod);
    pluginRegistry.install('ngrams', 'user');
    await runtime.initAll();

    const calls: string[] = [];
    eventBus.on('module:disabled', () => calls.push('disabled'));
    await runtime.disablePlugin('ngrams');
    expect(calls).toHaveLength(1);
  });
});
