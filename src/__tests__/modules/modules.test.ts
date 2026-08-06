// ============================================================
// Tests: modules — module manifest validation & init/destroy
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import clusteringModule from '@user-plugins/clustering/index';
import importExportModule from '@user-plugins/import-export/index';
import findReplaceModule from '@user-plugins/find-replace/index';
import crossSearchModule from '@user-plugins/cross-search/index';
import minusWordsModule from '@user-plugins/minus-words/index';
import { groupsModule } from '@/modules/groups/index';
import { phrasesModule } from '@/modules/phrases/index';
import type { AppModule } from '@/core/types';
import type { PluginContext } from '@/core/plugin-api';
import { createStoreAccess } from '@/core/store';

function createMockContext() {
  const methods: Record<string, ReturnType<typeof vi.fn>> = {
    registerUI: vi.fn(),
    registerCommand: vi.fn(),
    registerKeybinding: vi.fn(),
    registerLifecycleHook: vi.fn(),
    getSetting: vi.fn(),
    getModuleId: vi.fn(),
  };
  return {
    ...methods,
    registerSlot: vi.fn(),
    getContributions: vi.fn(),
  } as unknown as PluginContext;
}

describe('App Module', () => {

  const modules: AppModule[] = [
    groupsModule,
    phrasesModule,
    clusteringModule,
    importExportModule,
    findReplaceModule,
    crossSearchModule,
    minusWordsModule,
  ];

  it('all modules have valid manifests', () => {
    for (const mod of modules) {
      expect(mod.manifest.id).toBeTypeOf('string');
      expect(mod.manifest.id.length).toBeGreaterThan(0);
      expect(mod.manifest.name).toBeTypeOf('string');
      expect(mod.manifest.version).toBeTypeOf('string');
      expect(mod.manifest.description).toBeTypeOf('string');
      expect(mod.manifest.slot).toBeInstanceOf(Array);
      expect(mod.manifest.slot.length).toBeGreaterThan(0);
    }
  });

  it('all module ids are unique', () => {
    const ids = modules.map(m => m.manifest.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all modules have init and destroy methods', () => {
    for (const mod of modules) {
      expect(mod.init).toBeTypeOf('function');
      expect(mod.destroy).toBeTypeOf('function');
    }
  });
});

describe('Module Init/Destroy', () => {

  it('groups module should register UI contributions on init', () => {
    const ctx = createMockContext();
    groupsModule.init(ctx);
    expect(ctx.registerUI).toHaveBeenCalledTimes(1); // ribbon:file
  });

  it('phrases module should register UI contributions on init', () => {
    const ctx = createMockContext();
    phrasesModule.init(ctx);
    expect(ctx.registerUI).toHaveBeenCalledTimes(1); // ribbon:file
  });

  it('clustering module should register UI contributions on init', () => {
    const ctx = createMockContext();
    clusteringModule.init(ctx);
    expect(ctx.registerUI).toHaveBeenCalledTimes(1);
  });

  it('import-export module should register UI contributions on init', () => {
    const ctx = createMockContext();
    importExportModule.init(ctx);
    expect(ctx.registerUI).toHaveBeenCalledTimes(1);
  });

  it('find-replace module should register UI contributions on init', () => {
    const ctx = createMockContext();
    findReplaceModule.init(ctx);
    expect(ctx.registerUI).toHaveBeenCalledTimes(1);
  });

  it('cross-search module should register UI contributions on init', () => {
    const ctx = createMockContext();
    crossSearchModule.init(ctx);
    expect(ctx.registerUI).toHaveBeenCalledTimes(1);
  });

  it('minus-words module should register UI contributions on init', () => {
    const ctx = createMockContext();
    minusWordsModule.init(ctx);
    expect(ctx.registerUI).toHaveBeenCalledTimes(1);
  });

  it('groups module should register commands on init', () => {
    const ctx = createMockContext();
    groupsModule.init(ctx);
    expect(ctx.registerCommand).toHaveBeenCalledTimes(5); // create-group, create-subgroup, refresh-data, open-minus-words, toggle-multigroup
  });

  it('all modules destroy without error', async () => {
    for (const mod of [groupsModule, phrasesModule, clusteringModule, importExportModule, findReplaceModule, crossSearchModule, minusWordsModule]) {
      await mod.destroy();
    }
  });
});
