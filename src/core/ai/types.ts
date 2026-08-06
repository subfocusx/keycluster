// AI types — semantic tools ONLY
// AI is used for: rename generation, group descriptions, semantic recommendations
// Algorithmic operations (intent, minus-words, quality) are in core/intent, core/minus-words, core/clustering

export type AIProvider = 'ollama' | 'lmstudio';

export interface AISettings {
  enabled: boolean;
  provider: AIProvider;
  endpoint: string;
  model: string;
  temperature: number;
  timeout: number;
  batchSize: number;
  maxTokens: number;
  debugMode: boolean;
  cacheEnabled: boolean;
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  enabled: false,
  provider: 'ollama',
  endpoint: 'http://localhost:11434',
  model: 'qwen2.5:3b',
  temperature: 0.1,
  timeout: 20000,
  batchSize: 50,
  maxTokens: 2048,
  debugMode: false,
  cacheEnabled: true,
};

export const PROVIDER_ENDPOINTS: Record<AIProvider, string> = {
  ollama: 'http://localhost:11434',
  lmstudio: 'http://localhost:1234',
};

export const RECOMMENDED_MODELS = {
  fast: ['qwen2.5:3b', 'llama3.2:3b', 'gemma2:2b'],
  quality: ['qwen2.5:7b', 'mistral:7b', 'llama3.1:8b'],
} as const;

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface AILogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  duration?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  modelName?: string;
}

// AI tools limited to semantic operations only
export type AIToolId = 'rename-groups' | 'group-notes';

export interface AIQueueItem {
  id: string;
  toolId: AIToolId;
  label: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  total: number;
  processed: number;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIChatResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  duration: number;
}

export interface AIState {
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  logs: AILogEntry[];
  queue: AIQueueItem[];
  currentModel: string | null;
  responseTime: number | null;
}

export interface AIToolConfig {
  maxTokens: number;
  temperature: number;
  topP: number;
}

export const TOOL_CONFIGS: Record<AIToolId, AIToolConfig> = {
  'rename-groups': { maxTokens: 60, temperature: 0.2, topP: 0.8 },
  'group-notes': { maxTokens: 100, temperature: 0.3, topP: 0.9 },
};

export const TOOL_MAX_KEYWORDS: Record<AIToolId, number> = {
  'rename-groups': 15,
  'group-notes': 15,
};
