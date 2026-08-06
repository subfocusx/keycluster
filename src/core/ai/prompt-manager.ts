// AI prompts — semantic operations only
// Intent/MinusWords/ClusterQuality prompts removed — those are now algorithmic (core/intent, core/minus-words, core/clustering)

import type { AIToolId } from './types';
import { storageGet, storageSet, STORAGE_KEYS } from '@/core/storage/local-storage';

export type PromptKey = 'rename' | 'group-notes';

const PROMPT_KEY_MAP: Record<AIToolId, PromptKey> = {
  'rename-groups': 'rename',
  'group-notes': 'group-notes',
};

export interface PromptTemplates {
  rename: string;
  'group-notes': string;
}

export const DEFAULT_PROMPTS: PromptTemplates = {
  rename: `Ты PPC-специалист.

Создай короткое название группы ключевых фраз.

СТРОГИЕ ПРАВИЛА:
- ТОЛЬКО 2-4 слова
- НИКАКИХ кавычек
- НИКАКИХ объяснений
- НИКАКОГО анализа
- НИКАКИХ рассуждений
- НИКАКОГО thinking process
- НИКАКИХ шагов
- НИКАКИХ "group", "cluster", "keywords"
- НИКАКОГО markdown, списков, XML-тегов
- ТОЛЬКО короткое название

ОТВЕЧАЙ ТОЛЬКО НАЗВАНИЕМ. НИЧЕГО БОЛЬШЕ.

Ключевые фразы:
{{keywords}}`,
  'group-notes': `Ты PPC-специалист.

Создай краткое описание группы ключевых фраз.

СТРОГИЕ ПРАВИЛА:
- ТОЛЬКО 1 предложение
- максимум 15 слов
- НИКАКИХ объяснений
- НИКАКОГО анализа
- НИКАКИХ рассуждений
- НИКАКОГО thinking process
- НИКАКИХ шагов
- НИКАКОГО markdown, списков, тегов
- ТОЛЬКО смысл группы

ОТВЕЧАЙ ТОЛЬКО ОПИСАНИЕМ. НИЧЕГО БОЛЬШЕ.

Ключевые фразы:
{{keywords}}`,
};

export const PROMPT_LABELS: Record<PromptKey, string> = {
  rename: 'Переименование групп',
  'group-notes': 'Описания групп',
};

export const PROMPT_DESCRIPTIONS: Record<PromptKey, string> = {
  rename: 'Автоматически создает короткие PPC-названия групп ключевых фраз (2-4 слова)',
  'group-notes': 'Создает краткое описание тематики группы (1 предложение, до 15 слов)',
};

function loadOverrides(): Partial<PromptTemplates> {
  try {
    return storageGet<Partial<PromptTemplates>>(STORAGE_KEYS.AI_PROMPT_OVERRIDES) ?? {};
  } catch {
    return {};
  }
}

function saveOverrides(overrides: Partial<PromptTemplates>): void {
  try {
    storageSet(STORAGE_KEYS.AI_PROMPT_OVERRIDES, overrides);
  } catch { /* ignore */ }
}

export class PromptManager {
  private overrides: Partial<PromptTemplates>;

  constructor() {
    this.overrides = loadOverrides();
    this.ensureDefaults();
  }

  private ensureDefaults(): void {
    try {
      const initialized = storageGet<string>(STORAGE_KEYS.AI_PROMPT_INIT);
      if (!initialized) {
        this.overrides = {};
        saveOverrides({});
        storageSet(STORAGE_KEYS.AI_PROMPT_INIT, 'true');
      }
    } catch { /* ignore */ }
  }

  getTemplate(key: PromptKey): string {
    return this.overrides[key] ?? DEFAULT_PROMPTS[key];
  }

  setTemplate(key: PromptKey, value: string): void {
    if (value.trim() === DEFAULT_PROMPTS[key]) {
      delete this.overrides[key];
    } else {
      this.overrides[key] = value;
    }
    saveOverrides(this.overrides);
  }

  resetToDefault(key: PromptKey): void {
    delete this.overrides[key];
    saveOverrides(this.overrides);
  }

  resetAll(): void {
    this.overrides = {};
    saveOverrides(this.overrides);
  }

  exportPrompts(): string {
    return JSON.stringify(this.getAllTemplates(), null, 2);
  }

  importPrompts(json: string): string | null {
    try {
      const data = JSON.parse(json);
      const keys = Object.keys(DEFAULT_PROMPTS) as PromptKey[];
      for (const key of keys) {
        if (typeof data[key] === 'string') {
          this.setTemplate(key, data[key]);
        }
      }
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Invalid JSON format';
    }
  }

  listPresets(): string[] {
    try {
      const presets = storageGet<Record<string, PromptTemplates>>(STORAGE_KEYS.AI_PROMPT_PRESETS);
      return presets ? Object.keys(presets) : [];
    } catch { return []; }
  }

  savePreset(name: string): void {
    const current = this.getAllTemplates();
    try {
      const presets = storageGet<Record<string, PromptTemplates>>(STORAGE_KEYS.AI_PROMPT_PRESETS) ?? {};
      presets[name] = current;
      storageSet(STORAGE_KEYS.AI_PROMPT_PRESETS, presets);
    } catch { /* ignore */ }
  }

  loadPreset(name: string): boolean {
    try {
      const presets = storageGet<Record<string, PromptTemplates>>(STORAGE_KEYS.AI_PROMPT_PRESETS);
      if (!presets) return false;
      const preset = presets[name];
      if (!preset) return false;
      for (const key of Object.keys(DEFAULT_PROMPTS) as PromptKey[]) {
        const val = preset[key];
        if (val && val !== DEFAULT_PROMPTS[key]) {
          this.overrides[key] = val;
        } else {
          delete this.overrides[key];
        }
      }
      saveOverrides(this.overrides);
      return true;
    } catch { return false; }
  }

  deletePreset(name: string): boolean {
    try {
      const presets = storageGet<Record<string, PromptTemplates>>(STORAGE_KEYS.AI_PROMPT_PRESETS);
      if (!presets) return false;
      delete presets[name];
      storageSet(STORAGE_KEYS.AI_PROMPT_PRESETS, presets);
      return true;
    } catch { return false; }
  }

  getAllTemplates(): PromptTemplates {
    return { ...DEFAULT_PROMPTS, ...this.overrides };
  }

  buildPrompt(key: PromptKey, variables: Record<string, string>): string {
    let template = this.getTemplate(key);
    for (const [k, v] of Object.entries(variables)) {
      template = template.replace(`{{${k}}}`, v);
    }
    return template;
  }

  buildSystemMessage(toolId: AIToolId): string {
    const systemPrompts: Record<PromptKey, string> = {
      rename: 'Ты PPC-специалист. Отвечай ТОЛЬКО 2-4 словами — коротким названием группы. НЕ рассуждай. НЕ объясняй. НЕ показывай thinking process. НЕ используй кавычки, markdown, списки, пункты, XML-теги. ТОЛЬКО название. Никакого анализа. Никаких шагов. Только финальный ответ.',
      'group-notes': 'Ты PPC-специалист. Отвечай ТОЛЬКО одним предложением до 15 слов. НЕ рассуждай. НЕ объясняй. НЕ показывай thinking process. НЕ используй markdown, списки, теги. ТОЛЬКО описание. Никакого анализа. Никаких шагов. Только финальный ответ.',
    };
    return systemPrompts[PROMPT_KEY_MAP[toolId]] ?? 'Ты PPC-специалист. Отвечай ТОЛЬКО результатом. НЕ рассуждай. НЕ объясняй. НЕ показывай thinking process. Только итоговый ответ.';
  }

  getVariables(key: PromptKey): string[] {
    const template = this.getTemplate(key);
    const vars: string[] = [];
    const regex = /\{\{(\w+)\}\}/g;
    let match;
    while ((match = regex.exec(template)) !== null) {
      if (!vars.includes(match[1])) vars.push(match[1]);
    }
    return vars;
  }

  validate(key: PromptKey): string | null {
    const template = this.getTemplate(key).trim();
    if (!template) return 'Prompt пуст';
    if (template.length > 10000) return 'Prompt превышает 10000 символов';
    const expected = DEFAULT_PROMPTS[key];
    const defaultVars = new Set(this.getVariablesForString(expected));
    const currentVars = new Set(this.getVariablesForString(template));
    for (const v of defaultVars) {
      if (!currentVars.has(v)) return `Отсутствует обязательная переменная: {{${v}}}`;
    }
    return null;
  }

  private getVariablesForString(template: string): string[] {
    const vars: string[] = [];
    const regex = /\{\{(\w+)\}\}/g;
    let match;
    while ((match = regex.exec(template)) !== null) {
      if (!vars.includes(match[1])) vars.push(match[1]);
    }
    return vars;
  }

  getCacheHash(toolId: AIToolId, variables: Record<string, string>): string {
    const key = PROMPT_KEY_MAP[toolId];
    const template = this.getTemplate(key);
    const sortedVars = Object.entries(variables)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    const raw = `${toolId}|${template}|${sortedVars}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const chr = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return `${hash}`;
  }
}

export const promptManager = new PromptManager();
