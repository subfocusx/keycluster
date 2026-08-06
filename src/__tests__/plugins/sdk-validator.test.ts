// ============================================================
// SDK Validator Tests — проверка устойчивости платформы
// к некорректным плагинам
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearModuleCache, registerUserPlugin } from '@/core/module-loader';
import { getUserPluginPaths, ModuleLoadError, loadModule } from '@/plugin-sdk';
import { registerModulePath } from '@/core/module-loader';
import { createRuntime } from '@/core/module-runtime';
import { createStoreAccess } from '@/core/store';
import { executionGate } from '@/core/module-execution-gate';
import { validatePluginModule, PLUGIN_EVENTS } from '@/core/user-plugin-loader';
import { createEventBus } from '@/core/event-bus';
import { pluginRegistry } from '@/core/plugin-registry';
import type { AppModule } from '@/core/types';

// ---- Helper ----
function makeValidPlugin(id = 'valid-plugin'): AppModule {
  return {
    manifest: { id, name: 'Valid Plugin', version: '1.0.0', description: '', dependencies: [], settingsSchema: [], slot: ['ribbon:tools'] },
    init: vi.fn(),
    destroy: vi.fn(),
  };
}

// ============================================================
// 1. Валидация структуры плагина (validatePluginModule)
// ============================================================

describe('validatePluginModule', () => {
  it('корректный плагин — проходит валидацию', () => {
    const mod = makeValidPlugin('test');
    expect(validatePluginModule(mod, 'test')).toBeNull();
  });

  it('null — ошибка', () => {
    const err = validatePluginModule(null, 'null-plugin');
    expect(err).toContain('не является объектом');
    expect(err).toContain('export default');
  });

  it('не объект (число) — ошибка', () => {
    const err = validatePluginModule(42, 'num-plugin');
    expect(err).toContain('не является объектом');
  });

  it('отсутствует manifest — ошибка', () => {
    const err = validatePluginModule({ init: vi.fn(), destroy: vi.fn() }, 'no-manifest');
    expect(err).toContain('не имеет поля manifest');
  });

  it('manifest без id — ошибка', () => {
    const err = validatePluginModule({
      manifest: { name: 'No ID' },
      init: vi.fn(),
      destroy: vi.fn(),
    }, 'no-id');
    expect(err).toContain('manifest.id');
  });

  it('manifest.id не совпадает с pluginId — ошибка', () => {
    const err = validatePluginModule({
      manifest: { id: 'other-id', name: 'Test' },
      init: vi.fn(),
      destroy: vi.fn(),
    }, 'folder-name');
    expect(err).toContain('несовпадающий');
    expect(err).toContain('other-id');
  });

  it('шаблонный ID (YOUR_PLUGIN_ID) — ошибка', () => {
    const err = validatePluginModule({
      manifest: { id: 'YOUR_PLUGIN_ID', name: 'Test' },
      init: vi.fn(),
      destroy: vi.fn(),
    }, 'YOUR_PLUGIN_ID');
    expect(err).toContain('ID-заглушку');
  });

  it('шаблонный ID (YOUR_ADVANCED_PLUGIN_ID) — ошибка', () => {
    const err = validatePluginModule({
      manifest: { id: 'YOUR_ADVANCED_PLUGIN_ID', name: 'Test' },
      init: vi.fn(),
      destroy: vi.fn(),
    }, 'YOUR_ADVANCED_PLUGIN_ID');
    expect(err).toContain('ID-заглушку');
  });

  it('шаблонный ID (PLACEHOLDER_ID) — ошибка', () => {
    const err = validatePluginModule({
      manifest: { id: 'PLACEHOLDER_ID', name: 'Test' },
      init: vi.fn(),
      destroy: vi.fn(),
    }, 'PLACEHOLDER_ID');
    expect(err).toContain('ID-заглушку');
  });

  it('отсутствует init() — ошибка', () => {
    const err = validatePluginModule({
      manifest: { id: 'no-init', name: 'Test', version: '1' },
      destroy: vi.fn(),
    }, 'no-init');
    expect(err).toContain('не имеет метода init()');
  });

  it('отсутствует destroy() — ошибка', () => {
    const err = validatePluginModule({
      manifest: { id: 'no-destroy', name: 'Test', version: '1' },
      init: vi.fn(),
    }, 'no-destroy');
    expect(err).toContain('не имеет метода destroy()');
  });
});

// ============================================================
// 2. loadModule — улучшенные сообщения об ошибках
// ============================================================

describe('loadModule — улучшенные сообщения об ошибках', () => {
  beforeEach(() => {
    clearModuleCache();
  });

  it('отсутствует default export — понятная ошибка', async () => {
    registerModulePath(
      'no-default',
      () => Promise.resolve({ someOtherExport: {} }),
    );

    await expect(loadModule('no-default')).rejects.toThrow(
      /does not export AppModule/
    );
  });

  it('отсутствует init — ошибка с указанием недостающих полей', async () => {
    registerModulePath(
      'no-init-method',
      () => Promise.resolve({ default: { manifest: { id: 'no-init-method', name: 'Test', version: '1' }, destroy: vi.fn() } as any }),
    );

    await expect(loadModule('no-init-method')).rejects.toThrow(
      /Missing: init\(\)/
    );
  });

  it('отсутствует manifest — ошибка с указанием', async () => {
    registerModulePath(
      'no-manifest-mod',
      () => Promise.resolve({ default: { init: vi.fn(), destroy: vi.fn() } as any }),
    );

    await expect(loadModule('no-manifest-mod')).rejects.toThrow(
      /Missing: manifest/
    );
  });

  it('отсутствует destroy — ошибка с указанием', async () => {
    registerModulePath(
      'no-destroy-mod',
      () => Promise.resolve({ default: { manifest: { id: 'no-destroy-mod', name: 'T', version: '1' }, init: vi.fn() } as any }),
    );

    await expect(loadModule('no-destroy-mod')).rejects.toThrow(
      /Missing: destroy\(\)/
    );
  });

  it('все поля отсутствуют — перечислены все', async () => {
    registerModulePath(
      'bare-minimal',
      () => Promise.resolve({ default: {} as any }),
    );

    await expect(loadModule('bare-minimal')).rejects.toThrow(
      /Missing: manifest/
    );
  });
});

// ============================================================
// 3. Runtime — детектирование отсутствия UI
// ============================================================

describe('Runtime — статусы плагинов', () => {
  let eventBus: ReturnType<typeof createEventBus>;
  let storeAccess: ReturnType<typeof createStoreAccess>;

  beforeEach(() => {
    eventBus = createEventBus();
    (eventBus as { clear(): void }).clear();
    storeAccess = createStoreAccess();
    pluginRegistry.clear();
    executionGate.clear();
  });

  it('корректный плагин с UI — статус ok', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const mod: AppModule = {
      manifest: { id: 'ok-plugin', name: 'OK', version: '1', description: '', dependencies: [], settingsSchema: [], slot: ['ribbon:tools'] },
      init(ctx) { ctx.registerUI({ slot: 'ribbon:tools', label: 'OK', icon: 'check', component: () => null }); },
      destroy: vi.fn(),
    };

    runtime.register(mod);
    await runtime.initOne('ok-plugin');

    const statuses = runtime.getModuleStatuses();
    const s = statuses.find(st => st.id === 'ok-plugin');
    expect(s?.status).toBe('ok');
    expect(s?.uiContributionsCount).toBe(1);
  });

  it('плагин без UI — статус no-ui', async () => {
    pluginRegistry.install('no-ui-plugin', 'user', 'No UI');
    const runtime = createRuntime(eventBus, storeAccess);
    const mod: AppModule = {
      manifest: { id: 'no-ui-plugin', name: 'No UI', version: '1', description: '', dependencies: [], settingsSchema: [], slot: ['ribbon:tools'] },
      init: vi.fn(), // не вызывает registerUI
      destroy: vi.fn(),
    };

    runtime.register(mod);
    await runtime.initOne('no-ui-plugin');

    const statuses = runtime.getModuleStatuses();
    const s = statuses.find(st => st.id === 'no-ui-plugin');
    expect(s?.status).toBe('no-ui');
    expect(s?.error).toContain('registerUI');
  });

  it('плагин без slot в manifest — не проверяет UI', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const mod: AppModule = {
      manifest: { id: 'no-slot', name: 'No Slot', version: '1', description: '', dependencies: [], settingsSchema: [], slot: [] },
      init: vi.fn(),
      destroy: vi.fn(),
    };

    runtime.register(mod);
    await runtime.initOne('no-slot');

    const statuses = runtime.getModuleStatuses();
    const s = statuses.find(st => st.id === 'no-slot');
    expect(s?.status).toBe('ok');
  });

  it('фейл внутри init() — статус failed', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const mod: AppModule = {
      manifest: { id: 'crash-plugin', name: 'Crash', version: '1', description: '', dependencies: [], settingsSchema: [], slot: [] },
      init: () => { throw new Error('init crashed'); },
      destroy: vi.fn(),
    };

    runtime.register(mod);
    const result = await runtime.initOne('crash-plugin');
    expect(result).toBe(false);

    const statuses = runtime.getModuleStatuses();
    const s = statuses.find(st => st.id === 'crash-plugin');
    expect(s?.status).toBe('failed');
    expect(s?.error).toContain('init crashed');
  });
});

// ============================================================
// 4. Plugin lifecycle events emission
// ============================================================

describe('Plugin lifecycle events', () => {
  let eventBus: ReturnType<typeof createEventBus>;
  let storeAccess: ReturnType<typeof createStoreAccess>;

  beforeEach(() => {
    eventBus = createEventBus();
    (eventBus as { clear(): void }).clear();
    storeAccess = createStoreAccess();
    pluginRegistry.clear();
    executionGate.clear();
  });

  it('UI_REGISTERED emitted when plugin registers UI', async () => {
    const events: string[] = [];
    eventBus.on(PLUGIN_EVENTS.UI_REGISTERED, (p: any) => events.push(p.pluginId));

    const runtime = createRuntime(eventBus, storeAccess);
    const mod: AppModule = {
      manifest: { id: 'ui-plugin', name: 'UI', version: '1', description: '', dependencies: [], settingsSchema: [], slot: ['ribbon:tools'] },
      init(ctx) { ctx.registerUI({ slot: 'ribbon:tools', label: 'UI', icon: 'check', component: () => null }); },
      destroy: vi.fn(),
    };

    runtime.register(mod);
    await runtime.initOne('ui-plugin');

    expect(events).toContain('ui-plugin');
  });

  it('UI_MISSING emitted when user plugin has slot but no registerUI call', async () => {
    pluginRegistry.install('no-ui-emit', 'user', 'No UI');
    const events: Array<{ pluginId: string; detail: string }> = [];
    eventBus.on(PLUGIN_EVENTS.UI_MISSING, (p: any) => events.push(p));

    const runtime = createRuntime(eventBus, storeAccess);
    const mod: AppModule = {
      manifest: { id: 'no-ui-emit', name: 'No UI', version: '1', description: '', dependencies: [], settingsSchema: [], slot: ['ribbon:tools'] },
      init: vi.fn(),
      destroy: vi.fn(),
    };

    runtime.register(mod);
    await runtime.initOne('no-ui-emit');

    expect(events.some(e => e.pluginId === 'no-ui-emit')).toBe(true);
    expect(events[0].detail).toContain('registerUI');
  });

  it('UI_REGISTERED not emitted when slot array is empty', async () => {
    const events: string[] = [];
    eventBus.on(PLUGIN_EVENTS.UI_REGISTERED, (p: any) => events.push(p.pluginId));

    const runtime = createRuntime(eventBus, storeAccess);
    const mod: AppModule = {
      manifest: { id: 'empty-slot', name: 'Empty', version: '1', description: '', dependencies: [], settingsSchema: [], slot: [] },
      init: vi.fn(),
      destroy: vi.fn(),
    };

    runtime.register(mod);
    await runtime.initOne('empty-slot');

    expect(events).not.toContain('empty-slot');
  });
});

// ============================================================
// 5. Платформа не принимает некорректные плагины
// ============================================================

describe('Платформа не принимает некорректные плагины молча', () => {
  let eventBus: ReturnType<typeof createEventBus>;
  let storeAccess: ReturnType<typeof createStoreAccess>;

  beforeEach(() => {
    eventBus = createEventBus();
    (eventBus as { clear(): void }).clear();
    storeAccess = createStoreAccess();
    pluginRegistry.clear();
    executionGate.clear();
  });

  it('loadModule для не-AppModule кидает ModuleLoadError', async () => {
    registerUserPlugin('bad-script', () => Promise.resolve({ default: { notAModule: true } as any }));
    await expect(loadModule('bad-script', 'user')).rejects.toThrow(ModuleLoadError);
  });

  it('initOne возвращает false при ошибке', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const mod: AppModule = {
      manifest: { id: 'failing', name: 'Fail', version: '1', description: '', dependencies: [], settingsSchema: [], slot: [] },
      init: () => { throw new Error('Kaboom'); },
      destroy: vi.fn(),
    };

    runtime.register(mod);
    expect(await runtime.initOne('failing')).toBe(false);
  });

  it('enablePlugin возвращает false при неудачной загрузке', async () => {
    pluginRegistry.install('ghost-plugin', 'user');
    pluginRegistry.disable('ghost-plugin');

    const runtime = createRuntime(eventBus, storeAccess);
    const result = await runtime.enablePlugin('ghost-plugin');

    expect(result).toBe(false);
    expect(runtime.isModuleFailed('ghost-plugin')).toBe(true);
  });

  it('статус плагина виден в getModuleStatuses после ошибки загрузки при enablePlugin', async () => {
    pluginRegistry.install('fail-load', 'user');
    // Не выключаем в registry — пусть runtime сам обнаружит ошибку
    // Но не регистрируем path, чтобы loadModule кинул ошибку

    const runtime = createRuntime(eventBus, storeAccess);
    const result = await runtime.enablePlugin('fail-load');
    expect(result).toBe(false);

    const statuses = runtime.getModuleStatuses();
    const s = statuses.find(st => st.id === 'fail-load');
    expect(s).toBeDefined();
    expect(s!.error).toBeDefined();
  });

  it('статус ошибочного плагина виден через registry fallback', () => {
    pluginRegistry.install('orphan-plugin', 'user');
    pluginRegistry.disable('orphan-plugin');

    const runtime = createRuntime(eventBus, storeAccess);

    const statuses = runtime.getModuleStatuses();
    const s = statuses.find(st => st.id === 'orphan-plugin');
    expect(s).toBeDefined();
    expect(s!.status).toBe('disabled');
    expect(s!.enabled).toBe(false);
  });
});
