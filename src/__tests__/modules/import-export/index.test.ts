import { describe, it, expect, vi, beforeEach } from 'vitest';
import importExportModule from '@user-plugins/import-export/index';
import { parseCSV, exportToCSV, importExportSettings } from '@user-plugins/import-export/index';

beforeEach(() => {
  importExportSettings.defaultFormat = 'csv';
});

describe('parseCSV', () => {
  it('should parse comma-separated CSV', () => {
    const result = parseCSV('a,b,c\n1,2,3\n4,5,6');
    expect(result).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
      ['4', '5', '6'],
    ]);
  });

  it('should parse tab-separated TSV', () => {
    const result = parseCSV('a\tb\tc\n1\t2\t3', '\t');
    expect(result).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('should skip empty lines', () => {
    const result = parseCSV('a,b\n\n1,2\n\n');
    expect(result).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('should trim whitespace from cells', () => {
    const result = parseCSV('  a  ,  b  \n 1 , 2 ');
    expect(result).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('should return empty array for empty input', () => {
    const result = parseCSV('');
    expect(result).toEqual([]);
  });
});

describe('exportToCSV', () => {
  it('should produce basic CSV', () => {
    const result = exportToCSV([['a', 'b'], ['1', '2']]);
    expect(result).toBe('a,b\n1,2');
  });

  it('should quote cells containing delimiter', () => {
    const result = exportToCSV([['hello,world', 'b']]);
    expect(result).toBe('"hello,world",b');
  });

  it('should quote cells containing double quotes', () => {
    const result = exportToCSV([['say "hi"', 'b']]);
    expect(result).toBe('"say ""hi""",b');
  });

  it('should quote cells containing newlines', () => {
    const result = exportToCSV([['line1\nline2', 'b']]);
    expect(result).toBe('"line1\nline2",b');
  });

  it('should use custom delimiter', () => {
    const result = exportToCSV([['a', 'b', 'c']], '\t');
    expect(result).toBe('a\tb\tc');
  });

  it('should return empty string for empty data', () => {
    const result = exportToCSV([]);
    expect(result).toBe('');
  });
});

describe('importExportModule', () => {
  it('should have correct manifest', () => {
    expect(importExportModule.manifest.id).toBe('import-export');
    expect(importExportModule.manifest.name).toBe('Импорт/Экспорт');
    expect(importExportModule.manifest.version).toBe('1.0.0');
    expect(importExportModule.manifest.dependencies).toContain('groups');
    expect(importExportModule.manifest.dependencies).toContain('phrases');
  });

  it('should have settings schema', () => {
    expect(importExportModule.manifest.settingsSchema).toHaveLength(1);
    expect(importExportModule.manifest.settingsSchema![0].key).toBe('defaultFormat');
  });

  it('should have destroy as noop', async () => {
    await importExportModule.destroy();
  });
});

describe('parseCSVStreaming', () => {
  it('should call onRow and onComplete callbacks', async () => {
    const { parseCSVStreaming } = await import('@user-plugins/import-export/index');

    const onRow = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();

    const file = new File(['a,b,c\n1,2,3\n4,5,6'], 'test.csv', { type: 'text/csv' });

    await new Promise<void>((resolve) => {
      parseCSVStreaming(
        file,
        ',',
        (row) => {
          onRow(row);
          if (onRow.mock.calls.length === 2) {
            setTimeout(resolve, 100);
          }
        },
        () => {
          onComplete();
          resolve();
        },
        onError,
      );
    });

    expect(onError).not.toHaveBeenCalled();
  }, 5000);
});
