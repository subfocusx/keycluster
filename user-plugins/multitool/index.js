var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// lib/react-shim.ts
var React = globalThis.React;
var react_shim_default = React;
var {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  createElement,
  Fragment
} = React;

// lib/sdk-shim.ts
var _ctx = null;
function __setCtx(ctx) {
  _ctx = ctx;
}
function useAppStoreHook(selector) {
  const store = _ctx?.store;
  const selectorRef = react_shim_default.useRef(selector);
  selectorRef.current = selector;
  const [value, setValue] = react_shim_default.useState(() => {
    if (!store) return {};
    const state = store.getState();
    return selector ? selector(state) : state;
  });
  react_shim_default.useEffect(() => {
    if (!store) return;
    const notify = (state) => {
      const next = selectorRef.current ? selectorRef.current(state) : state;
      setValue(next);
    };
    notify(store.getState());
    const unsub = store.subscribe(notify);
    return typeof unsub === "function" ? unsub : void 0;
  }, [store]);
  return value;
}
function useAppStore(selector) {
  return useAppStoreHook(selector);
}
useAppStore.getState = () => _ctx?.store?.getState?.() ?? {};
function dispatch(action, payload) {
  const store = _ctx?.store;
  if (!store?.dispatch) return;
  if (action === "addPhrases") {
    return dispatchAddPhrases(payload);
  }
  try {
    store.dispatch(action, payload);
  } catch (e) {
    console.error("[seo-multitool] dispatch ERROR:", action, e.message);
  }
}
function dispatchAddPhrases(payload) {
  const store = _ctx?.store;
  if (typeof store?.dispatch !== "function") return;
  let groupId;
  let texts;
  if (Array.isArray(payload)) {
    groupId = payload[0]?.groupId ?? "";
    texts = payload.map((p) => typeof p === "string" ? p : p.text ?? "");
  } else {
    groupId = payload?.groupId ?? "";
    const raw = payload?.texts ?? payload?.phrases ?? [];
    texts = raw.map((p) => typeof p === "string" ? p : p.text ?? "");
  }
  if (!texts.length) return;
  store.dispatch("addPhrases", { groupId, texts });
}
function toast(msg) {
  if (_ctx?.eventBus?.emit) {
    _ctx.eventBus.emit("notify", { message: msg, duration: 3e3 });
  }
}
function getSetting(key) {
  return _ctx?.getSetting?.(key);
}
function setSetting(key, value) {
  _ctx?.setSetting?.(key, value);
}
var handlerRefs = {
  deduplicate: () => {
  },
  cleanChars: () => {
  },
  trim: () => {
  },
  lowercase: () => {
  },
  removeEmpty: () => {
  }
};
var _pluginSettings = {
  syncWithSelection: false,
  showStats: true,
  historySize: 10,
  defaultFilterMode: "copy"
};
var _settingsListeners = [];
function __updatePluginSettings(s) {
  _pluginSettings = { ..._pluginSettings, ...s };
  _settingsListeners.forEach((fn) => fn());
}
function getPluginSettings() {
  return _pluginSettings;
}
var _pendingSync = null;
function __setPendingSync(ids) {
  _pendingSync = ids;
}
function __consumePendingSync() {
  const v = _pendingSync;
  _pendingSync = null;
  return v;
}

// lib/filters.ts
var FilterRegistry = class {
  constructor() {
    __publicField(this, "filters", /* @__PURE__ */ new Map());
  }
  register(filter) {
    this.filters.set(filter.id, filter);
  }
  getAll() {
    return Array.from(this.filters.values());
  }
  get(id) {
    return this.filters.get(id);
  }
};
var filterRegistry = new FilterRegistry();
filterRegistry.register({
  id: "more-than-6",
  name: "\u041A\u043B\u044E\u0447\u0438 > 6 \u0441\u043B\u043E\u0432",
  check: (t) => t.split(/\s+/).filter(Boolean).length > 6
});
filterRegistry.register({
  id: "more-than-7",
  name: "\u041A\u043B\u044E\u0447\u0438 > 7 \u0441\u043B\u043E\u0432",
  check: (t) => t.split(/\s+/).filter(Boolean).length > 7
});
filterRegistry.register({
  id: "more-than-8",
  name: "\u041A\u043B\u044E\u0447\u0438 > 8 \u0441\u043B\u043E\u0432",
  check: (t) => t.split(/\s+/).filter(Boolean).length > 8
});
filterRegistry.register({
  id: "contains-number",
  name: "\u0421\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0447\u0438\u0441\u043B\u043E",
  check: (t) => /\d/.test(t)
});
filterRegistry.register({
  id: "questions",
  name: "\u0412\u043E\u043F\u0440\u043E\u0441\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u0437\u0430\u043F\u0440\u043E\u0441\u044B",
  check: (t) => {
    const lower = t.toLowerCase();
    const questionWords = [
      "\u043A\u0430\u043A",
      "\u0447\u0442\u043E",
      "\u0433\u0434\u0435",
      "\u043A\u043E\u0433\u0434\u0430",
      "\u043F\u043E\u0447\u0435\u043C\u0443",
      "\u0437\u0430\u0447\u0435\u043C",
      "\u043A\u0430\u043A\u043E\u0439",
      "\u043A\u0430\u043A\u0430\u044F",
      "\u043A\u0430\u043A\u0438\u0435",
      "\u0441\u043A\u043E\u043B\u044C\u043A\u043E"
    ];
    return questionWords.some((w) => lower.includes(w)) || t.includes("?");
  }
});
filterRegistry.register({
  id: "intent-transactional",
  name: "\u0422\u0440\u0430\u043D\u0437\u0430\u043A\u0446\u0438\u043E\u043D\u043D\u044B\u0435",
  check: (_t, p) => p?.intent === "transactional"
});
filterRegistry.register({
  id: "intent-commercial",
  name: "\u041A\u043E\u043C\u043C\u0435\u0440\u0447\u0435\u0441\u043A\u0438\u0435",
  check: (_t, p) => p?.intent === "commercial"
});
filterRegistry.register({
  id: "intent-informational",
  name: "\u0418\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0435",
  check: (_t, p) => p?.intent === "informational"
});
filterRegistry.register({
  id: "intent-navigational",
  name: "\u041D\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0435",
  check: (_t, p) => p?.intent === "navigational"
});
function createLengthMoreFilter(n) {
  return {
    id: `length-more-${n}`,
    name: `\u0414\u043B\u0438\u043D\u0430 > ${n} \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432`,
    check: (t) => t.length > n
  };
}
function createLengthLessFilter(n) {
  return {
    id: `length-less-${n}`,
    name: `\u0414\u043B\u0438\u043D\u0430 < ${n} \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432`,
    check: (t) => t.length < n
  };
}
function createFrequencyMoreFilter(n) {
  return {
    id: `frequency-more-${n}`,
    name: `\u0427\u0430\u0441\u0442\u043E\u0442\u0430 > ${n}`,
    check: (_t, p) => (p?.frequency ?? 0) > n
  };
}
function createSubstringFilter(query) {
  const q = query.toLowerCase();
  return {
    id: `substring-${q}`,
    name: `\u041F\u043E\u0438\u0441\u043A "${query}"`,
    check: (t) => t.toLowerCase().includes(q)
  };
}
function removeSpecialChars(text) {
  return text.replace(/[!@#$%^&*()\[\]{}<>|\\]/g, "").replace(/\s{2,}/g, " ").trim();
}
function batchDeduplicateInState(state, groupId) {
  const phrases = state.phrases?.filter((p) => p.groupId === groupId) ?? [];
  const seen = /* @__PURE__ */ new Set();
  let removed = 0;
  for (const p of phrases) {
    const key = (p.text ?? "").trim().toLowerCase();
    if (!key || seen.has(key)) {
      const idx = state.phrases.indexOf(p);
      if (idx !== -1) {
        state.phrases.splice(idx, 1);
        removed++;
      }
    } else {
      seen.add(key);
    }
  }
  return removed;
}
function batchRemoveEmptyInState(state, groupId) {
  const toRemove = (state.phrases ?? []).filter(
    (p) => p.groupId === groupId && (p.text == null || p.text.trim().length === 0)
  );
  for (const p of toRemove) {
    const idx = state.phrases.indexOf(p);
    if (idx !== -1) state.phrases.splice(idx, 1);
  }
  return toRemove.length;
}
function batchCleanCharsInState(state, groupId) {
  const phrases = state.phrases?.filter((p) => p.groupId === groupId) ?? [];
  let count = 0;
  for (const p of phrases) {
    const cleaned = removeSpecialChars(p.text ?? "");
    if (cleaned !== p.text) {
      if (!cleaned) {
        const idx = state.phrases.indexOf(p);
        if (idx !== -1) state.phrases.splice(idx, 1);
      } else {
        p.text = cleaned;
      }
      count++;
    }
  }
  return count;
}

// components/SeoMultitoolPanel.tsx
var DEFAULT_SECTION_ORDER = [
  "cleanup",
  "wordFilters",
  "lengthFilters",
  "intentFilters",
  "frequencyFilter",
  "substringFilter",
  "stats",
  "history"
];
function SeoMultitoolPanel(props) {
  const groups = useAppStore((s) => s.groups ?? []);
  const allPhrases = useAppStore((s) => s.phrases ?? []);
  const appSelectedGroupIds = useAppStore(
    (s) => Array.from(s.selectedGroupIds ?? [])
  );
  const savedSettings = useMemo(() => getSetting("panelState"), []);
  const [filterMode, setFilterMode] = useState(
    savedSettings?.filterMode ?? "copy"
  );
  const [selectedGroupId, setSelectedGroupId] = useState(
    savedSettings?.selectedGroupId ?? props.groupId ?? ""
  );
  const [sections, setSections] = useState(
    savedSettings?.openSections ?? {
      cleanup: true,
      wordFilters: true,
      lengthFilters: true,
      intentFilters: true,
      frequencyFilter: true,
      substringFilter: true,
      stats: false,
      history: false
    }
  );
  const [sectionOrder, setSectionOrder] = useState(
    savedSettings?.sectionOrder ?? DEFAULT_SECTION_ORDER
  );
  const [multiMode, setMultiMode] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [progress, setProgress] = useState(null);
  const [historyLog, setHistoryLog] = useState([]);
  const [lengthN, setLengthN] = useState("");
  const [frequencyN, setFrequencyN] = useState("");
  const [substringQuery, setSubstringQuery] = useState("");
  const saveTimerRef = useRef(null);
  const saveSettings = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSetting("panelState", {
        filterMode,
        selectedGroupId,
        openSections: sections,
        sectionOrder
      });
    }, 500);
  }, [filterMode, selectedGroupId, sections, sectionOrder]);
  useEffect(() => {
    saveSettings();
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [filterMode, selectedGroupId, sections, sectionOrder]);
  useEffect(() => {
    if (props.groupId && props.groupId !== selectedGroupId && !multiMode) {
      setSelectedGroupId(props.groupId);
    }
  }, [props.groupId, selectedGroupId, multiMode]);
  const handleUseAppSelection = useCallback(() => {
    setSelectedGroupIds(appSelectedGroupIds);
    setMultiMode(true);
  }, [appSelectedGroupIds]);
  const isMultiGroup = multiMode && selectedGroupIds.length > 0;
  const activePhrases = useMemo(() => {
    if (isMultiGroup) {
      return allPhrases?.filter((p) => selectedGroupIds.includes(p.groupId)) ?? [];
    }
    return allPhrases?.filter((p) => p.groupId === selectedGroupId) ?? [];
  }, [allPhrases, selectedGroupId, selectedGroupIds, isMultiGroup]);
  const activeGroups = useMemo(() => {
    if (isMultiGroup) {
      return groups?.filter((g2) => selectedGroupIds.includes(g2.id)) ?? [];
    }
    const g = groups?.find((g2) => g2.id === selectedGroupId);
    return g ? [g] : [];
  }, [groups, selectedGroupId, selectedGroupIds, isMultiGroup]);
  const selectedGroup = useMemo(
    () => groups?.find((g) => g.id === selectedGroupId) ?? null,
    [groups, selectedGroupId]
  );
  const groupPhraseCount = isMultiGroup ? activePhrases.length : activePhrases.length;
  const notify = useCallback((msg) => {
    try {
      toast(msg);
    } catch {
    }
  }, []);
  const addHistory = useCallback((msg) => {
    const now = /* @__PURE__ */ new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setHistoryLog((prev) => [{ time, msg }, ...prev].slice(0, historySize));
  }, []);
  const pluginSettings = useMemo(() => getPluginSettings(), []);
  const historySize = pluginSettings.historySize ?? 10;
  const showStats = pluginSettings.showStats ?? true;
  const defaultFilterModeSetting = pluginSettings.defaultFilterMode ?? "copy";
  useEffect(() => {
    const interval = setInterval(() => {
      const ids = __consumePendingSync();
      if (ids && ids.length > 0 && getSetting("syncWithSelection")) {
        setSelectedGroupIds(ids);
        setMultiMode(true);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);
  const filterPreviews = useMemo(() => {
    const result = {};
    filterRegistry.getAll().forEach((f) => {
      result[f.id] = activePhrases.filter((p) => f.check(p.text, p)).length;
    });
    return result;
  }, [activePhrases]);
  const totalPhrases = activePhrases.length;
  const runBatchOperation = useCallback((targetPhrases, mutator, successMsg, noopMsg) => {
    if (targetPhrases.length === 0) {
      notify("\u041D\u0435\u0442 \u0444\u0440\u0430\u0437 \u0434\u043B\u044F \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438");
      return;
    }
    const showProgress = targetPhrases.length > 100;
    if (showProgress) setProgress({ current: 0, total: targetPhrases.length });
    const schedule = () => {
      let count = 0;
      dispatch("batchOperation", (state) => {
        for (const p of targetPhrases) {
          const sp = state.phrases.find((sp2) => sp2.id === p.id);
          if (sp && mutator(state, sp)) count++;
        }
      });
      dispatch("pushUndo");
      setProgress(null);
      if (count > 0) {
        addHistory(successMsg(count));
        notify(successMsg(count));
      } else {
        notify(noopMsg ?? "\u041D\u0435\u0442 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0439");
      }
    };
    if (showProgress) {
      setTimeout(schedule, 10);
    } else {
      schedule();
    }
  }, [notify, addHistory]);
  const handleTrim = useCallback(() => {
    runBatchOperation(
      activePhrases,
      (_state, sp) => {
        const trimmed = sp.text.trim();
        if (trimmed !== sp.text) {
          sp.text = trimmed;
          return true;
        }
        return false;
      },
      (count) => `\u041E\u0431\u0440\u0435\u0437\u0430\u043D\u043E \u043F\u0440\u043E\u0431\u0435\u043B\u043E\u0432: ${count} \u0444\u0440\u0430\u0437`
    );
  }, [activePhrases, runBatchOperation]);
  const handleLowercase = useCallback(() => {
    runBatchOperation(
      activePhrases,
      (_state, sp) => {
        const lowered = sp.text.toLowerCase();
        if (lowered !== sp.text) {
          sp.text = lowered;
          return true;
        }
        return false;
      },
      (count) => `\u041F\u0435\u0440\u0435\u0432\u0435\u0434\u0435\u043D\u043E \u0432 \u043D\u0438\u0436\u043D\u0438\u0439 \u0440\u0435\u0433\u0438\u0441\u0442\u0440: ${count} \u0444\u0440\u0430\u0437`
    );
  }, [activePhrases, runBatchOperation]);
  const handleCleanChars = useCallback(() => {
    runBatchOperation(
      activePhrases,
      (_state, sp) => {
        const cleaned = removeSpecialChars(sp.text);
        if (cleaned !== sp.text) {
          sp.text = cleaned;
          return true;
        }
        return false;
      },
      (count) => `\u0421\u043F\u0435\u0446\u0441\u0438\u043C\u0432\u043E\u043B\u044B \u0443\u0434\u0430\u043B\u0435\u043D\u044B: ${count} \u0444\u0440\u0430\u0437`
    );
  }, [activePhrases, runBatchOperation]);
  const handleDeduplicate = useCallback(() => {
    if (!selectedGroup && !isMultiGroup) return;
    const seen = /* @__PURE__ */ new Set();
    const toRemove = [];
    activePhrases.forEach((p) => {
      const key = (p.text ?? "").trim().toLowerCase();
      if (seen.has(key)) toRemove.push(p.id);
      else seen.add(key);
    });
    if (toRemove.length > 0) {
      dispatch("moveToTrash", toRemove);
    }
    const msg = `\u0423\u0434\u0430\u043B\u0435\u043D\u043E \u0434\u0443\u0431\u043B\u0435\u0439: ${toRemove.length}`;
    addHistory(msg);
    notify(msg);
  }, [activePhrases, selectedGroup, isMultiGroup, notify, addHistory]);
  const handleRemoveEmpty = useCallback(() => {
    if (!selectedGroup && !isMultiGroup) return;
    const toRemove = activePhrases.filter((p) => p.text == null || p.text.trim().length === 0).map((p) => p.id);
    if (toRemove.length > 0) {
      dispatch("moveToTrash", toRemove);
    }
    const msg = `\u0423\u0434\u0430\u043B\u0435\u043D\u043E \u043F\u0443\u0441\u0442\u044B\u0445: ${toRemove.length}`;
    addHistory(msg);
    notify(msg);
  }, [activePhrases, selectedGroup, isMultiGroup, notify, addHistory]);
  const handleFilter = useCallback((filterId) => {
    if (!selectedGroup && !isMultiGroup) return;
    const filter = filterRegistry.get(filterId);
    if (!filter) return;
    const matched = activePhrases.filter((p) => filter.check(p.text, p));
    if (!matched.length) {
      notify("\u041D\u0435\u0442 \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0439");
      return;
    }
    const groupName = isMultiGroup ? `\u041E\u0431\u044A\u0435\u0434\u0438\u043D\u0451\u043D\u043D\u0430\u044F \u0433\u0440\u0443\u043F\u043F\u0430 \u2192 ${filter.name}` : `${selectedGroup.name} \u2192 ${filter.name}`;
    const existingIds = new Set(
      useAppStore.getState().groups?.map((g) => g.id) ?? []
    );
    dispatch("addGroup", { name: groupName, parentId: null });
    const updatedGroups = useAppStore.getState().groups ?? [];
    const newGroup = updatedGroups.find((g) => !existingIds.has(g.id));
    if (!newGroup) {
      notify("\u041E\u0448\u0438\u0431\u043A\u0430: \u0433\u0440\u0443\u043F\u043F\u0430 \u043D\u0435 \u0441\u043E\u0437\u0434\u0430\u043D\u0430");
      return;
    }
    if (filterMode === "move") {
      dispatch("movePhrases", {
        ids: matched.map((p) => p.id),
        targetGroupId: newGroup.id
      });
    } else {
      dispatch("addPhrases", {
        groupId: newGroup.id,
        texts: matched.map((p) => p.text)
      });
    }
    const msg = `\u041D\u0430\u0439\u0434\u0435\u043D\u043E: ${matched.length}`;
    addHistory(`${groupName}: ${msg}`);
    notify(msg);
  }, [activePhrases, selectedGroup, isMultiGroup, filterMode, notify, addHistory]);
  const handleLengthFilter = useCallback((type) => {
    if (!selectedGroup && !isMultiGroup) return;
    if (!lengthN) return;
    const n = parseInt(lengthN, 10);
    if (isNaN(n) || n < 1) {
      notify("\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E\u0435 \u0447\u0438\u0441\u043B\u043E");
      return;
    }
    const filter = type === "more" ? createLengthMoreFilter(n) : createLengthLessFilter(n);
    const matched = activePhrases.filter((p) => filter.check(p.text, p));
    if (!matched.length) {
      notify("\u041D\u0435\u0442 \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0439");
      return;
    }
    const groupName = isMultiGroup ? `\u041E\u0431\u044A\u0435\u0434\u0438\u043D\u0451\u043D\u043D\u0430\u044F \u0433\u0440\u0443\u043F\u043F\u0430 \u2192 ${filter.name}` : `${selectedGroup.name} \u2192 ${filter.name}`;
    const existingIds = new Set(
      useAppStore.getState().groups?.map((g) => g.id) ?? []
    );
    dispatch("addGroup", { name: groupName, parentId: null });
    const updatedGroups = useAppStore.getState().groups ?? [];
    const newGroup = updatedGroups.find((g) => !existingIds.has(g.id));
    if (!newGroup) {
      notify("\u041E\u0448\u0438\u0431\u043A\u0430: \u0433\u0440\u0443\u043F\u043F\u0430 \u043D\u0435 \u0441\u043E\u0437\u0434\u0430\u043D\u0430");
      return;
    }
    if (filterMode === "move") {
      dispatch("movePhrases", {
        ids: matched.map((p) => p.id),
        targetGroupId: newGroup.id
      });
    } else {
      dispatch("addPhrases", {
        groupId: newGroup.id,
        texts: matched.map((p) => p.text)
      });
    }
    const msg = `\u041D\u0430\u0439\u0434\u0435\u043D\u043E: ${matched.length}`;
    addHistory(`${groupName}: ${msg}`);
    notify(msg);
  }, [activePhrases, selectedGroup, isMultiGroup, lengthN, filterMode, notify, addHistory]);
  const handleFrequencyFilter = useCallback(() => {
    if (!selectedGroup && !isMultiGroup) return;
    if (!frequencyN) return;
    const n = parseInt(frequencyN, 10);
    if (isNaN(n) || n < 0) {
      notify("\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E\u0435 \u0447\u0438\u0441\u043B\u043E");
      return;
    }
    const filter = createFrequencyMoreFilter(n);
    const matched = activePhrases.filter((p) => filter.check(p.text, p));
    if (!matched.length) {
      notify("\u041D\u0435\u0442 \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0439");
      return;
    }
    const groupName = isMultiGroup ? `\u041E\u0431\u044A\u0435\u0434\u0438\u043D\u0451\u043D\u043D\u0430\u044F \u0433\u0440\u0443\u043F\u043F\u0430 \u2192 ${filter.name}` : `${selectedGroup.name} \u2192 ${filter.name}`;
    const existingIds = new Set(
      useAppStore.getState().groups?.map((g) => g.id) ?? []
    );
    dispatch("addGroup", { name: groupName, parentId: null });
    const updatedGroups = useAppStore.getState().groups ?? [];
    const newGroup = updatedGroups.find((g) => !existingIds.has(g.id));
    if (!newGroup) {
      notify("\u041E\u0448\u0438\u0431\u043A\u0430: \u0433\u0440\u0443\u043F\u043F\u0430 \u043D\u0435 \u0441\u043E\u0437\u0434\u0430\u043D\u0430");
      return;
    }
    if (filterMode === "move") {
      dispatch("movePhrases", {
        ids: matched.map((p) => p.id),
        targetGroupId: newGroup.id
      });
    } else {
      dispatch("addPhrases", {
        groupId: newGroup.id,
        texts: matched.map((p) => p.text)
      });
    }
    const msg = `\u041D\u0430\u0439\u0434\u0435\u043D\u043E: ${matched.length}`;
    addHistory(`${groupName}: ${msg}`);
    notify(msg);
  }, [activePhrases, selectedGroup, isMultiGroup, frequencyN, filterMode, notify, addHistory]);
  const handleSubstringFilter = useCallback(() => {
    if (!selectedGroup && !isMultiGroup) return;
    if (!substringQuery) return;
    const filter = createSubstringFilter(substringQuery);
    const matched = activePhrases.filter((p) => filter.check(p.text, p));
    if (!matched.length) {
      notify("\u041D\u0435\u0442 \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0439");
      return;
    }
    const groupName = isMultiGroup ? `\u041E\u0431\u044A\u0435\u0434\u0438\u043D\u0451\u043D\u043D\u0430\u044F \u0433\u0440\u0443\u043F\u043F\u0430 \u2192 ${filter.name}` : `${selectedGroup.name} \u2192 ${filter.name}`;
    const existingIds = new Set(
      useAppStore.getState().groups?.map((g) => g.id) ?? []
    );
    dispatch("addGroup", { name: groupName, parentId: null });
    const updatedGroups = useAppStore.getState().groups ?? [];
    const newGroup = updatedGroups.find((g) => !existingIds.has(g.id));
    if (!newGroup) {
      notify("\u041E\u0448\u0438\u0431\u043A\u0430: \u0433\u0440\u0443\u043F\u043F\u0430 \u043D\u0435 \u0441\u043E\u0437\u0434\u0430\u043D\u0430");
      return;
    }
    if (filterMode === "move") {
      dispatch("movePhrases", {
        ids: matched.map((p) => p.id),
        targetGroupId: newGroup.id
      });
    } else {
      dispatch("addPhrases", {
        groupId: newGroup.id,
        texts: matched.map((p) => p.text)
      });
    }
    const msg = `\u041D\u0430\u0439\u0434\u0435\u043D\u043E: ${matched.length}`;
    addHistory(`${groupName}: ${msg}`);
    notify(msg);
  }, [activePhrases, selectedGroup, isMultiGroup, substringQuery, filterMode, notify, addHistory]);
  const handleCopyToClipboard = useCallback(() => {
    const text = activePhrases.map((p) => p.text).join("\n");
    if (!text) {
      notify("\u041D\u0435\u0442 \u0444\u0440\u0430\u0437 \u0434\u043B\u044F \u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F");
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      notify(`\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u043E \u0444\u0440\u0430\u0437: ${activePhrases.length}`);
    }).catch(() => {
      notify("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C");
    });
  }, [activePhrases, notify]);
  useEffect(() => {
    handlerRefs.deduplicate = handleDeduplicate;
    handlerRefs.cleanChars = handleCleanChars;
    handlerRefs.trim = handleTrim;
    handlerRefs.lowercase = handleLowercase;
    handlerRefs.removeEmpty = handleRemoveEmpty;
  }, [handleDeduplicate, handleCleanChars, handleTrim, handleLowercase, handleRemoveEmpty]);
  const stats = useMemo(() => {
    if (!activePhrases.length) return null;
    const texts = activePhrases.map((p) => p.text);
    const lengths = texts.map((t) => t.length);
    const total = texts.length;
    const avgLength = lengths.reduce((a, b) => a + b, 0) / total;
    const minLength = Math.min(...lengths);
    const maxLength = Math.max(...lengths);
    const wordCounts = /* @__PURE__ */ new Map();
    const stopWords = /* @__PURE__ */ new Set([
      "\u0438",
      "\u0432",
      "\u043D\u0430",
      "\u0441",
      "\u043F\u043E",
      "\u0434\u043B\u044F",
      "\u043E\u0442",
      "\u043A",
      "\u0438\u0437",
      "\u0443",
      "\u0437\u0430",
      "\u043E",
      "\u043E\u0431",
      "\u0430",
      "\u043D\u043E",
      "\u0434\u0430",
      "\u043D\u0435",
      "\u043D\u0438",
      "\u043A\u0430\u043A",
      "\u0442\u0430\u043A",
      "\u0447\u0442\u043E",
      "\u044D\u0442\u043E",
      "\u0438\u043B\u0438",
      "\u0442\u043E",
      "\u0434\u043E",
      "\u0432\u043E",
      "\u0441\u043E",
      "\u043F\u0440\u0438",
      "\u043F\u0440\u043E",
      "\u0431\u0435\u0437",
      "\u0447\u0435\u0440\u0435\u0437",
      "\u043D\u0430\u0434",
      "\u043F\u043E\u0434",
      "\u0435\u0441\u043B\u0438",
      "\u0436\u0435",
      "\u0431\u044B",
      "\u043B\u0438",
      "\u0443\u0436\u0435"
    ]);
    texts.forEach((t) => {
      t.toLowerCase().split(/\s+/).filter(Boolean).forEach((w) => {
        if (!stopWords.has(w) && w.length > 1) {
          wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1);
        }
      });
    });
    const topWords = [...wordCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([word, count]) => ({ word, count }));
    return { total, avgLength, minLength, maxLength, topWords };
  }, [activePhrases]);
  const toggleSection = (key) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const moveSection = (key, direction) => {
    setSectionOrder((prev) => {
      const idx = prev.indexOf(key);
      if (idx === -1) return prev;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  };
  const Chevron = ({ open }) => /* @__PURE__ */ react_shim_default.createElement("span", { className: "inline-block w-3 text-xs select-none" }, open ? "\u25BC" : "\u25B6");
  const SectionHeader = ({
    label,
    sectionKey,
    defaultOpen
  }) => {
    const isOpen = sections[sectionKey] ?? defaultOpen ?? true;
    const orderIdx = sectionOrder.indexOf(sectionKey);
    const canMoveUp = orderIdx > 0;
    const canMoveDown = orderIdx < sectionOrder.length - 1;
    return /* @__PURE__ */ react_shim_default.createElement("div", { className: "flex items-center gap-0.5 group" }, /* @__PURE__ */ react_shim_default.createElement(
      "button",
      {
        className: "flex items-center gap-1 flex-1 text-xs font-semibold uppercase opacity-60 mb-1 px-1 py-0.5 hover:opacity-100 text-left",
        onClick: () => toggleSection(sectionKey)
      },
      /* @__PURE__ */ react_shim_default.createElement(Chevron, { open: isOpen }),
      label
    ), /* @__PURE__ */ react_shim_default.createElement("div", { className: "flex gap-0.5 opacity-0 group-hover:opacity-40 transition-opacity mb-1" }, /* @__PURE__ */ react_shim_default.createElement(
      "button",
      {
        className: "text-[10px] px-0.5 hover:opacity-100 disabled:opacity-20",
        disabled: !canMoveUp,
        onClick: () => moveSection(sectionKey, -1),
        title: "\u0412\u0432\u0435\u0440\u0445"
      },
      "\u25B2"
    ), /* @__PURE__ */ react_shim_default.createElement(
      "button",
      {
        className: "text-[10px] px-0.5 hover:opacity-100 disabled:opacity-20",
        disabled: !canMoveDown,
        onClick: () => moveSection(sectionKey, 1),
        title: "\u0412\u043D\u0438\u0437"
      },
      "\u25BC"
    )));
  };
  const SectionBody = ({
    sectionKey,
    children,
    defaultOpen
  }) => {
    const isOpen = sections[sectionKey] ?? defaultOpen ?? true;
    return isOpen ? /* @__PURE__ */ react_shim_default.createElement("div", { className: "space-y-1 pl-3" }, children) : null;
  };
  const FilterButton = ({
    filterId,
    name
  }) => {
    const count = filterPreviews[filterId] ?? 0;
    return /* @__PURE__ */ react_shim_default.createElement(
      "button",
      {
        className: "w-full text-xs px-3 py-1 rounded bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-40 flex justify-between items-center",
        disabled: !selectedGroup && !isMultiGroup,
        onClick: () => handleFilter(filterId)
      },
      /* @__PURE__ */ react_shim_default.createElement("span", null, name),
      /* @__PURE__ */ react_shim_default.createElement("span", { className: "text-[10px] ml-1 bg-white/20 text-white px-1.5 py-0 rounded" }, count)
    );
  };
  const sectionRenderers = {
    cleanup: () => /* @__PURE__ */ react_shim_default.createElement("div", null, /* @__PURE__ */ react_shim_default.createElement(SectionHeader, { label: "\u041E\u0447\u0438\u0441\u0442\u043A\u0430", sectionKey: "cleanup" }), /* @__PURE__ */ react_shim_default.createElement(SectionBody, { sectionKey: "cleanup" }, /* @__PURE__ */ react_shim_default.createElement(
      "button",
      {
        className: "w-full text-xs px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40",
        disabled: !selectedGroup && !isMultiGroup,
        onClick: handleDeduplicate
      },
      "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0434\u0443\u0431\u043B\u0438 (\u0432 \u043A\u043E\u0440\u0437\u0438\u043D\u0443)"
    ), /* @__PURE__ */ react_shim_default.createElement(
      "button",
      {
        className: "w-full text-xs px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40",
        disabled: !selectedGroup && !isMultiGroup,
        onClick: handleRemoveEmpty
      },
      "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043F\u0443\u0441\u0442\u044B\u0435 (\u0432 \u043A\u043E\u0440\u0437\u0438\u043D\u0443)"
    ), /* @__PURE__ */ react_shim_default.createElement(
      "button",
      {
        className: "w-full text-xs px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40",
        disabled: !selectedGroup && !isMultiGroup,
        onClick: handleCleanChars
      },
      "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0441\u043F\u0435\u0446\u0441\u0438\u043C\u0432\u043E\u043B\u044B"
    ), /* @__PURE__ */ react_shim_default.createElement(
      "button",
      {
        className: "w-full text-xs px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40",
        disabled: !selectedGroup && !isMultiGroup,
        onClick: handleTrim
      },
      "\u041E\u0431\u0440\u0435\u0437\u0430\u0442\u044C \u043F\u0440\u043E\u0431\u0435\u043B\u044B"
    ), /* @__PURE__ */ react_shim_default.createElement(
      "button",
      {
        className: "w-full text-xs px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40",
        disabled: !selectedGroup && !isMultiGroup,
        onClick: handleLowercase
      },
      "\u041D\u0438\u0436\u043D\u0438\u0439 \u0440\u0435\u0433\u0438\u0441\u0442\u0440"
    ))),
    wordFilters: () => /* @__PURE__ */ react_shim_default.createElement("div", null, /* @__PURE__ */ react_shim_default.createElement(SectionHeader, { label: "\u0424\u0438\u043B\u044C\u0442\u0440\u044B \u043F\u043E \u0441\u043B\u043E\u0432\u0430\u043C", sectionKey: "wordFilters" }), /* @__PURE__ */ react_shim_default.createElement(SectionBody, { sectionKey: "wordFilters" }, filterRegistry.getAll().filter(
      (f) => !f.id.startsWith("intent-") && !f.id.startsWith("frequency-") && !f.id.startsWith("substring-") && !f.id.startsWith("length-")
    ).map((f) => /* @__PURE__ */ react_shim_default.createElement(FilterButton, { key: f.id, filterId: f.id, name: f.name })))),
    lengthFilters: () => /* @__PURE__ */ react_shim_default.createElement("div", null, /* @__PURE__ */ react_shim_default.createElement(SectionHeader, { label: "\u0424\u0438\u043B\u044C\u0442\u0440\u044B \u043F\u043E \u0434\u043B\u0438\u043D\u0435", sectionKey: "lengthFilters" }), /* @__PURE__ */ react_shim_default.createElement(SectionBody, { sectionKey: "lengthFilters" }, /* @__PURE__ */ react_shim_default.createElement("div", { className: "space-y-1" }, /* @__PURE__ */ react_shim_default.createElement(
      "input",
      {
        type: "number",
        className: "w-full text-sm rounded px-2 py-1",
        style: { background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border)" },
        placeholder: "N \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432",
        value: lengthN,
        onChange: (e) => setLengthN(e.target.value),
        min: 1
      }
    ), /* @__PURE__ */ react_shim_default.createElement("div", { className: "flex gap-1" }, /* @__PURE__ */ react_shim_default.createElement(
      "button",
      {
        className: "flex-1 text-xs px-3 py-1 rounded bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-40",
        disabled: !selectedGroup && !isMultiGroup || !lengthN,
        onClick: () => handleLengthFilter("more")
      },
      "\u0411\u043E\u043B\u044C\u0448\u0435 N"
    ), /* @__PURE__ */ react_shim_default.createElement(
      "button",
      {
        className: "flex-1 text-xs px-3 py-1 rounded bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-40",
        disabled: !selectedGroup && !isMultiGroup || !lengthN,
        onClick: () => handleLengthFilter("less")
      },
      "\u041C\u0435\u043D\u044C\u0448\u0435 N"
    ))))),
    intentFilters: () => /* @__PURE__ */ react_shim_default.createElement("div", null, /* @__PURE__ */ react_shim_default.createElement(SectionHeader, { label: "\u0424\u0438\u043B\u044C\u0442\u0440\u044B \u043F\u043E \u0438\u043D\u0442\u0435\u043D\u0442\u0443", sectionKey: "intentFilters" }), /* @__PURE__ */ react_shim_default.createElement(SectionBody, { sectionKey: "intentFilters" }, filterRegistry.getAll().filter((f) => f.id.startsWith("intent-")).map((f) => /* @__PURE__ */ react_shim_default.createElement(FilterButton, { key: f.id, filterId: f.id, name: f.name })))),
    frequencyFilter: () => /* @__PURE__ */ react_shim_default.createElement("div", null, /* @__PURE__ */ react_shim_default.createElement(SectionHeader, { label: "\u0424\u0438\u043B\u044C\u0442\u0440 \u043F\u043E \u0447\u0430\u0441\u0442\u043E\u0442\u043D\u043E\u0441\u0442\u0438", sectionKey: "frequencyFilter" }), /* @__PURE__ */ react_shim_default.createElement(SectionBody, { sectionKey: "frequencyFilter" }, /* @__PURE__ */ react_shim_default.createElement("div", { className: "space-y-1" }, /* @__PURE__ */ react_shim_default.createElement(
      "input",
      {
        type: "number",
        className: "w-full text-sm rounded px-2 py-1",
        style: { background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border)" },
        placeholder: "\u0427\u0430\u0441\u0442\u043E\u0442\u0430 > N",
        value: frequencyN,
        onChange: (e) => setFrequencyN(e.target.value),
        min: 0
      }
    ), frequencyN && /* @__PURE__ */ react_shim_default.createElement("span", { className: "text-xs opacity-50" }, "\u0421\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0439:", " ", activePhrases.filter(
      (p) => createFrequencyMoreFilter(parseInt(frequencyN, 10) || 0).check(
        p.text,
        p
      )
    ).length, " ", "/ ", totalPhrases), /* @__PURE__ */ react_shim_default.createElement(
      "button",
      {
        className: "w-full text-xs px-3 py-1 rounded bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-40",
        disabled: !selectedGroup && !isMultiGroup || !frequencyN,
        onClick: handleFrequencyFilter
      },
      "\u0427\u0430\u0441\u0442\u043E\u0442\u0430 > N"
    )))),
    substringFilter: () => /* @__PURE__ */ react_shim_default.createElement("div", null, /* @__PURE__ */ react_shim_default.createElement(SectionHeader, { label: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u043F\u043E\u0434\u0441\u0442\u0440\u043E\u043A\u0435", sectionKey: "substringFilter" }), /* @__PURE__ */ react_shim_default.createElement(SectionBody, { sectionKey: "substringFilter" }, /* @__PURE__ */ react_shim_default.createElement("div", { className: "space-y-1" }, /* @__PURE__ */ react_shim_default.createElement(
      "input",
      {
        type: "text",
        className: "w-full text-sm rounded px-2 py-1",
        style: { background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border)" },
        placeholder: "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0441\u043B\u043E\u0432\u043E \u0438\u043B\u0438 \u0447\u0430\u0441\u0442\u044C",
        value: substringQuery,
        onChange: (e) => setSubstringQuery(e.target.value)
      }
    ), substringQuery && /* @__PURE__ */ react_shim_default.createElement("span", { className: "text-xs opacity-50" }, "\u0421\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0439:", " ", activePhrases.filter(
      (p) => p.text.toLowerCase().includes(substringQuery.toLowerCase())
    ).length, " ", "/ ", totalPhrases), /* @__PURE__ */ react_shim_default.createElement(
      "button",
      {
        className: "w-full text-xs px-3 py-1 rounded bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-40",
        disabled: !selectedGroup && !isMultiGroup || !substringQuery,
        onClick: handleSubstringFilter
      },
      "\u041D\u0430\u0439\u0442\u0438"
    )))),
    stats: () => /* @__PURE__ */ react_shim_default.createElement("div", null, /* @__PURE__ */ react_shim_default.createElement(SectionHeader, { label: "\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430", sectionKey: "stats", defaultOpen: false }), /* @__PURE__ */ react_shim_default.createElement(SectionBody, { sectionKey: "stats", defaultOpen: false }, stats ? /* @__PURE__ */ react_shim_default.createElement("div", { className: "space-y-1 text-xs" }, /* @__PURE__ */ react_shim_default.createElement("p", null, /* @__PURE__ */ react_shim_default.createElement("span", { className: "opacity-60" }, "\u0412\u0441\u0435\u0433\u043E \u0444\u0440\u0430\u0437:"), " ", stats.total), /* @__PURE__ */ react_shim_default.createElement("p", null, /* @__PURE__ */ react_shim_default.createElement("span", { className: "opacity-60" }, "\u0421\u0440\u0435\u0434\u043D\u044F\u044F \u0434\u043B\u0438\u043D\u0430:"), " ", stats.avgLength.toFixed(1), " \u0441\u0438\u043C\u0432."), /* @__PURE__ */ react_shim_default.createElement("p", null, /* @__PURE__ */ react_shim_default.createElement("span", { className: "opacity-60" }, "\u041C\u0438\u043D / \u041C\u0430\u043A\u0441 \u0434\u043B\u0438\u043D\u0430:"), " ", stats.minLength, " / ", stats.maxLength, " \u0441\u0438\u043C\u0432."), /* @__PURE__ */ react_shim_default.createElement("div", null, /* @__PURE__ */ react_shim_default.createElement("span", { className: "opacity-60" }, "\u0422\u043E\u043F-5 \u0441\u043B\u043E\u0432:"), /* @__PURE__ */ react_shim_default.createElement("ul", { className: "list-disc list-inside mt-0.5" }, stats.topWords.map((w, i) => /* @__PURE__ */ react_shim_default.createElement("li", { key: i }, w.word, " \u2014 ", w.count))))) : /* @__PURE__ */ react_shim_default.createElement("p", { className: "text-xs opacity-40" }, "\u041D\u0435\u0442 \u0434\u0430\u043D\u043D\u044B\u0445"))),
    history: () => /* @__PURE__ */ react_shim_default.createElement("div", null, /* @__PURE__ */ react_shim_default.createElement(SectionHeader, { label: "\u0418\u0441\u0442\u043E\u0440\u0438\u044F", sectionKey: "history", defaultOpen: false }), /* @__PURE__ */ react_shim_default.createElement(SectionBody, { sectionKey: "history", defaultOpen: false }, historyLog.length === 0 ? /* @__PURE__ */ react_shim_default.createElement("p", { className: "text-xs opacity-40" }, "\u041D\u0435\u0442 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0439") : /* @__PURE__ */ react_shim_default.createElement("div", { className: "space-y-0.5 max-h-40 overflow-y-auto" }, historyLog.map((entry, i) => /* @__PURE__ */ react_shim_default.createElement("p", { key: i, className: "text-[11px] opacity-60 leading-tight" }, /* @__PURE__ */ react_shim_default.createElement("span", { className: "opacity-40" }, "[", entry.time, "]"), " ", entry.msg)))))
  };
  const ProgressBar = progress ? /* @__PURE__ */ react_shim_default.createElement("div", { className: "w-full rounded h-2 overflow-hidden", style: { background: "var(--bg-surface)" } }, /* @__PURE__ */ react_shim_default.createElement(
    "div",
    {
      className: "h-full transition-all duration-200",
      style: { width: `${progress.current / progress.total * 100}%`, background: "var(--accent-blue)" }
    }
  )) : null;
  return /* @__PURE__ */ react_shim_default.createElement("div", { className: "p-4 space-y-3 text-sm" }, /* @__PURE__ */ react_shim_default.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ react_shim_default.createElement("h3", { className: "text-sm font-semibold" }, "SEO Multitool"), /* @__PURE__ */ react_shim_default.createElement(
    "button",
    {
      className: "text-xs px-2 py-0.5 rounded",
      style: { background: "var(--bg-surface)", color: "var(--text-primary)" },
      onClick: handleCopyToClipboard,
      title: "\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0444\u0440\u0430\u0437\u044B \u0432 \u0431\u0443\u0444\u0435\u0440"
    },
    "\u{1F4CB}"
  )), ProgressBar, /* @__PURE__ */ react_shim_default.createElement("div", null, /* @__PURE__ */ react_shim_default.createElement("div", { className: "flex items-center gap-2 mb-1" }, /* @__PURE__ */ react_shim_default.createElement("label", { className: "text-xs opacity-70" }, "\u0413\u0440\u0443\u043F\u043F\u0430"), /* @__PURE__ */ react_shim_default.createElement("label", { className: "flex items-center gap-1 text-xs opacity-50 ml-auto" }, /* @__PURE__ */ react_shim_default.createElement(
    "input",
    {
      type: "checkbox",
      checked: multiMode,
      onChange: (e) => {
        setMultiMode(e.target.checked);
        if (!e.target.checked) setSelectedGroupIds([]);
      }
    }
  ), "\u041D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E")), multiMode ? /* @__PURE__ */ react_shim_default.createElement(
    "div",
    {
      className: "space-y-1 max-h-48 overflow-y-auto rounded p-1.5",
      style: { border: "1px solid var(--border)", background: "var(--bg-base)" }
    },
    /* @__PURE__ */ react_shim_default.createElement(
      "button",
      {
        className: "text-xs px-2 py-0.5 rounded mb-1",
        style: { background: "var(--accent-blue)", color: "#fff" },
        onClick: handleUseAppSelection
      },
      "\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u044C \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u0438\u0437 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F (",
      appSelectedGroupIds.length,
      ")"
    ),
    groups?.map((g) => /* @__PURE__ */ react_shim_default.createElement(
      "label",
      {
        key: g.id,
        className: "flex items-center gap-1.5 text-xs px-1 py-0.5 hover:bg-gray-100 rounded cursor-pointer",
        style: { color: "var(--text-primary)" }
      },
      /* @__PURE__ */ react_shim_default.createElement(
        "input",
        {
          type: "checkbox",
          checked: selectedGroupIds.includes(g.id),
          onChange: (e) => {
            if (e.target.checked) {
              setSelectedGroupIds((prev) => [...prev, g.id]);
            } else {
              setSelectedGroupIds((prev) => prev.filter((id) => id !== g.id));
            }
          }
        }
      ),
      g.name
    )),
    selectedGroupIds.length > 0 && /* @__PURE__ */ react_shim_default.createElement("p", { className: "text-xs opacity-50 mt-1" }, "\u0413\u0440\u0443\u043F\u043F: ", selectedGroupIds.length, ", \u0424\u0440\u0430\u0437: ", totalPhrases)
  ) : /* @__PURE__ */ react_shim_default.createElement(react_shim_default.Fragment, null, /* @__PURE__ */ react_shim_default.createElement(
    "select",
    {
      className: "w-full text-sm rounded px-2 py-1",
      style: { background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border)" },
      value: selectedGroupId,
      onChange: (e) => setSelectedGroupId(e.target.value)
    },
    /* @__PURE__ */ react_shim_default.createElement("option", { value: "" }, "-- \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0433\u0440\u0443\u043F\u043F\u0443 --"),
    groups?.map((g) => /* @__PURE__ */ react_shim_default.createElement("option", { key: g.id, value: g.id }, g.name))
  ), selectedGroup && /* @__PURE__ */ react_shim_default.createElement("p", { className: "text-xs mt-1 opacity-50" }, "\u0424\u0440\u0430\u0437: ", totalPhrases))), /* @__PURE__ */ react_shim_default.createElement("div", { className: "flex items-center gap-2 text-xs" }, /* @__PURE__ */ react_shim_default.createElement("span", { className: "opacity-60" }, "\u0420\u0435\u0436\u0438\u043C \u0444\u0438\u043B\u044C\u0442\u0440\u0430:"), /* @__PURE__ */ react_shim_default.createElement(
    "button",
    {
      className: `px-2 py-0.5 rounded text-xs ${filterMode === "copy" ? "bg-blue-500 text-white" : ""}`,
      style: filterMode !== "copy" ? { background: "var(--bg-surface)", color: "var(--text-secondary)" } : {},
      onClick: () => setFilterMode("copy")
    },
    "\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C"
  ), /* @__PURE__ */ react_shim_default.createElement(
    "button",
    {
      className: `px-2 py-0.5 rounded text-xs ${filterMode === "move" ? "bg-blue-500 text-white" : ""}`,
      style: filterMode !== "move" ? { background: "var(--bg-surface)", color: "var(--text-secondary)" } : {},
      onClick: () => setFilterMode("move")
    },
    "\u041F\u0435\u0440\u0435\u043C\u0435\u0441\u0442\u0438\u0442\u044C"
  )), sectionOrder.filter((key) => sectionRenderers[key]).filter((key) => !(key === "stats" && !showStats)).map((key) => /* @__PURE__ */ react_shim_default.createElement("div", { key }, sectionRenderers[key]())));
}
function GroupToolbarButton({ groupId }) {
  const handleClick = () => {
    if (groupId) setSetting("selectedGroupId", groupId);
    dispatch("setLeftPanel", { open: true, module: "seo-multitool" });
  };
  return /* @__PURE__ */ react_shim_default.createElement(
    "button",
    {
      className: "text-xs px-2 py-1 rounded",
      style: { background: "var(--accent-blue)", color: "#fff" },
      onClick: handleClick,
      title: "Open SEO Multitool"
    },
    "Multitool"
  );
}

// index.ts
var _pluginCtx = null;
var plugin = {
  manifest: {
    id: "seo-multitool",
    name: "SEO Multitool",
    version: "1.2.0",
    description: "\u041E\u0447\u0438\u0441\u0442\u043A\u0430 \u0438 \u0444\u0438\u043B\u044C\u0442\u0440\u0430\u0446\u0438\u044F \u043A\u043B\u044E\u0447\u0435\u0432\u044B\u0445 \u0444\u0440\u0430\u0437: \u0443\u0434\u0430\u043B\u0435\u043D\u0438\u0435 \u0434\u0443\u0431\u043B\u0435\u0439, \u043F\u0443\u0441\u0442\u044B\u0445 \u0441\u0442\u0440\u043E\u043A, \u0441\u043F\u0435\u0446\u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432; \u0444\u0438\u043B\u044C\u0442\u0440\u044B \u043F\u043E \u0434\u043B\u0438\u043D\u0435, \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u0443 \u0441\u043B\u043E\u0432, \u0447\u0438\u0441\u043B\u0430\u043C \u0438 \u0432\u043E\u043F\u0440\u043E\u0441\u0430\u043C",
    category: "seo",
    icon: "search",
    slot: ["ribbon:tools", "context:group"]
  },
  init(ctx) {
    __setCtx(ctx);
    _pluginCtx = ctx;
    const readSettings = () => ({
      syncWithSelection: ctx.getSetting("syncWithSelection") ?? false,
      defaultFilterMode: ctx.getSetting("defaultFilterMode") ?? "copy",
      showStats: ctx.getSetting("showStats") ?? true,
      historySize: ctx.getSetting("historySize") ?? 10
    });
    __updatePluginSettings(readSettings());
    ctx.registerLifecycleHook("onSettingsChange", () => {
      __updatePluginSettings(readSettings());
    });
    ctx.registerUI({
      slot: "ribbon:tools",
      label: "SEO Multitool",
      icon: "search",
      component: SeoMultitoolPanel,
      order: 100
    });
    ctx.registerUI({
      slot: "context:group",
      label: "SEO Multitool",
      icon: "search",
      component: SeoMultitoolPanel,
      order: 100
    });
    function contextMenuAction(label, handler) {
      ctx.registerUI({
        slot: "context-menu:group",
        label,
        icon: "cleaning_services",
        action: (group, { store, eventBus }) => {
          handler(group, store);
          store.dispatch("pushUndo");
          eventBus.emit("notify", { message: `\u0413\u0440\u0443\u043F\u043F\u0430 \xAB${group.name}\xBB \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u0430`, duration: 2500 });
        }
      });
    }
    contextMenuAction("SEO Multitool: \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u0434\u0443\u0431\u043B\u0438", (group, store) => {
      store.dispatch("batchOperation", (state) => {
        batchDeduplicateInState(state, group.id);
      });
    });
    contextMenuAction("SEO Multitool: \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u043F\u0443\u0441\u0442\u044B\u0435", (group, store) => {
      store.dispatch("batchOperation", (state) => {
        batchRemoveEmptyInState(state, group.id);
      });
    });
    contextMenuAction("SEO Multitool: \u0443\u0431\u0440\u0430\u0442\u044C \u0441\u043F\u0435\u0446\u0441\u0438\u043C\u0432\u043E\u043B\u044B", (group, store) => {
      store.dispatch("batchOperation", (state) => {
        batchCleanCharsInState(state, group.id);
      });
    });
    ctx.registerUI({
      slot: "group:toolbar",
      label: "Multitool",
      icon: "manufacturing",
      component: GroupToolbarButton,
      order: 50
    });
    ctx.registerCommand("deduplicate", () => handlerRefs.deduplicate());
    ctx.registerCommand("cleanChars", () => handlerRefs.cleanChars());
    ctx.registerCommand("trim", () => handlerRefs.trim());
    ctx.registerCommand("lowercase", () => handlerRefs.lowercase());
    ctx.registerCommand("removeEmpty", () => handlerRefs.removeEmpty());
    ctx.registerKeybinding("Ctrl+Shift+D", "seo-multitool:deduplicate");
    ctx.registerKeybinding("Ctrl+Shift+C", "seo-multitool:cleanChars");
    ctx.registerKeybinding("Ctrl+Shift+T", "seo-multitool:trim");
    ctx.registerKeybinding("Ctrl+Shift+L", "seo-multitool:lowercase");
    ctx.registerKeybinding("Ctrl+Shift+E", "seo-multitool:removeEmpty");
    for (const filter of filterRegistry.getAll()) {
      ctx.registerFilter({
        id: filter.id,
        name: filter.name,
        check: (text) => filter.check(text)
      });
    }
    ctx.registerExporter({
      id: "seo-multitool-txt",
      label: "SEO Multitool \u2014 \u0442\u0435\u043A\u0441\u0442 (.txt)",
      extension: "txt",
      export: async ({ phrases }) => {
        return phrases.map((p) => p.text).join("\n");
      }
    });
    ctx.registerExporter({
      id: "seo-multitool-csv",
      label: "SEO Multitool \u2014 \u0442\u0430\u0431\u043B\u0438\u0446\u0430 (.csv)",
      extension: "csv",
      export: async ({ phrases }) => {
        const header = "text,frequency,kei,intent,tags";
        const rows = phrases.map((p) => [
          `"${(p.text ?? "").replace(/"/g, '""')}"`,
          p.frequency ?? "",
          p.kei ?? "",
          p.intent ?? "",
          (p.tags ?? []).join(";")
        ].join(","));
        return [header, ...rows].join("\n");
      }
    });
    ctx.onEvent("group:selected", (data) => {
      ctx.setSetting("selectedGroupId", data.groupId);
    });
    ctx.onEvent("selection:changed", () => {
      if (ctx.getSetting("syncWithSelection")) {
        const selectedIds = ctx.store.getState().selectedGroupIds;
        if (selectedIds) {
          __setPendingSync(Array.from(selectedIds));
        }
      }
    });
  },
  destroy() {
    try {
      _pluginCtx?.unregisterExporter?.("seo-multitool-txt");
    } catch {
    }
    try {
      _pluginCtx?.unregisterExporter?.("seo-multitool-csv");
    } catch {
    }
  }
};
var index_default = plugin;
export {
  index_default as default
};
