// ============================================================
// Module: Find & Replace — regex, case, whole words, preview
// ============================================================

import type { AppModule, PluginContext } from 'plugin-sdk';
import { FindReplacePanel } from './components';
import { useAppStore } from 'plugin-sdk';

/** Module-level settings state — updated on init and onSettingsChange */
export let findReplaceSettings = {
  caseSensitive: false,
  useRegex: false,
};

const findReplaceModule: AppModule = {
  manifest: {
    id: 'find-replace',
    name: 'Найти и заменить',
    version: '1.0.0',
    description: 'Поиск и замена в фразах: regex, регистр, целые слова',
    category: 'data',
    dependencies: ['phrases'],
    slot: ['ribbon:tools', 'left-panel'],
    settingsSchema: [
      { key: 'caseSensitive', type: 'boolean', label: 'Учитывать регистр', default: false },
      { key: 'useRegex', type: 'boolean', label: 'Регулярные выражения', default: false },
    ],
  },

  init(ctx: PluginContext) {
    // Read initial settings
    const readSettings = () => {
      findReplaceSettings = {
        caseSensitive: ctx.getSetting('caseSensitive') as boolean ?? false,
        useRegex: ctx.getSetting('useRegex') as boolean ?? false,
      };
    };
    readSettings();

    // Subscribe to settings changes
    ctx.registerLifecycleHook?.('onSettingsChange', (payload) => {
      if (payload?.moduleId === 'find-replace') {
        readSettings();
      }
    });

    ctx.registerUI({
      slot: 'ribbon:tools',
      label: 'Найти/Зам.',
      component: () => FindReplacePanel({ ctx }),
      order: 40,
    });

    // Register commands + keybindings
    ctx.registerCommand('open', () => {
      ctx.store.dispatch('setLeftPanel', { open: true, module: 'find-replace' });
    });
    ctx.registerKeybinding?.('ctrl+h', 'open', { label: 'Найти и заменить' });
  },

  destroy() {
    findReplaceSettings = { caseSensitive: false, useRegex: false };
  },
};

export default findReplaceModule;
