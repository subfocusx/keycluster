// ============================================================
// Tests: Module settingsSchema — all 7 modules define schemas
// ============================================================

import { describe, it, expect } from 'vitest';
import { groupsModule } from '@/modules/groups/index';
import { phrasesModule } from '@/modules/phrases/index';
import clusteringModule from '@user-plugins/clustering/index';
import minusWordsModule from '@user-plugins/minus-words/index';
import findReplaceModule from '@user-plugins/find-replace/index';
import importExportModule from '@user-plugins/import-export/index';
import crossSearchModule from '@user-plugins/cross-search/index';
import type { AppModule } from '@/plugin-sdk';

const allModules = [
  groupsModule, phrasesModule, clusteringModule,
  minusWordsModule, findReplaceModule, importExportModule, crossSearchModule,
];

describe('App Module', () => {
  it('all 7 modules have settingsSchema defined', () => {
    for (const mod of allModules) {
      expect(mod.manifest.settingsSchema).toBeDefined();
      expect(Array.isArray(mod.manifest.settingsSchema)).toBe(true);
      expect(mod.manifest.settingsSchema!.length).toBeGreaterThan(0);
    }
  });

  it('each schema field has key, type, label, default', () => {
    for (const mod of allModules) {
      for (const field of mod.manifest.settingsSchema!) {
        expect(field.key).toBeTypeOf('string');
        expect(field.key.length).toBeGreaterThan(0);
        expect(['boolean', 'string', 'number', 'select']).toContain(field.type);
        expect(field.label).toBeTypeOf('string');
        expect(field.label.length).toBeGreaterThan(0);
        expect('default' in field).toBe(true);
      }
    }
  });

  it('select fields have options array', () => {
    for (const mod of allModules) {
      for (const field of mod.manifest.settingsSchema!) {
        if (field.type === 'select') {
          expect(Array.isArray(field.options)).toBe(true);
          expect(field.options!.length).toBeGreaterThan(0);
          expect(field.options).toContain(field.default);
        }
      }
    }
  });

  // Specific module schemas
  it('groups module has defaultExpanded boolean', () => {
    const schema = groupsModule.manifest.settingsSchema!;
    const field = schema.find(f => f.key === 'defaultExpanded');
    expect(field).toBeDefined();
    expect(field!.type).toBe('boolean');
    expect(field!.default).toBe(true);
  });

  it('phrases module has clickableWords and pageSize', () => {
    const schema = phrasesModule.manifest.settingsSchema!;
    expect(schema.find(f => f.key === 'clickableWords')?.default).toBe(true);
    expect(schema.find(f => f.key === 'pageSize')?.default).toBe(50);
  });

  it('clustering module has threshold and minClusterSize', () => {
    const schema = clusteringModule.manifest.settingsSchema!;
    expect(schema.find(f => f.key === 'threshold')?.default).toBe(0.3);
    expect(schema.find(f => f.key === 'minClusterSize')?.default).toBe(2);
  });

  it('minus-words module has broadMatch', () => {
    const schema = minusWordsModule.manifest.settingsSchema!;
    expect(schema.find(f => f.key === 'broadMatch')?.default).toBe(false);
  });

  it('find-replace module has caseSensitive and useRegex', () => {
    const schema = findReplaceModule.manifest.settingsSchema!;
    expect(schema.find(f => f.key === 'caseSensitive')?.default).toBe(false);
    expect(schema.find(f => f.key === 'useRegex')?.default).toBe(false);
  });

  it('import-export module has defaultFormat select', () => {
    const schema = importExportModule.manifest.settingsSchema!;
    const field = schema.find(f => f.key === 'defaultFormat');
    expect(field).toBeDefined();
    expect(field!.type).toBe('select');
    expect(field!.default).toBe('csv');
    expect(field!.options).toEqual(['csv', 'xlsx', 'json', 'txt']);
  });

  it('cross-search module has minGroups', () => {
    const schema = crossSearchModule.manifest.settingsSchema!;
    expect(schema.find(f => f.key === 'minGroups')?.default).toBe(2);
  });
});
