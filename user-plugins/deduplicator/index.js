// user-plugins/deduplicator/index.ts
import { useAppStore } from "plugin-sdk";
var deduplicatorModule = {
  manifest: {
    id: "deduplicator",
    name: "\u0414\u0435\u0434\u0443\u043F\u043B\u0438\u043A\u0430\u0442\u043E\u0440",
    version: "1.0.0",
    description: "\u0423\u0434\u0430\u043B\u044F\u0435\u0442 \u0434\u0443\u0431\u043B\u0438\u0440\u0443\u044E\u0449\u0438\u0435\u0441\u044F \u0444\u0440\u0430\u0437\u044B",
    category: "data",
    dependencies: ["phrases"],
    slot: ["ribbon:tools"],
    settingsSchema: [
      { key: "caseSensitive", type: "boolean", label: "\u0423\u0447\u0438\u0442\u044B\u0432\u0430\u0442\u044C \u0440\u0435\u0433\u0438\u0441\u0442\u0440", default: false }
    ],
    repository: "https://github.com/keycluster/kc-deduplicator",
    minAppVersion: "0.3.0"
  },
  init(ctx) {
    ctx.registerCommand("deduplicate", () => {
      const store = useAppStore.getState();
      const phrases = store.phrases;
      const caseSensitive = ctx.getSetting("caseSensitive") ?? false;
      const seen = /* @__PURE__ */ new Map();
      const duplicateIds = [];
      for (const phrase of phrases) {
        const key = caseSensitive ? phrase.text : phrase.text.toLowerCase();
        if (seen.has(key)) {
          duplicateIds.push(phrase.id);
        } else {
          seen.set(key, phrase.id);
        }
      }
      if (duplicateIds.length > 0) {
        store.deletePhrases(duplicateIds);
        console.log(`[Deduplicator] Removed ${duplicateIds.length} duplicate phrases.`);
      } else {
        console.log("[Deduplicator] No duplicates found.");
      }
    });
    ctx.registerKeybinding?.("ctrl+shift+u", "deduplicate", { label: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0434\u0443\u0431\u043B\u0438\u043A\u0430\u0442\u044B" });
    ctx.registerLifecycleHook?.("onSettingsChange", (payload) => {
      if (payload?.moduleId === "deduplicator") {
        console.log("[Deduplicator] Settings updated.");
      }
    });
  },
  destroy() {
    console.log("[Deduplicator] Destroyed.");
  }
};
var index_default = deduplicatorModule;
export {
  index_default as default
};
