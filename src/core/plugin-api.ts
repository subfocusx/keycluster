// ╔══════════════════════════════════════════════════════════╗
// ║  @plugin-api — ПУБЛИЧНЫЙ API ДЛЯ ПЛАГИНОВ              ║
// ║  Версия: 1.0. Backward-compatible контракт.             ║
// ║  Изменения только с bumping версии PLUGIN_API_VERSION.  ║
// ╚══════════════════════════════════════════════════════════╝
// ============================================================
// KeyCluster Plugin API — версионированный контракт для модулей
// ============================================================
//
// Принципы:
//   1. Backward-compatible — все модули получают PluginContext (единый контракт)
//   2. ModuleContext остаётся type alias для обратной совместимости
//   3. apiVersion позволяет модулям проверять совместимость при init()
//   4. Все новые методы опциональны к использованию
//
// Жизненный цикл модуля через PluginContext:
//   init(ctx: PluginContext) → ctx.registerUI / registerCommand / registerKeybinding / registerLifecycleHook
//   ...
//   beforeDestroy hook → destroy()
// ============================================================

import type {
  EventBus,
  StoreAccess,
  ModuleUIContribution,
  FilterContribution,
} from './types';
import type { SlotOptions } from './module-runtime-types';
import type { PlatformAPI } from './platform-api/types';
import type { SearchProvider } from './search-provider-registry';
import type { ExportFormat } from './export-registry';
import type { NetworkRecord } from './network/NetworkStore';

// ---- API Version ----

/**
 * Текущая версия Plugin API.
 * Модули могут сверять эту константу со своей ожидаемой версией,
 * чтобы обнаружить несовместимость на этапе init().
 *
 * @example
 * ```ts
 * init(ctx) {
 *   if (ctx.apiVersion !== '1.0') {
 *     console.warn(`[my-module] Expected API 1.0, got ${ctx.apiVersion}`);
 *   }
 * }
 * ```
 */
export const PLUGIN_API_VERSION = '1.0' as const;

/** Тип версии API — строковый semver-minor */
export type PluginAPIVersion = typeof PLUGIN_API_VERSION;

// ---- Lifecycle Hooks ----

/**
 * Поддерживаемые события жизненного цикла модуля.
 *
 * - `beforeDestroy` — вызывается перед destroy() модуля, позволяет
 *   сохранить состояние, закрыть соединения, отписаться от событий.
 *   Порядок: обратный топологическому (зависимые модули уничтожаются первыми).
 *
 * - `onSettingsChange` — вызывается при изменении настроек модуля
 *   (когда система настроек будет реализована, пока заглушка).
 *   Payload: { moduleId: string; key: string; value: unknown }
 */
export type LifecycleEvent = 'beforeDestroy' | 'onSettingsChange';

/**
 * Обработчик события жизненного цикла.
 * Для beforeDestroy — вызывается без аргументов.
 * Для onSettingsChange — вызывается с { moduleId, key, value }.
 */
export type LifecycleHook = (payload?: Record<string, unknown>) => void;

// ---- Keybindings ----

/**
 * Привязка клавиатурного сокращения к зарегистрированной команде.
 *
 * Формат ключей — Electron accelerator style:
 *   'Ctrl+K'       — Ctrl + K
 *   'Ctrl+Shift+F' — Ctrl + Shift + F
 *   'Alt+Enter'    — Alt + Enter
 *
 * Команда должна быть предварительно зарегистрирована через registerCommand().
 * Если команда не найдена на момент нажатия — warning в консоль.
 */
export interface KeybindingBinding {
  /** Клавиатурное сокращение (Electron accelerator format) */
  keys: string;
  /** Идентификатор команды (без префикса moduleId — runtime подставит сам) */
  commandId: string;
  /** Человекочитаемая метка для Command Palette */
  label?: string;
  /** Условие видимости (пока зарезервировано, аналог VS Code when-clauses) */
  when?: string;
}

// ---- Plugin Context ----

/**
 * Расширенный контекст модуля — версионированный Plugin API.
 *
 * Содержит базовые методы (eventBus, store, registerUI, registerCommand)
 * и расширенные возможности. Все модули используют PluginContext напрямую.
 * продолжают работать без изменений — PluginContext является superset.
 *
 * @example
 * ```ts
 * // Старый модуль — работает как раньше
 * const myModule: AppModule = {
 *   manifest: { id: 'old', ... },
 *   init(ctx) {
 *     ctx.registerCommand('doStuff', () => { ... });
 *     // ctx.apiVersion — есть, но не обязателен к проверке
 *   },
 *   destroy() {},
 * };
 *
 * // Новый модуль — использует расширенный API
 * const newModule: AppModule = {
 *   manifest: { id: 'new', ... },
 *   init(ctx) {
 *     const version = ctx.apiVersion; // '1.0'
 *     ctx.registerCommand('search', () => { ... });
 *     ctx.registerKeybinding('Ctrl+Shift+F', 'search', { label: 'Поиск' });
 *     ctx.registerLifecycleHook('beforeDestroy', () => {
 *       console.log('[new] Cleaning up...');
 *     });
 *   },
 *   destroy() {},
 * };
 * ```
 *
 * Доступные action-ы через ctx.store.dispatch():
 *   - 'addGroup'          { name: string, parentId?: string | null }
 *   - 'addPhrases'        { texts: string[], groupId: string, extra?: Partial<Phrase>[] }
 *   - 'deletePhrases'     string[]
 *   - 'movePhrases'       { ids: string[], targetGroupId: string }
 *   - 'copyPhrases'       { ids: string[], targetGroupId: string }
 *   - 'setActiveGroup'    string | null
 *   - 'setLeftPanel'      { open: boolean, module?: string | null }
 *   - 'setRightPanel'     { open: boolean }
 *   - ...см. src/core/store.ts createStoreAccess
 */
export interface PluginContext {
  eventBus: EventBus;
  store: StoreAccess;
  registerUI(contribution: ModuleUIContribution): void;
  registerCommand(id: string, handler: () => void, options?: { label?: string; category?: string }): void;

  /**
   * Платформенный API: ограниченный доступ к runtime, state, events и логам.
   * Предоставляет read-only доступ к состоянию, subscribe-only к событиям,
   * и информацию о рантайме. Не даёт модулям прямых write-привилегий
   * (для записи модули должны использовать ctx.store / Zustand напрямую).
   */
  readonly api: PlatformAPI;

  /**
   * Сетевые запросы текущего плагина.
   * Только свои записи — трафик других плагинов недоступен.
   */
  readonly network: {
    getMyRequests(): NetworkRecord[];
  };

  /**
   * Версия Plugin API, с которой модуль был инициализирован.
   * Позволяет модулю проверить совместимость на этапе init().
   * Формат: semver-major.minor (например, '1.0').
   */
  readonly apiVersion: PluginAPIVersion;

  /**
   * Зарегистрировать обработчик события жизненного цикла модуля.
   *
   * Поддерживаемые события:
   * - `beforeDestroy` — вызывается перед destroy(), позволяет очистить ресурсы.
   *   Множественные хуки выполняются в порядке регистрации.
   * - `onSettingsChange` — вызывается при изменении настроек модуля.
   *   Payload: { moduleId: string; key: string; value: unknown }
   *
   * Возвращает функцию для отписки (аналогично EventBus.on()).
   *
   * @param event — одно из поддерживаемых событий жизненного цикла
   * @param hook — функция-обработчик, вызываемая при наступлении события
   * @returns функция отписки — удаляет зарегистрированный хук
   *
   * @example
   * ```ts
   * const unsub = ctx.registerLifecycleHook('beforeDestroy', () => {
   *   saveCacheToDisk();
   * });
   * // Позже можно отписаться:
   * unsub();
   * ```
   */
  registerLifecycleHook(event: LifecycleEvent, hook: LifecycleHook): () => void;

  /**
   * Зарегистрировать клавиатурное сокращение для команды модуля.
   *
   * Команда должна быть предварительно зарегистрирована через registerCommand().
   * Runtime автоматически добавит префикс moduleId к commandId при поиске обработчика.
   * Если два модуля регистрируют одинаковый keybinding — побеждает последний
   * зарегистрированный (с warning в консоль).
   *
   * @param keys — клавиатурное сокращение в формате Electron accelerator
   *               ('Ctrl+K', 'Ctrl+Shift+F', 'Alt+Enter')
   * @param commandId — идентификатор команды (без префикса moduleId)
   * @param options — дополнительные параметры (label для palette, when-условие)
   *
   * @example
   * ```ts
   * ctx.registerCommand('find', () => openFindDialog());
   * ctx.registerKeybinding('Ctrl+F', 'find', { label: 'Найти' });
   * ```
   */
  registerKeybinding(
    keys: string,
    commandId: string,
    options?: Omit<KeybindingBinding, 'keys' | 'commandId'>,
  ): void;

  /**
   * Зарегистрировать кастомный UI-слот.
   * Позволяет модулю объявить новое место для рендера UI-компонентов.
   * Другие модули могут добавить свои contributions в этот слот.
   *
   * @param slotId — уникальный идентификатор слота
   * @param options — метка и видимость по умолчанию
   *
   * @example
   * ```ts
   * ctx.declareSlot('analytics:chart', { label: 'Analytics Charts' });
   * ```
   */
  declareSlot(slotId: string, options?: SlotOptions): void;

  /**
   * Зарегистрировать кастомные цветные метки-теги для фраз.
   * Плагин может добавлять свои цвета поверх встроенных 6.
   */
  registerLabels(labels: Array<{ name: string; value: string; displayName: string }>): void;

  /**
   * Инжектировать CSS в документ (тема, кастомные стили).
   * Автоматически удаляется при destroy().
   * @param id — уникальный ID тега <style> (во избежание дублей)
   * @param css — CSS-строка с переменными или правилами
   */
  injectCSS(id: string, css: string): void;

  /**
   * Получить настройки ядра (не привязанные к модулю).
   * Хранится в settingsStore под ключом 'core'.
   */
  getCoreSettings(): Record<string, unknown>;

  /**
   * Установить настройку ядра.
   * @param key — ключ настройки
   * @param value — значение
   */
  setCoreSettings(key: string, value: unknown): void;

  /**
   * Получить настройку текущего модуля по ключу.
   * Автоматически привязана к moduleId — плагин читает только свои настройки.
   * Возвращает значение из хранилища или default из settingsSchema.
   *
   * @param key — ключ настройки
   *
   * @example
   * ```ts
   * const threshold = ctx.getSetting('threshold') as number ?? 0.3;
   * ```
   */
  getSetting(key: string): unknown;

  /**
   * Установить настройку текущего модуля.
   * Автоматически привязана к moduleId — плагин пишет только свои настройки.
   *
   * @param key — ключ настройки
   * @param value — значение
   */
  setSetting(key: string, value: unknown): void;

  // ---- Runtime Execution Control ----

  /**
   * Безопасный setTimeout — автоматически очищается при destroy/disable.
   * Использовать ВМЕСТО глобального setTimeout в модулях.
   */
  setTimeout(fn: () => void, ms: number): ReturnType<typeof setTimeout>;

  /**
   * Безопасный setInterval — автоматически очищается при destroy/disable.
   * Использовать ВМЕСТО глобального setInterval в модулях.
   */
  setInterval(fn: () => void, ms: number): ReturnType<typeof setInterval>;

  /**
   * Безопасная подписка на EventBus — автоматически отписывается при destroy/disable.
   * Использовать ВМЕСТО eventBus.on() в модулях.
   */
  onEvent<T>(event: string, handler: (payload: T) => void): () => void;

  /**
   * Безопасная подписка на store — автоматически отписывается при destroy/disable.
   */
  subscribeStore(listener: () => void): () => void;

  /**
   * Выполнить зарегистрированную команду по полному ID (moduleId:commandId).
   * Позволяет плагинам вызывать команды друг друга.
   *
   * @param id — полный идентификатор команды (например, 'deduplicator:deduplicate')
   *
   * @example
   * ```ts
   * ctx.executeCommand('groups:create-group');
   * ctx.executeCommand('import-export:export-csv');
   * ```
   */
  executeCommand(id: string): void;

  /**
   * Зарегистрировать поисковый провайдер.
   * Автоматически удаляется из search-provider-registry при destroy.
   */
  registerSearchProvider(provider: SearchProvider): void;

  /**
   * Зарегистрировать формат экспорта.
   * Автоматически удаляется из export-registry при destroy.
   */
  registerExporter(exporter: ExportFormat): void;

  /**
   * Зарегистрировать фильтр фраз.
   * Автоматически удаляется из filter-registry при destroy.
   */
  registerFilter(filter: FilterContribution): void;

  /**
   * Fetch с автоматическим x-plugin-id заголовком.
   * Гарантирует, что запросы плагина корректно атрибутируются в NetworkStore.
   * Использовать вместо window.fetch внутри модулей.
   */
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

// ---- Runtime Registry Types (internal use) ----

/**
 * Внутренняя запись о зарегистрированном keybinding.
 * Используется ModuleRuntime для хранения привязок.
 */
export interface RegisteredKeybinding {
  /** ID модуля-владельца */
  moduleId: string;
  /** Полный идентификатор команды (moduleId:commandId) */
  fullCommandId: string;
  /** Клавиатурное сокращение */
  keys: string;
  /** Человекочитаемая метка */
  label: string;
  /** When-условие (зарезервировано) */
  when?: string;
}

/**
 * Внутренняя запись о зарегистрированном lifecycle hook.
 */
export interface RegisteredLifecycleHook {
  moduleId: string;
  event: LifecycleEvent;
  hook: LifecycleHook;
}
