"use client";

// user-plugins/favorites/index.ts
var favoritesModule = {
  manifest: {
    id: "favorites",
    name: "\u0418\u0437\u0431\u0440\u0430\u043D\u043D\u043E\u0435",
    version: "1.0.0",
    description: "\u0417\u0432\u0451\u0437\u0434\u043E\u0447\u043A\u0438 \u0434\u043B\u044F \u0444\u0440\u0430\u0437: \u043E\u0442\u043C\u0435\u0447\u0430\u0439\u0442\u0435 \u0432\u0430\u0436\u043D\u044B\u0435 \u0444\u0440\u0430\u0437\u044B \u0438 \u0444\u0438\u043B\u044C\u0442\u0440\u0443\u0439\u0442\u0435 \u0442\u043E\u043B\u044C\u043A\u043E \u0438\u0437\u0431\u0440\u0430\u043D\u043D\u043E\u0435",
    category: "data",
    slot: [],
    repository: "https://github.com/keycluster/kc-favorites",
    minAppVersion: "0.3.0"
  },
  init() {
  },
  destroy() {
  }
};
var index_default = favoritesModule;
export {
  index_default as default
};
