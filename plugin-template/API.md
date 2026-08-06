# KeyCluster Plugin API Reference

Полный справочник по API хоста, доступному из плагинов через `ctx` и `plugin-sdk`.

## Содержание

- [PluginContext (ctx)](#plugincontext-ctx)
- [Store — чтение состояния](#store--чтение-состояния)
- [Store — dispatch (полная таблица)](#store--dispatch-полная-таблица)
- [Типы данных](#типы-данных)
- [EventBus — события](#eventbus--события)
- [Хуки SDK](#хуки-sdk)
- [UI-компоненты из SDK](#ui-компоненты-из-sdk)
- [Утилиты из SDK](#утилиты-из-sdk)
- [Поисковый провайдер и экспортёр](#поисковый-провайдер-и-экспортёр)

---

## PluginContext (ctx)

Объект `ctx` передаётся в `init(ctx: PluginContext)` и является основной точкой входа в API хоста.

```ts
init(ctx: PluginContext) {
  // Все методы доступны здесь
}
```

### Полная таблица методов ctx

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `registerCommand` | `(id, handler) => void` | Зарегистрировать команду. ID без префикса — runtime добавит `moduleId:` автоматически |
| `registerKeybinding` | `(keys, commandId, options?) => void` | Привязать горячую клавишу к команде. Формат: `'Ctrl+Shift+K'` |
| `registerUI` | `(contribution) => void` | Зарегистрировать UI-вклад в слот (компонент или action) |
| `executeCommand` | `(id) => void` | Выполнить команду. Формат: `'moduleId:commandId'` |
| `onEvent` | `(event, handler) => void` | Подписка на событие EventBus. Авто-cleanup при destroy |
| `subscribeStore` | `(callback) => () => void` | Подписка на изменения store. Авто-cleanup при destroy |
| `injectCSS` | `(id, cssText) => void` | Инжект CSS в документ. Авто-удаление при destroy |
| `declareSlot` | `(slotId, options) => void` | Объявить кастомный слот для других плагинов |
| `registerLabels` | `(labels) => void` | Зарегистрировать кастомные метки-теги |
| `registerFilter` | `(filter) => void` | Зарегистрировать фильтр фраз |
| `registerSearchProvider` | `(provider) => void` | Зарегистрировать поисковый провайдер |
| `registerExporter` | `(exporter) => void` | Зарегистрировать формат экспорта |
| `registerLifecycleHook` | `(event, hook) => void` | Хук жизненного цикла: `'beforeDestroy'`, `'onSettingsChange'` |
| `getSetting` | `(key) => unknown` | Прочитать настройку плагина (ctx знает свой moduleId) |
| `setSetting` | `(key, value) => void` | Записать настройку плагина |
| `getCoreSettings` | `() => unknown` | Прочитать глобальные настройки приложения ⚠ осторожно |
| `setCoreSettings` | `(key, value) => void` | Записать глобальную настройку ⚠ осторожно |
| `setTimeout` | `(fn, ms) => void` | Безопасный setTimeout. Авто-отмена при destroy |
| `setInterval` | `(fn, ms) => void` | Безопасный setInterval. Авто-отмена при destroy |
| `fetch` | `(input, init?) => Promise<Response>` | fetch с заголовком `x-plugin-id`. Только для **внутренних** URL (`/api/...`, `tauri://...`) |
| `api.httpRequest` | `(options) => Promise<HttpResponse>` | HTTP через Tauri IPC. Для **внешних** сервисов (обходит CORS) |
| `network.getMyRequests` | `() => NetworkRecord[]` | Список сетевых запросов плагина (для отладки) |
| `store` | `StoreAccess` | Прямой доступ к store (см. ниже) |
| `eventBus` | `EventBus` | Прямой доступ к шине событий |
| `apiVersion` | `'1.0'` | Версия Plugin API |

---

## Store — чтение состояния

```ts
// Получить полное состояние
const state = ctx.store.getState();

// Получить срез состояния
const groups  = ctx.store.getStateSlice('groups');
const phrases = ctx.store.getStateSlice('phrases');

// Подписка на изменения
ctx.subscribeStore(() => {
  const count = ctx.store.getState().phrases.length;
});
```

### Интерфейс AppState

```ts
interface AppState {
  // Данные проекта
  groups:          Group[];
  phrases:         Phrase[];
  minusWords:      MinusWord[];
  minusWordGroups: MinusWordGroup[];

  // Выделение
  selectedGroupIds:  Set<string>;   // ID выбранных групп
  selectedPhraseIds: Set<string>;   // ID выбранных фраз
  activeGroupId:     string | null; // Активная (открытая) группа

  // UI
  ui: UIState;
}
```

### Интерфейс UIState

```ts
interface UIState {
  leftPanel: {
    open:   boolean;
    width:  number;        // px, от 200 до 500
    module: string | null; // ID модуля, открытого в панели
  };
  rightPanel: {
    open:  boolean;
    width: number;
  };
  ribbon: {
    activeTab: string;
  };
  theme:           'light' | 'dark' | 'dark-pro';
  modulesLoading:  boolean;
  failedModules:   string[];
  dbPersistenceEnabled: boolean;
  multigroupMode:  boolean;
  columnVisibility: Record<string, boolean>;
  columnLabels:     Record<string, string>;
  columnColors:     Record<string, string>;
}
```

### Важное про структуру фраз

> Фразы хранятся в **плоском массиве** `state.phrases`, а не вложены в группы.
> Связь с группой — через поле `phrase.groupId`.

```ts
// Получить фразы конкретной группы:
const groupPhrases = state.phrases.filter(p => p.groupId === group.id);
```

---

## Store — dispatch (полная таблица)

Все мутации состояния — через `ctx.store.dispatch(action, payload)`.

> Каждый вызов dispatch автоматически добавляет снимок в стек undo/redo (кроме `updatePhraseNoUndo`).

### Группы

| Action | Payload | Описание |
|--------|---------|----------|
| `addGroup` | `{ name: string, parentId: string \| null }` | Создать группу. Возвращает ID |
| `renameGroup` | `{ id: string, name: string }` | Переименовать группу |
| `deleteGroup` | `string` (id) | Удалить группу и всех потомков (и их фразы) |
| `deleteGroups` | `string[]` | Удалить несколько групп и всех потомков |
| `moveGroups` | `{ ids: string[], newParentId: string \| null }` | Переместить группы. Защита от перемещения в собственного потомка |
| `toggleExpand` | `string` (id) | Свернуть/развернуть группу в дереве |

### Фразы

| Action | Payload | Описание |
|--------|---------|----------|
| `addPhrases` | `{ texts: string[], groupId: string, extra?: Partial<Phrase>[] }` | Добавить фразы. `texts` — массив **строк**. `id` и `createdAt` генерируются автоматически |
| `deletePhrases` | `string[]` | Удалить фразы по ID |
| `movePhrases` | `{ ids: string[], targetGroupId: string }` | Переместить фразы в другую группу |
| `copyPhrases` | `{ ids: string[], targetGroupId: string }` | Скопировать фразы (новые ID) |
| `updatePhrase` | `{ id: string, updates: Partial<Phrase> }` | Обновить поля фразы (с undo) |
| `updatePhraseNoUndo` | `{ id: string, updates: Partial<Phrase> }` | Обновить поля фразы (без undo — для фоновых операций) |
| `addTagToPhrase` | `{ id: string, tag: string }` | Добавить тег фразе (теги хранятся lowercase) |
| `removeTagFromPhrase` | `{ id: string, tag: string }` | Удалить тег у фразы |
| `moveToTrash` | `string[]` | Переместить фразы в корзину (корзина создаётся автоматически) |
| `restoreFromTrash` | `string[]` | Восстановить фразы из корзины в исходную группу |
| `clearTrash` | _(нет payload)_ | Удалить все фразы из корзины |

### Выделение

| Action | Payload | Описание |
|--------|---------|----------|
| `setActiveGroup` | `string \| null` | Установить активную (открытую) группу |
| `setSelectedGroupIds` | `Set<string>` | Установить выделенные группы |

### UI

| Action | Payload | Описание |
|--------|---------|----------|
| `setLeftPanel` | `{ open: boolean, module?: string \| null }` | Открыть/закрыть левую панель. `module` — ID плагина для отображения |
| `setRightPanel` | `{ open: boolean }` | Открыть/закрыть правую панель |
| `setMultigroupMode` | `boolean` | Включить/выключить режим нескольких групп |

### Прочее

| Action | Payload | Описание |
|--------|---------|----------|
| `clearAll` | _(нет payload)_ | Сбросить всё состояние проекта |
| `setClusteringResults` | `Map<string, Phrase[]> \| null` | Установить результаты кластеризации |
| `applyClusteringResults` | _(нет payload)_ | Применить результаты кластеризации (создать группы и переместить фразы) |
| `pushUndo` | _(нет payload)_ | Вручную добавить снимок в стек undo |
| `batchOperation` | `(state) => void` | Атомарная пакетная операция через функцию-мутатор |

### Примеры

```ts
// Создать группу
ctx.store.dispatch('addGroup', { name: 'SEO фразы', parentId: null });

// Добавить фразы
ctx.store.dispatch('addPhrases', {
  groupId: 'group-123',
  texts: ['купить телефон', 'купить ноутбук', 'купить планшет'],
});

// Добавить фразы с дополнительными полями
ctx.store.dispatch('addPhrases', {
  groupId: 'group-123',
  texts: ['запрос с частотой'],
  extra: [{ frequency: 1500, kei: 7.2 }],
});

// Обновить фразу
ctx.store.dispatch('updatePhrase', {
  id: 'phrase-456',
  updates: { text: 'новый текст', notes: 'важная фраза' },
});

// Добавить тег
ctx.store.dispatch('addTagToPhrase', { id: 'phrase-456', tag: 'important' });

// Переместить в корзину
ctx.store.dispatch('moveToTrash', ['phrase-1', 'phrase-2']);

// Открыть левую панель с конкретным модулем
ctx.store.dispatch('setLeftPanel', { open: true, module: 'my-plugin' });

// Включить мультигрупповой режим
ctx.store.dispatch('setMultigroupMode', true);
```

---

## Типы данных

### Phrase

```ts
interface Phrase {
  id:          string;        // KCID — UUID, генерируется хостом
  text:        string;        // Текст фразы
  groupId:     string;        // ID группы (плоская структура!)
  frequency?:  number;        // Частотность
  kei?:        number;        // KEI
  cpc?:        number;        // CPC
  competition?: number;       // Конкурентность (0-1)
  notes?:      string;        // Заметки
  tags?:       string[];      // Теги (lowercase)
  intent?:     IntentType;    // Интент: 'transactional' | 'commercial' | 'informational' | 'navigational'
  createdAt:   number;        // Unix timestamp (ms)
  starredAt?:  number;        // Unix timestamp (ms) — если фраза в избранном
}
```

### Group

```ts
interface Group {
  id:         string;
  name:       string;
  parentId:   string | null;  // null — корневая группа
  color?:     string;         // CSS-цвет (#hex, rgb, ...)
  notes?:     string;
  isExpanded: boolean;        // Развёрнута в дереве
  isTrash:    boolean;        // Системная группа "Корзина"
  createdAt:  number;
  clusterQuality?: {
    score:     number;        // 0-100
    reason:    string;
    updatedAt: number;
  };
}
```

### MinusWord

```ts
interface MinusWord {
  id:         string;
  text:       string;
  isExact:    boolean;
  groupId:    string | null;
  searchType: 'exact' | 'broad' | 'broad_modified';
  createdAt:  number;
  mwGroupId?: string | null;
}
```

### IntentType

```ts
type IntentType = 'transactional' | 'commercial' | 'informational' | 'navigational';
```

---

## EventBus — события

### Методы ctx.eventBus

```ts
// Подписка (возвращает функцию отписки)
const unsub = ctx.eventBus.on('phrases:changed', (data) => { ... });
unsub(); // отписаться вручную

// Подписка с авто-cleanup (рекомендуется)
ctx.onEvent('phrases:changed', (data) => { ... });

// Emit
ctx.eventBus.emit('notify', { message: 'Готово!', duration: 2000 });

// Подписка один раз
ctx.eventBus.once('project:loaded', () => { ... });
```

### Стандартные события приложения

| Событие | Когда |
|---------|-------|
| `groups:changed` | Изменились группы (добавление, удаление, переименование) |
| `phrases:changed` | Изменились фразы |
| `minus-words:changed` | Изменились минус-слова |
| `group:selected` | Пользователь выбрал группу |
| `phrase:selected` | Пользователь выбрал фразу |
| `selection:changed` | Изменилось выделение (группы или фразы) |
| `left-panel:open` | Левая панель открылась |
| `left-panel:close` | Левая панель закрылась |
| `right-panel:toggle` | Правая панель переключилась |
| `theme:changed` | Сменилась тема оформления |
| `multigroup:enter` | Включён мультигрупповой режим |
| `multigroup:exit` | Мультигрупповой режим выключен |
| `project:loaded` | Проект загружен с диска |
| `project:updated` | Проект сохранён/обновлён |
| `module:registered` | Зарегистрирован модуль |
| `module:initialized` | Модуль инициализирован |
| `module:error` | Ошибка в модуле |
| `module:disabled` | Модуль отключён |
| `module:enabled` | Модуль включён |

### Специальные события для плагинов

| Событие | Payload | Назначение |
|---------|---------|-----------|
| `notify` | `{ message: string, duration?: number }` | Показать toast-уведомление пользователю |
| `tool:open` | `{ moduleId: string }` | Открыть инструмент в левой панели |

```ts
// Показать уведомление пользователю
ctx.eventBus.emit('notify', { message: 'Обработка завершена', duration: 3000 });
```

---

## Хуки SDK

Импортируйте из `'plugin-sdk'` (в TypeScript) или из `'./lib/sdk-shim'` (в скомпилированном плагине):

```ts
import { useAppStore, useSettingsStore, useTabStore, toast } from 'plugin-sdk';
```

### useAppStore

Zustand-хук для подписки на состояние приложения в React-компонентах.

```tsx
function MyPanel() {
  // Подписка на срез (оптимальнее, чем весь state)
  const groups  = useAppStore(s => s.groups);
  const phrases = useAppStore(s => s.phrases);

  // Фильтрация фраз по группе
  const activeGroupId = useAppStore(s => s.activeGroupId);
  const groupPhrases  = useAppStore(s =>
    s.phrases.filter(p => p.groupId === activeGroupId)
  );

  return <div>Групп: {groups.length}, Фраз: {groupPhrases.length}</div>;
}
```

> `useAppStore` — React-хук. Использовать **только внутри React-компонентов**.
> Для чтения вне компонентов используйте `ctx.store.getState()`.

### useSettingsStore

```tsx
function SettingsPanel() {
  const theme = useSettingsStore(s => s.theme);
  return <div>Текущая тема: {theme}</div>;
}
```

### toast

```ts
import { toast } from 'plugin-sdk';

toast({ title: 'Готово!', description: 'Обработано 150 фраз', duration: 3000 });
```

---

## UI-компоненты из SDK

SDK реэкспортирует shadcn/ui-компоненты. Используйте их для единообразного UI:

```ts
import {
  Button, Input, Label,
  Checkbox, Switch,
  Badge, Slider, Progress,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
  ScrollArea,
  RadioGroup, RadioGroupItem,
} from 'plugin-sdk';
```

### Пример диалога

```tsx
import React, { useState } from 'react';
import { Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from 'plugin-sdk';

function MyDialog({ open, onClose }: { open: boolean, onClose: () => void }) {
  const [value, setValue] = useState('');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Мой диалог</DialogTitle>
        </DialogHeader>
        <Input
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Введите текст"
        />
        <DialogFooter>
          <Button onClick={() => { console.log(value); onClose(); }}>
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Утилиты из SDK

| Утилита | Назначение |
|---------|-----------|
| `preprocessPhrase(text, opts)` | Предобработка текста (лемматизация, стоп-слова, синонимы) |
| `simpleLemmatize(word)` | Простая лемматизация слова |
| `DEFAULT_STOP_WORDS` | Набор стоп-слов по умолчанию (`Set<string>`) |
| `buildChildrenMap(groups)` | Построить `Map<groupId, Group[]>` для работы с деревом |
| `collectWithDescendants(id, childrenMap)` | Собрать ID группы со всеми потомками в `Set<string>` |
| `computeProjectStats(state)` | Статистика проекта: кол-во групп, фраз, среднее и т.д. |
| `LogStore` | Логирование через встроенную систему (`_log(level, tag, msg, data)`) |
| `globalErrorCollector` | Сбор ошибок модуля |
| `getRuntime()` | Получить runtime модулей (для межмодульных вызовов) |
| `registerExportFormat(fmt)` | Зарегистрировать формат экспорта |
| `unregisterExportFormat(id)` | Отменить регистрацию формата экспорта |

### Пример preprocessPhrase

```ts
import { preprocessPhrase, DEFAULT_STOP_WORDS } from 'plugin-sdk';

const words = preprocessPhrase('купить красный телефон Samsung', {
  lemmatize:     true,
  ignoreNumbers: false,
  stopWords:     DEFAULT_STOP_WORDS,
  synonyms:      new Map([['телефон', 'смартфон']]),
});
// → ['купить', 'красный', 'смартфон', 'samsung']
```

### Пример buildChildrenMap

```ts
import { buildChildrenMap, collectWithDescendants } from 'plugin-sdk';

const groups = ctx.store.getState().groups;
const childrenMap = buildChildrenMap(groups);

// Все ID группы и её потомков (для каскадных операций)
const allIds = collectWithDescendants('group-123', childrenMap);
// allIds: Set { 'group-123', 'group-child-1', 'group-child-2', ... }

// Все фразы группы включая дочерние группы
const phrases = ctx.store.getState().phrases.filter(p => allIds.has(p.groupId));
```

---

## Поисковый провайдер и экспортёр

### Поисковый провайдер

```ts
ctx.registerSearchProvider({
  id:    'my-search',
  label: 'Мой поиск',
  icon:  'search',
  search: async (query: string) => {
    // Вернуть массив результатов
    return [
      { id: 'p-1', text: 'результат 1', groupId: 'g-1', rank: 0.9 },
      { id: 'p-2', text: 'результат 2', groupId: 'g-1', rank: 0.7 },
    ];
  },
});
```

### Формат экспорта

```ts
ctx.registerExporter({
  id:        'my-format',
  label:     'Мой формат (.xyz)',
  extension: 'xyz',
  export: async ({ phrases, groups }) => {
    // Вернуть строку с содержимым файла
    return phrases.map(p => p.text).join('\n');
  },
});
```

> Отменить регистрацию в `destroy()`:
> ```ts
> import { unregisterExportFormat } from 'plugin-sdk';
> destroy() { unregisterExportFormat('my-format'); }
> ```
