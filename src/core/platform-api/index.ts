import { createLogger } from '../logger';
import { LogStore } from '../logging/LogStore';
import { getRuntime } from '../module-runtime';
import { getCommandRegistry } from '../command-registry';
import { useAppStore } from '../store';
import type { PlatformAPI, PlatformStateAPI, PlatformEventsAPI, PlatformCommandsAPI, PlatformRuntimeAPI, HttpRequestOptions, HttpResponse } from './types';
import type { EventBus, StoreAccess } from '../types';

const ALLOWED_DISPATCH_ACTIONS = new Set([
  'setLeftPanel',
  'openPanel',
  'closePanel',
]);

export function createPlatformAPI(
  eventBus: EventBus,
  storeAccess: StoreAccess,
  moduleId: string,
): PlatformAPI {
  const state: PlatformStateAPI = {
    get: (selector) => selector(useAppStore.getState()),
    dispatch: (action, payload) => {
      if (!ALLOWED_DISPATCH_ACTIONS.has(action)) {
        throw new Error(`[PluginAPI] dispatch: action "${action}" is not permitted for plugins`);
      }
      const s = useAppStore.getState();
      const m = (s as unknown as Record<string, unknown>)[action];
      if (typeof m === 'function') {
        (m as (p?: unknown) => void)(payload);
      }
    },
    openPanel: (moduleId: string) => {
      useAppStore.getState().setLeftPanel(true, moduleId);
    },
    closePanel: () => {
      useAppStore.getState().setLeftPanel(false);
    },
  };

  const events: PlatformEventsAPI = {
    on: (event, handler) => eventBus.on(event, handler),
  };

  const commands: PlatformCommandsAPI = {
    execute: (id) => {
      const registry = getCommandRegistry();
      const cmd = registry.get(id) ?? registry.get(`${moduleId}:${id}`);
      if (cmd) cmd.handler();
    },
    register: (id, handler) => {
      const rt = getRuntime();
      const fullId = `${moduleId}:${id}`;
      rt?.getCommands().set(fullId, handler);
      getCommandRegistry().register({ id: fullId, label: id, category: moduleId, handler });
      return () => {
        rt?.getCommands().delete(fullId);
        getCommandRegistry().unregister(fullId);
      };
    },
  };

  const runtime: PlatformRuntimeAPI = {
    getStatus: () => {
      try {
        const rt = getRuntime();
        const mod = rt?.getModule(moduleId);
        if (!mod) return undefined;
        return {
          id: mod.manifest.id,
          name: mod.manifest.name,
          version: mod.manifest.version,
          enabled: true,
          status: 'ok' as const,
        };
      } catch {
        return undefined;
      }
    },
    getModuleIds: () => {
      try {
        const rt = getRuntime();
        if (!rt) return [];
        return rt.getManifests().map(m => m.id);
      } catch {
        return [];
      }
    },
    isModuleEnabled: (id) => {
      try {
        const rt = getRuntime();
        if (!rt) return false;
        return !rt.isModuleDisabled(id);
      } catch {
        return false;
      }
    },
    setModuleEnabled: async (id, enabled) => {
      LogStore._log(
        'warn',
        'platform-api',
        `[plugin:${moduleId}] setModuleEnabled("${id}", ${enabled})`,
      );
      try {
        const rt = getRuntime();
        if (!rt) return;
        if (enabled) {
          rt.enablePlugin(id);
        } else {
          await rt.disablePlugin(id);
        }
      } catch { /* ignore */ }
    },
  };

  const httpRequest = async (options: HttpRequestOptions): Promise<HttpResponse> => {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('http_request', { request: options });
  };

  return { logger: createLogger(moduleId), state, events, commands, runtime, httpRequest };
}
