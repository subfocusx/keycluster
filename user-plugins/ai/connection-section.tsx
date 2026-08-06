import React, { useState, useCallback } from 'react';
import { useSettingsStore, DEFAULT_AI_SETTINGS, PROVIDER_ENDPOINTS, useAIStore, AIService, Input, Button } from 'plugin-sdk';
import type { AIProvider, ConnectionStatus } from 'plugin-sdk';

function StatusBadge({ status }: { status: ConnectionStatus }) {
  const colors: Record<ConnectionStatus, string> = {
    connected: 'bg-green-500',
    connecting: 'bg-yellow-500',
    disconnected: 'bg-gray-500',
    error: 'bg-red-500',
  };
  const labels: Record<ConnectionStatus, string> = {
    connected: 'Подключено',
    connecting: 'Подключение...',
    disconnected: 'Отключено',
    error: 'Ошибка',
  };
  return (
    <span className="flex items-center gap-1.5 text-[11px]">
      <span className={`w-2 h-2 rounded-full ${colors[status]}`} />
      {labels[status]}
    </span>
  );
}

function getAISettings() {
  const s = useSettingsStore.getState();
  return {
    ...DEFAULT_AI_SETTINGS,
    provider: (s.getModuleSetting('ai', 'provider') as AIProvider) ?? DEFAULT_AI_SETTINGS.provider,
    endpoint: (s.getModuleSetting('ai', 'endpoint') as string) ?? DEFAULT_AI_SETTINGS.endpoint,
    model: (s.getModuleSetting('ai', 'model') as string) ?? DEFAULT_AI_SETTINGS.model,
    temperature: (s.getModuleSetting('ai', 'temperature') as number) ?? DEFAULT_AI_SETTINGS.temperature,
    timeout: (s.getModuleSetting('ai', 'timeout') as number) ?? DEFAULT_AI_SETTINGS.timeout,
    batchSize: (s.getModuleSetting('ai', 'batchSize') as number) ?? DEFAULT_AI_SETTINGS.batchSize,
    maxTokens: (s.getModuleSetting('ai', 'maxTokens') as number) ?? DEFAULT_AI_SETTINGS.maxTokens,
    debugMode: (s.getModuleSetting('ai', 'debugMode') as boolean) ?? DEFAULT_AI_SETTINGS.debugMode,
    cacheEnabled: (s.getModuleSetting('ai', 'cacheEnabled') as boolean) ?? DEFAULT_AI_SETTINGS.cacheEnabled,
  };
}

export async function getOrCreateService(): Promise<AIService | null> {
  let svc = useAIStore.getState().service;
  if (!svc) {
    const settings = getAISettings();
    svc = new AIService(settings);
    const available = await svc.isAvailable();
    if (!available) return null;
    const ok = await svc.checkConnection();
    if (ok !== 'connected') return null;
    useAIStore.getState().setService(svc);
  } else {
    const ok = await svc.checkConnection();
    if (ok !== 'connected') {
      useAIStore.getState().addLog('warn', '[AI] Service connection lost, re-creating...');
      useAIStore.getState().setService(null);
      return getOrCreateService();
    }
  }
  return svc;
}

function ProviderToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex rounded-[4px] border border-[var(--border)] overflow-hidden h-7">
      <button className={`flex-1 text-[11px] px-2 transition-colors ${value === 'ollama' ? 'bg-[var(--accent-blue)] text-white' : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`} onClick={() => onChange('ollama')}>Ollama</button>
      <div className="w-px bg-[var(--border)]" />
      <button className={`flex-1 text-[11px] px-2 transition-colors ${value === 'lmstudio' ? 'bg-[var(--accent-blue)] text-white' : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`} onClick={() => onChange('lmstudio')}>LM Studio</button>
    </div>
  );
}

function ConnectionSection() {
  const aiState = useAIStore();
  const [provider, setProvider] = useState<string>(() => {
    const s = useSettingsStore.getState();
    return (s.getModuleSetting('ai', 'provider') as string) ?? DEFAULT_AI_SETTINGS.provider;
  });
  const [endpoint, setEndpoint] = useState<string>(() => {
    const s = useSettingsStore.getState();
    return (s.getModuleSetting('ai', 'endpoint') as string) ?? DEFAULT_AI_SETTINGS.endpoint;
  });
  const [model, setModel] = useState<string>(() => {
    const s = useSettingsStore.getState();
    return (s.getModuleSetting('ai', 'model') as string) ?? DEFAULT_AI_SETTINGS.model;
  });
  const [testing, setTesting] = useState(false);

  const handleProviderChange = useCallback((val: string) => {
    setProvider(val);
    const ep = PROVIDER_ENDPOINTS[val as AIProvider] ?? DEFAULT_AI_SETTINGS.endpoint;
    setEndpoint(ep);
    useSettingsStore.getState().setModuleSetting('ai', 'provider', val);
    useSettingsStore.getState().setModuleSetting('ai', 'endpoint', ep);
    aiState.addLog('info', `[AI] Provider changed to ${val}, endpoint: ${ep}`);
  }, [aiState]);

  const handleEndpointChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEndpoint(val);
    useSettingsStore.getState().setModuleSetting('ai', 'endpoint', val);
  }, []);

  const handleModelChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setModel(val);
    useSettingsStore.getState().setModuleSetting('ai', 'model', val);
  }, []);

  const testConnection = useCallback(async () => {
    setTesting(true);
    aiState.setConnectionStatus('connecting');
    const settings = getAISettings();
    const svc = new AIService(settings);
    aiState.addLog('info', `[AI] Checking server: ${settings.endpoint} (provider: ${settings.provider}, model: ${settings.model})`);

    const available = await svc.isAvailable();
    if (!available) {
      aiState.setConnectionStatus('error', 'Сервер недоступен');
      aiState.addLog('error', `[AI] Server unreachable at ${settings.endpoint} — проверьте что ${settings.provider} запущен и порт правильный`);
      setTesting(false);
      return;
    }
    aiState.addLog('info', `[AI] Server reachable at ${settings.endpoint}, testing model ${settings.model}...`);

    const status = await svc.checkConnection();
    if (status === 'connected') {
      aiState.setConnectionStatus('connected');
      aiState.setCurrentModel(settings.model);
      aiState.setService(svc);
      aiState.addLog('info', `[AI] Connected | ${settings.provider} | ${settings.endpoint} | model: ${settings.model}`);
    } else {
      aiState.setConnectionStatus('error', 'Модель не ответила');
      aiState.addLog('error', `[AI] Model ${settings.model} at ${settings.endpoint} не отвечает — попробуйте другое имя модели`);
    }
    setTesting(false);
  }, [aiState]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-label-caps text-[var(--text-secondary)]">Подключение</span>
        <StatusBadge status={aiState.connectionStatus} />
      </div>
      <div className="space-y-1.5">
        <ProviderToggle value={provider} onChange={handleProviderChange} />
        <div className="flex gap-1">
          <Input value={endpoint} onChange={handleEndpointChange} placeholder="http://localhost:11434" className="flex-1 h-7 text-[11px] font-mono" />
          <Button size="sm" className="h-7 text-[11px] px-2" onClick={testConnection} disabled={testing}>
            {testing ? '...' : 'Тест'}
          </Button>
        </div>
        <Input value={model} onChange={handleModelChange} placeholder="qwen2.5:3b" className="h-7 text-[11px] font-mono" />
      </div>
    </div>
  );
}

export { ConnectionSection };