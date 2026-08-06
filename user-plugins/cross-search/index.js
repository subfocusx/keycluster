// components.tsx
import { useState } from "react";
import { useAppStore, Button, Badge, useKCDialog } from "plugin-sdk";
import { jsx, jsxs } from "react/jsx-runtime";
function MIcon({ name, className = "" }) {
  return /* @__PURE__ */ jsx("span", { className: `material-symbols-outlined ${className}`, children: name });
}
function CrossSearchPanel(_props) {
  const phrases = useAppStore((s) => s.phrases);
  const groups = useAppStore((s) => s.groups);
  const deletePhrases = useAppStore((s) => s.deletePhrases);
  const kcDialog = useKCDialog();
  const [duplicates, setDuplicates] = useState(null);
  const handleSearch = () => {
    const result = findDuplicates(phrases);
    setDuplicates(result);
  };
  const handleRemoveDuplicates = async (textKey) => {
    const entry = duplicates?.get(textKey);
    if (!entry) return;
    const matching = phrases.filter((p) => p.text.toLowerCase().trim() === textKey);
    if (matching.length <= 1) return;
    const toDelete = matching.slice(1).map((p) => p.id);
    const ok = await kcDialog.confirm(`\u0423\u0434\u0430\u043B\u0438\u0442\u044C ${toDelete.length} \u0434\u0443\u0431\u043B\u0435\u0439?`, { title: "\u0423\u0434\u0430\u043B\u0435\u043D\u0438\u0435 \u0434\u0443\u0431\u043B\u0435\u0439", confirmLabel: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C", variant: "destructive" });
    if (!ok) return;
    deletePhrases(toDelete);
    setDuplicates((prev) => {
      if (!prev) return prev;
      const next = new Map(prev);
      next.delete(textKey);
      return next;
    });
  };
  const getGroupName = (id) => groups.find((g) => g.id === id)?.name ?? "\u2014";
  return /* @__PURE__ */ jsxs("div", { className: "h-full flex flex-col", style: { maxWidth: "100%", width: "100%" }, children: [
    /* @__PURE__ */ jsxs("div", { className: "flex-1 overflow-y-auto compact-scroll p-3 space-y-3", children: [
      /* @__PURE__ */ jsx("p", { className: "text-[12px] text-[var(--kc-text-secondary)]", children: "\u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u0444\u0440\u0430\u0437\u044B, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u0432\u0441\u0442\u0440\u0435\u0447\u0430\u044E\u0442\u0441\u044F \u0432 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u0438\u0445 \u0433\u0440\u0443\u043F\u043F\u0430\u0445 \u043E\u0434\u043D\u043E\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E." }),
      duplicates && duplicates.size > 0 && /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsxs("span", { className: "text-[12px] font-semibold", children: [
          "\u041D\u0430\u0439\u0434\u0435\u043D\u043E \u0434\u0443\u0431\u043B\u0438\u043A\u0430\u0442\u043E\u0432: ",
          duplicates.size
        ] }),
        /* @__PURE__ */ jsx("div", { className: "max-h-[250px] overflow-y-auto compact-scroll space-y-2", children: Array.from(duplicates.entries()).map(([key, entry]) => /* @__PURE__ */ jsxs("div", { className: "border border-[var(--kc-border)] rounded-[3px] p-2 space-y-1", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[12px] font-medium truncate max-w-[200px]", children: entry.text }),
            /* @__PURE__ */ jsxs(Badge, { variant: "secondary", className: "text-[10px]", children: [
              entry.count,
              "x"
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-1", children: Array.from(entry.groupIds).map((gid) => /* @__PURE__ */ jsx(Badge, { variant: "outline", className: "text-[10px]", children: getGroupName(gid) }, gid)) }),
          /* @__PURE__ */ jsx(
            Button,
            {
              variant: "ghost",
              size: "sm",
              className: "h-6 text-[10px]",
              style: { color: "var(--kc-red)" },
              onClick: () => handleRemoveDuplicates(key),
              children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0434\u0443\u0431\u043B\u0438\u043A\u0430\u0442\u044B"
            }
          )
        ] }, key)) })
      ] }),
      duplicates && duplicates.size === 0 && /* @__PURE__ */ jsx("p", { className: "text-[12px] text-[var(--kc-text-secondary)]", children: "\u0414\u0443\u0431\u043B\u0438\u043A\u0430\u0442\u043E\u0432 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E." })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "shrink-0 border-t border-[var(--kc-border-light)] p-3", style: { background: "var(--kc-bg, var(--kc-surface))" }, children: /* @__PURE__ */ jsxs(Button, { onClick: handleSearch, className: "w-full", style: { backgroundColor: "var(--kc-blue)", color: "white" }, children: [
      /* @__PURE__ */ jsx(MIcon, { name: "content_copy", className: "!text-[16px] mr-1" }),
      "\u041D\u0430\u0439\u0442\u0438 \u0434\u0443\u0431\u043B\u0438\u043A\u0430\u0442\u044B"
    ] }) })
  ] });
}

// index.ts
var crossSearchSettings = {
  minGroups: 2
};
var crossSearchModule = {
  manifest: {
    id: "cross-search",
    name: "\u041F\u0435\u0440\u0435\u043A\u0440\u0451\u0441\u0442\u043D\u044B\u0439 \u043F\u043E\u0438\u0441\u043A",
    version: "1.0.0",
    description: "\u041F\u043E\u0438\u0441\u043A \u0434\u0443\u0431\u043B\u0438\u043A\u0430\u0442\u043E\u0432 \u0444\u0440\u0430\u0437 \u043C\u0435\u0436\u0434\u0443 \u0433\u0440\u0443\u043F\u043F\u0430\u043C\u0438",
    category: "analysis",
    dependencies: ["groups", "phrases"],
    slot: ["ribbon:tools", "left-panel"],
    settingsSchema: [
      { key: "minGroups", type: "number", label: "\u041C\u0438\u043D. \u0447\u0438\u0441\u043B\u043E \u0433\u0440\u0443\u043F\u043F \u0434\u043B\u044F \u0434\u0443\u0431\u043B\u0438\u043A\u0430\u0442\u0430", default: 2 }
    ]
  },
  init(ctx) {
    const readSettings = () => {
      crossSearchSettings = {
        minGroups: ctx.getSetting("minGroups") ?? 2
      };
    };
    readSettings();
    ctx.registerLifecycleHook?.("onSettingsChange", (payload) => {
      if (payload?.moduleId === "cross-search") {
        readSettings();
      }
    });
    ctx.registerUI({
      slot: "ribbon:tools",
      label: "\u041F\u0435\u0440\u0435\u043A\u0440\u0451\u0441\u0442\u043D\u044B\u0439",
      component: () => CrossSearchPanel({ ctx }),
      order: 30
    });
  },
  destroy() {
    crossSearchSettings = { minGroups: 2 };
  }
};
var index_default = crossSearchModule;
function findDuplicates(phrases) {
  const byText = /* @__PURE__ */ new Map();
  for (const p of phrases) {
    const key = p.text.toLowerCase().trim();
    if (!byText.has(key)) {
      byText.set(key, { text: p.text, groupIds: /* @__PURE__ */ new Set(), count: 0 });
    }
    const entry = byText.get(key);
    entry.groupIds.add(p.groupId);
    entry.count++;
  }
  const duplicates = /* @__PURE__ */ new Map();
  for (const [key, val] of byText) {
    if (val.groupIds.size >= crossSearchSettings.minGroups) {
      duplicates.set(key, val);
    }
  }
  return duplicates;
}
export {
  crossSearchSettings,
  index_default as default,
  findDuplicates
};
