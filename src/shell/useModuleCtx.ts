import React from 'react';
import { useAppStore, getEventBus, getRuntime, useSettingsStore } from '@/plugin-sdk';
import type { PluginContext, StoreAccess, EventBus, EventHandler } from '@/plugin-sdk';

export function useModuleCtx(): PluginContext {
const storeAccess: StoreAccess = React.useMemo(() => ({
  dispatch: (action: string, payload: any) => {
    const store = useAppStore.getState();
    switch (action) {
      case 'addGroup':
        store.addGroup(payload.name, payload.parentId); break;
        case 'deleteGroup': store.deleteGroup(payload); break;
        case 'addPhrases': store.addPhrases(payload.texts, payload.groupId, payload.extra); break;
        case 'deletePhrases': store.deletePhrases(payload); break;
        case 'moveToTrash': store.moveToTrash(payload); break;
        case 'restoreFromTrash': store.restoreFromTrash(payload); break;
        case 'clearTrash': store.clearTrash(); break;
        case 'movePhrases': store.movePhrases(payload.ids, payload.targetGroupId); break;
        case 'copyPhrases': store.copyPhrases(payload.ids, payload.targetGroupId); break;
        case 'setActiveGroup': store.setActiveGroup(payload); break;
        case 'clearAll': store.clearAll(); break;
      }
    },
    getState: () => useAppStore.getState(),
    getStateSlice: <K extends keyof import('@/core/types').AppState>(key: K): import('@/core/types').AppState[K] => {
      const state = useAppStore.getState();
      return state[key as keyof typeof state] as import('@/core/types').AppState[K];
    },
    subscribe: (listener: () => void) => useAppStore.subscribe(listener),
    getModuleSetting: (moduleId: string, key: string) => {
      try {
        const value = useSettingsStore.getState().getModuleSetting(moduleId, key);
        if (value !== undefined) return value;
      } catch { /* settings store may not be available */ }
      try {
        const rt = getRuntime();
        if (rt) {
          const mod = rt.getModule(moduleId);
          const field = mod?.manifest.settingsSchema?.find((f: { key: string }) => f.key === key);
          if (field) return (field as { default: unknown }).default;
        }
      } catch { /* runtime may not be available */ }
      return undefined;
    },
  }), []);

  const eventBus: EventBus = React.useMemo(() => {
    const bus = getEventBus();
    return {
      on: (event: string, handler: EventHandler) => bus.on(event, handler),
      off: (event: string, handler: EventHandler) => bus.off(event, handler),
      emit: (event: string, payload?: any) => bus.emit(event, payload),
      once: (event: string, handler: EventHandler) => bus.once(event, handler),
      clear: () => bus.clear(),
      onScoped: (event: string, scope: string, handler: EventHandler) => bus.onScoped(event, scope, handler),
      offAll: (scopeId?: string) => bus.offAll(scopeId),
    };
  }, []);

  return React.useMemo(() => ({
    eventBus,
    store: storeAccess,
    registerUI: () => {},
    registerCommand: () => {},
  } as unknown as PluginContext), [storeAccess, eventBus]);
}
