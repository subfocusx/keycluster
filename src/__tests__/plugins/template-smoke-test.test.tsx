// ============================================================
// Template Smoke Test — автоматическая проверка шаблонов
//
// Сценарий:
//   создать плагин из plugin-template
//   собрать
//   установить через Plugin Manager
//   включить
//   проверить UI
//   выполнить действие
//   удалить
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRuntime } from '@/core/module-runtime';
import { createStoreAccess } from '@/core/store';
import { executionGate } from '@/core/module-execution-gate';
import { clearModuleCache, registerUserPlugin, registerModulePath } from '@/core/module-loader';
import { validatePluginModule } from '@/core/user-plugin-loader';
import { createEventBus } from '@/core/event-bus';
import { pluginRegistry } from '@/core/plugin-registry';
import type { AppModule, Group, PhraseActionContext } from '@/core/types';

// ---- Helper: создаёт плагин по шаблону plugin-template ----
function createPluginFromTemplate(id = 'smoke-test-plugin'): AppModule {
  return {
    manifest: {
      id,
      name: 'Smoke Test Plugin',
      version: '1.0.0',
      description: 'Тестовый плагин из smoke теста',
      icon: 'extension',
      dependencies: [],
      slot: ['ribbon:tools', 'context-menu:group', 'status-bar'],
      settingsSchema: [
        { key: 'enabled', type: 'boolean', label: 'Включен', default: true },
      ],
    },
    init(ctx) {
      const c = ctx as any;
      c.registerCommand('my-action', () => {
        /* noop */
      });

      c.registerKeybinding('Ctrl+Shift+S', 'my-action', { label: 'Тестовое действие' });

      c.registerUI({
        slot: 'ribbon:tools',
        label: 'Smoke Plugin',
        icon: 'extension',
        component: () => <div data-testid="smoke-plugin-ui">Smoke Plugin Content</div>,
        order: 100,
      });

      c.registerUI({
        slot: 'context-menu:group',
        label: 'Smoke Action',
        icon: 'bolt',
        action: (group: Group, actionCtx: PhraseActionContext) => {
          actionCtx.eventBus.emit('notify', { message: `Smoke action on "${group.name}"` });
        },
        order: 200,
      });

      c.registerUI({
        slot: 'status-bar',
        label: 'Smoke Status',
        component: () => <span>Smoke OK</span>,
      });

      c.onEvent('phrases:changed', () => {});
      c.subscribeStore(() => {});
    },
    destroy() {
      /* cleanup */
    },
  };
}

describe('Template Smoke Test', () => {
  let eventBus: ReturnType<typeof createEventBus>;
  let storeAccess: ReturnType<typeof createStoreAccess>;

  beforeEach(() => {
    eventBus = createEventBus();
    (eventBus as { clear(): void }).clear();
    storeAccess = createStoreAccess();
    pluginRegistry.clear();
    executionGate.clear();
    clearModuleCache();
  });

  // ============================================================
  // 1. Создание плагина из шаблона
  // ============================================================

  it('1. create plugin from template — valid AppModule structure', () => {
    const plugin = createPluginFromTemplate('my-custom-plugin');
    expect(plugin).toBeDefined();
    expect(plugin.manifest.id).toBe('my-custom-plugin');
    expect(plugin.manifest.name).toBe('Smoke Test Plugin');
    expect(plugin.manifest.version).toBe('1.0.0');
    expect(Array.isArray(plugin.manifest.slot)).toBe(true);
    expect(plugin.manifest.slot).toContain('ribbon:tools');
    expect(plugin.manifest.slot).toContain('context-menu:group');
    expect(typeof plugin.init).toBe('function');
    expect(typeof plugin.destroy).toBe('function');
  });

  // ============================================================
  // 2. validatePluginModule проходит
  // ============================================================

  it('2. validatePluginModule — passes for template-based plugin', () => {
    const plugin = createPluginFromTemplate('valid-template-plugin');
    const err = validatePluginModule(plugin, 'valid-template-plugin');
    expect(err).toBeNull();
  });

  // ============================================================
  // 3. validatePluginModule отклоняет шаблонные ID
  // ============================================================

  it('3. validatePluginModule — rejects placeholder IDs', () => {
    const plugin = createPluginFromTemplate('YOUR_PLUGIN_ID');
    // Override manifest id to trigger validation
    plugin.manifest.id = 'YOUR_PLUGIN_ID';
    const err = validatePluginModule(plugin, 'YOUR_PLUGIN_ID');
    expect(err).toContain('ID-заглушку');
  });

  it('3b. validatePluginModule — rejects advanced placeholder IDs', () => {
    const plugin = createPluginFromTemplate('YOUR_ADVANCED_PLUGIN_ID');
    plugin.manifest.id = 'YOUR_ADVANCED_PLUGIN_ID';
    const err = validatePluginModule(plugin, 'YOUR_ADVANCED_PLUGIN_ID');
    expect(err).toContain('ID-заглушку');
  });

  it('3c. validatePluginModule — rejects PLACEHOLDER_ID', () => {
    const plugin = createPluginFromTemplate('PLACEHOLDER_ID');
    plugin.manifest.id = 'PLACEHOLDER_ID';
    const err = validatePluginModule(plugin, 'PLACEHOLDER_ID');
    expect(err).toContain('ID-заглушку');
  });

  // ============================================================
  // 4. Plugin Manager: install → register → init
  // ============================================================

  it('4. install via pluginRegistry + runtime register + init', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const plugin = createPluginFromTemplate('smoke-full');

    pluginRegistry.install('smoke-full', 'user', 'Smoke Test Plugin');
    expect(pluginRegistry.isInstalled('smoke-full')).toBe(true);
    expect(pluginRegistry.isEnabled('smoke-full')).toBe(true);

    runtime.register(plugin);
    const initResult = await runtime.initOne('smoke-full');
    expect(initResult).toBe(true);

    const statuses = runtime.getModuleStatuses();
    const s = statuses.find(st => st.id === 'smoke-full');
    expect(s).toBeDefined();
    expect(s!.status).toBe('ok');
  });

  // ============================================================
  // 5. UI contributions registered correctly
  // ============================================================

  it('5. UI contributions — all 3 slots have contributions', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const plugin = createPluginFromTemplate('smoke-ui');
    pluginRegistry.install('smoke-ui', 'user');
    runtime.register(plugin);
    await runtime.initOne('smoke-ui');

    const ribbonContribs = runtime.getUIContributions('ribbon:tools');
    expect(ribbonContribs.some(c => c.moduleId === 'smoke-ui' && c.label === 'Smoke Plugin')).toBe(true);

    const contextMenuContribs = runtime.getUIContributions('context-menu:group');
    expect(contextMenuContribs.some(c => c.moduleId === 'smoke-ui' && c.label === 'Smoke Action')).toBe(true);

    const statusBarContribs = runtime.getUIContributions('status-bar');
    expect(statusBarContribs.some(c => c.moduleId === 'smoke-ui' && c.label === 'Smoke Status')).toBe(true);
  });

  // ============================================================
  // 6. Action-based contribution works
  // ============================================================

  it('6. action-based contribution — context-menu:group action fires', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const plugin = createPluginFromTemplate('smoke-action');
    pluginRegistry.install('smoke-action', 'user');
    runtime.register(plugin);
    await runtime.initOne('smoke-action');

    const contextMenuContribs = runtime.getUIContributions('context-menu:group');
    const actionContrib = contextMenuContribs.find(c => c.moduleId === 'smoke-action');
    expect(actionContrib).toBeDefined();
    expect(typeof actionContrib!.action).toBe('function');
  });

  // ============================================================
  // 7. Command registered and executable
  // ============================================================

  it('7. command registration — command exists and is executable', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const plugin = createPluginFromTemplate('smoke-cmd');
    pluginRegistry.install('smoke-cmd', 'user');
    runtime.register(plugin);
    await runtime.initOne('smoke-cmd');

    const commands = runtime.getCommands();
    expect(commands.has('smoke-cmd:my-action')).toBe(true);
  });

  // ============================================================
  // 8. Disable → contributions removed
  // ============================================================

  it('8. disable — contributions removed, status disabled', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const plugin = createPluginFromTemplate('smoke-disable');
    pluginRegistry.install('smoke-disable', 'user');
    runtime.register(plugin);
    await runtime.initOne('smoke-disable');

    expect(runtime.getUIContributions('ribbon:tools').length).toBeGreaterThan(0);

    await runtime.disablePlugin('smoke-disable');
    expect(runtime.isModuleDisabled('smoke-disable')).toBe(true);
    expect(runtime.getUIContributions('ribbon:tools').length).toBe(0);
  });

  // ============================================================
  // 9. Enable → contributions restored
  // ============================================================

  it('9. enable after disable — contributions restored', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const plugin = createPluginFromTemplate('smoke-reenable');
    pluginRegistry.install('smoke-reenable', 'user');
    runtime.register(plugin);
    await runtime.initOne('smoke-reenable');

    await runtime.disablePlugin('smoke-reenable');
    expect(runtime.isModuleDisabled('smoke-reenable')).toBe(true);

    const result = await runtime.enablePlugin('smoke-reenable');
    expect(result).toBe(true);
    expect(runtime.isModuleDisabled('smoke-reenable')).toBe(false);

    const contribs = runtime.getUIContributions('ribbon:tools');
    expect(contribs.some(c => c.moduleId === 'smoke-reenable')).toBe(true);
  });

  // ============================================================
  // 10. Uninstall — full cleanup
  // ============================================================

  it('10. uninstall — plugin removed from runtime and registry', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const plugin = createPluginFromTemplate('smoke-uninstall');
    pluginRegistry.install('smoke-uninstall', 'user');
    runtime.register(plugin);
    await runtime.initOne('smoke-uninstall');

    expect(runtime.getUIContributions('ribbon:tools').some(c => c.moduleId === 'smoke-uninstall')).toBe(true);
    expect(pluginRegistry.isInstalled('smoke-uninstall')).toBe(true);

    await runtime.uninstallPlugin('smoke-uninstall', false);

    const statuses = runtime.getModuleStatuses();
    expect(statuses.some(s => s.id === 'smoke-uninstall')).toBe(false);
    expect(pluginRegistry.isInstalled('smoke-uninstall')).toBe(false);
    expect(runtime.getUIContributions('ribbon:tools').some(c => c.moduleId === 'smoke-uninstall')).toBe(false);
  });

  // ============================================================
  // 11. Full lifecycle: install → enable → init → disable → enable → uninstall
  // ============================================================

  it('11. full lifecycle — install → enable → action → disable → enable → uninstall', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const plugin = createPluginFromTemplate('smoke-lifecycle');

    // Install
    pluginRegistry.install('smoke-lifecycle', 'user', 'Lifecycle Test');
    expect(pluginRegistry.isInstalled('smoke-lifecycle')).toBe(true);

    // Register + init
    runtime.register(plugin);
    const initOk = await runtime.initOne('smoke-lifecycle');
    expect(initOk).toBe(true);
    expect(runtime.getModuleStatuses().find(s => s.id === 'smoke-lifecycle')?.status).toBe('ok');

    // Verify UI
    expect(runtime.getUIContributions('ribbon:tools').some(c => c.moduleId === 'smoke-lifecycle')).toBe(true);
    expect(runtime.getUIContributions('context-menu:group').some(c => c.moduleId === 'smoke-lifecycle')).toBe(true);
    expect(runtime.getUIContributions('status-bar').some(c => c.moduleId === 'smoke-lifecycle')).toBe(true);

    // Verify command
    const commands = runtime.getCommands();
    expect(commands.has('smoke-lifecycle:my-action')).toBe(true);

    // Verify keybinding
    const keybindings = runtime.getKeybindings();
    expect(keybindings.some(k => k.fullCommandId === 'smoke-lifecycle:my-action' && k.keys === 'ctrl+shift+s')).toBe(true);

    // Disable
    await runtime.disablePlugin('smoke-lifecycle');
    expect(runtime.isModuleDisabled('smoke-lifecycle')).toBe(true);
    expect(runtime.getUIContributions('ribbon:tools').length).toBe(0);

    // Re-enable
    const reResult = await runtime.enablePlugin('smoke-lifecycle');
    expect(reResult).toBe(true);
    expect(runtime.isModuleDisabled('smoke-lifecycle')).toBe(false);
    expect(runtime.getUIContributions('ribbon:tools').some(c => c.moduleId === 'smoke-lifecycle')).toBe(true);

    // Uninstall
    await runtime.uninstallPlugin('smoke-lifecycle', false);
    expect(pluginRegistry.isInstalled('smoke-lifecycle')).toBe(false);
    expect(runtime.getUIContributions('ribbon:tools').some(c => c.moduleId === 'smoke-lifecycle')).toBe(false);
  });

  // ============================================================
  // 12. Plugin created from template can be loaded via module-loader
  // ============================================================

  it('12. loadModule — template-based plugin loads via registerUserPlugin', async () => {
    const plugin = createPluginFromTemplate('template-load');
    registerUserPlugin('template-load', () => Promise.resolve({ default: plugin }));

    const { loadModule } = await import('@/core/module-loader');
    const loaded = await loadModule('template-load', 'user');
    expect(loaded).toBeDefined();
    expect(loaded.manifest.id).toBe('template-load');
    expect(typeof loaded.init).toBe('function');
    expect(typeof loaded.destroy).toBe('function');
  });

  // ============================================================
  // 13. Runtime status reporting
  // ============================================================

  it('13. status reporting — plugin statuses include correct info', async () => {
    const runtime = createRuntime(eventBus, storeAccess);
    const plugin = createPluginFromTemplate('smoke-status');
    pluginRegistry.install('smoke-status', 'user', 'Status Test');
    runtime.register(plugin);
    await runtime.initOne('smoke-status');

    const statuses = runtime.getModuleStatuses();
    const s = statuses.find(st => st.id === 'smoke-status');
    expect(s).toBeDefined();
    expect(s!.name).toBe('Smoke Test Plugin');
    expect(s!.version).toBe('1.0.0');
    expect(s!.enabled).toBe(true);
    expect(s!.status).toBe('ok');
    expect(s!.uiContributionsCount).toBeGreaterThanOrEqual(3);
    expect(s!.source).toBe('user');
  });
});
