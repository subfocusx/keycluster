// AI Service — semantic operations ONLY
// ClassifyIntent / GenerateMinusWords / EvaluateCluster removed
// These are now algorithmic: core/intent, core/minus-words, core/clustering

import type { AISettings, AIChatMessage, AIChatResponse, ConnectionStatus, AIToolId } from './types';
import { TOOL_CONFIGS, TOOL_MAX_KEYWORDS } from './types';
import { tryExtractJson, sanitizeGroupName, sanitizeGroupDescription, validatePlainText, sanitizeAIResponse } from './validators';
import { promptManager } from './prompt-manager';
import { useAIStore } from './store';
import type { Phrase } from '@/core/types';

interface CacheEntry {
  result: string;
  timestamp: number;
}

export class AIService {
  private settings: AISettings;
  private activeControllers = new Set<AbortController>();
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_MAX = 200;

  constructor(settings: AISettings) {
    this.settings = settings;
  }

  updateSettings(settings: AISettings): void {
    this.settings = settings;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  private get baseUrl(): string {
    return this.settings.endpoint.replace(/\/+$/, '');
  }

  private get chatUrl(): string {
    return `${this.baseUrl}/v1/chat/completions`;
  }

  private getCacheKey(toolId: AIToolId, keywords: string[], extraVars?: Record<string, string>): string {
    const sortedKw = [...keywords].sort().join('|');
    const vars = extraVars ? JSON.stringify(extraVars) : '';
    const promptHash = promptManager.getCacheHash(toolId, { keywords: sortedKw });
    return `${toolId}|${sortedKw}|${vars}|${this.settings.model}|${promptHash}`;
  }

  private checkCache(toolId: AIToolId, keywords: string[], extraVars?: Record<string, string>): string | null {
    if (!this.settings.cacheEnabled) return null;
    const key = this.getCacheKey(toolId, keywords, extraVars);
    const entry = this.cache.get(key);
    if (!entry) return null;
    const age = Date.now() - entry.timestamp;
    if (age > 300000) {
      this.cache.delete(key);
      return null;
    }
    return entry.result;
  }

  private setCache(toolId: AIToolId, keywords: string[], extraVars: Record<string, string> | undefined, result: string): void {
    if (!this.settings.cacheEnabled) return;
    if (this.cache.size >= this.CACHE_MAX) {
      let oldestKey: string | null = null;
      let oldestTs = Infinity;
      for (const [k, v] of this.cache) {
        if (v.timestamp < oldestTs) {
          oldestTs = v.timestamp;
          oldestKey = k;
        }
      }
      if (oldestKey) this.cache.delete(oldestKey);
    }
    const key = this.getCacheKey(toolId, keywords, extraVars);
    this.cache.set(key, { result, timestamp: Date.now() });
  }

  private selectKeywords(phrases: Phrase[], toolId: AIToolId): string[] {
    const maxKw = TOOL_MAX_KEYWORDS[toolId];
    const withFreq = phrases.filter(p => typeof p.frequency === 'number' && p.frequency > 0);
    if (withFreq.length >= maxKw) {
      return withFreq
        .sort((a, b) => (b.frequency ?? 0) - (a.frequency ?? 0))
        .slice(0, maxKw)
        .map(p => p.text);
    }
    return phrases.slice(0, maxKw).map(p => p.text);
  }

  async isAvailable(): Promise<boolean> {
    const endpoints = this.settings.provider === 'lmstudio'
      ? ['/v1/models', '/api/tags']
      : ['/api/tags', '/v1/models'];
    for (const path of endpoints) {
      const controller = new AbortController();
      this.activeControllers.add(controller);
      let timeout: ReturnType<typeof setTimeout> | null = null;
      try {
        timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${this.baseUrl}${path}`, {
          signal: controller.signal,
          headers: { 'x-plugin-id': 'ai' },
        });
        if (timeout) { clearTimeout(timeout); timeout = null; }
        if (res.ok) return true;
      } catch {
        if (timeout) { clearTimeout(timeout); timeout = null; }
        /* try next */
      } finally {
        this.activeControllers.delete(controller);
      }
    }
    return false;
  }

  async getModels(): Promise<string[]> {
    const controller = new AbortController();
    this.activeControllers.add(controller);
    try {
      try {
        const res = await fetch(`${this.baseUrl}/api/tags`, {
          signal: controller.signal,
          headers: { 'x-plugin-id': 'ai' },
        });
        if (res.ok) {
          const data = await res.json();
          return (data.models ?? []).map((m: { name: string }) => m.name);
        }
      } catch { /* fall through */ }
      try {
        const res = await fetch(`${this.baseUrl}/v1/models`, {
          signal: controller.signal,
          headers: { 'x-plugin-id': 'ai' },
        });
        if (res.ok) {
          const data = await res.json();
          return (data.data ?? []).map((m: { id: string }) => m.id);
        }
      } catch { /* ignore */ }
    } finally {
      this.activeControllers.delete(controller);
    }
    return [];
  }

  cancel(): void {
    for (const ctrl of this.activeControllers) ctrl.abort();
    this.activeControllers.clear();
  }

  private async sendChat(messages: AIChatMessage[], toolId?: AIToolId, retries = 1): Promise<AIChatResponse> {
    const startTime = performance.now();
    const config = toolId ? TOOL_CONFIGS[toolId] : null;

    const doFetch = async (attempt: number): Promise<AIChatResponse> => {
      const attemptController = new AbortController();
      this.activeControllers.add(attemptController);
      let timeout: ReturnType<typeof setTimeout> | null = null;

      timeout = setTimeout(() => {
        if (!attemptController.signal.aborted) attemptController.abort();
      }, this.settings.timeout);

      try {
        const body: Record<string, unknown> = {
          model: this.settings.model,
          messages,
          stream: false,
        };

        if (config) {
          body.temperature = config.temperature;
          body.max_tokens = config.maxTokens;
          body.top_p = config.topP;
        } else {
          body.temperature = this.settings.temperature;
          body.max_tokens = this.settings.maxTokens;
        }

    const res = await fetch(this.chatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-plugin-id': 'ai',
      },
      body: JSON.stringify(body),
      signal: attemptController.signal,
    });

        if (res.status === 429 && attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 4000);
          await new Promise(r => setTimeout(r, delay));
          return doFetch(attempt + 1);
        }

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
        }

        const data = await res.json();
        const duration = performance.now() - startTime;

        return {
          content: data.choices?.[0]?.message?.content ?? '',
          model: data.model ?? this.settings.model,
          usage: data.usage
            ? {
                promptTokens: data.usage.prompt_tokens ?? 0,
                completionTokens: data.usage.completion_tokens ?? 0,
                totalTokens: data.usage.total_tokens ?? 0,
              }
            : undefined,
          duration,
        };
      } catch (err) {
        if (attempt < retries && !attemptController.signal.aborted) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 4000);
          await new Promise(r => setTimeout(r, delay));
          return doFetch(attempt + 1);
        }
        throw err;
      } finally {
        if (timeout) clearTimeout(timeout);
        this.activeControllers.delete(attemptController);
      }
    };

    return await doFetch(0);
  }

  async chat(messages: AIChatMessage[]): Promise<AIChatResponse> {
    return this.sendChat(messages);
  }

  async renameGroup(phrases: Phrase[]): Promise<string> {
    const keywords = this.selectKeywords(phrases, 'rename-groups');
    const cached = this.checkCache('rename-groups', keywords);
    if (cached) {
      if (this.settings.debugMode) {
        useAIStore.getState().addLog('info', `[AI] CACHE HIT rename-groups (${keywords.length} kw): "${cached}"`);
      }
      return cached;
    }

    const prompt = promptManager.buildPrompt('rename', { keywords: keywords.map(k => `- ${k}`).join('\n') });
    if (this.settings.debugMode) {
      useAIStore.getState().addLog('info', `[AI] rename-groups: ${keywords.length} keywords, sending prompt`);
    }

    const response = await this.sendChat([
      { role: 'system', content: promptManager.buildSystemMessage('rename-groups') },
      { role: 'user', content: prompt },
    ], 'rename-groups');

    if (this.settings.debugMode) {
      useAIStore.getState().addLog('info', `[AI] RAW response: "${response.content}"`);
    }

    let name = '';

    const parsed = tryExtractJson(response.content);
    if (parsed) {
      const rawName = validatePlainText(parsed, 60);
      if (rawName) name = sanitizeGroupName(rawName);
    }

    if (!name) {
      const rawName = sanitizeAIResponse(response.content);
      if (rawName) name = sanitizeGroupName(rawName);
    }

    if (!name) {
      if (this.settings.debugMode) {
        useAIStore.getState().addLog('error', `[AI] rename-groups: sanitization produced empty result`);
      }
      throw new Error('Invalid group name response');
    }

    if (this.settings.debugMode) {
      useAIStore.getState().addLog('info', `[AI] SANITIZED name: "${name}"`);
    }

    this.setCache('rename-groups', keywords, undefined, name);
    return name;
  }

  async generateGroupNotes(phrases: Phrase[]): Promise<string> {
    const keywords = this.selectKeywords(phrases, 'group-notes');
    const cached = this.checkCache('group-notes', keywords);
    if (cached) {
      if (this.settings.debugMode) {
        useAIStore.getState().addLog('info', `[AI] CACHE HIT group-notes (${keywords.length} kw): "${cached}"`);
      }
      return cached;
    }

    const prompt = promptManager.buildPrompt('group-notes', { keywords: keywords.map(k => `- ${k}`).join('\n') });
    if (this.settings.debugMode) {
      useAIStore.getState().addLog('info', `[AI] group-notes: ${keywords.length} keywords, sending prompt`);
    }

    const response = await this.sendChat([
      { role: 'system', content: promptManager.buildSystemMessage('group-notes') },
      { role: 'user', content: prompt },
    ], 'group-notes');

    if (this.settings.debugMode) {
      useAIStore.getState().addLog('info', `[AI] RAW response: "${response.content}"`);
    }

    let notes = '';

    const parsed = tryExtractJson(response.content);
    if (parsed) {
      const rawNotes = validatePlainText(parsed, 300);
      if (rawNotes) notes = sanitizeGroupDescription(rawNotes);
    }

    if (!notes) {
      const rawNotes = sanitizeAIResponse(response.content);
      if (rawNotes) notes = sanitizeGroupDescription(rawNotes);
    }

    if (!notes) {
      if (this.settings.debugMode) {
        useAIStore.getState().addLog('error', `[AI] group-notes: sanitization produced empty result`);
      }
      throw new Error('Invalid group notes response');
    }

    if (this.settings.debugMode) {
      useAIStore.getState().addLog('info', `[AI] SANITIZED notes: "${notes}"`);
    }

    this.setCache('group-notes', keywords, undefined, notes);
    return notes;
  }

  async checkConnection(): Promise<ConnectionStatus> {
    try {
      const response = await this.sendChat([
        { role: 'system', content: 'Отвечай только OK. Не объясняй. Не рассуждай.' },
        { role: 'user', content: 'Ответь OK.' },
      ]);
      return response.content.length > 0 ? 'connected' : 'error';
    } catch (err) {
      return 'error';
    }
  }
}
