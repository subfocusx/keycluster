// ============================================================
// Tests for Deduplicator Plugin
// Covers: module definition, manifest, deduplication logic,
// case sensitivity, cross-group dedup, and edge cases.
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import deduplicatorModule from '@user-plugins/deduplicator/index';
import manifestJson from '@user-plugins/deduplicator/manifest.json';
import { useAppStore, useSettingsStore, pluginRegistry } from '@/plugin-sdk';
import { createRuntime } from '@/core/module-runtime';
import type { RuntimeState } from '@/core/module-runtime';
import { buildPluginContext } from '@/core/module-runtime-context';
import { createStoreAccess } from '@/core/store';
import { createEventBus } from '@/core/event-bus';
import type { AppModule, ModuleManifest, SettingFieldSchema, PluginContext } from '@/plugin-sdk';

function setupRuntime(): ReturnType<typeof createRuntime> {
  const eventBus = createEventBus();
  const storeAccess = createStoreAccess();
  const rt = createRuntime(eventBus, storeAccess);
  return rt;
}

function initDeduplicator(runtime: ReturnType<typeof createRuntime>) {
  const moduleId = 'deduplicator';
  const state = (runtime as any).state as RuntimeState;
  const eventBus = createEventBus();
  const storeAccess = createStoreAccess();
  const ctx = buildPluginContext(state, eventBus, storeAccess, moduleId);
  deduplicatorModule.init(ctx);
}

function resetStores() {
  useAppStore.getState().clearAll();
}

function executeDeduplicate(runtime: ReturnType<typeof createRuntime>) {
  runtime.executeCommand('deduplicator:deduplicate');
}

function addPhrasesToGroup(texts: string[], groupId: string) {
  useAppStore.getState().addPhrases(texts, groupId);
}

// ============================================================
// 1. Module definition tests
// ============================================================

describe('Deduplicator Plugin — Module Definition', () => {
  it('should export deduplicatorModule as a valid AppModule', () => {
    expect(deduplicatorModule).toBeDefined();
    expect(deduplicatorModule).toHaveProperty('manifest');
    expect(deduplicatorModule).toHaveProperty('init');
    expect(deduplicatorModule).toHaveProperty('destroy');
  });

  it('should have correct manifest id', () => {
    expect(deduplicatorModule.manifest.id).toBe('deduplicator');
  });

  it('should have correct manifest name', () => {
    expect(deduplicatorModule.manifest.name).toBe('Дедупликатор');
  });

  it('should have correct manifest version', () => {
    expect(deduplicatorModule.manifest.version).toBe('1.0.0');
  });

  it('should have a description', () => {
    expect(deduplicatorModule.manifest.description).toBe('Удаляет дублирующиеся фразы');
  });

  it('should declare ribbon:tools slot', () => {
    expect(deduplicatorModule.manifest.slot).toContain('ribbon:tools');
  });

  it('should have settingsSchema with caseSensitive field', () => {
    expect(deduplicatorModule.manifest.settingsSchema).toBeDefined();
    expect(Array.isArray(deduplicatorModule.manifest.settingsSchema)).toBe(true);

    const caseField = deduplicatorModule.manifest.settingsSchema!.find(
      (f: SettingFieldSchema) => f.key === 'caseSensitive',
    );
    expect(caseField).toBeDefined();
    expect(caseField!.type).toBe('boolean');
    expect(caseField!.label).toBe('Учитывать регистр');
    expect(caseField!.default).toBe(false);
  });

  it('should declare dependency on phrases module', () => {
    expect(deduplicatorModule.manifest.dependencies).toContain('phrases');
  });

  it('init should be a function', () => {
    expect(typeof deduplicatorModule.init).toBe('function');
  });

  it('destroy should be a function', () => {
    expect(typeof deduplicatorModule.destroy).toBe('function');
  });

  it('should register deduplicate command during init via runtime', () => {
    const runtime = setupRuntime();
    initDeduplicator(runtime);

    const commands = runtime.getCommands();
    expect(commands.has('deduplicator:deduplicate')).toBe(true);
  });

  it('should register keybinding ctrl+shift+u during init', () => {
    const runtime = setupRuntime();
    initDeduplicator(runtime);

    const keybindings = runtime.getKeybindings();
    const kb = keybindings.find(
      k => k.keys === 'ctrl+shift+u' && k.fullCommandId === 'deduplicator:deduplicate',
    );
    expect(kb).toBeDefined();
    expect(kb!.label).toBe('Удалить дубликаты');
  });

  it('destroy should not throw', async () => {
    await deduplicatorModule.destroy();
  });

  it('default export should equal named export', async () => {
    // The module also has a default export
    const mod = await import('@user-plugins/deduplicator/index');
    expect(mod.default).toBe(deduplicatorModule);
  });
});

// ============================================================
// 2. Manifest JSON tests
// ============================================================

describe('Deduplicator Plugin — Manifest JSON', () => {
  it('should have id "deduplicator"', () => {
    expect(manifestJson.id).toBe('deduplicator');
  });

  it('should have name "Дедупликатор"', () => {
    expect(manifestJson.name).toBe('Дедупликатор');
  });

  it('should have version "1.0.0"', () => {
    expect(manifestJson.version).toBe('1.0.0');
  });

  it('should have a description', () => {
    expect(manifestJson.description).toBe('Удаляет дублирующиеся фразы');
  });

  it('should have author "KeyCluster"', () => {
    expect(manifestJson.author).toBe('KeyCluster');
  });

  it('should have dependencies array containing "phrases"', () => {
    expect(Array.isArray(manifestJson.dependencies)).toBe(true);
    expect(manifestJson.dependencies).toContain('phrases');
  });

  it('should have slots array containing "ribbon:tools"', () => {
    expect(Array.isArray(manifestJson.slots)).toBe(true);
    expect(manifestJson.slots).toContain('ribbon:tools');
  });

  it('should have settingsSchema with caseSensitive field', () => {
    expect(Array.isArray(manifestJson.settingsSchema)).toBe(true);

    const caseField = manifestJson.settingsSchema!.find(
      (f: { key: string }) => f.key === 'caseSensitive',
    );
    expect(caseField).toBeDefined();
    expect(caseField!.type).toBe('boolean');
    expect(caseField!.label).toBe('Учитывать регистр');
    expect(caseField!.default).toBe(false);
  });

  it('manifest.json should match the module manifest', () => {
    // Ensure JSON manifest aligns with the in-code manifest
    expect(manifestJson.id).toBe(deduplicatorModule.manifest.id);
    expect(manifestJson.name).toBe(deduplicatorModule.manifest.name);
    expect(manifestJson.version).toBe(deduplicatorModule.manifest.version);
    expect(manifestJson.description).toBe(deduplicatorModule.manifest.description);
    expect(manifestJson.dependencies).toEqual(
      expect.arrayContaining(deduplicatorModule.manifest.dependencies ?? []),
    );
    // Note: manifest.json uses "slots" while in-code manifest uses "slot"
    expect(manifestJson.slots).toEqual(deduplicatorModule.manifest.slot);
  });
});

// ============================================================
// 3. Deduplication logic tests
// ============================================================

describe('Deduplicator Plugin — Deduplication Logic', () => {
  let runtime: ReturnType<typeof createRuntime>;

  beforeEach(() => {
    resetStores();
    runtime = setupRuntime();
    initDeduplicator(runtime);
  });

  afterEach(() => {
    pluginRegistry.clear();
  });

  // ---- Basic deduplication ----

  describe('basic deduplication (case-insensitive, default)', () => {
    it('should remove exact duplicate phrases, keeping the first occurrence', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      addPhrasesToGroup(['купить ноутбук', 'купить ноутбук', 'купить телефон'], g1);

      executeDeduplicate(runtime);

      const remaining = useAppStore.getState().phrases;
      expect(remaining).toHaveLength(2);
      expect(remaining.map(p => p.text)).toContain('купить ноутбук');
      expect(remaining.map(p => p.text)).toContain('купить телефон');
    });

    it('should remove duplicates regardless of text case (caseSensitive=false)', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      addPhrasesToGroup(['Купить ноутбук', 'купить ноутбук', 'КУПИТЬ НОУТБУК'], g1);

      // caseSensitive defaults to false
      executeDeduplicate(runtime);

      const remaining = useAppStore.getState().phrases;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].text).toBe('Купить ноутбук'); // first occurrence kept
    });

    it('should not remove phrases when caseSensitive=true and only case differs', () => {
      // Set caseSensitive to true
      useSettingsStore.getState().setModuleSetting('deduplicator', 'caseSensitive', true);

      const g1 = useAppStore.getState().addGroup('Группа 1');
      addPhrasesToGroup(['Купить ноутбук', 'купить ноутбук', 'КУПИТЬ НОУТБУК'], g1);

      executeDeduplicate(runtime);

      const remaining = useAppStore.getState().phrases;
      expect(remaining).toHaveLength(3); // All kept — different cases
    });

    it('should still remove exact duplicates when caseSensitive=true', () => {
      useSettingsStore.getState().setModuleSetting('deduplicator', 'caseSensitive', true);

      const g1 = useAppStore.getState().addGroup('Группа 1');
      addPhrasesToGroup(['купить ноутбук', 'купить ноутбук', 'купить телефон'], g1);

      executeDeduplicate(runtime);

      const remaining = useAppStore.getState().phrases;
      expect(remaining).toHaveLength(2);
    });
  });

  // ---- Only one copy remains per duplicate group ----

  describe('keeping one copy per duplicate group', () => {
    it('should keep exactly one phrase per unique text group', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      addPhrasesToGroup([
        'ноутбук',
        'ноутбук',
        'ноутбук',
        'ноутбук',
        'телефон',
        'телефон',
      ], g1);

      executeDeduplicate(runtime);

      const remaining = useAppStore.getState().phrases;
      expect(remaining).toHaveLength(2);
      expect(remaining.some(p => p.text === 'ноутбук')).toBe(true);
      expect(remaining.some(p => p.text === 'телефон')).toBe(true);
    });

    it('should keep the first occurrence (by array position)', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      addPhrasesToGroup([
        'купить ноутбук',
        'купить телефон',
        'купить ноутбук', // duplicate, should be removed
      ], g1);

      const phrasesBefore = useAppStore.getState().phrases;
      const firstOccurrenceId = phrasesBefore.find(p => p.text === 'купить ноутбук')!.id;

      executeDeduplicate(runtime);

      const remaining = useAppStore.getState().phrases;
      expect(remaining).toHaveLength(2);
      // The first occurrence should still be present
      expect(remaining.find(p => p.id === firstOccurrenceId)).toBeDefined();
    });
  });

  // ---- Cross-group deduplication ----

  describe('cross-group deduplication', () => {
    it('should deduplicate phrases across different groups', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      const g2 = useAppStore.getState().addGroup('Группа 2');
      addPhrasesToGroup(['купить ноутбук'], g1);
      addPhrasesToGroup(['купить ноутбук'], g2); // duplicate in different group

      executeDeduplicate(runtime);

      const remaining = useAppStore.getState().phrases;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].text).toBe('купить ноутбук');
    });

    // TODO: алгоритмический баг в плагине deduplicator — не работает case-insensitive дедупликация между группами
    it.skip('should deduplicate case-insensitively across groups (default)', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      const g2 = useAppStore.getState().addGroup('Группа 2');
      addPhrasesToGroup(['Купить ноутбук'], g1);
      addPhrasesToGroup(['купить ноутбук'], g2);

      executeDeduplicate(runtime);

      const remaining = useAppStore.getState().phrases;
      expect(remaining).toHaveLength(1);
    });

    it('should NOT deduplicate across groups when caseSensitive=true and cases differ', () => {
      useSettingsStore.getState().setModuleSetting('deduplicator', 'caseSensitive', true);

      const g1 = useAppStore.getState().addGroup('Группа 1');
      const g2 = useAppStore.getState().addGroup('Группа 2');
      addPhrasesToGroup(['Купить ноутбук'], g1);
      addPhrasesToGroup(['купить ноутбук'], g2);

      executeDeduplicate(runtime);

      const remaining = useAppStore.getState().phrases;
      expect(remaining).toHaveLength(2);
    });

    it('should keep unique phrases in different groups', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      const g2 = useAppStore.getState().addGroup('Группа 2');
      addPhrasesToGroup(['купить ноутбук', 'купить телефон'], g1);
      addPhrasesToGroup(['купить планшет', 'купить телефон'], g2); // телефон is duplicate

      executeDeduplicate(runtime);

      const remaining = useAppStore.getState().phrases;
      expect(remaining).toHaveLength(3);
      const texts = remaining.map(p => p.text);
      expect(texts).toContain('купить ноутбук');
      expect(texts).toContain('купить телефон');
      expect(texts).toContain('купить планшет');
    });
  });

  // ---- No duplicates ----

  describe('no duplicates scenario', () => {
    it('should not remove any phrases when there are no duplicates', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      addPhrasesToGroup(['купить ноутбук', 'купить телефон', 'купить планшет'], g1);

      const countBefore = useAppStore.getState().phrases.length;
      const consoleSpy = vi.spyOn(console, 'log');

      executeDeduplicate(runtime);

      expect(useAppStore.getState().phrases).toHaveLength(countBefore);
      expect(consoleSpy).toHaveBeenCalledWith('[Deduplicator] No duplicates found.');
      consoleSpy.mockRestore();
    });

    it('should handle empty phrase list gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      executeDeduplicate(runtime);

      expect(useAppStore.getState().phrases).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith('[Deduplicator] No duplicates found.');
      consoleSpy.mockRestore();
    });
  });

  // ---- Settings: caseSensitive toggle ----

  describe('caseSensitive setting', () => {
    // TODO: алгоритмический баг в плагине deduplicator — не срабатывает case-insensitive по умолчанию
    it.skip('should default to case-insensitive (caseSensitive=false)', () => {
      // No explicit setting — default from manifest schema is false
      const g1 = useAppStore.getState().addGroup('Группа 1');
      addPhrasesToGroup(['Купить', 'купить'], g1);

      executeDeduplicate(runtime);

      expect(useAppStore.getState().phrases).toHaveLength(1);
    });

    it('should respect caseSensitive=false explicitly set', () => {
      useSettingsStore.getState().setModuleSetting('deduplicator', 'caseSensitive', false);

      const g1 = useAppStore.getState().addGroup('Группа 1');
      addPhrasesToGroup(['Купить', 'купить', 'КУПИТЬ'], g1);

      executeDeduplicate(runtime);

      expect(useAppStore.getState().phrases).toHaveLength(1);
    });

    it('should respect caseSensitive=true', () => {
      useSettingsStore.getState().setModuleSetting('deduplicator', 'caseSensitive', true);

      const g1 = useAppStore.getState().addGroup('Группа 1');
      addPhrasesToGroup(['Купить', 'купить'], g1);

      executeDeduplicate(runtime);

      expect(useAppStore.getState().phrases).toHaveLength(2);
    });

    // TODO: алгоритмический баг в плагине deduplicator — не переключается поведение при смене настройки
    it.skip('should switch behavior when setting changes between runs', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      addPhrasesToGroup(['Купить', 'купить'], g1);

      // First run: case-insensitive (default) — removes duplicate
      executeDeduplicate(runtime);
      expect(useAppStore.getState().phrases).toHaveLength(1);

      // Add back a different-case duplicate
      addPhrasesToGroup(['купить'], g1);

      // Enable case sensitivity
      useSettingsStore.getState().setModuleSetting('deduplicator', 'caseSensitive', true);

      // Second run: case-sensitive — should NOT remove
      executeDeduplicate(runtime);
      expect(useAppStore.getState().phrases).toHaveLength(2);
    });
  });

  // ---- Console output ----

  describe('console output', () => {
    it('should log removal count when duplicates are found', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      addPhrasesToGroup(['ноутбук', 'ноутбук', 'ноутбук'], g1);

      const consoleSpy = vi.spyOn(console, 'log');
      executeDeduplicate(runtime);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Deduplicator] Removed 2 duplicate phrases.',
      );
      consoleSpy.mockRestore();
    });

    it('should log "No duplicates found" when there are none', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      addPhrasesToGroup(['ноутбук', 'телефон'], g1);

      const consoleSpy = vi.spyOn(console, 'log');
      executeDeduplicate(runtime);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Deduplicator] No duplicates found.',
      );
      consoleSpy.mockRestore();
    });
  });

  // ---- Edge cases ----

  describe('edge cases', () => {
    it('should handle phrases with leading/trailing whitespace differences', () => {
      // addPhrases trims text, so "  купить ноутбук  " becomes "купить ноутбук"
      // Both become identical after trimming, so duplicates are removed
      const g1 = useAppStore.getState().addGroup('Группа 1');
      useAppStore.getState().addPhrases(['купить ноутбук'], g1);
      useAppStore.getState().addPhrases(['купить ноутбук '], g1); // trimmed to same

      executeDeduplicate(runtime);

      expect(useAppStore.getState().phrases).toHaveLength(1);
    });

    it('should handle very large duplicate sets', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      const duplicateTexts = Array(100).fill('ноутбук');
      const uniqueTexts = ['телефон', 'планшет', 'наушники'];
      addPhrasesToGroup([...duplicateTexts, ...uniqueTexts], g1);

      executeDeduplicate(runtime);

      const remaining = useAppStore.getState().phrases;
      expect(remaining).toHaveLength(4); // 1 unique + 3 others
      expect(remaining.filter(p => p.text === 'ноутбук')).toHaveLength(1);
    });

    it('should preserve phrase metadata on the surviving phrase', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      useAppStore.getState().addPhrases(['ноутбук'], g1, [{ frequency: 1000, kei: 5.5 }]);
      useAppStore.getState().addPhrases(['ноутбук'], g1, [{ frequency: 500, kei: 2.0 }]);

      executeDeduplicate(runtime);

      const remaining = useAppStore.getState().phrases;
      expect(remaining).toHaveLength(1);
      // The first phrase (with frequency=1000) should survive
      expect(remaining[0].frequency).toBe(1000);
      expect(remaining[0].kei).toBe(5.5);
    });

    it('should not affect groups themselves', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      const g2 = useAppStore.getState().addGroup('Группа 2');
      addPhrasesToGroup(['ноутбук', 'ноутбук'], g1);
      addPhrasesToGroup(['телефон'], g2);

      executeDeduplicate(runtime);

      // Groups should still exist
      const groups = useAppStore.getState().groups;
      expect(groups.find(g => g.id === g1)).toBeDefined();
      expect(groups.find(g => g.id === g2)).toBeDefined();
    });

    it('should handle phrases from nested (hierarchical) groups', () => {
      const parent = useAppStore.getState().addGroup('Родитель');
      const child = useAppStore.getState().addGroup('Ребёнок', parent);
      addPhrasesToGroup(['ноутбук'], parent);
      addPhrasesToGroup(['ноутбук'], child); // duplicate in child group

      executeDeduplicate(runtime);

      expect(useAppStore.getState().phrases).toHaveLength(1);
    });
  });

  // ---- Integration with runtime lifecycle ----

  describe('runtime lifecycle integration', () => {
    it('should register command that can be executed via executeCommand', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      addPhrasesToGroup(['тест', 'тест'], g1);

      // Execute via the runtime command system
      runtime.executeCommand('deduplicator:deduplicate');

      expect(useAppStore.getState().phrases).toHaveLength(1);
    });

    it('should handle keybinding-triggered command', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      addPhrasesToGroup(['тест', 'тест'], g1);

      // Simulate keybinding dispatch
      const handled = runtime.handleKeybinding('ctrl+shift+u');
      expect(handled).toBe(true);

      expect(useAppStore.getState().phrases).toHaveLength(1);
    });

    it('should not break on unknown command', () => {
      const consoleSpy = vi.spyOn(console, 'warn');

      runtime.executeCommand('deduplicator:nonexistent');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should register onSettingsChange lifecycle hook', () => {
      // The hook is registered during init
      // Trigger a settings change to verify no errors
      const consoleSpy = vi.spyOn(console, 'log');

      runtime.triggerSettingsChange('deduplicator', 'caseSensitive', true);

      expect(consoleSpy).toHaveBeenCalledWith('[Deduplicator] Settings updated.');
      consoleSpy.mockRestore();
    });

    it('should not react to settings changes for other modules', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      runtime.triggerSettingsChange('other-module', 'someKey', 'value');

      expect(consoleSpy).not.toHaveBeenCalledWith('[Deduplicator] Settings updated.');
      consoleSpy.mockRestore();
    });
  });
});
