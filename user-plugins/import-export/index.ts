// ============================================================
// Module: Import/Export — CSV, TSV, TXT, JSON, XLSX with mapping
// ============================================================

import type { AppModule, PluginContext } from 'plugin-sdk';
import { ImportExportRibbonButtons, ImportExportPanel } from './components';
import { ImportDialog } from './import-dialog';
import { registerExportFormat, unregisterExportFormat, useAppStore } from 'plugin-sdk';

/** Module-level settings state — updated on init and onSettingsChange */
export let importExportSettings = {
  defaultFormat: 'csv' as string,
};

const importExportModule: AppModule = {
  manifest: {
    id: 'import-export',
    name: 'Импорт/Экспорт',
    version: '1.0.0',
    description: 'Импорт и экспорт данных: CSV, TSV, TXT, JSON, XLSX с маппингом столбцов',
    category: 'data',
    dependencies: ['groups', 'phrases'],
    slot: ['ribbon:import-export', 'left-panel'],
    settingsSchema: [
      { key: 'defaultFormat', type: 'select', label: 'Формат по умолчанию', default: 'csv', options: ['csv', 'xlsx', 'json', 'txt'] },
    ],
  },

  init(ctx: PluginContext) {
    // Read initial settings
    const readSettings = () => {
      importExportSettings = {
        defaultFormat: ctx.getSetting('defaultFormat') as string ?? 'csv',
      };
    };
    readSettings();

    // Subscribe to settings changes
    ctx.registerLifecycleHook?.('onSettingsChange', (payload) => {
      if (payload?.moduleId === 'import-export') {
        readSettings();
      }
    });

    for (const fmt of BUILTIN_EXPORT_FORMATS) {
      registerExportFormat(fmt);
    }

    ctx.registerUI({
      slot: 'ribbon:import-export',
      label: 'Импорт/Экспорт',
      component: () => ImportExportRibbonButtons({ ctx }),
      order: 10,
    });

    // Register commands + keybindings
    ctx.registerCommand('export', () => {
      ctx.store.dispatch('setLeftPanel', { open: true, module: 'import-export' });
    });
    ctx.registerKeybinding?.('ctrl+shift+e', 'export', { label: 'Экспорт данных' });
  },

  destroy() {
    for (const fmt of BUILTIN_EXPORT_FORMATS) {
      unregisterExportFormat(fmt.id);
    }
  },
};

export default importExportModule;

// ---- Utility Functions ----

import Papa from 'papaparse';
import { BUILTIN_EXPORT_FORMATS } from './formats';

export function parseCSV(text: string, delimiter: string = ','): string[][] {
  const result = Papa.parse<string[]>(text, {
    delimiter,
    skipEmptyLines: true,
  });
  return result.data.map(row => row.map(cell => cell.trim()));
}

/** Stream-parse a File with PapaParse, calling onRow for each parsed row.
 *  Batches rows into chunks of batchSize, calling onBatch for each chunk.
 *  Useful for importing large CSV files without loading everything into memory. */
export function parseCSVStreaming(
  file: File,
  delimiter: string,
  onRow: (row: string[]) => void,
  onComplete: () => void,
  onError: (err: Error) => void,
): { abort: () => void } {
  let parser: Papa.Parser | undefined;
  Papa.parse<string[]>(file, {
    delimiter,
    skipEmptyLines: true,
    step: (result, p) => {
      parser = p;
      onRow(result.data.map(c => c.trim()));
    },
    complete: onComplete,
    error: (err) => onError(new Error(err.message)),
  });
  return {
    abort: () => {
      if (parser) parser.abort();
    },
  };
}

export function exportToCSV(data: string[][], delimiter: string = ','): string {
  return data.map(row =>
    row.map(cell => {
      if (cell.includes(delimiter) || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(delimiter)
  ).join('\n');
}