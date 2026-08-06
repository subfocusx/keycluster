import type { ExportFormat, ExportPayload } from 'plugin-sdk';
import { COLUMN_LABELS, type ExportColumnKey } from './export-templates';
import { exportToCSV } from './index';

function getGroupLabel(id: string, groups: { id: string; name: string }[]): string {
  return groups.find(g => g.id === id)?.name ?? '—';
}

function phraseToRowArray(p: { text: string; groupId: string; frequency?: number; kei?: number; cpc?: number; notes?: string; tags?: string[] }, columns: string[], groups: { id: string; name: string }[]): string[] {
  const getGroupName = (id: string) => getGroupLabel(id, groups);
  const map: Record<string, string> = {
    text: p.text,
    group: getGroupName(p.groupId),
    frequency: String(p.frequency ?? ''),
    kei: String(p.kei ?? ''),
    cpc: String(p.cpc ?? ''),
    notes: p.notes ?? '',
    tags: (p.tags ?? []).join(', '),
  };
  return columns.map(c => map[c] ?? '');
}

function defaultColumnLabel(col: string): string {
  return (COLUMN_LABELS as Record<string, string>)[col] ?? col;
}

const csvFormat: ExportFormat = {
  id: 'csv',
  label: 'CSV',
  extension: 'csv',
  fileFilter: { name: 'CSV File', extensions: ['csv'] },
  async serialize(payload) {
    const { phrases, groups, minusWords, columns, includeHeader, exportMinusWords, columnLabels } = payload;
    const getLabel = (c: string) => columnLabels?.[c] ?? defaultColumnLabel(c);
    const delim = ',';

    if (exportMinusWords) {
      const rows = includeHeader ? [['Minus-фраза']] : [];
      for (const mw of minusWords) rows.push([mw.text]);
      return exportToCSV(rows, delim);
    }

    const rows: string[][] = [];
    if (includeHeader) rows.push(columns.map(c => getLabel(c)));
    for (const p of phrases) rows.push(phraseToRowArray(p, columns, groups));
    return exportToCSV(rows, delim);
  },
};

const tsvFormat: ExportFormat = {
  id: 'tsv',
  label: 'TSV',
  extension: 'tsv',
  fileFilter: { name: 'TSV File', extensions: ['tsv'] },
  async serialize(payload) {
    const { phrases, groups, minusWords, columns, includeHeader, exportMinusWords, columnLabels } = payload;
    const getLabel = (c: string) => columnLabels?.[c] ?? defaultColumnLabel(c);
    const delim = '\t';

    if (exportMinusWords) {
      const rows = includeHeader ? [['Minus-фраза']] : [];
      for (const mw of minusWords) rows.push([mw.text]);
      return exportToCSV(rows, delim);
    }

    const rows: string[][] = [];
    if (includeHeader) rows.push(columns.map(c => getLabel(c)));
    for (const p of phrases) rows.push(phraseToRowArray(p, columns, groups));
    return exportToCSV(rows, delim);
  },
};

const txtFormat: ExportFormat = {
  id: 'txt',
  label: 'TXT (по строкам)',
  extension: 'txt',
  fileFilter: { name: 'TXT File', extensions: ['txt'] },
  async serialize(payload) {
    const { phrases, minusWords, exportMinusWords } = payload;
    if (exportMinusWords) return minusWords.map(mw => mw.text).join('\n');
    return phrases.map(p => p.text).join('\n');
  },
};

const jsonFormat: ExportFormat = {
  id: 'json',
  label: 'JSON',
  extension: 'json',
  fileFilter: { name: 'JSON', extensions: ['json'] },
  async serialize(payload) {
    const { phrases, groups, minusWords, exportMinusWords } = payload;
    if (exportMinusWords) {
      return JSON.stringify({ minusWords: minusWords.map(mw => mw.text) }, null, 2);
    }
    return JSON.stringify({ groups, phrases, minusWords, version: 1 }, null, 2);
  },
};

const xlsxFormat: ExportFormat = {
  id: 'xlsx',
  label: 'XLSX (Excel)',
  extension: 'xlsx',
  fileFilter: { name: 'Excel Workbook', extensions: ['xlsx'] },
  async serialize(payload) {
    const { phrases, groups, minusWords, columns, includeHeader, exportMinusWords, columnLabels } = payload;
    const getLabel = (c: string) => columnLabels?.[c] ?? defaultColumnLabel(c);
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    if (!exportMinusWords) {
      const headerLabels = columns.map(c => getLabel(c));
      const phrasesData = phrases.map(p => {
        const row = phraseToRowArray(p, columns, groups);
        const obj: Record<string, string> = {};
        columns.forEach((col, i) => { obj[headerLabels[i]] = row[i]; });
        return obj;
      });
      const ws1 = XLSX.utils.json_to_sheet(phrasesData);
      XLSX.utils.book_append_sheet(wb, ws1, 'Фразы');
    }

    const mwData = minusWords.map(mw => ({
      'Минус-фраза': mw.text,
      'Тип': (mw as any).isExact ? 'Точная' : 'Широкая',
      'Область': (mw as any).groupId ? getGroupLabel((mw as any).groupId, groups) : 'Глобальная',
    }));
    const ws2 = XLSX.utils.json_to_sheet(mwData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Минус-фразы');

    const buffer: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    return new Uint8Array(buffer);
  },
};

export const BUILTIN_EXPORT_FORMATS: ExportFormat[] = [
  csvFormat,
  tsvFormat,
  txtFormat,
  jsonFormat,
  xlsxFormat,
];