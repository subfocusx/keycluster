// ============================================================
// Tests: modules/import-export/index.ts — CSV parsing & export
// ============================================================

import { describe, it, expect } from 'vitest';
import { parseCSV, exportToCSV } from '@user-plugins/import-export/index';

describe('Import/Export — parseCSV', () => {

  it('should parse simple CSV', () => {
    const csv = 'фраза,частота,kei\nкупить ноутбук,12100,12\nаренда,8500,8';
    const result = parseCSV(csv, ',');
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(['фраза', 'частота', 'kei']);
    expect(result[1]).toEqual(['купить ноутбук', '12100', '12']);
    expect(result[2]).toEqual(['аренда', '8500', '8']);
  });

  it('should parse TSV (tab-delimited)', () => {
    const tsv = 'фраза\tчастота\nноутбук\t100';
    const result = parseCSV(tsv, '\t');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(['фраза', 'частота']);
    expect(result[1]).toEqual(['ноутбук', '100']);
  });

  it('should handle quoted fields with delimiters inside', () => {
    const csv = 'фраза,частота\n"купить, ноутбук",100';
    const result = parseCSV(csv, ',');
    expect(result[1]).toEqual(['купить, ноутбук', '100']);
  });

  it('should handle double-escaped quotes inside quoted fields', () => {
    const csv = 'фраза,частота\n"он сказал ""привет""",50';
    const result = parseCSV(csv, ',');
    expect(result[1][0]).toBe('он сказал "привет"');
  });

  it('should handle semicolon delimiter', () => {
    const csv = 'фраза;частота\nноутбук;100';
    const result = parseCSV(csv, ';');
    expect(result[1]).toEqual(['ноутбук', '100']);
  });

  it('should skip empty lines', () => {
    const csv = 'фраза,частота\n\nноутбук,100\n\n';
    const result = parseCSV(csv, ',');
    expect(result).toHaveLength(2);
  });

  it('should trim whitespace in cells', () => {
    const csv = ' фраза , частота \n ноутбук , 100 ';
    const result = parseCSV(csv, ',');
    expect(result[0]).toEqual(['фраза', 'частота']);
    expect(result[1]).toEqual(['ноутбук', '100']);
  });

  it('should handle CRLF line endings', () => {
    const csv = 'фраза,частота\r\nноутбук,100\r\n';
    const result = parseCSV(csv, ',');
    expect(result).toHaveLength(2);
  });

  it('should handle single-column CSV', () => {
    const csv = 'фраза\nноутбук\nтелефон';
    const result = parseCSV(csv, ',');
    expect(result).toHaveLength(3);
    expect(result[1]).toEqual(['ноутбук']);
  });

  it('should handle empty input', () => {
    const result = parseCSV('', ',');
    expect(result).toEqual([]);
  });
});

describe('Import/Export — exportToCSV', () => {

  it('should export simple data', () => {
    const data = [['Фраза', 'Частота'], ['ноутбук', '100']];
    const csv = exportToCSV(data, ',');
    expect(csv).toBe('Фраза,Частота\nноутбук,100');
  });

  it('should quote cells containing delimiter', () => {
    const data = [['купить, ноутбук', '100']];
    const csv = exportToCSV(data, ',');
    expect(csv).toContain('"купить, ноутбук"');
  });

  it('should quote cells containing double quotes', () => {
    const data = [['он сказал "привет"', '50']];
    const csv = exportToCSV(data, ',');
    expect(csv).toContain('"он сказал ""привет"""');
  });

  it('should quote cells containing newlines', () => {
    const data = [['строка1\nстрока2', 'val']];
    const csv = exportToCSV(data, ',');
    expect(csv).toContain('"строка1\nстрока2"');
  });

  it('should handle TSV export', () => {
    const data = [['Фраза', 'Частота'], ['ноутбук', '100']];
    const csv = exportToCSV(data, '\t');
    expect(csv).toBe('Фраза\tЧастота\nноутбук\t100');
  });

  it('should handle empty data', () => {
    const csv = exportToCSV([], ',');
    expect(csv).toBe('');
  });
});

describe('Import/Export — roundtrip', () => {

  it('should roundtrip CSV data correctly', () => {
    const original = [['Фраза', 'Частота', 'KEI'], ['купить ноутбук', '12100', '12'], ['аренда', '8500', '8']];
    const csv = exportToCSV(original, ',');
    const parsed = parseCSV(csv, ',');
    expect(parsed).toEqual(original);
  });

  it('should roundtrip CSV with quoted fields', () => {
    const original = [['Фраза', 'Частота'], ['купить, ноутбук', '100']];
    const csv = exportToCSV(original, ',');
    // Export should quote "купить, ноутбук" because it contains comma
    expect(csv).toContain('"купить, ноутбук"');
    const parsed = parseCSV(csv, ',');
    expect(parsed[1][0]).toBe('купить, ноутбук');
    expect(parsed[1][1]).toBe('100');
  });
});
