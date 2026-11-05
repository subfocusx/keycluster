# HTTP Bridge Server — фактический API

> Порт по умолчанию `42001` | Axum, bind `127.0.0.1` | Источник правды: `src-tauri/src/api_server.rs`
>
> ⚠️ Старая версия этого файла описывала несуществующий префикс `/api/v1/*`
> (`/status`, `/state`, `/dispatch`, `/events`, AI-эндпоинты). Такого API нет.
> Ниже — только реально реализованные маршруты (все — `/api/*` без `/v1`).

---

## Содержание

- [Архитектура](#архитектура)
- [Авторизация](#авторизация)
- [Маршруты](#маршруты)
- [Tauri-команды управления сервером](#tauri-команды-управления-сервером)
- [Ограничения](#ограничения)
- [Roadmap (не реализовано)](#roadmap-не-реализовано)

---

## Архитектура

```
Внешний инструмент
  │  HTTP → http://127.0.0.1:42001/api/...
  ▼
api_server.rs (axum) — Bearer-авторизация, rate-limit, request-log
  │
  ├─ читает/пишет SQLite через DbState (таблицы Project, ProjectBackup)
  └─ уведомляет фронтенд через tauri Emitter (store:phrases-updated)
```

Сервер стартует вместе с приложением (`lib.rs`), перезапускается сменой
порта через `restart_api_server`. CORS: `AllowOrigin::exact("http://localhost")`.

## Авторизация

Все маршруты, кроме `GET /api/health`, требуют заголовка:

```
Authorization: Bearer <token>
```

Токен генерируется в рантайме (UUID v4), получить/перегенерить — только
через Tauri IPC изнутри приложения:

- `get_api_token` → текущий токен
- `regenerate_api_token` → новый токен

Без верного токена — `401 unauthorized`.

## Маршруты

Базовый URL: `http://127.0.0.1:42001`

### `GET /api/health` (без авторизации)

```json
{ "status": "ok", "version": "0.3.0" }
```

### `GET /api/token` (авторизация обязательна)

Возвращает текущий токен (нужен сам токен, чтобы его узнать — используется
для проверки/ротации из доверенного клиента).

```json
{ "token": "uuid-v4" }
```

### `GET /api/project?projectId=...`

Метаданные проекта. `projectId` опционален (без него берётся последний
изменённый — deprecated, в логах предупреждение).

```json
{ "id": "uuid", "name": "Мой проект", "groupCount": 48, "phraseCount": 1250 }
```

Ошибки: `404 project not found` / `404 no project`, `500 corrupt project data`.

### `GET /api/groups?projectId=...`

Возвращает **массив групп** (JSON-массив, не объект-обёртка):

```json
[ { "id": "uuid", "name": "...", "parentId": null, "isTrash": false, ... } ]
```

### `GET /api/phrases?projectId=...&groupId=...`

Возвращает **массив фраз**. `groupId` опционален (фильтр по группе).

```json
[ { "id": "uuid", "text": "...", "groupId": "uuid", "createdAt": 1700000000000 } ]
```

### `POST /api/phrases`

Добавить фразы (массив строк) в первую не-корзинную группу проекта.

Request:

```json
{ "projectId": "uuid", "phrases": ["купить телефон", "телефон цена"] }
```

Response:

```json
{ "added": 2, "total": 1252 }
```

Фронтенд уведомляется событием `store:phrases-updated` (`addPhrases`).

### `DELETE /api/phrases`

Удалить фразы по ID. Фразы без `id` тоже удаляются (считаются битыми).

Request:

```json
{ "projectId": "uuid", "ids": ["uuid1", "uuid2"] }
```

Response:

```json
{ "deleted": 2, "total": 1250 }
```

### `POST /api/frequency`

Массово проставить частотность по тексту фразы.

Request:

```json
{ "projectId": "uuid", "frequencies": { "купить телефон": 5400 } }
```

Response:

```json
{ "updated": 1 }
```

Фронтенд уведомляется событием `store:phrases-updated` (`updateFrequencies`).

### `POST /api/snapshot`

Создать снапшот проекта (строка в `ProjectBackup` + SHA-256 checksum).

Request:

```json
{ "projectId": "uuid", "label": "перед чисткой" }
```

`projectId` опционален (deprecated fallback на последний проект).

Response:

```json
{ "id": "snapshot-uuid", "createdAt": 1700000000000, "projectId": "uuid" }
```

### `GET /api/log`

Последние 100 записей журнала запросов (новые сверху).

```json
[ { "method": "GET", "path": "/api/health", "status": 200, "timestamp_ms": 1700000000000, "duration_ms": 1 } ]
```

---

## Tauri-команды управления сервером

Вызываются из фронтенда через `invoke()` (см. `lib.rs`):

| Команда | Назначение |
|---|---|
| `get_api_token` | Текущий Bearer-токен |
| `regenerate_api_token` | Новый токен (UUID v4) |
| `get_api_status` | `{ running, port, uptime_secs }` |
| `get_api_request_log` | Полный журнал (в памяти, до 200 записей) |
| `restart_api_server(port)` | Сменить порт и перезапустить сервер |

## Ограничения

- Нет префикса `/api/v1` — только `/api/*`.
- Нет эндпоинтов `/status`, `/state`, `/dispatch`, `/events` (SSE), `/ai/*`,
  CRUD групп/фраз по одной, WebSocket, MCP — всё это roadmap, а не факт.
- `POST /api/phrases` принимает только `string[]`, не объекты с `frequency/kei/cpc`.
- `projectId` обязателен везде, кроме трёх GET/снапшота (там deprecated fallback).
- Rate-limit общий: **100 запросов/мин** на весь сервер.
- CORS разрешает только origin `http://localhost` (может бить мимо реальных origin).
- Известные нюансы (не чинено): FK `ProjectBackup.parentId` без `ON DELETE`,
  `delete_phrases` трёт фразы без `id`, rate-limit общий на всех клиентов.

## Roadmap (не реализовано)

Старая версия доки описывала как «спецификацию» — фактически это план:

1. Минимальный Bridge: `/status`, `/state`, `/dispatch`, SSE `/events`.
2. Полный CRUD групп и фраз отдельными эндпоинтами.
3. WebSocket (двунаправленный поток).
4. MCP-адаптер для AI-агентов.

---

*Актуализировано 2026-11-05 сверкой с `src-tauri/src/api_server.rs` (794 строки).*
