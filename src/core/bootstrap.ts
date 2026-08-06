import { listen } from '@tauri-apps/api/event';
import { createEventBus } from './event-bus';
import { getBuiltinModuleIds } from './module-loader';
import { pluginRegistry } from './plugin-registry';
import { getCommandRegistry } from './command-registry';
import { keybindingManager } from './keybinding-manager';
import { initLogger } from './tauri-logger';
import { LogStore } from './logging/LogStore';
import { globalErrorCollector } from './errors/ErrorCollector';
import { PLUGIN_EVENTS } from './user-plugin-loader';
import { executionGate } from './module-execution-gate';
import { installFetchInterceptor, installPluginFetch } from './network/fetch-interceptor';
import { AIQueueManager } from './ai/queue-manager';
import { useAIStore } from './ai/store';
import { createStoreAccess, useAppStore, resetContextKeysSync } from './store';
import { setToolEnabled, isToolId } from '@/core/tool-registry';
import './engine/engine-handlers';
import type { ModuleRuntimeImpl } from './module-runtime';

import { orchestrateDiscovery } from './bootstrap-discovery';
import { orchestrateRegistry } from './bootstrap-registry';
import { createAndSetupRuntime, loadAndInitModules } from './bootstrap-runtime';
import { enableAutoSave, flushSaveQueue } from './project-service-auto-save';

export let eventBus: ReturnType<typeof createEventBus>;
export let runtime: ModuleRuntimeImpl;

const ALL_BUILTIN_IDS = getBuiltinModuleIds();

let _bootstrapped = false;
let _bootstrapUnsubs: Array<() => void> = [];

export async function resetBootstrap(): Promise<void> {
  _bootstrapped = false;
  for (const unsub of _bootstrapUnsubs) {
    try { unsub(); } catch { /* ignore */ }
  }
  _bootstrapUnsubs = [];
  await flushSaveQueue(2000).catch(err => console.error('[bootstrap] flush failed on reset:', err));
  if (runtime) {
    await runtime.destroyAll();
  }
  const { resetEventBus } = await import('./event-bus');
  resetEventBus();
  executionGate.clear();
  resetContextKeysSync();
  AIQueueManager.reset();
}

export async function bootstrap(): Promise<void> {
  if (_bootstrapped) {
    console.warn('[Bootstrap] Already bootstrapped, skipping duplicate call.');
    return;
  }
  _bootstrapped = true;

  await initLogger();
  installFetchInterceptor();
  installPluginFetch();

  useAppStore.setState(s => ({
    ui: { ...s.ui, modulesLoading: true },
  }));

  eventBus = createEventBus();
  const storeAccess = createStoreAccess();
  runtime = createAndSetupRuntime(eventBus, storeAccess);
  LogStore.enableEventBus();

  LogStore._log('info', 'system', 'bootstrap:started', { version: '0.3.0' });
  eventBus.emit('app:bootstrap-started' as any, { timestamp: Date.now() });

  let debugStartTime = performance.now();
  _bootstrapUnsubs.push(eventBus.on('module:error', (payload: unknown) => {
    const { moduleId, error, phase } = (payload || {}) as { moduleId?: string; error?: unknown; phase?: string };
    if (moduleId) {
      globalErrorCollector.add(moduleId, (phase as any) ?? 'runtime', error ?? 'Unknown error');
    }
  }));
  _bootstrapUnsubs.push(eventBus.on('runtime:error', (payload: unknown) => {
    const { moduleId, error } = (payload || {}) as { moduleId?: string; error?: unknown };
    if (moduleId) {
      globalErrorCollector.add(moduleId, 'runtime', error ?? 'Unknown runtime error');
    }
  }));
  _bootstrapUnsubs.push(eventBus.on('ipc:error', (payload: unknown) => {
    const { command, error } = (payload || {}) as { command?: string; error?: unknown };
    globalErrorCollector.add('ipc', 'runtime', error ?? `IPC command "${command}" failed`);
  }));

  {
    const unsub = await listen('store:phrases-updated', (event) => {
      const { action, payload } = event.payload as { action: string; payload: Record<string, unknown> };
      if (action === 'addPhrases') {
        const p = payload as { texts: string[]; groupId: string };
        useAppStore.getState().addPhrases(p.texts, p.groupId);
      } else if (action === 'updateFrequencies') {
        const p = payload as { updates: Array<{ id: string; frequency: number }> };
        for (const u of p.updates) {
          useAppStore.getState().updatePhrase(u.id, { frequency: u.frequency });
        }
      }
    });
    _bootstrapUnsubs.push(unsub);
  }

  const allUserPluginIds = await orchestrateDiscovery();
  orchestrateRegistry(ALL_BUILTIN_IDS, allUserPluginIds);

  LogStore._log('debug', 'system', `Step 1-4 complete: ${performance.now() - debugStartTime}ms`);
  debugStartTime = performance.now();

  await loadAndInitModules(runtime, eventBus);

  LogStore._log('debug', 'system', `Modules registered: ${runtime.getManifests().length}, load time: ${performance.now() - debugStartTime}ms`);
  debugStartTime = performance.now();

  try {
    await runtime.initAll();
    LogStore._log('debug', 'system', `initAll complete: ${performance.now() - debugStartTime}ms`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    LogStore._log('error', 'system', `InitAll failed: ${msg}`, { error: msg });
    useAppStore.setState(s => ({
      ui: { ...s.ui, modulesLoading: false, initError: msg },
    }));
    return;
  }

  useAppStore.setState(s => ({
    ui: { ...s.ui, modulesLoading: false },
  }));

  if (useAppStore.getState().ui.dbPersistenceEnabled) {
    enableAutoSave();
  }

  const statuses = runtime.getModuleStatuses();
  let ok = 0, failed = 0, disabled = 0;
  for (const s of statuses) {
    if (s.status === 'ok') ok++;
    else if (s.status === 'failed') failed++;
    else if (s.status === 'disabled') disabled++;
  }
  LogStore._log('info', 'system', `Modules initialized: ${ok} ok, ${failed} failed, ${disabled} disabled`);

  const nameUpdates = pluginRegistry
    .getAll()
    .filter(r => !r.enabled && !r.name)
    .map(async (record) => {
      try {
        const { loadManifest } = await import('./module-loader');
        const manifest = await loadManifest(record.id, record.source);
        pluginRegistry.updateName(record.id, manifest.name);
      } catch { /* ignore */ }
    });
  await Promise.allSettled(nameUpdates);

  LogStore._log('info', 'system', 'bootstrap:completed', {
    modulesLoaded: Array.from(runtime.getManifests().map(m => m.id)),
    initTimeMs: statuses.reduce((acc, m) => acc + (m.initTimeMs ?? 0), 0),
  });
  eventBus.emit('app:bootstrap-completed' as any, { timestamp: Date.now() });

  const themeContribs = runtime.getUIContributions('theme');
  for (const contrib of themeContribs) {
    if (contrib.cssVars) {
      const vars = Object.entries(contrib.cssVars).map(([k, v]) => `${k}: ${v};`).join('\n');
      const css = `:root[data-theme] { ${vars} }`;
      let el = document.getElementById(`theme-${contrib.moduleId}`) as HTMLStyleElement | null;
      if (!el) { el = document.createElement('style'); el.id = `theme-${contrib.moduleId}`; document.head.appendChild(el); }
      el.textContent = css;
    }
    if (contrib.cssText) {
      let el = document.getElementById(`theme-css-${contrib.moduleId}`) as HTMLStyleElement | null;
      if (!el) { el = document.createElement('style'); el.id = `theme-css-${contrib.moduleId}`; document.head.appendChild(el); }
      el.textContent = contrib.cssText;
    }
  }

  const registry = getCommandRegistry();
  registry.register({
    id: 'core.undo',
    label: 'Отменить последнее действие',
    category: 'Правка',
    keybinding: 'Ctrl+Z',
    handler: () => useAppStore.getState().undo(),
  });
  registry.register({
    id: 'core.redo',
    label: 'Повторить действие',
    category: 'Правка',
    keybinding: 'Ctrl+Shift+Z',
    handler: () => useAppStore.getState().redo(),
  });
  registry.register({
    id: 'core.selectAll',
    label: 'Выделить все фразы',
    category: 'Правка',
    keybinding: 'Ctrl+A',
    handler: () => useAppStore.getState().selectAllPhrases(),
  });
  registry.register({
    id: 'core.palette',
    label: 'Открыть палитру команд',
    category: 'Навигация',
    keybinding: 'Ctrl+K',
    handler: () => {},
  });
  registry.register({
    id: 'core.editPhrase',
    label: 'Редактировать выбранную фразу',
    category: 'Правка',
    keybinding: 'F2',
    handler: () => {},
  });
  registry.register({
    id: 'core.deleteSelected',
    label: 'Удалить выбранные фразы',
    category: 'Правка',
    keybinding: 'Delete',
    handler: () => {},
  });

  keybindingManager.register('ctrl+z', 'core.undo');
  keybindingManager.register('ctrl+y', 'core.redo');
  keybindingManager.register('ctrl+shift+z', 'core.redo');
  keybindingManager.register('meta+z', 'core.undo');
  keybindingManager.register('meta+shift+z', 'core.redo');

  if (process.env.NODE_ENV === 'development' && typeof module !== 'undefined' && (module as unknown as { hot?: unknown }).hot) {
    (module as unknown as { hot: { accept: () => void } }).hot.accept();
  }

  if (import.meta.env.DEV) {
    import('./hot-reload-watcher').then(({ startHotReloadWatcher }) => {
      startHotReloadWatcher().catch((err: unknown) => {
        console.error('[bootstrap] Failed to start hot-reload watcher:', err);
      });
    });
  }
}

export async function shutdown(): Promise<void> {
  _bootstrapped = false;
  for (const unsub of _bootstrapUnsubs) {
    try { unsub(); } catch { /* ignore */ }
  }
  _bootstrapUnsubs = [];
  pluginRegistry.flush();
  await flushSaveQueue(2000);
  if (runtime) {
    await runtime.destroyAll();
  }
  const { resetEventBus } = await import('./event-bus');
  resetEventBus();
  AIQueueManager.reset();
}
