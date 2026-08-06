import type { AppModule, PluginContext } from 'plugin-sdk';

const darkThemePlugin: AppModule = {
  manifest: {
    id: 'dark-theme',
    name: 'Тёмная тема Pro',
    version: '1.0.0',
    description: 'Кастомная тёмная тема',
    category: 'custom',
    slot: ['theme'],
    dependencies: [],
    settingsSchema: [],
  },

  init(ctx: PluginContext) {
    ctx.injectCSS('dark-pro', `
      [data-theme="dark-pro"] {
        --bg-base: #0d1117;
        --bg-surface: #161b22;
        --bg-panel: #21262d;
        --accent-blue: #58a6ff;
        --border: #30363d;
        --text-primary: #e6edf3;
        --text-secondary: #8b949e;
      }
    `);

    ctx.registerLabels([
      { name: 'hot', value: '#ff6b6b', displayName: '🔥 Горячий' },
      { name: 'cold', value: '#74c0fc', displayName: '❄️ Холодный' },
    ]);
  },

  destroy() {},
};

export default darkThemePlugin;
