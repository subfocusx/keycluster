// index.ts
import { DEFAULT_AI_SETTINGS as DEFAULT_AI_SETTINGS2 } from "plugin-sdk";
import { useAIStore as useAIStore4 } from "plugin-sdk";

// components.tsx
import { useCallback as useCallback2 } from "react";
import { useAppStore, Separator } from "plugin-sdk";

// connection-section.tsx
import { useState, useCallback } from "react";
import { useSettingsStore, DEFAULT_AI_SETTINGS, PROVIDER_ENDPOINTS, useAIStore, AIService, Input, Button } from "plugin-sdk";
import { jsx, jsxs } from "react/jsx-runtime";
function StatusBadge({ status }) {
  const colors = {
    connected: "bg-green-500",
    connecting: "bg-yellow-500",
    disconnected: "bg-gray-500",
    error: "bg-red-500"
  };
  const labels = {
    connected: "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043E",
    connecting: "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435...",
    disconnected: "\u041E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u043E",
    error: "\u041E\u0448\u0438\u0431\u043A\u0430"
  };
  return /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1.5 text-[11px]", children: [
    /* @__PURE__ */ jsx("span", { className: `w-2 h-2 rounded-full ${colors[status]}` }),
    labels[status]
  ] });
}
function getAISettings() {
  const s = useSettingsStore.getState();
  return {
    ...DEFAULT_AI_SETTINGS,
    provider: s.getModuleSetting("ai", "provider") ?? DEFAULT_AI_SETTINGS.provider,
    endpoint: s.getModuleSetting("ai", "endpoint") ?? DEFAULT_AI_SETTINGS.endpoint,
    model: s.getModuleSetting("ai", "model") ?? DEFAULT_AI_SETTINGS.model,
    temperature: s.getModuleSetting("ai", "temperature") ?? DEFAULT_AI_SETTINGS.temperature,
    timeout: s.getModuleSetting("ai", "timeout") ?? DEFAULT_AI_SETTINGS.timeout,
    batchSize: s.getModuleSetting("ai", "batchSize") ?? DEFAULT_AI_SETTINGS.batchSize,
    maxTokens: s.getModuleSetting("ai", "maxTokens") ?? DEFAULT_AI_SETTINGS.maxTokens,
    debugMode: s.getModuleSetting("ai", "debugMode") ?? DEFAULT_AI_SETTINGS.debugMode,
    cacheEnabled: s.getModuleSetting("ai", "cacheEnabled") ?? DEFAULT_AI_SETTINGS.cacheEnabled
  };
}
function ProviderToggle({ value, onChange }) {
  return /* @__PURE__ */ jsxs("div", { className: "flex rounded-[4px] border border-[var(--border)] overflow-hidden h-7", children: [
    /* @__PURE__ */ jsx("button", { className: `flex-1 text-[11px] px-2 transition-colors ${value === "ollama" ? "bg-[var(--accent-blue)] text-white" : "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"}`, onClick: () => onChange("ollama"), children: "Ollama" }),
    /* @__PURE__ */ jsx("div", { className: "w-px bg-[var(--border)]" }),
    /* @__PURE__ */ jsx("button", { className: `flex-1 text-[11px] px-2 transition-colors ${value === "lmstudio" ? "bg-[var(--accent-blue)] text-white" : "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"}`, onClick: () => onChange("lmstudio"), children: "LM Studio" })
  ] });
}
function ConnectionSection() {
  const aiState = useAIStore();
  const [provider, setProvider] = useState(() => {
    const s = useSettingsStore.getState();
    return s.getModuleSetting("ai", "provider") ?? DEFAULT_AI_SETTINGS.provider;
  });
  const [endpoint, setEndpoint] = useState(() => {
    const s = useSettingsStore.getState();
    return s.getModuleSetting("ai", "endpoint") ?? DEFAULT_AI_SETTINGS.endpoint;
  });
  const [model, setModel] = useState(() => {
    const s = useSettingsStore.getState();
    return s.getModuleSetting("ai", "model") ?? DEFAULT_AI_SETTINGS.model;
  });
  const [testing, setTesting] = useState(false);
  const handleProviderChange = useCallback((val) => {
    setProvider(val);
    const ep = PROVIDER_ENDPOINTS[val] ?? DEFAULT_AI_SETTINGS.endpoint;
    setEndpoint(ep);
    useSettingsStore.getState().setModuleSetting("ai", "provider", val);
    useSettingsStore.getState().setModuleSetting("ai", "endpoint", ep);
    aiState.addLog("info", `[AI] Provider changed to ${val}, endpoint: ${ep}`);
  }, [aiState]);
  const handleEndpointChange = useCallback((e) => {
    const val = e.target.value;
    setEndpoint(val);
    useSettingsStore.getState().setModuleSetting("ai", "endpoint", val);
  }, []);
  const handleModelChange = useCallback((e) => {
    const val = e.target.value;
    setModel(val);
    useSettingsStore.getState().setModuleSetting("ai", "model", val);
  }, []);
  const testConnection = useCallback(async () => {
    setTesting(true);
    aiState.setConnectionStatus("connecting");
    const settings = getAISettings();
    const svc = new AIService(settings);
    aiState.addLog("info", `[AI] Checking server: ${settings.endpoint} (provider: ${settings.provider}, model: ${settings.model})`);
    const available = await svc.isAvailable();
    if (!available) {
      aiState.setConnectionStatus("error", "\u0421\u0435\u0440\u0432\u0435\u0440 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D");
      aiState.addLog("error", `[AI] Server unreachable at ${settings.endpoint} \u2014 \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0447\u0442\u043E ${settings.provider} \u0437\u0430\u043F\u0443\u0449\u0435\u043D \u0438 \u043F\u043E\u0440\u0442 \u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u044B\u0439`);
      setTesting(false);
      return;
    }
    aiState.addLog("info", `[AI] Server reachable at ${settings.endpoint}, testing model ${settings.model}...`);
    const status = await svc.checkConnection();
    if (status === "connected") {
      aiState.setConnectionStatus("connected");
      aiState.setCurrentModel(settings.model);
      aiState.setService(svc);
      aiState.addLog("info", `[AI] Connected | ${settings.provider} | ${settings.endpoint} | model: ${settings.model}`);
    } else {
      aiState.setConnectionStatus("error", "\u041C\u043E\u0434\u0435\u043B\u044C \u043D\u0435 \u043E\u0442\u0432\u0435\u0442\u0438\u043B\u0430");
      aiState.addLog("error", `[AI] Model ${settings.model} at ${settings.endpoint} \u043D\u0435 \u043E\u0442\u0432\u0435\u0447\u0430\u0435\u0442 \u2014 \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0434\u0440\u0443\u0433\u043E\u0435 \u0438\u043C\u044F \u043C\u043E\u0434\u0435\u043B\u0438`);
    }
    setTesting(false);
  }, [aiState]);
  return /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsx("span", { className: "font-label-caps text-[var(--text-secondary)]", children: "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435" }),
      /* @__PURE__ */ jsx(StatusBadge, { status: aiState.connectionStatus })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "space-y-1.5", children: [
      /* @__PURE__ */ jsx(ProviderToggle, { value: provider, onChange: handleProviderChange }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-1", children: [
        /* @__PURE__ */ jsx(Input, { value: endpoint, onChange: handleEndpointChange, placeholder: "http://localhost:11434", className: "flex-1 h-7 text-[11px] font-mono" }),
        /* @__PURE__ */ jsx(Button, { size: "sm", className: "h-7 text-[11px] px-2", onClick: testConnection, disabled: testing, children: testing ? "..." : "\u0422\u0435\u0441\u0442" })
      ] }),
      /* @__PURE__ */ jsx(Input, { value: model, onChange: handleModelChange, placeholder: "qwen2.5:3b", className: "h-7 text-[11px] font-mono" })
    ] })
  ] });
}

// logs-section.tsx
import { useEffect, useRef } from "react";
import { useAIStore as useAIStore2 } from "plugin-sdk";
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function MIcon({ name, className = "" }) {
  return /* @__PURE__ */ jsx2("span", { className: `material-symbols-outlined ${className}`, children: name });
}
function LogsSection() {
  const logs = useAIStore2((s) => s.logs);
  const clearLogs = useAIStore2((s) => s.clearLogs);
  const debugMode = useAIStore2((s) => s.debugMode);
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);
  return /* @__PURE__ */ jsxs2("div", { className: "space-y-2 flex-1 flex flex-col min-h-0", children: [
    /* @__PURE__ */ jsxs2("div", { className: "flex items-center justify-between shrink-0", children: [
      /* @__PURE__ */ jsx2("span", { className: "font-label-caps text-[var(--text-secondary)]", children: "\u041B\u043E\u0433\u0438" }),
      /* @__PURE__ */ jsxs2("div", { className: "flex items-center gap-1", children: [
        debugMode && /* @__PURE__ */ jsx2("span", { className: "text-[8px] text-[var(--accent-orange)] font-mono", children: "DEBUG" }),
        /* @__PURE__ */ jsx2(
          "button",
          {
            className: "tool-btn !w-5 !h-5",
            title: "\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043B\u043E\u0433\u0438",
            "aria-label": "\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043B\u043E\u0433\u0438",
            onClick: () => {
              const text = logs.map((l) => `${new Date(l.timestamp).toLocaleString()} [${l.level.toUpperCase()}] ${l.message}${l.duration ? ` (${l.duration}ms)` : ""}`).join("\n");
              navigator.clipboard.writeText(text);
            },
            disabled: logs.length === 0,
            children: /* @__PURE__ */ jsx2(MIcon, { name: "content_copy", className: "!text-[12px]" })
          }
        ),
        /* @__PURE__ */ jsx2("button", { className: "tool-btn !w-5 !h-5", title: "\u041E\u0447\u0438\u0441\u0442\u0438\u0442\u044C \u043B\u043E\u0433\u0438", "aria-label": "\u041E\u0447\u0438\u0441\u0442\u0438\u0442\u044C \u043B\u043E\u0433\u0438", onClick: clearLogs, children: /* @__PURE__ */ jsx2(MIcon, { name: "delete", className: "!text-[12px]" }) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs2("div", { className: "ai-log-area flex-1 overflow-auto compact-scroll p-2 text-[11px] leading-relaxed", children: [
      logs.length === 0 ? /* @__PURE__ */ jsx2("span", { className: "text-[var(--text-disabled)]", children: "\u041D\u0435\u0442 \u0437\u0430\u043F\u0438\u0441\u0435\u0439" }) : logs.map((log) => /* @__PURE__ */ jsxs2("div", { className: `${log.level === "error" ? "text-[var(--accent-red)]" : log.level === "warn" ? "text-[var(--accent-orange)]" : "text-[var(--text-secondary)]"}`, children: [
        /* @__PURE__ */ jsx2("span", { className: "text-[var(--text-disabled)]", children: new Date(log.timestamp).toLocaleTimeString() }),
        " ",
        log.message,
        log.duration && /* @__PURE__ */ jsxs2("span", { className: "text-[var(--text-disabled)] ml-1", children: [
          "(",
          log.duration,
          "ms"
        ] }),
        log.modelName && /* @__PURE__ */ jsxs2("span", { className: "text-[var(--text-disabled)]", children: [
          ", ",
          log.modelName
        ] }),
        log.totalTokens && /* @__PURE__ */ jsxs2("span", { className: "text-[var(--text-disabled)]", children: [
          ", ",
          log.totalTokens,
          " tok"
        ] }),
        log.duration && /* @__PURE__ */ jsx2("span", { className: "text-[var(--text-disabled)]", children: ")" })
      ] }, log.id)),
      /* @__PURE__ */ jsx2("div", { ref: endRef })
    ] })
  ] });
}

// components.tsx
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
function AIPanel({ ctx }) {
  return /* @__PURE__ */ jsx3("div", { className: "flex flex-col h-full", children: /* @__PURE__ */ jsxs3("div", { className: "flex-1 overflow-auto compact-scroll p-3 space-y-3 flex flex-col min-h-0", children: [
    /* @__PURE__ */ jsx3(ConnectionSection, {}),
    /* @__PURE__ */ jsx3(Separator, {}),
    /* @__PURE__ */ jsx3(LogsSection, {})
  ] }) });
}

// AIProgressPopup.tsx
import { useState as useState2, useEffect as useEffect2, useRef as useRef2, useCallback as useCallback3 } from "react";
import { useAIStore as useAIStore3 } from "plugin-sdk";
import { jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
var STATUS_COLORS = {
  pending: "#4A90D9",
  processing: "#4A90D9",
  completed: "#4CAF50",
  cancelled: "#F57C00",
  failed: "#D32F2F"
};
function formatElapsed(ms) {
  const s = Math.floor(ms / 1e3);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}\u043C ${s % 60}\u0441`;
  return `${s}.${Math.floor(ms % 1e3 / 100)}\u0441`;
}
function AIProgressPopup() {
  const queue = useAIStore3((s) => s.queue);
  const service = useAIStore3((s) => s.service);
  const [minimized, setMinimized] = useState2(false);
  const [elapsed, setElapsed] = useState2(0);
  const startTimeRef = useRef2(null);
  const active = queue.find((q) => q.status === "processing" || q.status === "pending");
  useEffect2(() => {
    if (active && !active.startedAt && active.status === "processing") {
      useAIStore3.getState().updateQueueItem(active.id, { startedAt: Date.now() });
    }
    if (active?.startedAt) {
      startTimeRef.current = active.startedAt;
    } else if (!active) {
      startTimeRef.current = null;
      setElapsed(0);
    }
  }, [active?.id, active?.status, active?.startedAt]);
  useEffect2(() => {
    if (!startTimeRef.current) return;
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTimeRef.current);
    }, 200);
    return () => clearInterval(interval);
  }, [active?.id]);
  const statusColor = active ? STATUS_COLORS[active.status] : STATUS_COLORS.processing;
  const handleStop = useCallback3(() => {
    const aiState = useAIStore3.getState();
    aiState.cancelAll();
    aiState.addLog("warn", "[AI] \u0412\u0441\u0435 \u0437\u0430\u0434\u0430\u0447\u0438 \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u044B \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0435\u043C");
  }, []);
  const handleClose = useCallback3(() => {
    if (!active) return;
    if (active.status === "completed" || active.status === "cancelled" || active.status === "failed") {
      useAIStore3.getState().removeQueueItem(active.id);
    }
  }, [active]);
  if (!active) return null;
  if (minimized) {
    return /* @__PURE__ */ jsxs4(
      "div",
      {
        className: "fixed bottom-3 right-3 z-50 flex items-center gap-2 px-2.5 py-1 rounded-[4px] cursor-pointer shadow-lg border transition-all duration-200 hover:opacity-90",
        style: {
          backgroundColor: "var(--kc-surface)",
          borderColor: statusColor
        },
        onClick: () => setMinimized(false),
        children: [
          /* @__PURE__ */ jsx4("span", { className: "material-symbols-outlined !text-[12px]", style: { color: statusColor }, children: "auto_awesome" }),
          /* @__PURE__ */ jsx4("span", { className: "text-[10px] font-medium", style: { color: statusColor }, children: active.label }),
          /* @__PURE__ */ jsxs4("span", { className: "text-[10px] tabular-nums", style: { color: statusColor }, children: [
            active.progress,
            "%"
          ] })
        ]
      }
    );
  }
  return /* @__PURE__ */ jsxs4(
    "div",
    {
      className: "fixed bottom-3 right-3 z-50 w-[300px] rounded-[6px] shadow-lg border overflow-hidden transition-all duration-200",
      style: { backgroundColor: "var(--kc-surface)", borderColor: "var(--kc-border)" },
      children: [
        /* @__PURE__ */ jsxs4("div", { className: "flex items-center justify-between px-3 py-2 border-b", style: { borderColor: "var(--kc-border-light)" }, children: [
          /* @__PURE__ */ jsxs4("div", { className: "flex items-center gap-2 min-w-0", children: [
            /* @__PURE__ */ jsx4("span", { className: "material-symbols-outlined !text-[16px] shrink-0", style: { color: statusColor }, children: "auto_awesome" }),
            /* @__PURE__ */ jsxs4("div", { className: "min-w-0", children: [
              /* @__PURE__ */ jsx4("div", { className: "text-[11px] font-medium truncate", children: active.label }),
              active.status === "processing" && startTimeRef.current && /* @__PURE__ */ jsx4("div", { className: "text-[10px] text-[var(--kc-text-secondary)]", children: formatElapsed(elapsed) })
            ] })
          ] }),
          /* @__PURE__ */ jsxs4("div", { className: "flex items-center gap-0.5 shrink-0", children: [
            /* @__PURE__ */ jsx4(
              "button",
              {
                className: "w-5 h-5 flex items-center justify-center rounded-[3px] hover:bg-[var(--kc-surface-hover)] cursor-pointer text-[var(--kc-text-secondary)]",
                onClick: () => setMinimized(true),
                children: /* @__PURE__ */ jsx4("span", { className: "material-symbols-outlined !text-[12px]", children: "minimize" })
              }
            ),
            /* @__PURE__ */ jsx4(
              "button",
              {
                className: "w-5 h-5 flex items-center justify-center rounded-[3px] hover:bg-[var(--kc-surface-hover)] cursor-pointer text-[var(--kc-text-secondary)]",
                onClick: handleClose,
                children: /* @__PURE__ */ jsx4("span", { className: "material-symbols-outlined !text-[12px]", children: "close" })
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxs4("div", { className: "px-3 py-2 space-y-1.5", children: [
          /* @__PURE__ */ jsx4("div", { className: "w-full h-1.5 rounded-[2px] overflow-hidden", style: { backgroundColor: "var(--kc-border-light)" }, children: /* @__PURE__ */ jsx4(
            "div",
            {
              className: "h-full rounded-[2px] transition-all duration-300 ease-out",
              style: { width: `${active.progress}%`, backgroundColor: statusColor }
            }
          ) }),
          /* @__PURE__ */ jsxs4("div", { className: "flex items-center justify-between text-[10px] text-[var(--kc-text-secondary)] tabular-nums", children: [
            /* @__PURE__ */ jsxs4("span", { children: [
              active.progress,
              "%"
            ] }),
            /* @__PURE__ */ jsxs4("span", { children: [
              "Batch ",
              active.processed,
              "/",
              active.total
            ] }),
            startTimeRef.current && /* @__PURE__ */ jsx4("span", { children: formatElapsed(elapsed) })
          ] }),
          /* @__PURE__ */ jsxs4("div", { className: "text-[10px] text-[var(--kc-text-secondary)]", children: [
            active.status === "processing" && "Processing...",
            active.status === "completed" && "Completed",
            active.status === "cancelled" && "Cancelled",
            active.status === "failed" && `Failed`,
            active.error && /* @__PURE__ */ jsx4("span", { className: "text-[var(--kc-red)] ml-1", children: active.error })
          ] })
        ] }),
        active.status === "processing" && /* @__PURE__ */ jsx4("div", { className: "px-3 py-1.5 border-t flex justify-end", style: { borderColor: "var(--kc-border-light)" }, children: /* @__PURE__ */ jsx4(
          "button",
          {
            className: "px-3 py-0.5 text-[10px] font-medium rounded-[3px] border transition-colors cursor-pointer hover:bg-[var(--kc-red-light)]",
            style: { borderColor: "var(--kc-red)", color: "var(--kc-red)" },
            onClick: handleStop,
            children: "STOP"
          }
        ) })
      ]
    }
  );
}
var AIProgressPopup_default = AIProgressPopup;

// index.ts
var aiModule = {
  manifest: {
    id: "ai",
    name: "AI",
    version: "1.0.0",
    description: "AI-\u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B \u0434\u043B\u044F \u0441\u0435\u043C\u0430\u043D\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0445 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0439: \u043F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435 \u0433\u0440\u0443\u043F\u043F \u0438 \u0433\u0435\u043D\u0435\u0440\u0430\u0446\u0438\u044F \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0439 \u043D\u0430 \u043E\u0441\u043D\u043E\u0432\u0435 LLM",
    category: "algorithms",
    slot: ["left-panel"],
    dependencies: [],
    settingsSchema: [
      { key: "enabled", type: "boolean", label: "\u0412\u043A\u043B\u044E\u0447\u0438\u0442\u044C AI", default: false },
      { key: "provider", type: "select", label: "\u041F\u0440\u043E\u0432\u0430\u0439\u0434\u0435\u0440", default: "ollama", options: ["ollama", "lmstudio"] },
      { key: "endpoint", type: "string", label: "Endpoint", default: DEFAULT_AI_SETTINGS2.endpoint },
      { key: "model", type: "string", label: "\u041C\u043E\u0434\u0435\u043B\u044C", default: DEFAULT_AI_SETTINGS2.model },
      { key: "temperature", type: "number", label: "Temperature", default: DEFAULT_AI_SETTINGS2.temperature },
      { key: "timeout", type: "number", label: "\u0422\u0430\u0439\u043C\u0430\u0443\u0442 (\u043C\u0441)", default: DEFAULT_AI_SETTINGS2.timeout },
      { key: "batchSize", type: "number", label: "\u0420\u0430\u0437\u043C\u0435\u0440 \u0431\u0430\u0442\u0447\u0430", default: DEFAULT_AI_SETTINGS2.batchSize },
      { key: "maxTokens", type: "number", label: "Max tokens", default: DEFAULT_AI_SETTINGS2.maxTokens },
      { key: "debugMode", type: "boolean", label: "\u0420\u0435\u0436\u0438\u043C \u043E\u0442\u043B\u0430\u0434\u043A\u0438", default: false },
      { key: "cacheEnabled", type: "boolean", label: "\u041A\u044D\u0448 AI", default: true }
    ]
  },
  init(ctx) {
    const readSettings = () => {
      const enabled = ctx.getSetting("enabled") ?? DEFAULT_AI_SETTINGS2.enabled;
      const provider = ctx.getSetting("provider") ?? DEFAULT_AI_SETTINGS2.provider;
      const endpoint = ctx.getSetting("endpoint") ?? DEFAULT_AI_SETTINGS2.endpoint;
      const model = ctx.getSetting("model") ?? DEFAULT_AI_SETTINGS2.model;
      const temperature = ctx.getSetting("temperature") ?? DEFAULT_AI_SETTINGS2.temperature;
      const timeout = ctx.getSetting("timeout") ?? DEFAULT_AI_SETTINGS2.timeout;
      const batchSize = ctx.getSetting("batchSize") ?? DEFAULT_AI_SETTINGS2.batchSize;
      const maxTokens = ctx.getSetting("maxTokens") ?? DEFAULT_AI_SETTINGS2.maxTokens;
      const debugMode = ctx.getSetting("debugMode") ?? DEFAULT_AI_SETTINGS2.debugMode;
      const cacheEnabled = ctx.getSetting("cacheEnabled") ?? DEFAULT_AI_SETTINGS2.cacheEnabled;
      useAIStore4.getState().setDebugMode(debugMode);
      return { enabled, provider, endpoint, model, temperature, timeout, batchSize, maxTokens, debugMode, cacheEnabled };
    };
    readSettings();
    ctx.registerUI({
      slot: "left-panel",
      label: "AI \u0418\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B",
      component: () => AIPanel({ ctx }),
      order: 40
    });
    ctx.registerUI({
      slot: "status-bar",
      label: "AI Progress",
      component: AIProgressPopup_default,
      order: 100
    });
    ctx.registerLifecycleHook?.("onSettingsChange", (payload) => {
      if (payload?.moduleId === "ai") {
        const settings = readSettings();
        const svc = useAIStore4.getState().service;
        if (svc) {
          svc.updateSettings({
            ...DEFAULT_AI_SETTINGS2,
            ...settings
          });
        }
      }
    });
  },
  destroy() {
    useAIStore4.getState().clearQueue();
  }
};
var index_default = aiModule;
export {
  index_default as default
};
