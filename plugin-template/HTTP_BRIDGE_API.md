# HTTP Bridge Server — Документация и спецификация API

> Порт 42001 | Внешний REST API для KeyCluster

---

## Содержание

- [Что это и зачем](#что-это-и-зачем)
- [Текущий статус](#текущий-статус)
- [Существующие точки интеграции](#существующие-точки-интеграции)
- [Архитектура моста](#архитектура-моста)
- [REST API — спецификация](#rest-api--спецификация)
  - [GET /status](#get-apiv1status)
  - [GET /state](#get-apiv1state)
  - [GET /groups](#get-apiv1groups)
  - [POST /groups](#post-apiv1groups)
  - [PATCH /groups/:id](#patch-apiv1groupsid)
  - [DELETE /groups/:id](#delete-apiv1groupsid)
  - [GET /phrases](#get-apiv1phrases)
  - [POST /phrases](#post-apiv1phrases)
  - [PATCH /phrases/:id](#patch-apiv1phrasesid)
  - [POST /phrases/move](#post-apiv1phrasesmove)
  - [DELETE /phrases](#delete-apiv1phrases)
  - [POST /dispatch](#post-apiv1dispatch)
  - [GET /events (SSE)](#get-apiv1events-sse)
  - [POST /ai/rename-group](#post-apiv1airename-group)
  - [POST /ai/generate-notes](#post-apiv1aigenerate-notes)
  - [Коды ошибок](#коды-ошибок)
- [Типы данных](#типы-данных)
- [Полная таблица dispatch-экшенов](#полная-таблица-dispatch-экшенов)
- [Стратегия расширения API](#стратегия-расширения-api)

---

## Что это и зачем

HTTP Bridge — это HTTP-сервер на порту 42001, который открывает KeyCluster для **внешних инструментов**: браузерных расширений, Python/Node скриптов, CLI, Google Sheets, сторонних парсеров и любого другого ПО, умеющего делать HTTP-запросы.

Без этого сервера KeyCluster — закрытое приложение: все данные доступны только изнутри через Plugin SDK. С ним приложение становится полноценной платформой.

**Примеры сценариев:**

- Браузерное расширение собирает ключевые фразы со страницы и напрямую добавляет их в открытый проект
- Python-скрипт выгружает Yandex.Wordstat в KeyCluster батчами по 1000 фраз
- Google Sheets скрипт синхронизирует таблицу с группами и фразами в реальном времени
- CLI-инструмент запускает AI-переименование групп по расписанию

---

## Текущий статус

**Сервер на 42001 не реализован в переданных исходниках (фронтенд).**

В коде фронтенда нет ни одного упоминания порта 42001. Вся коммуникация между фронтендом и нативным слоем идёт через Tauri IPC (`invoke()`), а не HTTP. Это значит:

- Сервер либо реализован на Rust-стороне (не вошёл в архив)
- Либо он запланирован, но ещё не написан

Существующий IPC API (`src/core/project-transport-ipc.ts`) — это хорошая основа: все нужные команды уже есть, их нужно обернуть в HTTP.

---

## Существующие точки интеграции

Перед тем как строить Bridge, важно понимать, что уже работает:

| Механизм | Где живёт | Доступность | Назначение |
|----------|-----------|-------------|------------|
| **Plugin SDK** | Фронтенд JS | Только внутри приложения | Плагины с UI и логикой |
| **EventBus** | Фронтенд JS | Только внутри приложения | Реактивная связь между модулями |
| **Tauri IPC** (`invoke()`) | Rust ↔ JS | Только внутри Tauri | Файлы, БД, нативные операции |
| **AI HTTP** (Ollama/LM Studio) | Фронтенд → localhost | Любой LLM-сервер | Семантические операции через LLM |
| **HTTP Bridge (42001)** | Rust HTTP-сервер | **Любой внешний инструмент** | Управление приложением снаружи |
| **Hot-Reload** (`hot-reload-watcher.ts`) | Фронтенд | Файловая система | Плагины подхватываются при изменении файлов |

**Действующий IPC API** (команды Tauri, уже реализованы):

```
create_project       update_project       get_project
list_projects        delete_project       create_backup
save_backup_file     list_backup_files    prune_backup_files
list_snapshots       get_snapshot         delete_snapshot
```

---

## Архитектура моста

```
Внешний инструмент
  │  HTTP запрос  →  http://localhost:42001/api/v1/...
  ▼
Rust HTTP-сервер (Axum или Actix-web)
  │  Парсит запрос → преобразует в Tauri команду / Event
  ▼
Tauri Event Bridge  (tauri::AppHandle::emit / invoke)
  │  Доставляет команду во фронтенд
  ▼
Фронтенд (React + Zustand)
  │  useAppStore.dispatch(action, payload)
  ▼
Состояние: groups[], phrases[], minusWords[]
  │
  ├─ Ответ возвращается через tauri::channel / oneshot
  ▼
Rust HTTP-сервер  →  JSON-ответ  →  Внешний инструмент
```

**Для SSE (события):**

```
Внешний инструмент подключается к GET /api/v1/events
  ▼
Rust держит SSE-стрим открытым
  ▼
EventBus.on('*', ...) во фронтенде
  → Tauri emit('sse:event', payload)
  → Rust форвардит в SSE-стрим
  ▼
Внешний инструмент получает события в реальном времени
```

**Рекомендуемый Rust стек:**
- `axum` — HTTP-сервер
- `tokio` — async runtime (уже есть в Tauri)
- `tauri-plugin-localhost` — или кастомный плагин

---

## REST API — спецификация

**Базовый URL:** `http://localhost:42001/api/v1`

**Заголовки запроса:**
```
Content-Type: application/json
X-Client-Id: my-extension    (опционально, для логирования)
```

---

### `GET /api/v1/status`

Проверка доступности сервера и состояния приложения. Использовать для ping перед работой.

**Response 200:**
```json
{
  "status": "ready",
  "version": "1.0",
  "projectId": "uuid-or-null",
  "projectName": "Мой проект",
  "phraseCount": 1250,
  "groupCount": 48
}
```

---

### `GET /api/v1/state`

Полный снимок текущего состояния проекта (read-only).

**Response 200:**
```json
{
  "groups": [
    {
      "id": "uuid",
      "name": "Купить телефон",
      "parentId": null,
      "color": "#4CAF50",
      "notes": "Коммерческие запросы",
      "isExpanded": true,
      "isTrash": false,
      "createdAt": 1700000000000
    }
  ],
  "phrases": [
    {
      "id": "uuid",
      "text": "купить телефон",
      "groupId": "uuid",
      "frequency": 5400,
      "kei": 8.2,
      "cpc": 1.5,
      "competition": 0.7,
      "tags": ["commercial"],
      "intent": "transactional",
      "createdAt": 1700000000000
    }
  ],
  "minusWords": [
    {
      "id": "uuid",
      "text": "бесплатно",
      "isExact": false,
      "searchType": "broad",
      "groupId": null,
      "createdAt": 1700000000000
    }
  ],
  "selectedGroupIds": [],
  "activeGroupId": "uuid-or-null"
}
```

---

### `GET /api/v1/groups`

Список групп проекта.

**Query params:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `parentId` | string | Только дочерние группы указанного родителя |
| `includeTrash` | boolean | Включить системную группу «Корзина» (по умолчанию `false`) |

**Response 200:**
```json
{
  "groups": [ ...Group[] ],
  "total": 48
}
```

---

### `POST /api/v1/groups`

Создать группу.

**Request:**
```json
{
  "name": "Новая группа",
  "parentId": null
}
```

**Response 201:**
```json
{
  "id": "new-uuid",
  "name": "Новая группа",
  "parentId": null,
  "isExpanded": true,
  "isTrash": false,
  "createdAt": 1700000000000
}
```

---

### `PATCH /api/v1/groups/:id`

Обновить группу. Все поля опциональны — передавать только изменяемые.

**Request:**
```json
{
  "name": "Новое название",
  "notes": "Описание группы",
  "color": "#FF5722",
  "parentId": "uuid-or-null"
}
```

**Response 200:**
```json
{ "success": true }
```

---

### `DELETE /api/v1/groups/:id`

Удалить группу вместе со всеми дочерними группами и их фразами.

**Response 200:**
```json
{
  "success": true,
  "deletedGroups": 3,
  "deletedPhrases": 150
}
```

---

### `GET /api/v1/phrases`

Список фраз с фильтрацией и пагинацией.

**Query params:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `groupId` | string | Фразы конкретной группы |
| `search` | string | Текстовый поиск по полю `text` |
| `intent` | string | Фильтр: `transactional \| commercial \| informational \| navigational` |
| `limit` | number | Кол-во результатов (по умолчанию 100, max 1000) |
| `offset` | number | Смещение для пагинации (по умолчанию 0) |

**Response 200:**
```json
{
  "phrases": [ ...Phrase[] ],
  "total": 1250,
  "limit": 100,
  "offset": 0
}
```

---

### `POST /api/v1/phrases`

Добавить фразы в группу.

**Request:**
```json
{
  "groupId": "target-group-uuid",
  "phrases": [
    { "text": "купить телефон", "frequency": 5400, "kei": 8.2, "cpc": 1.5 },
    { "text": "телефон цена",   "frequency": 2100 },
    { "text": "смартфон недорого" }
  ]
}
```

Поля каждой фразы (все опциональны кроме `text`):

| Поле | Тип | Описание |
|------|-----|----------|
| `text` | string | **Обязательно.** Текст фразы |
| `frequency` | number | Частотность |
| `kei` | number | KEI |
| `cpc` | number | CPC |
| `competition` | number | Конкурентность (0–1) |
| `notes` | string | Заметки |
| `tags` | string[] | Теги |
| `intent` | string | Интент: `transactional \| commercial \| informational \| navigational` |

**Response 201:**
```json
{
  "added": 3,
  "ids": ["uuid1", "uuid2", "uuid3"]
}
```

---

### `PATCH /api/v1/phrases/:id`

Обновить поля фразы. Все поля опциональны.

**Request:**
```json
{
  "text": "новый текст",
  "frequency": 3000,
  "notes": "важная фраза",
  "tags": ["important", "commercial"],
  "intent": "commercial"
}
```

**Response 200:**
```json
{ "success": true }
```

---

### `POST /api/v1/phrases/move`

Переместить фразы в другую группу.

**Request:**
```json
{
  "phraseIds": ["uuid1", "uuid2", "uuid3"],
  "targetGroupId": "target-group-uuid"
}
```

**Response 200:**
```json
{ "moved": 3 }
```

---

### `DELETE /api/v1/phrases`

Удалить фразы по ID.

**Request:**
```json
{
  "phraseIds": ["uuid1", "uuid2", "uuid3"]
}
```

**Response 200:**
```json
{ "deleted": 3 }
```

---

### `POST /api/v1/dispatch`

Универсальный эндпоинт: прямой вызов любого store-экшена. Позволяет выполнять операции, для которых нет отдельного эндпоинта. Полный список экшенов — в разделе [Полная таблица dispatch-экшенов](#полная-таблица-dispatch-экшенов).

**Request:**
```json
{
  "action": "addGroup",
  "payload": { "name": "SEO фразы", "parentId": null }
}
```

**Response 200:**
```json
{
  "success": true,
  "result": "new-group-uuid"
}
```

**Примеры:**
```json
// Включить мультигрупповой режим
{ "action": "setMultigroupMode", "payload": true }

// Установить активную группу
{ "action": "setActiveGroup", "payload": "group-uuid" }

// Открыть левую панель с плагином
{ "action": "setLeftPanel", "payload": { "open": true, "module": "ai" } }

// Переместить фразы в корзину
{ "action": "moveToTrash", "payload": ["phrase-id-1", "phrase-id-2"] }

// Применить результаты кластеризации
{ "action": "applyClusteringResults", "payload": null }
```

---

### `GET /api/v1/events` (SSE)

Подписка на события приложения в реальном времени через Server-Sent Events.

**Request:**
```
GET /api/v1/events HTTP/1.1
Accept: text/event-stream
Cache-Control: no-cache
```

**Stream (формат каждого события):**
```
data: {"event":"groups:changed","payload":{"groupId":"uuid","action":"rename"}}

data: {"event":"phrases:changed","payload":{"count":5,"groupId":"uuid"}}

data: {"event":"group:selected","payload":{"groupId":"uuid"}}

data: {"event":"project:loaded","payload":{"projectId":"uuid","name":"Мой проект"}}

data: {"event":"ping"}

```

**Поддерживаемые события:**

| Событие | Когда |
|---------|-------|
| `groups:changed` | Группы изменились (добавление, удаление, переименование, перемещение) |
| `phrases:changed` | Фразы изменились |
| `minus-words:changed` | Минус-слова изменились |
| `group:selected` | Пользователь выбрал группу |
| `phrase:selected` | Пользователь выбрал фразу |
| `selection:changed` | Изменилось выделение (группы или фразы) |
| `project:loaded` | Проект загружен |
| `project:updated` | Проект сохранён |
| `left-panel:open` | Левая панель открылась |
| `left-panel:close` | Левая панель закрылась |
| `theme:changed` | Сменилась тема |
| `multigroup:enter` | Включён мультигрупповой режим |
| `multigroup:exit` | Мультигрупповой режим выключен |
| `module:initialized` | Плагин инициализирован |
| `ping` | Keepalive (каждые 30 сек) |

**Пример на Python:**
```python
import requests

with requests.get('http://localhost:42001/api/v1/events', stream=True) as r:
    for line in r.iter_lines():
        if line.startswith(b'data: '):
            import json
            event = json.loads(line[6:])
            print(event)
```

**Пример на JavaScript (браузерное расширение):**
```js
const es = new EventSource('http://localhost:42001/api/v1/events');
es.onmessage = (e) => {
  const { event, payload } = JSON.parse(e.data);
  if (event === 'phrases:changed') {
    console.log('Фразы изменились:', payload);
  }
};
```

---

### `POST /api/v1/ai/rename-group`

Запустить AI-переименование группы. Требует активного AI-плагина с установленным соединением к LLM.

**Request:**
```json
{ "groupId": "uuid" }
```

**Response 200:**
```json
{
  "success": true,
  "groupId": "uuid",
  "oldName": "Группа 1",
  "newName": "Купить телефон"
}
```

**Response 503** (AI недоступен):
```json
{
  "error": "AI_NOT_AVAILABLE",
  "message": "AI plugin is not connected. Enable it in settings."
}
```

---

### `POST /api/v1/ai/generate-notes`

Сгенерировать описание группы через AI.

**Request:**
```json
{ "groupId": "uuid" }
```

**Response 200:**
```json
{
  "success": true,
  "groupId": "uuid",
  "notes": "Коммерческие запросы по покупке смартфонов"
}
```

---

### Коды ошибок

| HTTP код | Error code | Когда |
|----------|------------|-------|
| `400` | `INVALID_REQUEST` | Отсутствуют обязательные поля или неверный формат |
| `404` | `GROUP_NOT_FOUND` | Группа с указанным ID не найдена |
| `404` | `PHRASE_NOT_FOUND` | Фраза с указанным ID не найдена |
| `409` | `CONFLICT` | Нельзя переместить группу в свою дочернюю группу |
| `503` | `AI_NOT_AVAILABLE` | AI-плагин не подключён или LLM недоступен |
| `500` | `INTERNAL_ERROR` | Внутренняя ошибка |

**Формат ошибки:**
```json
{
  "error": "GROUP_NOT_FOUND",
  "message": "Group with id 'abc-123' not found",
  "details": { "id": "abc-123" }
}
```

---

## Типы данных

### Phrase

```ts
interface Phrase {
  id:           string;           // UUID, генерируется хостом
  text:         string;           // Текст фразы
  groupId:      string;           // ID группы (плоская структура!)
  frequency?:   number;           // Частотность
  kei?:         number;           // KEI
  cpc?:         number;           // CPC
  competition?: number;           // Конкурентность (0–1)
  notes?:       string;           // Заметки
  tags?:        string[];         // Теги (lowercase)
  intent?:      IntentType;       // Интент запроса
  createdAt:    number;           // Unix timestamp (мс)
  starredAt?:   number;           // Unix timestamp (мс) — если в избранном
}

type IntentType = 'transactional' | 'commercial' | 'informational' | 'navigational';
```

> **Важно:** фразы хранятся в **плоском массиве**, не вложены в группы. Связь с группой — через `phrase.groupId`.

### Group

```ts
interface Group {
  id:         string;
  name:       string;
  parentId:   string | null;    // null — корневая группа
  color?:     string;           // CSS-цвет (#hex, rgb...)
  notes?:     string;
  isExpanded: boolean;          // развёрнута в дереве
  isTrash:    boolean;          // системная группа «Корзина»
  createdAt:  number;
  clusterQuality?: {
    score:     number;          // 0–100
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

---

## Полная таблица dispatch-экшенов

Используется в `POST /api/v1/dispatch`. Все мутации автоматически добавляют снимок в стек undo/redo (кроме `updatePhraseNoUndo`).

### Группы

| Action | Payload | Описание |
|--------|---------|----------|
| `addGroup` | `{ name: string, parentId: string \| null }` | Создать группу |
| `renameGroup` | `{ id: string, name: string }` | Переименовать группу |
| `deleteGroup` | `string` (id) | Удалить группу и потомков (с фразами) |
| `deleteGroups` | `string[]` | Удалить несколько групп |
| `moveGroups` | `{ ids: string[], newParentId: string \| null }` | Переместить группы |
| `toggleExpand` | `string` (id) | Свернуть/развернуть в дереве |

### Фразы

| Action | Payload | Описание |
|--------|---------|----------|
| `addPhrases` | `{ texts: string[], groupId: string, extra?: Partial<Phrase>[] }` | Добавить фразы |
| `deletePhrases` | `string[]` | Удалить фразы по ID |
| `movePhrases` | `{ ids: string[], targetGroupId: string }` | Переместить фразы |
| `copyPhrases` | `{ ids: string[], targetGroupId: string }` | Скопировать фразы (новые ID) |
| `updatePhrase` | `{ id: string, updates: Partial<Phrase> }` | Обновить фразу (с undo) |
| `updatePhraseNoUndo` | `{ id: string, updates: Partial<Phrase> }` | Обновить фразу (без undo) |
| `addTagToPhrase` | `{ id: string, tag: string }` | Добавить тег фразе |
| `removeTagFromPhrase` | `{ id: string, tag: string }` | Удалить тег у фразы |
| `moveToTrash` | `string[]` | Переместить фразы в корзину |
| `restoreFromTrash` | `string[]` | Восстановить из корзины |
| `clearTrash` | _(нет payload)_ | Очистить корзину |

### Выделение

| Action | Payload | Описание |
|--------|---------|----------|
| `setActiveGroup` | `string \| null` | Установить активную группу |
| `setSelectedGroupIds` | `string[]` | Установить выделенные группы |

### UI

| Action | Payload | Описание |
|--------|---------|----------|
| `setLeftPanel` | `{ open: boolean, module?: string \| null }` | Открыть/закрыть левую панель |
| `setRightPanel` | `{ open: boolean }` | Открыть/закрыть правую панель |
| `setMultigroupMode` | `boolean` | Включить/выключить мультигрупповой режим |

### Прочее

| Action | Payload | Описание |
|--------|---------|----------|
| `clearAll` | _(нет payload)_ | Сбросить всё состояние проекта |
| `pushUndo` | _(нет payload)_ | Вручную добавить снимок в undo-стек |
| `batchOperation` | `(state) => void` | Атомарная пакетная мутация |
| `setClusteringResults` | `Map<string, Phrase[]> \| null` | Установить результаты кластеризации |
| `applyClusteringResults` | _(нет payload)_ | Применить результаты (создать группы, переместить фразы) |

---

## Стратегия расширения API

### Что добавить после минимального Bridge

| Приоритет | Что | Сложность | Ценность |
|-----------|-----|-----------|----------|
| 1 | **Минимальный HTTP Bridge**: `/status`, `/state`, `/dispatch`, SSE `/events` | Средняя (Rust) | 🔥 Максимальная |
| 2 | **CRUD для групп и фраз** (отдельные эндпоинты) | Низкая | Высокая |
| 3 | **WebSocket** на порту 42002 — двунаправленный поток | Средняя | Средняя |
| 4 | **MCP Server адаптер** — KeyCluster как инструмент для AI-агентов | Высокая | Перспектива |

### WebSocket (порт 42002)

Дополняет HTTP Bridge для сценариев, где клиенту нужно не только слушать события, но и отправлять команды в реальном времени без повторных HTTP-запросов.

```
ws://localhost:42002

// Клиент отправляет:
{ "type": "subscribe", "events": ["phrases:changed", "groups:changed"] }
{ "type": "dispatch", "action": "addPhrases", "payload": { ... } }

// Сервер отвечает:
{ "type": "event", "event": "phrases:changed", "payload": { ... } }
{ "type": "result", "success": true }
```

### MCP Server

[Model Context Protocol](https://modelcontextprotocol.io/) — стандарт для подключения инструментов к AI-агентам (Claude, GPT и др.).

Поверх HTTP Bridge можно реализовать MCP-адаптер, который откроет KeyCluster как инструмент в любом AI-агенте. Агент сможет читать фразы, создавать группы, запускать AI-операции — через естественный язык.

```
AI-агент (Claude): "Добавь 50 фраз из списка в группу 'Купить телефон'"
  → MCP Tool: keycluster.add_phrases({ groupId, phrases })
  → HTTP Bridge POST /api/v1/phrases
  → Данные в KeyCluster
```

---

*Документ описывает спецификацию HTTP Bridge на основе анализа исходного кода KeyCluster и существующего Plugin API.*
