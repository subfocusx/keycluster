// ============================================================
// Module: Groups — hierarchical group tree management
// ============================================================

import type { AppModule, PluginContext, KCID } from '@/plugin-sdk';
import { kcPrompt } from '@/components/KCDialog';
import { useAppStore } from '@/plugin-sdk';
import { AppEvents } from '@/plugin-sdk';
import { GroupsRibbonButtons } from './GroupsRibbonButtons';
import { GroupsPanel } from './GroupsPanel';

/** Module-level settings state */
export let groupsSettings = { defaultExpanded: true };

export const groupsModule: AppModule = {
  manifest: {
    id: 'groups',
    name: 'Управление группами',
    version: '1.0.0',
    description: 'Иерархическое дерево групп, создание, удаление, перемещение',
    slot: ['ribbon:file', 'context-menu:group'],
    dependencies: [],
    settingsSchema: [
      { key: 'defaultExpanded', type: 'boolean', label: 'Раскрывать группы по умолчанию', default: true },
    ],
  },

  init(ctx: PluginContext) {
    // Read initial settings
    const readSettings = () => {
      groupsSettings = {
        defaultExpanded: ctx.getSetting('defaultExpanded') as boolean ?? true,
      };
    };
    readSettings();

    // Subscribe to settings changes
    ctx.registerLifecycleHook?.('onSettingsChange', (payload) => {
      if (payload?.moduleId === 'groups') {
        readSettings();
      }
    });

    // Register UI contributions
    ctx.registerUI({
      slot: 'ribbon:file',
      label: 'Новая группа',
      component: () => GroupsRibbonButtons({ ctx }),
      order: 10,
    });

    // Register commands
    ctx.registerCommand('create-group', async () => {
      const name = await kcPrompt('Название группы:', { title: 'Создать группу', placeholder: 'Название...' });
      if (name) {
        ctx.store.dispatch('addGroup', { name, parentId: null });
        ctx.eventBus.emit(AppEvents.GROUPS_CHANGED);
      }
    });

    ctx.registerCommand('create-subgroup', async () => {
      const activeGroupId = ctx.store.getStateSlice('activeGroupId');
      if (!activeGroupId) return;
      const name = await kcPrompt('Название подгруппы:', { title: 'Создать подгруппу', placeholder: 'Название...' });
      if (name) {
        ctx.store.dispatch('addGroup', { name, parentId: activeGroupId });
        ctx.eventBus.emit(AppEvents.GROUPS_CHANGED);
      }
    });

    // Register keybindings
    ctx.registerKeybinding?.('f5', 'refresh-data', { label: 'Обновить данные' });
    ctx.registerKeybinding?.('f9', 'open-minus-words', { label: 'Минус-слова' });
    ctx.registerKeybinding?.('f3', 'toggle-multigroup', { label: 'Мультигрупповой режим' });

    // Register commands for keybindings
    ctx.registerCommand('refresh-data', () => {
      // Trigger data refresh via phrases-changed event
      ctx.eventBus.emit(AppEvents.PHRASES_CHANGED);
    });

    ctx.registerCommand('open-minus-words', () => {
      // Emit event — shell listens and opens the tool modal
      ctx.eventBus.emit(AppEvents.TOOL_OPEN, { toolId: 'minus-words' });
    });

    ctx.registerCommand('toggle-multigroup', () => {
      const s = useAppStore.getState();
      if (s.ui.multigroupMode) {
        ctx.store.dispatch('setMultigroupMode', false);
        ctx.eventBus.emit(AppEvents.MULTIGROUP_EXIT);
      } else {
        const activeCountsAsSelected = s.activeGroupId && !s.selectedGroupIds.has(s.activeGroupId) ? 1 : 0;
        const effectiveCount = s.selectedGroupIds.size + activeCountsAsSelected;
        if (effectiveCount >= 2) {
          ctx.store.dispatch('setMultigroupMode', true);
          ctx.eventBus.emit(AppEvents.MULTIGROUP_ENTER);
        }
      }
    });
  },

  destroy() {
    groupsSettings = { defaultExpanded: true };
  },
};