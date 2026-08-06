// ============================================================
// Module: Phrases — table with sort, filter, mass operations
// ============================================================

import type { AppModule, PluginContext } from '@/plugin-sdk';
import { PhrasesRibbonButtons } from './components';
import { AddPhrasesDialog } from './AddPhrasesDialog';

/** Module-level settings state — updated on init and onSettingsChange */
export let phrasesSettings = {
  clickableWords: true,
  pageSize: 50,
};

export const phrasesModule: AppModule = {
  manifest: {
    id: 'phrases',
    name: 'Ключевые фразы',
    version: '1.0.0',
    description: 'Таблица фраз, сортировка, фильтрация, массовые операции',
    dependencies: ['groups'],
    slot: ['ribbon:file', 'ribbon:tools'],
    settingsSchema: [
      { key: 'clickableWords', type: 'boolean', label: 'Кликабельные слова', default: true },
      { key: 'pageSize', type: 'number', label: 'Строк на странице', default: 50 },
    ],
  },

  init(ctx: PluginContext) {
    // Read initial settings
    const readSettings = () => {
      phrasesSettings = {
        clickableWords: ctx.getSetting('clickableWords') as boolean ?? true,
        pageSize: ctx.getSetting('pageSize') as number ?? 50,
      };
    };
    readSettings();

    // Subscribe to settings changes
    ctx.registerLifecycleHook?.('onSettingsChange', (payload) => {
      if (payload?.moduleId === 'phrases') {
        readSettings();
      }
    });

    ctx.registerUI({
      slot: 'ribbon:file',
      label: 'Добавить фразы',
      component: () => PhrasesRibbonButtons({ ctx }),
      order: 5,
    });

    // PhrasesTable is rendered by the shell as the main content area
  },

  destroy() {},
};

// Export AddPhrasesDialog for global use in shell
export { AddPhrasesDialog };