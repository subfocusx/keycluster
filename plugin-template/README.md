# KeyCluster Plugin Development Guide

## Содержание

- [Быстрый старт](#быстрый-старт)
- [Структура плагина](#структура-плагина)
- [manifest.json — все поля](#manifestjson--все-поля)
- [Жизненный цикл](#жизненный-цикл)
- [Компиляция и сборка](#компиляция-и-сборка)
- [Работа с React](#работа-с-react)
- [UI-слоты](#ui-слоты)
- [Команды и горячие клавиши](#команды-и-горячие-клавиши)
- [Настройки плагина](#настройки-плагина)
- [Сетевые запросы](#сетевые-запросы)
- [Web Workers](#web-workers)
- [Стилизация](#стилизация)
- [Диагностика и отладка](#диагностика-и-отладка)
- [Типичные ошибки](#типичные-ошибки)
- [Причины отклонения валидатором](#причины-отклонения-валидатором)

---

## Быстрый старт

### Требования

- **Node.js 18+** — https://nodejs.org
- **npx** — поставляется с Node.js

### Пошаговая инструкция

**1. Скопируйте папку `plugin-template`** в своё рабочее пространство.

**2. Замените `YOUR_PLUGIN_ID`** на уникальный ID плагина в двух файлах:
- `manifest.json` → поле `id`
- `index.ts` → поле `manifest.id`

ID должен быть в нижнем регистре, латиница, допустимы дефисы. Например: `seo-multitool`, `my-plugin`.

**3. Напишите логику** в функции `init(ctx)` внутри `index.ts`.

**4. Скомпилируйте TypeScript в JavaScript:**

```bash
npx esbuild index.ts \
  --bundle \
  --format=esm \
  --outfile=index.js \
  --alias:react=./lib/react-shim.ts
```

> Подробнее про шимы и почему они нужны — см. раздел [Компиляция и сборка](#компиляция-и-сборка).

**5. Установите плагин:**
Настройки → Модули и плагины → Выбрать папку с плагином → Установить.

**6. Включите тумблер** — плагин начнёт работу немедленно, без перезапуска приложения.

---

## Структура плагина

```
your-plugin/
  manifest.json          — метаданные (id, name, slots, settings, ...)
  index.ts               — исходный код (TypeScript)
  index.js               — скомпилированный бандл (результат esbuild)
  components/
    YourPanel.tsx        — React-компоненты
  lib/
    react-shim.ts        — шим для React (обязателен при использовании JSX)
    sdk-shim.ts          — шим для SDK (если используете useAppStore/toast)
```

### Что обязательно должно быть в папке

| Файл | Обязателен | Описание |
|------|-----------|----------|
| `manifest.json` | ✅ | Метаданные плагина |
| `index.js` | ✅ | Скомпилированная точка входа |
| `index.ts` | нет | Исходник — нужен для пересборки |
| `lib/react-shim.ts` | если есть JSX | Шим для React |
| `lib/sdk-shim.ts` | если есть `useAppStore`/`toast` | Шим для SDK |

### Минимальный index.ts

```ts
import type { AppModule, PluginContext } from 'plugin-sdk';

const myPlugin: AppModule = {
  manifest: {
    id: 'my-plugin',
    name: 'Мой плагин',
    version: '1.0.0',
    description: 'Описание',
    slot: ['ribbon:tools'],
  },

  init(ctx: PluginContext) {
    ctx.registerCommand('run', () => {
      console.log('Hello!');
    });
  },

  destroy() {
    // Очистка ресурсов
  },
};

export default myPlugin;
```

---

## manifest.json — все поля

```json
{
  "id": "my-plugin",
  "name": "Мой плагин",
  "version": "1.0.0",
  "description": "Краткое описание",
  "author": "Имя автора",
  "icon": "extension",
  "slot": ["ribbon:tools"],
  "entry": "index.js",
  "category": "custom",
  "dependencies": ["phrases"],
  "minAppVersion": "0.3.0",
  "repository": "https://github.com/your-org/your-plugin",
  "allowedDomains": ["api.example.com"],
  "settingsSchema": [
    { "key": "enabled", "type": "boolean", "label": "Включён", "default": true },
    { "key": "limit",   "type": "number",  "label": "Лимит",   "default": 10, "min": 1, "max": 100 }
  ]
}
```

| Поле | Обязательно | Описание |
|------|-------------|----------|
| `id` | ✅ | Уникальный ID (латиница, дефисы, нет пробелов) |
| `name` | ✅ | Отображаемое название |
| `version` | ✅ | Версия (semver: `"1.0.0"`) |
| `description` | ✅ | Краткое описание |
| `slot` | ✅ | Массив слотов. Писать именно `"slot"`, не `"slots"` |
| `entry` | нет | Точка входа (по умолчанию `"index.js"`) |
| `author` | нет | Автор |
| `icon` | нет | Иконка из Material Symbols (например, `"extension"`, `"search"`, `"bolt"`) |
| `category` | нет | `system` / `algorithms` / `data` / `analysis` / `custom` / `seo` / `import` / `export` / `ai` / `tools` |
| `dependencies` | нет | ID модулей, от которых зависит плагин (`["phrases"]`, `["groups", "phrases"]`) |
| `minAppVersion` | нет | Минимальная версия приложения (`"0.3.0"`) |
| `repository` | нет | Ссылка на репозиторий |
| `allowedDomains` | нет | Домены для внешних HTTP-запросов. Показывается пользователю при установке |
| `settingsSchema` | нет | Схема настроек (см. раздел [Настройки плагина](#настройки-плагина)) |

> ⚠ Валидатор проверяет именно поле `"slot"` (единственное число). `"slots"` — игнорируется.

---

## Жизненный цикл

```
install → validate → enable → init(ctx) → [активен] → disable → destroy()
```

### Этапы

| Этап | Описание | Может провалиться |
|------|----------|-------------------|
| `install` | Копирование папки в директорию плагинов | да |
| `validate` | Проверка manifest, id, entry, default export | да |
| `enable` | `import(index.js)` | да (синтаксис, зависимости) |
| `init` | Вызов `init(ctx)` | да (исключение в коде) |
| `disable` | Вызов `destroy()`, очистка UI/команд | warning в лог |
| `uninstall` | Удаление файлов | да |

### Хуки жизненного цикла

```ts
init(ctx) {
  ctx.registerLifecycleHook?.('beforeDestroy', () => {
    // Вызывается перед destroy() — сохраните состояние, закройте соединения
    saveCacheToDisk();
  });

  ctx.registerLifecycleHook?.('onSettingsChange', (payload) => {
    if (payload?.moduleId === 'my-plugin') {
      reloadSettings();
    }
  });
}
```

> Используйте опциональную цепочку `?.` при вызове `registerLifecycleHook` и `registerKeybinding` — это гарантирует совместимость с будущими версиями API.

`destroy()` поддерживает `async`:

```ts
async destroy() {
  await this.flushPendingData();
  this.worker?.terminate();
}
```

---

## Компиляция и сборка

Хост-приложение загружает `index.js` как ESM-модуль через `blob:` URL. **Bare imports недопустимы** — `import ... from "react"` или `import ... from "plugin-sdk"` вызовут ошибку загрузки.

Итоговый `index.js` должен быть полностью самодостаточным.

### Шим для React (`lib/react-shim.ts`)

React предоставляется хостом через `globalThis.React`. Создайте файл:

```ts
// lib/react-shim.ts
const R = (globalThis as any).React;
export default R;
export const {
  useState, useEffect, useRef, useCallback, useMemo,
  useReducer, useContext, createContext, memo, forwardRef,
  Fragment,
} = R;
```

### Шим для SDK (`lib/sdk-shim.ts`)

npm-пакет `plugin-sdk` — пустышка. Реальный SDK живёт в `ctx`, который передаётся в `init()`. Создайте файл:

```ts
// lib/sdk-shim.ts
let _ctx: any = null;

export function __setCtx(ctx: any) { _ctx = ctx; }

export function useAppStore(selector?: (s: any) => any) {
  const state = _ctx?.store.getState();
  return selector ? selector(state) : state;
}
(useAppStore as any).getState = () => _ctx?.store.getState();
(useAppStore as any).setState = (partial: any) => _ctx?.store.setState(partial);

export function toast(options: { title?: string; description?: string; duration?: number }) {
  _ctx?.eventBus.emit('notify', { message: options.title ?? options.description ?? '' });
}
```

В `init()` обязательно вызовите `__setCtx`:

```ts
import { __setCtx } from './lib/sdk-shim';

init(ctx) {
  __setCtx(ctx);
  // ...остальная логика
}
```

### Команда сборки

```bash
npx esbuild index.ts \
  --bundle \
  --format=esm \
  --outfile=index.js \
  --alias:react=./lib/react-shim.ts
```

> Если вы используете `sdk-shim`, добавьте: `--alias:plugin-sdk=./lib/sdk-shim.ts`

### Проверка после сборки

```bash
# Не должно ничего вернуть:
grep 'from "react"' index.js
grep 'from "plugin-sdk"' index.js

# Размер файла:
ls -lh index.js
```

### Автоматизация (watch-режим)

Добавьте в `package.json`:

```json
{
  "scripts": {
    "build": "esbuild index.ts --bundle --format=esm --outfile=index.js --alias:react=./lib/react-shim.ts",
    "watch": "esbuild index.ts --bundle --format=esm --outfile=index.js --alias:react=./lib/react-shim.ts --watch"
  }
}
```

Запуск:

```bash
npm run build   # однократная сборка
npm run watch   # пересборка при изменениях
```

После пересборки нажмите **Reload** в Plugin Manager для применения изменений.

---

## Работа с React

Добавляйте `import React from 'react'` (или из `./lib/react-shim`) в каждый `.tsx`-файл с JSX.

```tsx
// components/MyPanel.tsx
import React, { useState } from 'react';
// или из шима:
// import React, { useState } from '../lib/react-shim';

export function MyPanel() {
  const [count, setCount] = useState(0);
  return (
    <div style={{ padding: 16 }}>
      <button onClick={() => setCount(c => c + 1)}>
        Нажато: {count}
      </button>
    </div>
  );
}
```

Большинство плагинов с JSX начинаются с директивы `'use client';` (обязательна при наличии JSX):

```ts
'use client';
import React from 'react';
```

---

## UI-слоты

Все UI-вклады регистрируются через `ctx.registerUI({ slot, ... })`.

### Слоты с компонентом

```ts
ctx.registerUI({
  slot: 'ribbon:tools',
  label: 'Мой плагин',
  icon: 'extension',
  component: () => <MyPanel ctx={ctx} />,
  order: 100,               // порядок среди вкладов в слот (меньше — левее)
});
```

| Слот | Описание |
|------|----------|
| `ribbon:tools` | Вкладка в основном ribbon |
| `ribbon:file` | Кнопка в меню File |
| `ribbon:import-export` | Кнопки импорта/экспорта |
| `left-panel` | Левая боковая панель |
| `right-panel` | Правая боковая панель |
| `group:toolbar` | Кнопки в заголовке группы |
| `workspace:panel` | Дополнительная панель рабочей области |
| `workspace:layout` | Кастомный layout (требует `layoutComponent` + `tabId`) |
| `settings:tab` | Вкладка в диалоге настроек (требует `tabId` + `tabLabel`) |
| `status-bar` | Элемент в статус-баре |
| `theme` | CSS-тема (требует `themeId` + `cssVars`/`cssText`) |

### Слоты с action (контекстное меню)

```ts
ctx.registerUI({
  slot: 'context-menu:group',
  label: 'Действие над группой',
  icon: 'bolt',
  action: (group, { store, eventBus }) => {
    const phrases = store.getState().phrases.filter(p => p.groupId === group.id);
    eventBus.emit('notify', { message: `${phrases.length} фраз` });
  },
});
```

| Слот | Тип первого аргумента action |
|------|------------------------------|
| `context-menu:phrase` | `Phrase` |
| `context-menu:group` | `Group` |
| `phrase-row:actions` | `Phrase` |

### Кастомные слоты

```ts
// Объявить слот (другие плагины смогут в него добавлять UI)
ctx.declareSlot('my-plugin:sidebar', { label: 'My Sidebar' });
```

---

## Команды и горячие клавиши

```ts
// Регистрация команды
ctx.registerCommand('my-action', () => {
  console.log('Действие выполнено');
});

// Привязка горячей клавиши (Electron accelerator format)
ctx.registerKeybinding?.('Ctrl+Shift+M', 'my-action', { label: 'Моё действие' });

// Вызов команды из другого плагина
ctx.executeCommand('import-export:export-csv');
// Формат: "moduleId:commandId"
```

Примеры форматов клавиш: `'Ctrl+K'`, `'Ctrl+Shift+F'`, `'Alt+Enter'`.

---

## Настройки плагина

Объявите схему в `manifest.json`:

```json
"settingsSchema": [
  { "key": "apiKey",  "type": "string",  "label": "API ключ",  "default": "" },
  { "key": "limit",   "type": "number",  "label": "Лимит",     "default": 10, "min": 1, "max": 100, "step": 1 },
  { "key": "enabled", "type": "boolean", "label": "Включён",   "default": true },
  { "key": "format",  "type": "select",  "label": "Формат",    "default": "csv", "options": ["csv", "json", "xlsx"] }
]
```

**Чтение настроек в `init()`:**

```ts
init(ctx) {
  const apiKey = ctx.getSetting('apiKey') as string ?? '';
  const limit  = ctx.getSetting('limit')  as number ?? 10;
}
```

**Реакция на изменение настроек:**

```ts
ctx.registerLifecycleHook?.('onSettingsChange', (payload) => {
  if (payload?.moduleId === 'my-plugin') {
    reloadSettings();
  }
});
```

**Чтение в компонентах:**

```ts
// Только для своего moduleId:
const value = ctx.store.getModuleSetting('my-plugin', 'apiKey');
```

---

## Сетевые запросы

### ❌ Нельзя: прямой fetch к внешним сервисам

```ts
// Вызовет CORS / Mixed Content ошибку в Tauri webview
const res = await fetch('https://external-api.com/data');
```

### ✅ Правильно: ctx.api.httpRequest()

```ts
const res = await ctx.api.httpRequest({
  url: 'https://external-api.com/data',
  method: 'GET',
  headers: { 'Authorization': 'Bearer token' },
});
const data = JSON.parse(res.body);
```

### ✅ Правильно: ctx.fetch() для внутренних URL

```ts
// Только для /api/..., tauri://... и т.п.
const res = await ctx.fetch('/api/internal-endpoint');
```

Добавьте домены в `manifest.json`:

```json
"allowedDomains": ["api.example.com"]
```

---

## Web Workers

```ts
let worker: Worker | null = null;

init(ctx) {
  worker = new Worker(
    new URL('./my-plugin.worker.ts', import.meta.url),
    { type: 'module' },
  );
  worker.postMessage({ type: 'compute', data: [...] });
  worker.onmessage = (e) => console.log('Result:', e.data);
},

destroy() {
  worker?.terminate();
  worker = null;
}
```

Worker-файл компилируется esbuild автоматически при сборке.

---

## Стилизация

### CSS-переменные хоста

```css
--bg-base        /* Фон страницы */
--bg-surface     /* Фон карточек/панелей */
--bg-hover       /* Фон при наведении */
--text-primary   /* Основной текст */
--text-secondary /* Второстепенный текст */
--border         /* Цвет границ */
--accent-blue    /* Акцентный синий */
--kc-yellow      /* Акцентный жёлтый */
--danger         /* Цвет ошибки/удаления */
```

### Инжект CSS из кода

```ts
ctx.injectCSS('my-plugin-styles', `
  .my-panel { padding: 16px; background: var(--bg-surface); }
  .my-panel button { color: var(--accent-blue); }
`);
// CSS автоматически удаляется при destroy/disable.
```

### CSS-классы хоста

```tsx
// Кнопка панели инструментов
<button className="tool-btn" onClick={handle}>
  <span className="material-symbols-outlined">search</span>
  Поиск
</button>
```

---

## Диагностика и отладка

Проверьте статус плагина после установки:

- **Plugin Manager** → статус `Загружен` / `Ошибка`
- **DevTools** → Модули → статус `ok` / `failed` / `no-ui`
- **DevTools** → Console → логи плагина

Диагностический вывод при запуске (добавьте в `init()`):

```ts
init(ctx) {
  console.log('[my-plugin] ctx keys:', Object.keys(ctx));
  console.log('[my-plugin] store keys:', Object.keys(ctx.store));
  console.log('[my-plugin] state keys:', Object.keys(ctx.store.getState()));
  console.log('[my-plugin] API version:', ctx.apiVersion);
}
```

Проверка совместимости API:

```ts
init(ctx) {
  if (ctx.apiVersion !== '1.0') {
    console.warn(`[my-plugin] Expected API 1.0, got ${ctx.apiVersion}`);
  }
}
```

---

## Типичные ошибки

### `Failed to load module "X": No plugin registered for "X"`

| Причина | Решение |
|---------|---------|
| Нет `index.js` | Запустите `npm run build` |
| `manifest.json` → `entry` указывает на `.ts` вместо `.js` | Исправьте на `"index.js"` |
| `manifest.id` в коде не совпадает с `id` в `manifest.json` | Убедитесь что оба поля одинаковы |
| Нет `export default` | Последняя строка файла: `export default myPlugin;` |

### Плагин установился, но UI не появляется

| Причина | Решение |
|---------|---------|
| Нет метода `destroy()` | Добавьте `destroy() {}` — он обязателен |
| Нет `component:` в `registerUI` | Передайте `component: () => <MyPanel />` |
| Неправильный слот | Проверьте имя слота по таблице выше |
| Нет `import React from 'react'` в `.tsx` | Добавьте импорт |

### Компилируется, но бандл содержит bare imports

| Причина | Решение |
|---------|---------|
| Флаг `--external:react` вместо `--alias` | Используйте `--alias:react=./lib/react-shim.ts` |
| Нет `--alias:plugin-sdk` | Добавьте `--alias:plugin-sdk=./lib/sdk-shim.ts` |

### `useAppStore.setState` не обновляет UI

Прямой `setState` обходит dispatch-слой. Используйте `ctx.store.dispatch()`:

```ts
// ❌ Не работает
useAppStore.setState({ groups: newGroups });

// ✅ Правильно
ctx.store.dispatch('addGroup', { name: 'Новая группа', parentId: null });
```

### `addPhrases` выбрасывает ошибку

Правильный формат payload:

```ts
// ✅ Правильно
ctx.store.dispatch('addPhrases', {
  groupId: 'group-id',
  texts: ['фраза 1', 'фраза 2'],
});

// ❌ Неправильно — texts должен быть массивом строк, не объектов
ctx.store.dispatch('addPhrases', {
  groupId: 'group-id',
  texts: [{ text: 'фраза 1' }],
});
```

---

## Причины отклонения валидатором

| Причина | Условие | Сообщение |
|---------|---------|-----------|
| ID-заглушка | `id` начинается с `YOUR_` | «имеет ID-заглушку» |
| Несовпадающий ID | `manifest.id` ≠ `id` в manifest.json | «несовпадающий manifest.id» |
| Нет manifest | `manifest` не объект | «не имеет поля manifest» |
| Нет init() | `init` не функция | «не имеет метода init()» |
| Нет destroy() | `destroy` не функция | «не имеет метода destroy()» |
| Нет slot | `slot` не массив | «не имеет manifest.slot» |
| Нет entry-файла | файл из `manifest.entry` не найден | «entry file not found» |
| Ошибка импорта | синтаксическая ошибка в JS | «blob import error» |
| Не экспортирует AppModule | нет `{ manifest, init, destroy }` | «does not export AppModule» |
| Неизвестный слот | слота нет в списке встроенных | warning (плагин загружается) |
