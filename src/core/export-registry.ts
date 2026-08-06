import type { Phrase, Group, MinusWord } from './types';

export interface ExportPayload {
  phrases: Phrase[];
  groups: Group[];
  minusWords: MinusWord[];
  columns: string[];
  includeHeader: boolean;
  exportMinusWords?: boolean;
  columnLabels?: Record<string, string>;
}

export interface ExportFormat {
  id: string;
  label: string;
  extension: string;
  fileFilter: { name: string; extensions: string[] };
  serialize(payload: ExportPayload): Promise<string | Uint8Array>;
}

const _formats = new Map<string, ExportFormat>();

export function registerExportFormat(format: ExportFormat): void {
  _formats.set(format.id, format);
}

export function getExportFormat(id: string): ExportFormat | undefined {
  return _formats.get(id);
}

export function getAllExportFormats(): ExportFormat[] {
  return Array.from(_formats.values());
}

export function unregisterExportFormat(id: string): void {
  _formats.delete(id);
}

export function clearExportFormats(): void {
  _formats.clear();
}
