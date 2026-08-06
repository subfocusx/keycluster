// user-plugins/dark-theme/index.ts
var darkThemePlugin = {
  manifest: {
    id: "dark-theme",
    name: "\u0422\u0451\u043C\u043D\u0430\u044F \u0442\u0435\u043C\u0430 Pro",
    version: "1.0.0",
    description: "\u041A\u0430\u0441\u0442\u043E\u043C\u043D\u0430\u044F \u0442\u0451\u043C\u043D\u0430\u044F \u0442\u0435\u043C\u0430",
    category: "custom",
    slot: ["theme"]
  },
  init(ctx) {
    ctx.injectCSS("dark-pro", `
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
      { name: "hot", value: "#ff6b6b", displayName: "\u{1F525} \u0413\u043E\u0440\u044F\u0447\u0438\u0439" },
      { name: "cold", value: "#74c0fc", displayName: "\u2744\uFE0F \u0425\u043E\u043B\u043E\u0434\u043D\u044B\u0439" }
    ]);
  },
  destroy() {
  }
};
var index_default = darkThemePlugin;
export {
  index_default as default
};
