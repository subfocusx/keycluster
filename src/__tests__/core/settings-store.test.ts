// ============================================================
// Settings Store Tests
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from '@/plugin-sdk';
import type { SettingFieldSchema } from '@/core/types';

describe('SettingsStore', () => {
  beforeEach(() => {
    // Reset store state
    useSettingsStore.setState({ settings: {} });
  });

  // ---- getModuleSetting ----

  it('should return undefined for non-existent setting', () => {
    const value = useSettingsStore.getState().getModuleSetting('noModule', 'noKey');
    expect(value).toBeUndefined();
  });

  it('should return value after setModuleSetting', () => {
    const store = useSettingsStore.getState();
    store.setModuleSetting('clustering', 'threshold', 0.5);

    const value = useSettingsStore.getState().getModuleSetting('clustering', 'threshold');
    expect(value).toBe(0.5);
  });

  // ---- setModuleSetting ----

  it('should set a boolean setting', () => {
    useSettingsStore.getState().setModuleSetting('groups', 'autoExpand', true);
    expect(useSettingsStore.getState().getModuleSetting('groups', 'autoExpand')).toBe(true);
  });

  it('should set a string setting', () => {
    useSettingsStore.getState().setModuleSetting('import-export', 'defaultFormat', 'xlsx');
    expect(useSettingsStore.getState().getModuleSetting('import-export', 'defaultFormat')).toBe('xlsx');
  });

  it('should set a number setting', () => {
    useSettingsStore.getState().setModuleSetting('clustering', 'minGroupSize', 3);
    expect(useSettingsStore.getState().getModuleSetting('clustering', 'minGroupSize')).toBe(3);
  });

  it('should set a select setting', () => {
    useSettingsStore.getState().setModuleSetting('cross-search', 'matchType', 'broad');
    expect(useSettingsStore.getState().getModuleSetting('cross-search', 'matchType')).toBe('broad');
  });

  it('should overwrite existing setting', () => {
    useSettingsStore.getState().setModuleSetting('clustering', 'threshold', 0.5);
    useSettingsStore.getState().setModuleSetting('clustering', 'threshold', 0.8);

    expect(useSettingsStore.getState().getModuleSetting('clustering', 'threshold')).toBe(0.8);
  });

  it('should handle multiple modules independently', () => {
    useSettingsStore.getState().setModuleSetting('mod1', 'key', 'val1');
    useSettingsStore.getState().setModuleSetting('mod2', 'key', 'val2');

    expect(useSettingsStore.getState().getModuleSetting('mod1', 'key')).toBe('val1');
    expect(useSettingsStore.getState().getModuleSetting('mod2', 'key')).toBe('val2');
  });

  // ---- getAllModuleSettings ----

  it('should return all settings for a module', () => {
    useSettingsStore.getState().setModuleSetting('clustering', 'threshold', 0.5);
    useSettingsStore.getState().setModuleSetting('clustering', 'method', 'jaccard');

    const all = useSettingsStore.getState().getAllModuleSettings('clustering');
    expect(all).toEqual({ threshold: 0.5, method: 'jaccard' });
  });

  it('should return empty object for module with no settings', () => {
    const all = useSettingsStore.getState().getAllModuleSettings('noModule');
    expect(all).toEqual({});
  });

  // ---- resetModuleSettings ----

  it('should reset module settings to defaults from schema', () => {
    useSettingsStore.getState().setModuleSetting('clustering', 'threshold', 0.9);
    useSettingsStore.getState().setModuleSetting('clustering', 'method', 'words');

    const schema: SettingFieldSchema[] = [
      { key: 'threshold', type: 'number', label: 'Threshold', default: 0.5 },
      { key: 'method', type: 'select', label: 'Method', default: 'jaccard', options: ['jaccard', 'words'] },
    ];

    useSettingsStore.getState().resetModuleSettings('clustering', schema);

    expect(useSettingsStore.getState().getModuleSetting('clustering', 'threshold')).toBe(0.5);
    expect(useSettingsStore.getState().getModuleSetting('clustering', 'method')).toBe('jaccard');
  });

  it('should reset to empty object when no schema provided', () => {
    useSettingsStore.getState().setModuleSetting('clustering', 'threshold', 0.9);
    useSettingsStore.getState().resetModuleSettings('clustering');

    const all = useSettingsStore.getState().getAllModuleSettings('clustering');
    expect(all).toEqual({});
  });

  // ---- SettingFieldSchema type ----

  it('should handle complete SettingFieldSchema', () => {
    const schema: SettingFieldSchema[] = [
      { key: 'enabled', type: 'boolean', label: 'Enabled', default: true },
      { key: 'name', type: 'string', label: 'Name', default: 'test' },
      { key: 'count', type: 'number', label: 'Count', default: 10 },
      { key: 'mode', type: 'select', label: 'Mode', default: 'auto', options: ['auto', 'manual'] },
    ];

    useSettingsStore.getState().resetModuleSettings('test-mod', schema);

    expect(useSettingsStore.getState().getModuleSetting('test-mod', 'enabled')).toBe(true);
    expect(useSettingsStore.getState().getModuleSetting('test-mod', 'name')).toBe('test');
    expect(useSettingsStore.getState().getModuleSetting('test-mod', 'count')).toBe(10);
    expect(useSettingsStore.getState().getModuleSetting('test-mod', 'mode')).toBe('auto');
  });
});
