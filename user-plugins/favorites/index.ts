import type { AppModule, PluginContext } from 'plugin-sdk';

const favoritesModule: AppModule = {
  manifest: {
    id: 'favorites',
    name: 'Избранное',
    version: '1.0.0',
    description: 'Звёздочки для фраз: отмечайте важные фразы и фильтруйте только избранное',
    category: 'data',
    slot: [],
    dependencies: [],
    settingsSchema: [],
    repository: 'https://github.com/keycluster/kc-favorites',
    minAppVersion: '0.3.0',
  },

  init(_ctx: PluginContext) {
  },

  destroy() {},
};

export default favoritesModule;
