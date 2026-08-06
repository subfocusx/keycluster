import type { EventBus, StoreAccess } from './types';
import { createRuntime } from './module-runtime';
import { setRuntimeRef } from './store';
import { loadModule, getBuiltinModuleIds, ModuleLoadError } from './module-loader';
import { pluginRegistry } from './plugin-registry';
import { LogStore } from './logging/LogStore';
import { executionGate } from './module-execution-gate';
import { registerDiscoveredPlugins, registerRuntimeUserPlugins, PLUGIN_EVENTS } from './user-plugin-loader';
import { declareCoreSlots } from './slot-registry-constants';
import { useAIStore } from './ai/store';
import { AIQueueManager } from './ai/queue-manager';

const ALL_BUILTIN_IDS = new Set(getBuiltinModuleIds());

export function createAndSetupRuntime(eventBus: EventBus, storeAccess: StoreAccess): ReturnType<typeof createRuntime> {
  const runtime = createRuntime(eventBus, storeAccess);
  setRuntimeRef({ getRuntime: () => runtime });
  useAIStore.getState().setQueueManager(AIQueueManager.getInstance());
  declareCoreSlots(runtime);
  return runtime;
}

export async function loadAndInitModules(
  runtime: ReturnType<typeof createRuntime>,
  eventBus: EventBus,
): Promise<void> {
  const allEnabledRecords = pluginRegistry.getAll().filter(p => p.enabled);
  const seen = new Set<string>();
  const enabledRecords = allEnabledRecords.filter(r => {
    if (seen.has(r.id)) {
      LogStore._log('warn', 'bootstrap', `Duplicate plugin record detected and skipped: "${r.id}"`);
      return false;
    }
    seen.add(r.id);
    return true;
  });

  const loadResults = await Promise.allSettled(
    enabledRecords.map(record => {
      eventBus.emit(PLUGIN_EVENTS.LOAD_STARTED, { pluginId: record.id, name: record.name });
      return loadModule(record.id, record.source);
    })
  );

  for (let i = 0; i < enabledRecords.length; i++) {
    const record = enabledRecords[i];
    const result = loadResults[i];

    if (result.status === 'fulfilled') {
      const mod = result.value;
      runtime.register(mod);
      eventBus.emit(PLUGIN_EVENTS.LOAD_SUCCESS, { pluginId: record.id, name: mod.manifest.name, version: mod.manifest.version });
    } else {
      const err = result.reason;
      const errorMsg = err instanceof Error ? err.message : String(err);

      if (err instanceof ModuleLoadError) {
        console.error(`[Bootstrap] ${errorMsg}`);
        LogStore._log('warn', 'bootstrap', `Skipping module "${record.id}"`, { source: record.source, error: errorMsg });

        const isStructureError = errorMsg.includes('структуру') || errorMsg.includes('Отсутствует');
        const isExportError = errorMsg.includes('не экспортирует');

        if (isStructureError || isExportError) {
          eventBus.emit(PLUGIN_EVENTS.INVALID_STRUCTURE, { pluginId: record.id, error: errorMsg, detail: record.source });
        } else {
          eventBus.emit(PLUGIN_EVENTS.LOAD_FAILED, { pluginId: record.id, error: errorMsg, detail: record.source });
        }

        if (!ALL_BUILTIN_IDS.has(record.id) && record.source !== 'user') {
          pluginRegistry.purge(record.id);
        }
      } else {
        console.error(`[Bootstrap] Unexpected error loading "${record.id}":`, err);
        eventBus.emit(PLUGIN_EVENTS.LOAD_FAILED, { pluginId: record.id, error: errorMsg });
      }
    }
  }

  LogStore._log('debug', 'system', `Modules registered: ${runtime.getManifests().length}`);

  try {
    await runtime.initAll();
    LogStore._log('debug', 'system', `initAll complete`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    LogStore._log('error', 'system', `InitAll failed: ${msg}`, { error: msg });
  }
}
