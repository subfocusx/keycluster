// AI Module — semantic operations only (rename, group notes)
// Intent, minus-words, cluster-quality are now algorithmic (core/intent, core/minus-words, core/clustering)

import type { AppModule, PluginContext, AIProvider} from 'plugin-sdk';
import { DEFAULT_AI_SETTINGS } from 'plugin-sdk';
import { useAIStore } from 'plugin-sdk';
import { AIPanel } from './components';
import AIProgressPopup from './AIProgressPopup';

const aiModule: AppModule = {
  manifest: {
    id: 'ai',
    name: 'AI',
    version: '1.0.0',
    description: 'AI-инструменты для семантических операций: переименование групп и генерация описаний на основе LLM',
    category: 'algorithms',
    slot: ['left-panel'],
    dependencies: [],
    settingsSchema: [
      { key: 'enabled', type: 'boolean', label: 'Включить AI', default: false },
      { key: 'provider', type: 'select', label: 'Провайдер', default: 'ollama', options: ['ollama', 'lmstudio'] },
      { key: 'endpoint', type: 'string', label: 'Endpoint', default: DEFAULT_AI_SETTINGS.endpoint },
      { key: 'model', type: 'string', label: 'Модель', default: DEFAULT_AI_SETTINGS.model },
      { key: 'temperature', type: 'number', label: 'Temperature', default: DEFAULT_AI_SETTINGS.temperature },
      { key: 'timeout', type: 'number', label: 'Таймаут (мс)', default: DEFAULT_AI_SETTINGS.timeout },
      { key: 'batchSize', type: 'number', label: 'Размер батча', default: DEFAULT_AI_SETTINGS.batchSize },
      { key: 'maxTokens', type: 'number', label: 'Max tokens', default: DEFAULT_AI_SETTINGS.maxTokens },
      { key: 'debugMode', type: 'boolean', label: 'Режим отладки', default: false },
      { key: 'cacheEnabled', type: 'boolean', label: 'Кэш AI', default: true },
    ],
  },

  init(ctx: PluginContext) {
    const readSettings = () => {
      const enabled = ctx.getSetting('enabled') as boolean ?? DEFAULT_AI_SETTINGS.enabled;
      const provider = ctx.getSetting('provider') as string ?? DEFAULT_AI_SETTINGS.provider;
      const endpoint = ctx.getSetting('endpoint') as string ?? DEFAULT_AI_SETTINGS.endpoint;
      const model = ctx.getSetting('model') as string ?? DEFAULT_AI_SETTINGS.model;
      const temperature = ctx.getSetting('temperature') as number ?? DEFAULT_AI_SETTINGS.temperature;
      const timeout = ctx.getSetting('timeout') as number ?? DEFAULT_AI_SETTINGS.timeout;
      const batchSize = ctx.getSetting('batchSize') as number ?? DEFAULT_AI_SETTINGS.batchSize;
      const maxTokens = ctx.getSetting('maxTokens') as number ?? DEFAULT_AI_SETTINGS.maxTokens;
      const debugMode = ctx.getSetting('debugMode') as boolean ?? DEFAULT_AI_SETTINGS.debugMode;
      const cacheEnabled = ctx.getSetting('cacheEnabled') as boolean ?? DEFAULT_AI_SETTINGS.cacheEnabled;
      useAIStore.getState().setDebugMode(debugMode);
      return { enabled, provider: provider as AIProvider, endpoint, model, temperature, timeout, batchSize, maxTokens, debugMode, cacheEnabled };
    };
    readSettings();

    ctx.registerUI({
      slot: 'left-panel',
      label: 'AI Инструменты',
      component: () => AIPanel({ ctx }),
      order: 40,
    });

    ctx.registerUI({
      slot: 'status-bar',
      label: 'AI Progress',
      component: AIProgressPopup,
      order: 100,
    });

    ctx.registerLifecycleHook?.('onSettingsChange', (payload) => {
      if (payload?.moduleId === 'ai') {
        const settings = readSettings();
        const svc = useAIStore.getState().service;
        if (svc) {
          svc.updateSettings({
            ...DEFAULT_AI_SETTINGS,
            ...settings,
          });
        }
      }
    });
  },

  destroy() {
    useAIStore.getState().clearQueue();
  },
};

export default aiModule;