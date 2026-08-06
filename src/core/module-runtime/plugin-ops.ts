import type { RuntimeState } from '../module-runtime-types';
import type { EventBus } from '../types';
import type { ModuleLifecycleManager } from '../module-runtime-lifecycle';
import { LogStore } from '../logging/LogStore';
import { executionGate } from '../module-execution-gate';
import { pluginRegistry } from '../plugin-registry';
import { setToolEnabled } from '@/core/tool-registry';
import type { ToolId } from '@/core/tool-registry';
import { labelRegistry } from '../label-registry';
import { keybindingManager } from '../keybinding-manager';
import { getCommandRegistry } from '../command-registry';
import { removeFromModuleCache, pluginSourceRepo } from '../module-loader';
import { removePluginFolder, removeDevPluginFolder } from '../plugin-fs-utils';
import { storageGet, storageSet, STORAGE_KEYS } from '../storage/local-storage';
import { useSettingsStore } from '../settings-store';

export async function disableModule(
  state: RuntimeState,
  lifecycle: ModuleLifecycleManager,
  moduleId: string,
): Promise<void> {
  executionGate.disable(moduleId);
  await lifecycle.destroyOne(moduleId);
  if (pluginRegistry.isInstalled(moduleId)) {
    pluginRegistry.disable(moduleId);
  }
  setToolEnabled(moduleId as ToolId, false);
}

export async function enableModule(
  state: RuntimeState,
  eventBus: EventBus,
  lifecycle: ModuleLifecycleManager,
  moduleId: string,
): Promise<boolean> {
  const mod = state.modules.get(moduleId);
  if (!mod) {
    console.warn(`[Runtime] Cannot enable unknown module "${moduleId}".`);
    return false;
  }
  executionGate.enable(moduleId);
  state.disabledModules.delete(moduleId);
  const success = await lifecycle.initOne(moduleId);
  if (success) {
    if (pluginRegistry.isInstalled(moduleId)) {
      pluginRegistry.enable(moduleId);
    }
    setToolEnabled(moduleId as ToolId, true);
    eventBus.emit('module:enabled', { id: moduleId });
    LogStore._log('info', moduleId, 'enabled');
  }
  return success;
}

const moduleOpQueue = new Map<string, Promise<unknown>>();

function serializeModuleOp<T>(moduleId: string, fn: () => Promise<T>): Promise<T> {
  const prev = moduleOpQueue.get(moduleId);
  const promise = (prev ?? Promise.resolve()).then(fn).finally(() => {
    if (moduleOpQueue.get(moduleId) === promise) {
      moduleOpQueue.delete(moduleId);
    }
  });
  moduleOpQueue.set(moduleId, promise);
  return promise as Promise<T>;
}

export async function enablePlugin(
  state: RuntimeState,
  eventBus: EventBus,
  lifecycle: ModuleLifecycleManager,
  enablingPlugins: Set<string>,
  moduleId: string,
): Promise<boolean> {
  return serializeModuleOp(moduleId, async () => {
    if (enablingPlugins.has(moduleId)) return false;
    enablingPlugins.add(moduleId);
    try {
      const record = pluginRegistry.get(moduleId);
      if (!record) {
        throw new Error(`Plugin "${moduleId}" is not installed.`);
      }

      executionGate.enable(moduleId);

      if (!state.modules.has(moduleId)) {
        try {
          const { loadModule } = await import('../module-loader');
          const mod = await loadModule(moduleId, record.source);
          lifecycle.register(mod);
        } catch (err) {
          console.error(`[Runtime] Failed to enable plugin "${moduleId}":`, err);
          state.disabledModules.add(moduleId);
          state.failedModules.add(moduleId);
          state.moduleErrors.set(moduleId, err instanceof Error ? err.message : String(err));
          eventBus.emit('module:error', { moduleId, error: err, phase: 'init' });
          return false;
        }
      }

      state.disabledModules.delete(moduleId);
      const success = await lifecycle.initOne(moduleId);
      state.disabledModules.delete(moduleId);
      if (success) {
        pluginRegistry.enable(moduleId);
        setToolEnabled(moduleId as ToolId, true);
        eventBus.emit('module:enabled', { id: moduleId });
      }
      return success;
    } finally {
      enablingPlugins.delete(moduleId);
    }
  });
}

export async function disablePlugin(
  state: RuntimeState,
  lifecycle: ModuleLifecycleManager,
  moduleId: string,
): Promise<void> {
  executionGate.disable(moduleId);
  await lifecycle.destroyOne(moduleId);
  if (pluginRegistry.isInstalled(moduleId)) {
    pluginRegistry.disable(moduleId);
  }
  setToolEnabled(moduleId as ToolId, false);
}

export async function uninstallPlugin(
  state: RuntimeState,
  eventBus: EventBus,
  lifecycle: ModuleLifecycleManager,
  moduleId: string,
  deleteFiles = true,
): Promise<void> {
  await disablePlugin(state, lifecycle, moduleId);

  labelRegistry.unregister(moduleId);

  const stylePrefix = `plugin-style-${moduleId}`;
  document.querySelectorAll(`style[id^="${stylePrefix}"]`).forEach(el => el.remove());
  const themeStyle = document.getElementById(`theme-${moduleId}`);
  if (themeStyle) themeStyle.remove();
  const themeCss = document.getElementById(`theme-css-${moduleId}`);
  if (themeCss) themeCss.remove();

  pluginSourceRepo.remove(moduleId);

  try {
    pluginRegistry.uninstall(moduleId);
  } catch (err) {
    LogStore._log('warn', moduleId, `registry.uninstall skipped: ${err instanceof Error ? err.message : String(err)}`);
    pluginRegistry.purge(moduleId);
    LogStore._log('info', moduleId, 'registry.purge fallback applied');
  }

  removeFromModuleCache(moduleId);

  state.modules.delete(moduleId);
  state.moduleErrors.delete(moduleId);
  state.failedModules.delete(moduleId);
  state.disabledModules.delete(moduleId);
  state.contexts.delete(moduleId);
  state.initStartTimes.delete(moduleId);
  state.handles.delete(moduleId);

  for (const key of state.commands.keys()) {
    if (key.startsWith(`${moduleId}:`)) {
      getCommandRegistry().unregister(key);
      state.commands.delete(key);
    }
  }
  for (const [key, kb] of [...state.keybindings]) {
    if (kb.moduleId === moduleId) {
      state.keybindings.delete(key);
      keybindingManager.unregister(key);
    }
  }

  try {
    const overrides = storageGet<Record<string, string>>(STORAGE_KEYS.CATEGORY_OVERRIDES) ?? {};
    delete overrides[moduleId];
    storageSet(STORAGE_KEYS.CATEGORY_OVERRIDES, overrides);
  } catch { }

  // Clean up legacy key used in tests
  try {
    const legacy = JSON.parse(localStorage.getItem('plugin-category-overrides-v2') ?? '{}');
    delete legacy[moduleId];
    localStorage.setItem('plugin-category-overrides-v2', JSON.stringify(legacy));
  } catch { }

  useSettingsStore.getState().resetModuleSettings(moduleId);

  if (deleteFiles) {
    try {
      await removePluginFolder(moduleId);
      await removeDevPluginFolder(moduleId);
      LogStore._log('info', moduleId, 'plugin files deleted from disk');
    } catch (err) {
      LogStore._log('warn', moduleId, `Failed to delete plugin files: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  eventBus.emit('plugin:uninstalled', { pluginId: moduleId });
  LogStore._log('info', moduleId, 'plugin:uninstalled');
}
