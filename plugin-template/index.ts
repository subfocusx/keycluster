import React from 'react';
import type { AppModule, Group, PhraseActionContext, PluginContext } from 'plugin-sdk';

const yourPlugin: AppModule = {
  manifest: {
    id: 'YOUR_PLUGIN_ID',
    name: 'Название плагина',
    version: '1.0.0',
    description: 'Описание плагина',
    icon: 'extension',
    slot: ['ribbon:tools', 'context-menu:group'],
    settingsSchema: [
      { key: 'enabled', type: 'boolean', label: 'Включен', default: true },
    ],
  },

  init(ctx: PluginContext) {
    // Чтение и запись настроек
    const isEnabled = ctx.getSetting('enabled') as boolean ?? true;
    if (!isEnabled) return;

    ctx.setSetting('limit', 20);

    // Подписка на изменения настроек
    ctx.registerLifecycleHook?.('onSettingsChange', (payload) => {
      if (payload?.moduleId === 'YOUR_PLUGIN_ID') {
        console.log('Settings changed:', payload?.key, payload?.value);
      }
    });

    ctx.registerCommand('my-action', () => {
      console.log('Hello from your plugin!');
    });

    ctx.registerKeybinding?.('Ctrl+Shift+M', 'my-action', { label: 'Моё действие' });

    ctx.registerUI({
      slot: 'ribbon:tools',
      label: 'Мой плагин',
      icon: 'extension',
      // ⚠ Если используешь JSX (<div>...</div>), добавь: import React from 'react'
      component: () => <div>Содержимое плагина</div>,
      order: 100,
    });

    ctx.registerUI({
      slot: 'context-menu:group',
      label: 'Действие плагина',
      icon: 'bolt',
      action: (group: Group, actionCtx: PhraseActionContext) => {
        const phrases = actionCtx.store.getState().phrases.filter(p => p.groupId === group.id);
        actionCtx.eventBus.emit('notify', { message: `${phrases.length} фраз в группе` });
      },
      order: 200,
    });

    ctx.onEvent('phrases:changed', (data) => {
      console.log('Phrases changed:', data);
    });

    ctx.subscribeStore(() => {
      const count = ctx.store.getState().phrases.length;
      console.log(`Фраз в проекте: ${count}`);
    });
  },

  destroy() {
  },
};

export default yourPlugin;
