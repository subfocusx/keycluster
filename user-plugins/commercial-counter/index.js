"use client";

// user-plugins/commercial-counter/components/CommercialCounterPanel.tsx
import { useMemo } from "react";
import { useAppStore } from "plugin-sdk";
import { jsx, jsxs } from "react/jsx-runtime";
var COMMERCIAL_WORDS = [
  "\u0437\u0430\u043A\u0430\u0437\u0430\u0442\u044C",
  "\u0446\u0435\u043D\u0430",
  "\u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C",
  "\u0441\u043A\u0438\u0434\u043A\u0430",
  "\u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0430",
  "\u0434\u0435\u0448\u0435\u0432\u043E",
  "\u0430\u043A\u0446\u0438\u044F",
  "\u0440\u0430\u0441\u043F\u0440\u043E\u0434\u0430\u0436\u0430",
  "\u043A\u0440\u0435\u0434\u0438\u0442",
  "\u0440\u0430\u0441\u0441\u0440\u043E\u0447\u043A\u0430",
  "\u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u043E",
  "\u043F\u043E\u0434\u0430\u0440\u043E\u043A",
  "\u043F\u0440\u043E\u043C\u043E\u043A\u043E\u0434"
];
function CommercialCounterPanel({ groupId }) {
  const phrases = useAppStore((s) => s.phrases);
  const count = useMemo(() => {
    const groupPhrases = phrases.filter((p) => p.groupId === groupId);
    let total = 0;
    const wordMatches = {};
    for (const phrase of groupPhrases) {
      const lower = phrase.text.toLowerCase();
      for (const word of COMMERCIAL_WORDS) {
        if (lower.includes(word)) {
          total++;
          wordMatches[word] = (wordMatches[word] ?? 0) + 1;
        }
      }
    }
    return { total, wordMatches, totalPhrases: groupPhrases.length };
  }, [phrases, groupId]);
  if (count.total === 0) return null;
  return /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1 px-2 py-1 rounded bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/30 text-[11px]", children: [
    /* @__PURE__ */ jsx("span", { className: "material-symbols-outlined !text-[14px] text-yellow-600 dark:text-yellow-400", children: "sell" }),
    /* @__PURE__ */ jsx("span", { className: "font-medium text-yellow-700 dark:text-yellow-300", children: count.total }),
    /* @__PURE__ */ jsx("span", { className: "text-yellow-600 dark:text-yellow-400", children: "\u043A\u043E\u043C\u043C\u0435\u0440\u0447." }),
    count.total > 0 && /* @__PURE__ */ jsxs("span", { className: "text-[10px] text-yellow-500 dark:text-yellow-500 ml-1", children: [
      "(",
      count.totalPhrases,
      " \u0444\u0440\u0430\u0437)"
    ] })
  ] });
}
var CommercialCounterPanel_default = CommercialCounterPanel;

// user-plugins/commercial-counter/index.ts
var commercialCounterModule = {
  manifest: {
    id: "commercial-counter",
    name: "\u0421\u0447\u0451\u0442\u0447\u0438\u043A \u043A\u043E\u043C\u043C\u0435\u0440\u0447\u0435\u0441\u043A\u0438\u0445 \u0441\u043B\u043E\u0432",
    version: "1.0.0",
    description: "\u041F\u043E\u0434\u0441\u0447\u0438\u0442\u044B\u0432\u0430\u0435\u0442 \u043A\u043E\u043C\u043C\u0435\u0440\u0447\u0435\u0441\u043A\u0438\u0435 \u0441\u043B\u043E\u0432\u0430 \u0432 \u0433\u0440\u0443\u043F\u043F\u0430\u0445",
    category: "analysis",
    slot: ["group:toolbar"],
    repository: "https://github.com/keycluster/kc-commercial-counter",
    minAppVersion: "0.3.0"
  },
  init(ctx) {
    ctx.registerUI({
      slot: "group:toolbar",
      label: "\u0421\u0447\u0451\u0442\u0447\u0438\u043A",
      component: CommercialCounterPanel_default,
      order: 100
    });
  },
  destroy() {
  }
};
var index_default = commercialCounterModule;
export {
  commercialCounterModule,
  index_default as default
};
