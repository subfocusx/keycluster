# KeyCluster — аудит и карта проекта

Дата: 2026-10-02. Версия: 0.3.0.

## Что это
Desktop-приложение (Tauri v2 + React 19) для анализа и кластеризации ключевых фраз.

## Стек
- Frontend: React 19, TS 5, Vite 8, Tailwind 4, Radix/shadcn, Zustand 5 + immer (persist localStorage), TanStack Table/Virtual, PapaParse/xlsx, Vitest 4 + jsdom.
- Backend: Rust (Tauri 2, rusqlite bundled, tokio, axum 0.7 HTTP API порт 42001, reqwest, sha2).
- Сборка плагинов: esbuild 0.28 (prod-зависимость).

## Структура
```
src/main.tsx            # entry: bootstrap(), React-шимы для плагинов, providers
src/core/               # ядро ~100 файлов: bootstrap, store (слайсы), module-runtime, реестры, project-service, ai-service, log
src/shell/              # KeyClusterShell — layout, палитра команд, оверлеи
src/modules/            # 3 builtin UI-модуля: phrases, groups, devtools
src/components/         # shadcn/ui + общие
src/plugin-sdk.ts       # единственный публичный SDK для плагинов (v1.0)
src-tauri/src/          # lib.rs (22 команды), db.rs (SQLite), api_server.rs (790 строк), http.rs (SSRF-защита)
user-plugins/           # 17 функциональных плагинов (ai, clustering, tfidf, ngrams, ...)
plugin-template/        # шаблон плагина + доки (README/API/AI_PLUGIN/HTTP_BRIDGE_API)
portable/               # собранный keycluster.exe 19.3MB (коммитится в репо — мусор)
```

## Запуск / сборка
- `npm run dev` → Vite :1420; `npm run tauri` / `tauri dev|build`
- `npm test`, `test:coverage`, `lint`, `typecheck`; perf — отдельный `vitest.config.perf.ts` (node, --expose-gc)
- vite-плагин `copyPluginManifests` копирует `user-plugins/*/manifest.json` в dist (иначе прод-fetch падает)
- Алиасы: `@`, `plugin-sdk`, `@user-plugins`

## Плагины
- Контракт: `AppModule { manifest, init(ctx), destroy }`, `PluginContext` (`src/core/plugin-api.ts`, API v1.0)
- Регистрация: статическая `registerBuiltin` (13 builtin в `src/core/module-loader.ts`) + динамическая (Vite glob + сканирование `%APPDATA%/user-plugins`)
- Банды: esbuild ESM `index.js`, подключение через Blob-URL, React-шимы через `window.React`
- Манифест: id/name/version/slots/settingsSchema/entry/allowedDomains/minAppVersion

## Существующая документация
- `README.md` (11.8KB) — основная, частично неточная
- `plugin-template/*.md` — 4 файла по ~22-25KB (API.md = дубль README.md)
- `src/__tests__/PERFORMANCE_REPORT.md` — перф-отчёт 38/38, 100k фраз
- `TEST_COVERAGE_PLAN.md` — устарел (противоречит README ~72%)
- `src/plugins/README.md` — устарел (описывает несуществующий `src/plugins/{id}/`)

## Проблемы (приоритет)
1. Мусор в корне: 16 `*.txt` логов покрытия (~660KB) + `tsconfig.tsbuildinfo` — удалить (уже в .gitignore, но физически лежат)
2. `portable/KeyCluster-portable/` с exe в репо — вынести в релизы, добавить в .gitignore
3. Дубли: `plugin-template/API.md` = `README.md` байт-в-байт; `take-screenshot.cjs` — одноразовый скрипт с хардкод-путями
4. Неиспользуемые deps (`@mdxeditor/editor`, `z-ai-web-dev-sdk`, `sharp` и др.) — проверить и вычистить
5. `tsconfig` exclude ссылается на несуществующий `src/__tests__/api`
6. Нет CI-скриптов


## Чистка 2026-10-02
Удалено: 15 `*.txt` логов покрытия (~660KB), `take-screenshot.cjs`, `tsconfig.tsbuildinfo`, `src/plugins/README.md` (устаревший, каталог удалён).
Оставлено: `portable/` (20MB exe), `dist/`, `TEST_COVERAGE_PLAN.md`.

## Health-check 2026-10-02
- typecheck: 1 ошибка → исправлена (`lifecycle.ts:34` cast через `unknown`), теперь чисто
- lint: скрипт сломан — нет `eslint.config.js` (ESLint 9 требует новый формат)
- tests: 2656 passed / 8 failed / 13 skipped (155 файлов). Падают 4 файла: `command-palette-keybindings` (счётчик kbd 8 vs 4), `KeyClusterShell` (Delete→moveToTrash не вызван), `export-dialog` (5 шт, тексты шаблонов), `minus-words-ui` (текст "Широкий поиск"). Характер — протухшие UI-ассёрты, не ядро.
- Исправлен 1 файл: `src/core/module-runtime-lifecycle/lifecycle.ts`