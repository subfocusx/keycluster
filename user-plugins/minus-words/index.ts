// ============================================================
// Module: Minus Words — global/per-group, search types, apply
// ============================================================

import type { AppModule, PluginContext } from 'plugin-sdk';
import { MinusWordsPanel } from './components';

/** Module-level settings state — updated on init and onSettingsChange */
export let minusWordsSettings = {
  broadMatch: false,
};

const minusWordsModule: AppModule = {
  manifest: {
    id: 'minus-words',
    name: 'Минус-фразы',
    version: '1.0.0',
    description: 'Глобальные и групповые минус-фразы, типы поиска, отчёт применения',
    category: 'data',
    dependencies: ['groups', 'phrases'],
    slot: ['ribbon:tools', 'left-panel'],
    settingsSchema: [
      { key: 'broadMatch', type: 'boolean', label: 'Широкое соответствие по умолчанию', default: false },
    ],
  },

  init(ctx: PluginContext) {
    // Read initial settings
    const readSettings = () => {
      minusWordsSettings = {
        broadMatch: ctx.getSetting('broadMatch') as boolean ?? false,
      };
    };
    readSettings();

    // Subscribe to settings changes
    ctx.registerLifecycleHook?.('onSettingsChange', (payload) => {
      if (payload?.moduleId === 'minus-words') {
        readSettings();
      }
    });

    ctx.registerUI({
      slot: 'ribbon:tools',
      label: 'Минус-фразы',
      component: () => MinusWordsPanel({ ctx }),
      order: 20,
    });
  },

  destroy() {},
};

export default minusWordsModule;