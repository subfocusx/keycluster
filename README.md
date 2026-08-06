# KeyCluster

Анализ и кластеризация ключевых фраз. Десктоп-приложение на Tauri v2 + React.

## Возможности

- Импорт ключевых фраз из CSV, TSV, TXT, XLSX с маппингом столбцов (streaming-парсинг для больших файлов, batch по 1000 строк)
- Экспорт в CSV, TSV, JSON, XLSX
- Кластеризация фраз (TF-IDF, n-граммы, кросс-поиск)
- Управление группами и минус-фразами
- Поиск и замена
- Автосохранение проектов с версионированием
- Резервное копирование с SHA-256 контрольными суммами
- Горячие клавиши
- Система плагинов с динамической загрузкой

## Быстрый старт

### Требования

- Node.js 20+
- Rust (stable) — `cargo 1.77+`
- Windows: Visual Studio Build Tools (C++)

### Установка и запуск

```bash
# Клонировать репозиторий
git clone <url>
cd keycluster-tauri

# Установить зависимости
npm install

# Режим разработки (Vite dev server)
npm run tauri dev

# Production сборка
npm run tauri build
```

Готовый установщик появится в `src-tauri/target/release/bundle/`.

## Скрипты

| Команда | Описание |
|---|---|
| `npm run dev` | Vite dev сервер (http://localhost:1420) |
| `npm run build` | Vite production сборка фронтенда |
| `npm run tauri dev` | Tauri dev (Vite + Rust hot-reload) |
| `npm run tauri build` | Сборка MSI/NSIS установщика |
| `npm test` | Запуск тестов (Vitest) |
| `npm run test:watch` | Тесты в watch-режиме |
| `npm run test:coverage` | Тесты с отчётом покрытия |
| `npm run typecheck` | TypeScript проверка |
| `npm run lint` | ESLint |

## Архитектура

```
keycluster-tauri/
├── src/                          # Фронтенд (React + TypeScript + Vite)
│   ├── core/                     # Ядро: сервисы, транспорт, стор
│   ├── components/               # UI компоненты (shadcn/ui)
│   ├── modules/                  # Функциональные модули
│   ├── shell/                    # Оболочка приложения
│   ├── hooks/                    # React хуки
│   ├── lib/                      # Утилиты
│   └── __tests__/                # Тесты
├── src-tauri/                    # Бэкенд (Rust + Tauri)
│   └── src/
│       ├── lib.rs                # setup Tauri, плагины, команды
│       ├── main.rs               # точка входа
│       ├── db.rs                 # SQLite: таблицы, индексы
│       ├── projects.rs           # CRUD проектов
│       ├── backups.rs            # SHA-256 бэкапы
│       └── commands.rs           # health_check
├── package.json
├── tauri.conf.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

### Стек

- **Ядро**: Tauri v2, Rust (rusqlite + serde + sha2)
- **Фронтенд**: React 19, TypeScript, Vite 8, Tailwind v4
- **Состояние**: Zustand 5
- **Импорт**: PapaParse (streaming) + xlsx
- **UI**: Radix UI + shadcn/ui, Framer Motion, Recharts
- **Тесты**: Vitest, Testing Library, jsdom, Istanbul

### Backend (Rust)

```
┌─────────────────────┐
│   main.rs           │  точка входа
├─────────────────────┤
│   lib.rs            │  Tauri Builder + плагины + команды
├─────────────────────┤
│   db.rs             │  SQLite (rusqlite) — Project, ProjectBackup
├─────────────────────┤
│   projects.rs       │  list / get / create / update / delete
├─────────────────────┤
│   backups.rs        │  create / get / list / prune + SHA-256
├─────────────────────┤
│   commands.rs       │  health_check
└─────────────────────┘
```

### Frontend (TypeScript)

```
┌────────────────────────────────────────────┐
│  main.tsx                                  │  ReactDOM.createRoot
├────────────────────────────────────────────┤
│  shell/KeyClusterShell.tsx                 │  главный компонент
├────────────────────────────────────────────┤
│  core/                                     │
│  ├── bootstrap.ts         ── инициализация │
│  ├── project-service.ts   ── сервис проектов│
│  ├── project-transport-ipc.ts ── IPC invoke │
│  ├── store.ts             ── Zustand store  │
│  ├── module-runtime.ts    ── рантайм модулей│
│  ├── module-loader.ts     ── загрузчик      │
│  ├── plugin-registry.ts   ── реестр плагинов│
│  ├── event-bus.ts         ── шина событий   │
│  ├── save-queue.ts        ── очередь записи │
│  ├── backup-manager.ts    ── менеджер бэкапов│
│  └── tauri-logger.ts      ── логгер в файл  │
├────────────────────────────────────────────┤
│  modules/                                  │
│  ├── clustering/    ── кластеризация       │
│  ├── phrases/       ── фразы               │
│  ├── groups/        ── группы              │
│  ├── import-export/ ── импорт/экспорт      │
│  ├── cross-search/  ── кросс-поиск         │
│  ├── find-replace/  ── поиск и замена      │
│  ├── minus-words/   ── минус-фразы         │
│  ├── ngrams/        ── n-граммы            │
│  ├── tfidf/         ── TF-IDF              │
│  └── ...                                   │
└────────────────────────────────────────────┘
```

### Транспорт (Frontend ↔ Backend)

```
React Component
    │
    ▼
project-service.ts
    │ invoke('create_project', { input })
    ▼
project-transport-ipc.ts
    │
    ▼  (Tauri IPC — JSON сериализация)
    │
    ▼
Rust: projects::create_project()
    │
    ▼
db.rs (SQLite)
```

Все общение с бэкендом — через `@tauri-apps/api/core.invoke()`. HTTP-транспорт не используется.

### Система плагинов

Приложение имеет трёхуровневую архитектуру плагинов:

| Тип | Назначение | Расположение | Можно удалить? |
|-----|-----------|-------------|----------------|
| **builtin** | Ядро системы (неотключаемые) | `src/modules/` | нет |
| **local** | Встроенные модули приложения | `src/plugins/` | нет |
| **user** | Пользовательские плагины | `user-plugins/` (dev) / `appLocalDataDir/user-plugins/` (runtime) | да |

Каждый плагин — это `AppModule` с `manifest`, `init(ctx)` и `destroy()`. Жизненный цикл: установка → валидация → enable → init → destroy при disable/uninstall. Установка атомарна с откатом при ошибке.

**Plugin API** (`src/plugin-sdk.ts`) — публичный SDK для плагинов:
- `ctx.registerUI({ slot, component, action })` — регистрация UI в слотах (`ribbon:tools`, `left-panel`, `settings:tab`, `context-menu:*` и др.)
- `ctx.registerCommand(id, handler)` / `ctx.registerKeybinding(keys, id)` — команды и хоткеи
- `ctx.onEvent(event, handler)` — подписка на события приложения (авто-cleanup)
- `ctx.store.getState()` / `ctx.store.dispatch()` — чтение и изменение состояния
- `ctx.injectCSS(id, css)` — инжект стилей (авто-удаление при destroy)
- `ctx.registerSearchProvider()` / `ctx.registerExporter()` / `ctx.registerFilter()` — расширение возможностей
- `ctx.setTimeout()` / `ctx.setInterval()` — безопасные таймеры (авто-cleanup)

Управление плагинами: Plugin Manager UI (в настройках) → выбор папки с плагином → атомарная установка. Настройки плагинов сохраняются в Zustand с валидацией по схеме.

**Шаблоны для разработки плагинов:**
- `plugin-template/` — базовый шаблон (см. `plugin-template/README.md` — полная документация)
- `plugin-template-advanced/` — расширенный шаблон с кастомными вкладками настроек

Плагины компилируются через esbuild: `npx esbuild index.ts --bundle --format=esm --outfile=index.js --external:react --external:react-dom`.

### Состояние

Zustand + Immer. Основные срезы:
- `groups` — список групп
- `phrases` — список фраз
- `minusWords` — минус-фразы
- `ui` — состояние интерфейса (панели, тема)
- `settings` — настройки модулей

### Тестирование

```bash
# Все тесты (кроме API)
npm test

# С покрытием
npm run test:coverage

# Конкретный файл
npx vitest run src/__tests__/core/project-service-extended.test.ts

# Watch
npm run test:watch
```

Текущее покрытие: **~72% statements**, **~73% lines** (core — 88.5%, основные модули — 70–100%).

## Переносимая версия

```bash
npm run tauri build
```

После сборки:

- **Windows**: `src-tauri/target/release/bundle/msi/KeyCluster_0.3.0_x64.msi` или `nsis/KeyCluster_0.3.0_x64-setup.exe`
- Размер: ~3.7 MB (NSIS) / ~5.2 MB (MSI)
- Single-file portable: сам установщик не требует прав администратора (NSIS)

Для ручного запуска без установки можно взять `KeyCluster.exe` из `src-tauri/target/release/`, но ему нужны рядом ресурсы (icon, etc).

## Структура данных

```sql
-- SQLite
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0',
    data TEXT NOT NULL DEFAULT '{}',
    phrase_count INTEGER DEFAULT 0,
    is_backup INTEGER DEFAULT 0,
    parent_project_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## Конфигурация

Tauri: `src-tauri/tauri.conf.json`
- Разрешения: `src-tauri/capabilities/default.json`
- Vite: `vite.config.ts`
- Vitest: `vitest.config.ts`
- TypeScript: `tsconfig.json`
