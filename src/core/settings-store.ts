// ============================================================
// KeyCluster Settings Store — Zustand слайс для настроек модулей
// ============================================================
//
// Хранит настройки вида: { [moduleId]: { [key]: value } }
// Персистентность через localStorage (zustand/middleware/persist)
//
// API:
//   getModuleSetting(moduleId, key) — получить значение (или default из schema)
//   setModuleSetting(moduleId, key, value) — установить значение
//   getAllModuleSettings(moduleId) — получить все настройки модуля
//   resetModuleSettings(moduleId, schema?) — сбросить к defaults
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SettingFieldSchema } from './types';

// ---- Types ----

export interface ModuleSettingsMap {
  [moduleId: string]: {
    [key: string]: unknown;
  };
}

interface SettingsSlice {
  settings: ModuleSettingsMap;

  /** Получить значение настройки модуля */
  getModuleSetting: (moduleId: string, key: string) => unknown;

  /** Установить значение настройки модуля */
  setModuleSetting: (moduleId: string, key: string, value: unknown) => void;

  /** Получить все настройки модуля */
  getAllModuleSettings: (moduleId: string) => Record<string, unknown>;

  /** Сбросить настройки модуля к значениям по умолчанию */
  resetModuleSettings: (moduleId: string, schema?: SettingFieldSchema[]) => void;
}

// ---- Store ----

export const useSettingsStore = create<SettingsSlice>()(
  persist(
    (set, get) => ({
      settings: {},

      getModuleSetting: (moduleId, key) => {
        const state = get();
        const value = state.settings[moduleId]?.[key];
        return value;
      },

      setModuleSetting: (moduleId, key, value) => {
        set(s => ({
          settings: {
            ...s.settings,
            [moduleId]: {
              ...s.settings[moduleId],
              [key]: value,
            },
          },
        }));
      },

      getAllModuleSettings: (moduleId) => {
        return get().settings[moduleId] ?? {};
      },

      resetModuleSettings: (moduleId, schema) => {
        set(s => {
          const defaults: Record<string, unknown> = {};
          if (schema) {
            for (const field of schema) {
              defaults[field.key] = field.default;
            }
          }
          return {
            settings: {
              ...s.settings,
              [moduleId]: defaults,
            },
          };
        });
      },
    }),
    {
      name: 'keycluster-settings',
      partialize: (state) => ({ settings: state.settings }),
    },
  ),
);
