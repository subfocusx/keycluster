import type { AppModule, PluginContext } from 'plugin-sdk';
import { useAppStore } from 'plugin-sdk';
import type { Phrase } from 'plugin-sdk';
import { DeduplicatorPanel } from './components';

export interface DeduplicateOptions {
  caseSensitive: boolean;
  withinGroup: boolean;
}

export function deduplicate(
  phrases: Phrase[],
  options: DeduplicateOptions,
): string[] {
  const { caseSensitive, withinGroup } = options;
  const seen = new Map<string, string>();
  const duplicateIds: string[] = [];

  if (withinGroup) {
    const groupSeen = new Map<string, Map<string, string>>();
    for (const phrase of phrases) {
      const key = caseSensitive ? phrase.text : phrase.text.toLowerCase();
      if (!groupSeen.has(phrase.groupId)) {
        groupSeen.set(phrase.groupId, new Map());
      }
      const groupMap = groupSeen.get(phrase.groupId)!;
      if (groupMap.has(key)) {
        duplicateIds.push(phrase.id);
      } else {
        groupMap.set(key, phrase.id);
      }
    }
  } else {
    for (const phrase of phrases) {
      const key = caseSensitive ? phrase.text : phrase.text.toLowerCase();
      if (seen.has(key)) {
        duplicateIds.push(phrase.id);
      } else {
        seen.set(key, phrase.id);
      }
    }
  }

  return duplicateIds;
}

const deduplicatorModule: AppModule = {
  manifest: {
    id: 'deduplicator',
    name: 'Дедупликатор',
    version: '1.0.0',
    description: 'Удаляет дублирующиеся фразы',
    category: 'data',
    dependencies: ['phrases'],
    slot: ['ribbon:tools'],
    icon: 'auto_fix_high',
    settingsSchema: [
      { key: 'caseSensitive', type: 'boolean', label: 'Учитывать регистр', default: false },
      { key: 'withinGroup', type: 'boolean', label: 'Дедупликация в пределах группы', default: true },
    ],
    repository: 'https://github.com/keycluster/kc-deduplicator',
    minAppVersion: '0.3.0',
  },

  init(ctx: PluginContext) {
    ctx.registerUI({
      slot: 'ribbon:tools',
      label: 'Дедупликатор',
      icon: 'auto_fix_high',
      component: () => DeduplicatorPanel({ ctx }),
      order: 35,
    });

    ctx.registerCommand('deduplicate', () => {
      const store = useAppStore.getState();
      const phrases = store.phrases;
      const caseSensitive = ctx.getSetting('caseSensitive') as boolean ?? false;
      const withinGroup = ctx.getSetting('withinGroup') as boolean ?? true;

      const duplicateIds = deduplicate(phrases, { caseSensitive, withinGroup });

      if (duplicateIds.length > 0) {
        ctx.store.dispatch('deletePhrases', duplicateIds);
        console.log(`[Deduplicator] Removed ${duplicateIds.length} duplicate phrases.`);
      } else {
        console.log('[Deduplicator] No duplicates found.');
      }
    });

    ctx.registerKeybinding?.('ctrl+shift+u', 'deduplicate', { label: 'Удалить дубликаты' });

    ctx.registerLifecycleHook?.('onSettingsChange', (payload) => {
      if (payload?.moduleId === 'deduplicator') {
        console.log('[Deduplicator] Settings updated.');
      }
    });
  },

  destroy() {
    console.log('[Deduplicator] Destroyed.');
  },
};

export default deduplicatorModule;
