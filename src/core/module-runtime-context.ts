import type { ModuleUIContribution, FilterContribution, StoreAccess } from './types';
import type { PluginContext, LifecycleEvent, LifecycleHook, RegisteredLifecycleHook, RegisteredKeybinding } from './plugin-api';
import { PLUGIN_API_VERSION } from './plugin-api';
import { keybindingManager } from './keybinding-manager';
import { getCommandRegistry } from './command-registry';
import type { RuntimeState, SlotOptions } from './module-runtime-types';
import { createPlatformAPI } from './platform-api';
import { labelRegistry } from './label-registry';
import { pluginRegistry } from './plugin-registry';
import { useSettingsStore } from './settings-store';
import { registerSearchProvider as regSearchProvider, unregisterSearchProvider } from './search-provider-registry';
import type { SearchProvider } from './search-provider-registry';
import { registerExportFormat as regExportFormat, unregisterExportFormat } from './export-registry';
import type { ExportFormat } from './export-registry';
import { registerFilter as regFilter, unregisterFilter } from './filter-registry';
import { LogStore } from './logging/LogStore';
import { NetworkStore } from './network/NetworkStore';
import { setToolEnabled, isToolId } from '@/core/tool-registry';

const PROTECTED_SLOTS = new Set([
  'theme',
]);

function getHandle(state: RuntimeState, moduleId: string) {
  let handle = state.handles.get(moduleId);
  if (!handle) {
    handle = { timers: new Set(), intervals: new Set(), unsubscribers: new Set(), cleanupFns: [] };
    state.handles.set(moduleId, handle);
  }
  return handle;
}

export function buildPluginContext(
  state: RuntimeState,
  eventBus: import('./types').EventBus,
  storeAccess: import('./types').StoreAccess,
  moduleId: string,
): PluginContext {
  const guardedStore: StoreAccess = {
    ...storeAccess,
    getModuleSetting: (mid: string, key: string) => {
      if (mid !== moduleId) {
        LogStore._log('warn', moduleId, `getModuleSetting: blocked cross-module read of "${mid}"`);
        return undefined;
      }
      return storeAccess.getModuleSetting(mid, key);
    },
  };

  const api = createPlatformAPI(eventBus, storeAccess, moduleId);
  return {
    api,
    fetch: async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;

      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();

      const reqHeaders: Record<string, string> = {};
      const srcHeaders = init?.headers ?? (input instanceof Request ? input.headers : undefined);
      if (srcHeaders instanceof Headers) {
        srcHeaders.forEach((v, k) => { reqHeaders[k] = v; });
      } else if (Array.isArray(srcHeaders)) {
        for (const [k, v] of srcHeaders) reqHeaders[k] = v;
      } else if (srcHeaders) {
        Object.assign(reqHeaders, srcHeaders);
      }
      reqHeaders['x-plugin-id'] = moduleId;

      const startedAt = Date.now();
      const recordId = NetworkStore.add({
        moduleId,
        method,
        url,
        status: 'pending',
        startedAt,
      });

      try {
        const response = await api.httpRequest({
          url,
          method: method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
          headers: reqHeaders,
          body: typeof init?.body === 'string' ? init.body : undefined,
        });

        const durationMs = Date.now() - startedAt;
        NetworkStore.update(recordId, {
          status: response.status >= 200 && response.status < 300 ? 'success' : 'error',
          statusCode: response.status,
          durationMs,
          responseSize: response.body.length,
          error: response.status >= 200 && response.status < 300 ? undefined : `HTTP ${response.status}`,
        });

        return new Response(response.body, {
          status: response.status,
          headers: new Headers(response.headers),
        });
      } catch (err) {
        const durationMs = Date.now() - startedAt;
        NetworkStore.update(recordId, {
          status: 'error',
          durationMs,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    },
    network: {
      getMyRequests: () => NetworkStore.getByModule(moduleId),
    },
    eventBus,
    store: guardedStore,

    registerUI(contribution: ModuleUIContribution) {
      if (PROTECTED_SLOTS.has(contribution.slot)) {
        const record = pluginRegistry.get(moduleId);
        if (record?.source === 'user') {
          LogStore._log('warn', moduleId, `registerUI: slot "${contribution.slot}" is protected, user plugins cannot register here`);
          return;
        }
      }
      if (!state.slotRegistry.has(contribution.slot)) {
        state.slotRegistry.set(contribution.slot, {
          contributions: [],
          options: { label: contribution.slot, defaultVisible: true },
        });
      }
      const entry = state.slotRegistry.get(contribution.slot)!;
      const contribType = contribution.action ? 'action' : contribution.component ? 'component' : 'unknown';
      LogStore._log('info', moduleId, `registerUI: slot="${contribution.slot}" label="${contribution.label}" type=${contribType}`);
      entry.contributions.push({
        ...contribution,
        moduleId,
        order: contribution.order ?? entry.contributions.length,
      });

      // Sync with TOOL_REGISTRY — a tool that successfully registers UI should be marked enabled
      if (isToolId(moduleId)) {
        setToolEnabled(moduleId, true);
        LogStore._log('debug', moduleId, `registerUI → setToolEnabled(true) synced to TOOL_REGISTRY`);
      }
    },

    registerCommand(id: string, handler: () => void, options?: { label?: string; category?: string }) {
      const fullId = `${moduleId}:${id}`;
      LogStore._log('info', moduleId, `registerCommand: ${fullId} (label="${options?.label ?? id}")`);
      state.commands.set(fullId, handler);
      getCommandRegistry().register({
        id: fullId,
        label: options?.label ?? id,
        category: options?.category ?? moduleId,
        handler,
      });
    },

    executeCommand(id: string) {
      const handler = state.commands.get(id);
      if (handler) {
        handler();
      } else {
        console.warn(`[Runtime] Command "${id}" not found.`);
      }
    },

    apiVersion: PLUGIN_API_VERSION,

    registerLifecycleHook(event: LifecycleEvent, hook: LifecycleHook): () => void {
      if (!state.lifecycleHooks.has(event)) {
        state.lifecycleHooks.set(event, []);
      }
      const entry: RegisteredLifecycleHook = { moduleId, event, hook };
      state.lifecycleHooks.get(event)!.push(entry);
      return () => {
        const hooks = state.lifecycleHooks.get(event);
        if (hooks) {
          const idx = hooks.indexOf(entry);
          if (idx !== -1) hooks.splice(idx, 1);
        }
      };
    },

    registerKeybinding(
      keys: string,
      commandId: string,
      options?: { label?: string; when?: string },
    ): void {
      const normalizedKeys = keys.toLowerCase();
      const fullCommandId = `${moduleId}:${commandId}`;
      const existing = state.keybindings.get(normalizedKeys);
      if (existing) {
        console.warn(
          `[Runtime] Keybinding "${keys}" already registered by "${existing.moduleId}". Overriding.`,
        );
      }
      state.keybindings.set(normalizedKeys, {
        moduleId,
        fullCommandId,
        keys: normalizedKeys,
        label: options?.label ?? commandId,
        when: options?.when,
      });
      keybindingManager.register(normalizedKeys, fullCommandId);

      const commandEntry = getCommandRegistry().get(fullCommandId);
      if (commandEntry) {
        commandEntry.keybinding = normalizedKeys;
      }
    },

    declareSlot(slotId: string, options?: SlotOptions): void {
      if (!state.slotRegistry.has(slotId)) {
        state.slotRegistry.set(slotId, {
          contributions: [],
          options: {
            label: options?.label ?? slotId,
            defaultVisible: options?.defaultVisible ?? true,
          },
        });
      } else {
        const entry = state.slotRegistry.get(slotId)!;
        if (options?.label) entry.options.label = options.label;
        if (options?.defaultVisible !== undefined) entry.options.defaultVisible = options.defaultVisible;
      }
    },

    setTimeout(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
      const id = globalThis.setTimeout(() => {
        getHandle(state, moduleId).timers.delete(id);
        fn();
      }, ms);
      getHandle(state, moduleId).timers.add(id);
      return id;
    },

    setInterval(fn: () => void, ms: number): ReturnType<typeof setInterval> {
      const id = globalThis.setInterval(() => {
        getHandle(state, moduleId).intervals.delete(id);
        fn();
      }, ms);
      getHandle(state, moduleId).intervals.add(id);
      return id;
    },

    onEvent<T>(event: string, handler: (payload: T) => void): () => void {
      const unsub = eventBus.onScoped(event, moduleId, handler as any);
      getHandle(state, moduleId).unsubscribers.add(unsub);
      return () => {
        unsub();
        getHandle(state, moduleId).unsubscribers.delete(unsub);
      };
    },

    subscribeStore(listener: () => void): () => void {
      const unsub = storeAccess.subscribe(listener);
      getHandle(state, moduleId).unsubscribers.add(unsub);
      return () => {
        unsub();
        getHandle(state, moduleId).unsubscribers.delete(unsub);
      };
    },

    registerLabels(
      labels: Array<{ name: string; value: string; displayName: string }>,
    ): void {
      labelRegistry.register(moduleId, labels);
    },

    injectCSS(id: string, css: string): void {
      const styleId = `plugin-style-${moduleId}-${id}`;
      let el = document.getElementById(styleId) as HTMLStyleElement | null;
      if (!el) {
        el = document.createElement('style');
        el.id = styleId;
        document.head.appendChild(el);
      }
      el.textContent = css;
      const handle = getHandle(state, moduleId);
      handle.cleanupFns.push(() => {
        const existing = document.getElementById(styleId);
        if (existing) existing.remove();
      });
    },

    getCoreSettings(): Record<string, unknown> {
      return useSettingsStore.getState().getAllModuleSettings('core');
    },

    setCoreSettings(key: string, value: unknown): void {
      useSettingsStore.getState().setModuleSetting('core', key, value);
    },

    getSetting(key: string): unknown {
      return storeAccess.getModuleSetting(moduleId, key);
    },

    setSetting(key: string, value: unknown): void {
      const mod = state.modules.get(moduleId);
      const schema = mod?.manifest.settingsSchema;
      if (schema) {
        const field = schema.find(f => f.key === key);
        if (!field) {
          LogStore._log('warn', moduleId, `setSetting: key "${key}" not in settingsSchema, blocked`);
          return;
        }
        switch (field.type) {
          case 'boolean':
            if (typeof value !== 'boolean') {
              LogStore._log('warn', moduleId, `setSetting: "${key}" expects boolean, got ${typeof value}`);
              return;
            }
            break;
          case 'number':
            if (typeof value !== 'number') {
              LogStore._log('warn', moduleId, `setSetting: "${key}" expects number, got ${typeof value}`);
              return;
            }
            if (field.min !== undefined && (value as number) < field.min) {
              LogStore._log('warn', moduleId, `setSetting: "${key}" value ${value} below min ${field.min}`);
              return;
            }
            if (field.max !== undefined && (value as number) > field.max) {
              LogStore._log('warn', moduleId, `setSetting: "${key}" value ${value} above max ${field.max}`);
              return;
            }
            break;
          case 'string':
            if (typeof value !== 'string') {
              LogStore._log('warn', moduleId, `setSetting: "${key}" expects string, got ${typeof value}`);
              return;
            }
            break;
          case 'select':
            if (!field.options?.includes(value as string)) {
              LogStore._log('warn', moduleId, `setSetting: "${key}" select got invalid value "${String(value)}"`);
              return;
            }
            break;
        }
      }
      useSettingsStore.getState().setModuleSetting(moduleId, key, value);
    },

    registerSearchProvider(provider: SearchProvider): void {
      regSearchProvider(provider);
      getHandle(state, moduleId).cleanupFns.push(() => {
        unregisterSearchProvider(provider.id);
      });
    },

    registerExporter(exporter: ExportFormat): void {
      regExportFormat(exporter);
      getHandle(state, moduleId).cleanupFns.push(() => {
        unregisterExportFormat(exporter.id);
      });
    },

    registerFilter(filter: FilterContribution): void {
      regFilter(moduleId, filter);
      const handle = getHandle(state, moduleId);
      handle.cleanupFns.push(() => {
        unregisterFilter(filter.id);
      });
    },
  };
}
