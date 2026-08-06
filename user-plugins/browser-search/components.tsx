import React, { useReducer } from 'react';
import type { AppModule, PluginContext } from 'plugin-sdk';
import { useSettingsStore } from 'plugin-sdk';
function MIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

const ENGINE_OPTIONS = [
  { id: 'yandex', label: 'Яндекс' },
  { id: 'google', label: 'Google' },
  { id: 'wordstat', label: 'Wordstat' },
  { id: 'keys.so', label: 'Keys.so' },
  { id: 'custom', label: 'Custom' },
];

export function SearchEngineSettings() {
  const [, forceUpdate] = useReducer(x => x + 1, 0);
  const current = (useSettingsStore.getState().getModuleSetting('browser-search', 'searchEngine') as string) ?? 'yandex';
  const customUrl = (useSettingsStore.getState().getModuleSetting('browser-search', 'customSearchUrl') as string) ?? '';

  const setEngine = (id: string) => {
    useSettingsStore.getState().setModuleSetting('browser-search', 'searchEngine', id);
    forceUpdate();
  };

  const setCustomUrl = (url: string) => {
    useSettingsStore.getState().setModuleSetting('browser-search', 'customSearchUrl', url);
    forceUpdate();
  };

  return (
    <div className="p-4 space-y-4 text-[12px]">
      <h4 className="text-[13px] font-semibold text-[var(--kc-text)] mb-1.5 flex items-center gap-1.5">
        <MIcon name="search" className="!text-[16px] text-[var(--kc-blue)]" />
        Поиск в браузере
      </h4>

      <div className="space-y-2">
        <label className="text-[11px] font-medium text-[var(--kc-text)]">
          Поисковая система
        </label>
        {ENGINE_OPTIONS.map(opt => (
          <label
            key={opt.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-[var(--bg-hover)]"
          >
            <input
              type="radio"
              name="searchEngine"
              className="accent-[var(--accent-blue)]"
              checked={current === opt.id}
              onChange={() => setEngine(opt.id)}
            />
            <span className="text-[12px]">{opt.label}</span>
          </label>
        ))}
      </div>

      {current === 'custom' && (
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-[var(--kc-text)]">
            URL шаблон
          </label>
          <input
            className="w-full h-7 text-[12px] rounded border border-[var(--kc-border)] bg-[var(--kc-surface)] px-2 font-mono"
            placeholder="https://site.com/search?q={query}"
            value={customUrl}
            onChange={e => setCustomUrl(e.target.value)}
          />
          <p className="text-[10px] text-[var(--kc-text-secondary)]">
            Используйте {'{query}'} как placeholder для поискового запроса.
          </p>
        </div>
      )}

      <p className="text-[10px] text-[var(--kc-text-secondary)]">
        Выберите поисковую систему для кнопки поиска напротив каждой фразы.
      </p>
    </div>
  );
}
