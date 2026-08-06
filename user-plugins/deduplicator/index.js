// index.ts
import { useAppStore as useAppStore2 } from "plugin-sdk";

// components.tsx
import { useState, useCallback } from "react";
import { useAppStore, Button, Label, Checkbox, useKCDialog } from "plugin-sdk";
import { jsx, jsxs } from "react/jsx-runtime";
function DeduplicatorPanel({ ctx }) {
  const [caseSensitive, setCaseSensitive] = useState(() => ctx.getSetting("caseSensitive") ?? false);
  const [withinGroup, setWithinGroup] = useState(() => ctx.getSetting("withinGroup") ?? true);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const phrases = useAppStore((s) => s.phrases);
  const deletePhrases = useAppStore((s) => s.deletePhrases);
  const kcDialog = useKCDialog();
  const run = useCallback(() => {
    setRunning(true);
    setResult(null);
    setTimeout(async () => {
      const duplicateIds = deduplicate(phrases, { caseSensitive, withinGroup });
      let removed = 0;
      if (duplicateIds.length > 0) {
        const ok = await kcDialog.confirm(`\u0423\u0434\u0430\u043B\u0438\u0442\u044C ${duplicateIds.length} \u0434\u0443\u0431\u043B\u0435\u0439?`, { title: "\u0414\u0435\u0434\u0443\u043F\u043B\u0438\u043A\u0430\u0446\u0438\u044F", confirmLabel: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C", variant: "destructive" });
        if (ok) {
          deletePhrases(duplicateIds);
          removed = duplicateIds.length;
        }
      }
      setResult({ removed, total: phrases.length });
      setRunning(false);
    }, 50);
  }, [caseSensitive, withinGroup, phrases, deletePhrases, kcDialog]);
  return /* @__PURE__ */ jsxs("div", { className: "p-4 space-y-4", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ jsx(
        Checkbox,
        {
          id: "dedup-case",
          checked: caseSensitive,
          onCheckedChange: (v) => setCaseSensitive(!!v)
        }
      ),
      /* @__PURE__ */ jsx(Label, { htmlFor: "dedup-case", children: "\u0423\u0447\u0438\u0442\u044B\u0432\u0430\u0442\u044C \u0440\u0435\u0433\u0438\u0441\u0442\u0440" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ jsx(
        Checkbox,
        {
          id: "dedup-within-group",
          checked: withinGroup,
          onCheckedChange: (v) => setWithinGroup(!!v)
        }
      ),
      /* @__PURE__ */ jsx(Label, { htmlFor: "dedup-within-group", children: "\u0414\u0435\u0434\u0443\u043F\u043B\u0438\u043A\u0430\u0446\u0438\u044F \u0432 \u043F\u0440\u0435\u0434\u0435\u043B\u0430\u0445 \u0433\u0440\u0443\u043F\u043F\u044B" })
    ] }),
    /* @__PURE__ */ jsx(Button, { onClick: run, disabled: running || phrases.length === 0, children: running ? "\u041F\u043E\u0438\u0441\u043A..." : "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0434\u0443\u0431\u043B\u0438\u043A\u0430\u0442\u044B" }),
    phrases.length === 0 && /* @__PURE__ */ jsx("p", { className: "text-sm text-[var(--text-secondary)]", children: "\u041D\u0435\u0442 \u0444\u0440\u0430\u0437 \u0434\u043B\u044F \u0434\u0435\u0434\u0443\u043F\u043B\u0438\u043A\u0430\u0446\u0438\u0438." }),
    result && /* @__PURE__ */ jsx("div", { className: "text-sm text-[var(--text-secondary)]", children: result.removed > 0 ? `\u0423\u0434\u0430\u043B\u0435\u043D\u043E \u0434\u0443\u0431\u043B\u0435\u0439: ${result.removed} \u0438\u0437 ${result.total} \u0444\u0440\u0430\u0437` : "\u0414\u0443\u0431\u043B\u0438\u043A\u0430\u0442\u044B \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B" })
  ] });
}

// index.ts
function deduplicate(phrases, options) {
  const { caseSensitive, withinGroup } = options;
  const seen = /* @__PURE__ */ new Map();
  const duplicateIds = [];
  if (withinGroup) {
    const groupSeen = /* @__PURE__ */ new Map();
    for (const phrase of phrases) {
      const key = caseSensitive ? phrase.text : phrase.text.toLowerCase();
      if (!groupSeen.has(phrase.groupId)) {
        groupSeen.set(phrase.groupId, /* @__PURE__ */ new Map());
      }
      const groupMap = groupSeen.get(phrase.groupId);
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
var deduplicatorModule = {
  manifest: {
    id: "deduplicator",
    name: "\u0414\u0435\u0434\u0443\u043F\u043B\u0438\u043A\u0430\u0442\u043E\u0440",
    version: "1.0.0",
    description: "\u0423\u0434\u0430\u043B\u044F\u0435\u0442 \u0434\u0443\u0431\u043B\u0438\u0440\u0443\u044E\u0449\u0438\u0435\u0441\u044F \u0444\u0440\u0430\u0437\u044B",
    category: "data",
    dependencies: ["phrases"],
    slot: ["ribbon:tools"],
    icon: "auto_fix_high",
    settingsSchema: [
      { key: "caseSensitive", type: "boolean", label: "\u0423\u0447\u0438\u0442\u044B\u0432\u0430\u0442\u044C \u0440\u0435\u0433\u0438\u0441\u0442\u0440", default: false },
      { key: "withinGroup", type: "boolean", label: "\u0414\u0435\u0434\u0443\u043F\u043B\u0438\u043A\u0430\u0446\u0438\u044F \u0432 \u043F\u0440\u0435\u0434\u0435\u043B\u0430\u0445 \u0433\u0440\u0443\u043F\u043F\u044B", default: true }
    ],
    repository: "https://github.com/keycluster/kc-deduplicator",
    minAppVersion: "0.3.0"
  },
  init(ctx) {
    ctx.registerUI({
      slot: "ribbon:tools",
      label: "\u0414\u0435\u0434\u0443\u043F\u043B\u0438\u043A\u0430\u0442\u043E\u0440",
      icon: "auto_fix_high",
      component: () => DeduplicatorPanel({ ctx }),
      order: 35
    });
    ctx.registerCommand("deduplicate", () => {
      const store = useAppStore2.getState();
      const phrases = store.phrases;
      const caseSensitive = ctx.getSetting("caseSensitive") ?? false;
      const withinGroup = ctx.getSetting("withinGroup") ?? true;
      const duplicateIds = deduplicate(phrases, { caseSensitive, withinGroup });
      if (duplicateIds.length > 0) {
        ctx.store.dispatch("deletePhrases", duplicateIds);
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
  deduplicate,
  index_default as default
};
