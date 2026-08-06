// ============================================================
// Module: Cross Search — find duplicates between groups
// ============================================================

import type { AppModule, PluginContext, Phrase } from 'plugin-sdk';
import { CrossSearchPanel } from './components';

/** Module-level settings state — updated on init and onSettingsChange */
export let crossSearchSettings = {
  minGroups: 2,
};

const crossSearchModule: AppModule = {
  manifest: {
    id: 'cross-search',
    name: 'Перекрёстный поиск',
    version: '1.0.0',
    description: 'Поиск дубликатов фраз между группами',
    category: 'analysis',
    dependencies: ['groups', 'phrases'],
    slot: ['ribbon:tools', 'left-panel'],
    settingsSchema: [
      { key: 'minGroups', type: 'number', label: 'Мин. число групп для дубликата', default: 2 },
    ],
  },

  init(ctx: PluginContext) {
    // Read initial settings
    const readSettings = () => {
      crossSearchSettings = {
        minGroups: ctx.getSetting('minGroups') as number ?? 2,
      };
    };
    readSettings();

    // Subscribe to settings changes
    ctx.registerLifecycleHook?.('onSettingsChange', (payload) => {
      if (payload?.moduleId === 'cross-search') {
        readSettings();
      }
    });

    ctx.registerUI({
      slot: 'ribbon:tools',
      label: 'Перекрёстный',
      component: () => CrossSearchPanel({ ctx }),
      order: 30,
    });
  },

  destroy() {
    crossSearchSettings = { minGroups: 2 };
  },
};

export default crossSearchModule;

export function findDuplicates(phrases: Phrase[]): Map<string, { text: string; groupIds: Set<string>; count: number }> {
  const byText = new Map<string, { text: string; groupIds: Set<string>; count: number }>();

  for (const p of phrases) {
    const key = p.text.toLowerCase().trim();
    if (!byText.has(key)) {
      byText.set(key, { text: p.text, groupIds: new Set(), count: 0 });
    }
    const entry = byText.get(key)!;
    entry.groupIds.add(p.groupId);
    entry.count++;
  }

  // Only return duplicates (in 2+ groups)
  const duplicates = new Map<string, { text: string; groupIds: Set<string>; count: number }>();
  for (const [key, val] of byText) {
    if (val.groupIds.size >= crossSearchSettings.minGroups) {
      duplicates.set(key, val);
    }
  }
  return duplicates;
}