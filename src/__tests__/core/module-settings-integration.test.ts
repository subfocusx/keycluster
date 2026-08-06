// ============================================================
// Tests: Module settings integration — read settings + onSettingsChange hooks
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PluginContext } from '@/plugin-sdk';
import { createStoreAccess } from '@/core/store';
import { createEventBus } from '@/core/event-bus';
import { useSettingsStore } from '@/core/settings-store';
import { groupsModule } from '@/modules/groups/index';
import { groupsSettings } from '@/modules/groups/index';
import clusteringModule from '@user-plugins/clustering/index';
import { getClusteringSettings } from '@user-plugins/clustering/index';
import minusWordsModule from '@user-plugins/minus-words/index';
import { minusWordsSettings } from '@user-plugins/minus-words/index';
import findReplaceModule from '@user-plugins/find-replace/index';
import { findReplaceSettings } from '@user-plugins/find-replace/index';
import importExportModule from '@user-plugins/import-export/index';
import { importExportSettings } from '@user-plugins/import-export/index';
import crossSearchModule from '@user-plugins/cross-search/index';
import { crossSearchSettings } from '@user-plugins/cross-search/index';

function createPluginContext(moduleId?: string): PluginContext {
  const eventBus = createEventBus();
  const store = createStoreAccess();
  const lifecycleHooks: Map<string, ((payload?: Record<string, unknown>) => void)[]> = new Map();

  return {
    eventBus,
    store,
    registerUI: vi.fn(),
    registerCommand: vi.fn(),
    getSetting: vi.fn((key: string) => {
      if (moduleId) {
        return useSettingsStore.getState().getModuleSetting(moduleId, key);
      }
      return undefined;
    }),
    setSetting: vi.fn(),
    apiVersion: '1.0',
    registerLifecycleHook: vi.fn((event, hook) => {
      if (!lifecycleHooks.has(event)) lifecycleHooks.set(event, []);
      lifecycleHooks.get(event)!.push(hook);
      return () => {
        const hooks = lifecycleHooks.get(event);
        if (hooks) {
          const idx = hooks.indexOf(hook);
          if (idx !== -1) hooks.splice(idx, 1);
        }
      };
    }),
    registerKeybinding: vi.fn(),
    declareSlot: vi.fn(),
    // Test helper to trigger lifecycle hooks
    _triggerHook: (event: string, payload?: Record<string, unknown>) => {
      const hooks = lifecycleHooks.get(event) ?? [];
      for (const hook of hooks) hook(payload);
    },
  } as any;
}

describe('Module settings integration', () => {
  beforeEach(() => {
    // Reset settings store
    useSettingsStore.getState().resetModuleSettings('groups');
    useSettingsStore.getState().resetModuleSettings('clustering', clusteringModule.manifest.settingsSchema);
    useSettingsStore.getState().resetModuleSettings('minus-words');
    useSettingsStore.getState().resetModuleSettings('find-replace');
    useSettingsStore.getState().resetModuleSettings('import-export');
    useSettingsStore.getState().resetModuleSettings('cross-search');
  });

  it('groups module reads defaultExpanded from settings', () => {
    const ctx = createPluginContext('groups');
    groupsModule.init(ctx);

    // Should read default value
    expect(groupsSettings.defaultExpanded).toBe(true);
  });

  it('groups module reacts to onSettingsChange', () => {
    const ctx = createPluginContext('groups');
    groupsModule.init(ctx);

    // Change the setting
    useSettingsStore.getState().setModuleSetting('groups', 'defaultExpanded', false);

    // Trigger the hook
    (ctx as any)._triggerHook('onSettingsChange', { moduleId: 'groups', key: 'defaultExpanded', value: false });

    expect(groupsSettings.defaultExpanded).toBe(false);
  });

  it('clustering module reads threshold and minClusterSize from settings', () => {
    const ctx = createPluginContext('clustering');
    useSettingsStore.getState().setModuleSetting('clustering', 'threshold', 0.5);
    useSettingsStore.getState().setModuleSetting('clustering', 'minClusterSize', 5);

    clusteringModule.init(ctx);

    expect(getClusteringSettings().threshold).toBe(0.5);
    expect(getClusteringSettings().minClusterSize).toBe(5);
  });

  it('clustering module reacts to onSettingsChange', () => {
    const ctx = createPluginContext('clustering');
    clusteringModule.init(ctx);

    useSettingsStore.getState().setModuleSetting('clustering', 'threshold', 0.7);
    (ctx as any)._triggerHook('onSettingsChange', { moduleId: 'clustering', key: 'threshold', value: 0.7 });

    expect(getClusteringSettings().threshold).toBe(0.7);
  });

  it('minus-words module reads broadMatch setting', () => {
    const ctx = createPluginContext('minus-words');
    minusWordsModule.init(ctx);
    expect(minusWordsSettings.broadMatch).toBe(false);
  });

  it('minus-words module reacts to onSettingsChange for broadMatch', () => {
    const ctx = createPluginContext('minus-words');
    minusWordsModule.init(ctx);

    useSettingsStore.getState().setModuleSetting('minus-words', 'broadMatch', true);
    (ctx as any)._triggerHook('onSettingsChange', { moduleId: 'minus-words', key: 'broadMatch', value: true });

    expect(minusWordsSettings.broadMatch).toBe(true);
  });

  it('find-replace module reads caseSensitive and useRegex settings', () => {
    const ctx = createPluginContext('find-replace');
    findReplaceModule.init(ctx);
    expect(findReplaceSettings.caseSensitive).toBe(false);
    expect(findReplaceSettings.useRegex).toBe(false);
  });

  it('find-replace module reacts to onSettingsChange', () => {
    const ctx = createPluginContext('find-replace');
    findReplaceModule.init(ctx);

    useSettingsStore.getState().setModuleSetting('find-replace', 'caseSensitive', true);
    useSettingsStore.getState().setModuleSetting('find-replace', 'useRegex', true);
    (ctx as any)._triggerHook('onSettingsChange', { moduleId: 'find-replace', key: 'caseSensitive', value: true });

    expect(findReplaceSettings.caseSensitive).toBe(true);
    expect(findReplaceSettings.useRegex).toBe(true);
  });

  it('import-export module reads defaultFormat setting', () => {
    const ctx = createPluginContext('import-export');
    importExportModule.init(ctx);
    expect(importExportSettings.defaultFormat).toBe('csv');
  });

  it('import-export module reacts to onSettingsChange for defaultFormat', () => {
    const ctx = createPluginContext('import-export');
    importExportModule.init(ctx);

    useSettingsStore.getState().setModuleSetting('import-export', 'defaultFormat', 'xlsx');
    (ctx as any)._triggerHook('onSettingsChange', { moduleId: 'import-export', key: 'defaultFormat', value: 'xlsx' });

    expect(importExportSettings.defaultFormat).toBe('xlsx');
  });

  it('cross-search module reads minGroups setting', () => {
    const ctx = createPluginContext('cross-search');
    crossSearchModule.init(ctx);
    expect(crossSearchSettings.minGroups).toBe(2);
  });

  it('cross-search module reacts to onSettingsChange', () => {
    const ctx = createPluginContext('cross-search');
    crossSearchModule.init(ctx);

    useSettingsStore.getState().setModuleSetting('cross-search', 'minGroups', 3);
    (ctx as any)._triggerHook('onSettingsChange', { moduleId: 'cross-search', key: 'minGroups', value: 3 });

    expect(crossSearchSettings.minGroups).toBe(3);
  });

  it('modules only react to their own moduleId in onSettingsChange', () => {
    const ctx1 = createPluginContext('groups');
    groupsModule.init(ctx1);

    const ctx2 = createPluginContext('clustering');
    clusteringModule.init(ctx2);

    // Trigger onSettingsChange for clustering — groups should NOT react
    (ctx1 as any)._triggerHook('onSettingsChange', { moduleId: 'clustering', key: 'threshold', value: 0.9 });

    expect(groupsSettings.defaultExpanded).toBe(true); // unchanged
  });

  it('StoreAccess.getModuleSetting returns values from settings store', () => {
    const store = createStoreAccess();
    useSettingsStore.getState().setModuleSetting('groups', 'defaultExpanded', false);

    const value = store.getModuleSetting('groups', 'defaultExpanded');
    expect(value).toBe(false);
  });

  it('StoreAccess.getModuleSetting returns undefined for unknown keys', () => {
    const store = createStoreAccess();
    const value = store.getModuleSetting('nonexistent', 'unknown');
    expect(value).toBeUndefined();
  });
});
