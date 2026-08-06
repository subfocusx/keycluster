export const STORAGE_KEYS = {
  PLUGIN_REGISTRY:        'keycluster:plugin-registry',
  CATEGORY_CONFIG:        'keycluster:category-config-v1',
  CATEGORY_OVERRIDES:     'keycluster:category-overrides-v2',
  RECENT_COMMANDS:        'keycluster:recent-commands',
  AI_PROMPT_OVERRIDES:    'keycluster:ai-prompt-overrides',
  AI_PROMPT_PRESETS:      'keycluster:ai-prompt-presets',
  AI_PROMPT_INIT:         'keycluster:ai-prompt-init',
  CLUSTERING_HISTORY:     'keycluster:clustering-history',
  AUTO_SAVE_INTERVAL:     'keycluster:auto-save-interval',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

export function storageGet<T>(key: StorageKey): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function storageSet<T>(key: StorageKey, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`[Storage] Failed to write key "${key}":`, e);
  }
}

export function storageRemove(key: StorageKey): void {
  try {
    localStorage.removeItem(key);
  } catch { /* ignore */ }
}
