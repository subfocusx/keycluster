import type { AppModule, PluginContext} from '@/plugin-sdk';
import { useAppStore } from '@/plugin-sdk';
import { DevToolsToggle } from './DevToolsPanel';

export const devtoolsModule: AppModule = {
  manifest: {
    id: 'devtools',
    name: 'DevTools',
    version: '1.0.0',
    description: 'Инструменты разработчика: логи, ошибки, события, модули, инспектор',
    slot: ['status-bar'],
    icon: 'settings_code',
    dependencies: [],
    settingsSchema: [],
  },
  init(ctx: PluginContext) {
    ctx.registerKeybinding('ctrl+shift+d', 'toggle-devtools', { label: 'Открыть DevTools' });

    ctx.registerCommand('toggle-devtools', () => {
      useAppStore.getState().toggleDevtools();
    });

    ctx.registerUI({
      slot: 'status-bar',
      label: 'DevTools',
      component: DevToolsToggle,
      order: 100,
    });
  },
  destroy() {},
};