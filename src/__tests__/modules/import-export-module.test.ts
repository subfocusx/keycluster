// ============================================================
// Tests: modules/import-export/index.ts — module, parseCSV, exportToCSV
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock store before importing module
vi.mock('@/core/store', () => ({
  useAppStore: {
    getState: vi.fn(() => ({
      setLeftPanel: vi.fn(),
    })),
  },
}));

// Mock import-export components (React)
vi.mock('@user-plugins/import-export/components', () => ({
  ImportExportRibbonButtons: vi.fn(() => null),
  ImportExportPanel: vi.fn(() => null),
}));

import importExportModule from '@user-plugins/import-export/index';
import {
  importExportSettings,
  parseCSV,
  exportToCSV,
} from '@user-plugins/import-export/index';
import { useAppStore } from '@/plugin-sdk';
import type { ModuleContext } from '@/core/types';

// ---- Mock Context ----

function createMockCtx() {
  const getModuleSetting = vi.fn();
  return {
    getSetting: vi.fn((key: string) => getModuleSetting('import-export', key)),
    store: {
      getModuleSetting,
      dispatch: vi.fn(),
      getStateSlice: vi.fn(),
    },
    eventBus: {
      emit: vi.fn(),
    },
    registerUI: vi.fn(),
    registerCommand: vi.fn(),
    registerLifecycleHook: vi.fn(),
    registerKeybinding: vi.fn(),
  };
}

type MockCtx = ReturnType<typeof createMockCtx>;

// ============================================================
// parseCSV
// ============================================================

describe('parseCSV', () => {

  it('should parse basic comma-separated values', () => {
    const csv = 'a,b,c\n1,2,3';
    const result = parseCSV(csv, ',');
    expect(result).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('should parse TSV with tab delimiter', () => {
    const tsv = 'фраза\tчастота\nноутбук\t100';
    const result = parseCSV(tsv, '\t');
    expect(result).toEqual([
      ['фраза', 'частота'],
      ['ноутбук', '100'],
    ]);
  });

  it('should handle quoted fields containing delimiters', () => {
    const csv = '"hello, world",other';
    const result = parseCSV(csv, ',');
    expect(result[0]).toEqual(['hello, world', 'other']);
  });

  it('should handle escaped double quotes ("" → ")', () => {
    const csv = '"он сказал ""привет""",value';
    const result = parseCSV(csv, ',');
    expect(result[0][0]).toBe('он сказал "привет"');
    expect(result[0][1]).toBe('value');
  });

  it('should handle CRLF line endings', () => {
    const csv = 'a,b\r\nc,d\r\n';
    const result = parseCSV(csv, ',');
    expect(result).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('should filter out empty lines', () => {
    const csv = 'a,b\n\nc,d\n\n';
    const result = parseCSV(csv, ',');
    expect(result).toHaveLength(2);
    expect(result).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('should trim whitespace in cells', () => {
    const csv = ' a , b \n c , d ';
    const result = parseCSV(csv, ',');
    expect(result).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('should handle empty input', () => {
    expect(parseCSV('', ',')).toEqual([]);
  });

  it('should handle single-column input', () => {
    const csv = 'hello\nworld';
    const result = parseCSV(csv, ',');
    expect(result).toEqual([['hello'], ['world']]);
  });
});

// ============================================================
// exportToCSV
// ============================================================

describe('exportToCSV', () => {

  it('should produce basic CSV output', () => {
    const data = [['a', 'b'], ['1', '2']];
    const result = exportToCSV(data, ',');
    expect(result).toBe('a,b\n1,2');
  });

  it('should quote cells containing the delimiter', () => {
    const data = [['hello, world', 'other']];
    const result = exportToCSV(data, ',');
    expect(result).toContain('"hello, world"');
    expect(result).toBe('"hello, world",other');
  });

  it('should quote cells containing double quotes', () => {
    const data = [['say "hi"', 'val']];
    const result = exportToCSV(data, ',');
    expect(result).toContain('"say ""hi"""');
  });

  it('should quote cells containing newlines', () => {
    const data = [['line1\nline2', 'val']];
    const result = exportToCSV(data, ',');
    expect(result).toContain('"line1\nline2"');
  });

  it('should escape double quotes as ""', () => {
    const data = [['a"b']];
    const result = exportToCSV(data, ',');
    expect(result).toBe('"a""b"');
  });

  it('should export with tab delimiter (TSV)', () => {
    const data = [['a', 'b'], ['1', '2']];
    const result = exportToCSV(data, '\t');
    expect(result).toBe('a\tb\n1\t2');
  });

  it('should handle empty data', () => {
    expect(exportToCSV([], ',')).toBe('');
  });
});

// ============================================================
// Roundtrip: parseCSV → exportToCSV → parseCSV
// ============================================================

describe('parseCSV ↔ exportToCSV roundtrip', () => {

  it('should roundtrip simple data', () => {
    const original = [['a', 'b', 'c'], ['1', '2', '3']];
    const csv = exportToCSV(original, ',');
    const parsed = parseCSV(csv, ',');
    expect(parsed).toEqual(original);
  });

  it('should roundtrip data with commas in fields', () => {
    const original = [['hello, world', 'other'], ['val', 'x']];
    const csv = exportToCSV(original, ',');
    const parsed = parseCSV(csv, ',');
    expect(parsed).toEqual(original);
  });

  it('should roundtrip data with double quotes in fields', () => {
    const original = [['say "hi"', 'val']];
    const csv = exportToCSV(original, ',');
    const parsed = parseCSV(csv, ',');
    expect(parsed).toEqual(original);
  });

  it('should roundtrip TSV data', () => {
    const original = [['a', 'b'], ['1', '2']];
    const tsv = exportToCSV(original, '\t');
    const parsed = parseCSV(tsv, '\t');
    expect(parsed).toEqual(original);
  });
});

// ============================================================
// importExportModule — manifest
// ============================================================

describe('importExportModule — manifest', () => {

  it('should have correct id', () => {
    expect(importExportModule.manifest.id).toBe('import-export');
  });

  it('should have correct name', () => {
    expect(importExportModule.manifest.name).toBe('Импорт/Экспорт');
  });

  it('should have correct version', () => {
    expect(importExportModule.manifest.version).toBe('1.0.0');
  });

  it('should have correct description', () => {
    expect(importExportModule.manifest.description).toBe(
      'Импорт и экспорт данных: CSV, TSV, TXT, JSON, XLSX с маппингом столбцов',
    );
  });

  it('should declare dependencies on groups and phrases', () => {
    expect(importExportModule.manifest.dependencies).toEqual(['groups', 'phrases']);
  });

  it('should declare correct slots', () => {
    expect(importExportModule.manifest.slot).toEqual(['ribbon:import-export', 'left-panel']);
  });
});

// ============================================================
// importExportModule — init
// ============================================================

describe('importExportModule — init', () => {

  let mockCtx: MockCtx;

  beforeEach(() => {
    mockCtx = createMockCtx();
    vi.clearAllMocks();
  });

  it('should register UI contribution on init', () => {
    importExportModule.init(mockCtx as unknown as ModuleContext);

    expect(mockCtx.registerUI).toHaveBeenCalledTimes(1);
    expect(mockCtx.registerUI).toHaveBeenCalledWith(
      expect.objectContaining({
        slot: 'ribbon:import-export',
        label: 'Импорт/Экспорт',
        order: 10,
      }),
    );
  });

  it('should register export command on init', () => {
    importExportModule.init(mockCtx as unknown as ModuleContext);

    expect(mockCtx.registerCommand).toHaveBeenCalledWith('export', expect.any(Function));
  });

  it('should register keybinding for export on init', () => {
    importExportModule.init(mockCtx as unknown as ModuleContext);

    expect(mockCtx.registerKeybinding).toHaveBeenCalledWith(
      'ctrl+shift+e',
      'export',
      { label: 'Экспорт данных' },
    );
  });

  it('should subscribe to settings changes', () => {
    importExportModule.init(mockCtx as unknown as ModuleContext);

    expect(mockCtx.registerLifecycleHook).toHaveBeenCalledWith(
      'onSettingsChange',
      expect.any(Function),
    );
  });

  it('should read initial settings from store', () => {
    mockCtx.store.getModuleSetting.mockReturnValue('xlsx');
    importExportModule.init(mockCtx as unknown as ModuleContext);

    expect(mockCtx.store.getModuleSetting).toHaveBeenCalledWith('import-export', 'defaultFormat');
  });

  it('export command should dispatch setLeftPanel to open import-export panel', () => {
    importExportModule.init(mockCtx as unknown as ModuleContext);

    const exportHandler = mockCtx.registerCommand.mock.calls.find(
      (call: any[]) => call[0] === 'export',
    )![1] as () => void;

    exportHandler();

    expect(mockCtx.store.dispatch).toHaveBeenCalledWith('setLeftPanel', { open: true, module: 'import-export' });
  });

  it('destroy should not throw', async () => {
    await importExportModule.destroy();
  });
});
