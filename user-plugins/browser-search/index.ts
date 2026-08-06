import type { AppModule, PluginContext } from 'plugin-sdk';
import { useSettingsStore, getSearchProvider, getAllSearchProviders, registerSearchProvider, unregisterSearchProvider } from 'plugin-sdk';
import type { SearchProvider } from 'plugin-sdk';

export type { SearchProvider } from 'plugin-sdk';
const BUILTIN_PROVIDERS: SearchProvider[] = [
  { id: 'yandex',   name: 'Яндекс',   urlTemplate: 'https://yandex.ru/search/?text={query}' },
  { id: 'google',   name: 'Google',    urlTemplate: 'https://www.google.com/search?q={query}' },
  { id: 'wordstat', name: 'Wordstat',  urlTemplate: 'https://wordstat.yandex.ru/?words={query}' },
  { id: 'keys.so',  name: 'Keys.so',   urlTemplate: 'https://keys.so/report?q={query}' },
];

const CUSTOM_PROVIDER: SearchProvider = {
  id: 'custom', name: 'Custom', urlTemplate: 'https://custom.search?q={query}',
};

export const DEFAULT_SEARCH_ENGINES: SearchProvider[] = [...BUILTIN_PROVIDERS, CUSTOM_PROVIDER];

export function getSearchUrl(query: string): string {
  const engineId = (useSettingsStore.getState().getModuleSetting('browser-search', 'searchEngine') as string) ?? 'yandex';
  if (engineId === 'custom') {
    const customUrl = (useSettingsStore.getState().getModuleSetting('browser-search', 'customSearchUrl') as string) || '';
    if (customUrl) {
      return customUrl.replace('{query}', encodeURIComponent(query));
    }
  }
  const engine = getSearchProvider(engineId) ?? getAllSearchProviders()[0];
  if (!engine) {
    const fallback = BUILTIN_PROVIDERS.find(e => e.id === engineId) ?? BUILTIN_PROVIDERS[0];
    return fallback.urlTemplate.replace('{query}', encodeURIComponent(query));
  }
  return engine.urlTemplate.replace('{query}', encodeURIComponent(query));
}

export async function openInBrowser(query: string): Promise<void> {
  const url = getSearchUrl(query);
  try {
    const { open } = await import('@tauri-apps/plugin-shell');
    await open(url);
  } catch {
    window.open(url, '_blank');
  }
}

const browserSearchModule: AppModule = {
  manifest: {
    id: 'browser-search',
    name: 'Поиск в браузере',
    version: '1.0.0',
    description: 'Кнопка поиска напротив каждой фразы + настройка поисковой системы',
    category: 'data',
    slot: ['phrase-row:actions'],
    dependencies: [],
    settingsSchema: [
      { key: 'searchEngine', type: 'string', label: 'Поисковик', default: 'yandex' },
      { key: 'customSearchUrl', type: 'string', label: 'URL шаблон', default: 'https://google.com/search?q={query}' },
    ],
    repository: 'https://github.com/keycluster/kc-browser-search',
    minAppVersion: '0.3.0',
  },

  init(ctx: PluginContext) {
    for (const p of BUILTIN_PROVIDERS) {
      registerSearchProvider(p);
    }

    ctx.registerUI({
      slot: 'phrase-row:actions',
      label: 'Поиск в браузере',
      icon: 'search',
      action: (phrase, _actionCtx) => {
        openInBrowser(phrase.text);
      },
      order: 100,
    });

    ctx.registerCommand('open-search', () => {
      const text = document.getSelection()?.toString();
      if (text) openInBrowser(text);
    });
    ctx.registerKeybinding?.('ctrl+shift+f', 'open-search', { label: 'Поиск выделенного в браузере' });
  },

  destroy() {
    for (const p of BUILTIN_PROVIDERS) {
      unregisterSearchProvider(p.id);
    }
  },
};

export default browserSearchModule;
