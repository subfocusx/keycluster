# AI-плагин — Документация

> `user-plugins/ai/` + `src/core/ai/` | Plugin API версия 1.0

---

## Содержание

- [Что делает](#что-делает)
- [Архитектура и файловая структура](#архитектура-и-файловая-структура)
- [Настройки](#настройки)
- [AI Tools — параметры инструментов](#ai-tools--параметры-инструментов)
- [useAIStore — состояние и управление](#useaistore--состояние-и-управление)
- [AIService — HTTP-клиент к LLM](#aiservice--http-клиент-к-llm)
- [AIQueueManager — очередь задач](#aiqueuemanager--очередь-задач)
- [PromptManager — шаблоны промптов](#promptmanager--шаблоны-промптов)
- [Использование из другого плагина](#использование-из-другого-плагина)

---

## Что делает

AI-плагин подключается к локальному LLM-серверу (Ollama или LM Studio) и выполняет **семантические операции** над ключевыми фразами и группами. Он умеет делать ровно две вещи:

| Tool ID | Что генерирует | Формат |
|---------|---------------|--------|
| `rename-groups` | Короткое название группы по её фразам | 2–4 слова |
| `group-notes` | Краткое описание тематики группы | 1 предложение, до 15 слов |

> **Важно:** AI **не используется** для классификации интентов, генерации минус-слов и оценки качества кластеров. Эти задачи решаются алгоритмически в `core/intent`, `core/minus-words`, `core/clustering`.

---

## Архитектура и файловая структура

```
user-plugins/ai/
├── index.ts               AppModule: регистрация в shell, читает настройки
├── components.tsx          AIPanel — левая панель со всеми секциями
├── connection-section.tsx  UI подключения к LLM + getOrCreateService()
├── prompt-section.tsx      UI редактирования и экспорта промптов
├── logs-section.tsx        UI логов AI-запросов
└── AIProgressPopup.tsx     Попап прогресса в status-bar

src/core/ai/
├── service.ts              AIService: HTTP-клиент к LLM
├── store.ts                useAIStore: Zustand-стор состояния
├── types.ts                Типы, константы, дефолтные настройки
├── queue-manager.ts        AIQueueManager: батчинг, конкурентность
├── prompt-manager.ts       PromptManager: шаблоны промптов и пресеты
└── validators.ts           Санитизация и валидация LLM-ответов
```

**Поток данных:**

```
init(ctx)
  └─ readSettings()
  └─ useAIStore.setService(new AIService(settings))

AIPanel (UI)
  └─ ConnectionSection → getOrCreateService() → AIService

[Пользователь запускает операцию]
  └─ AIQueueManager.enqueueBatch([tasks])
       └─ AIService.renameGroup(phrases) / generateGroupNotes(phrases)
            └─ fetch → LLM (Ollama/LM Studio)

useAIStore (queue[], logs[], connectionStatus)
  └─ AIProgressPopup (status-bar) — реактивный UI прогресса
  └─ LogsSection — лог запросов
```

---

## Настройки

Хранятся в `settingsStore` под ключом `'ai'`. Читаются через `ctx.getSetting(key)`, обновляются через `ctx.setSetting(key, value)`.

| Ключ | Тип | По умолчанию | Описание |
|------|-----|-------------|----------|
| `enabled` | `boolean` | `false` | Включить AI-плагин |
| `provider` | `'ollama' \| 'lmstudio'` | `'ollama'` | LLM-провайдер |
| `endpoint` | `string` | `'http://localhost:11434'` | URL сервера LLM |
| `model` | `string` | `'qwen2.5:3b'` | Название модели |
| `temperature` | `number` | `0.1` | Температура генерации (0–1) |
| `timeout` | `number` | `20000` | Таймаут HTTP-запроса (мс) |
| `batchSize` | `number` | `50` | Максимум групп за один запуск |
| `maxTokens` | `number` | `2048` | Лимит токенов в ответе |
| `debugMode` | `boolean` | `false` | Подробные логи каждого запроса |
| `cacheEnabled` | `boolean` | `true` | Кэш ответов (TTL 5 мин, max 200 записей) |

**Эндпоинты по умолчанию:**

| Провайдер | URL |
|-----------|-----|
| Ollama | `http://localhost:11434` |
| LM Studio | `http://localhost:1234` |

**Рекомендуемые модели:**

| Приоритет | Модели |
|-----------|--------|
| Быстрые (≤ 3B) | `qwen2.5:3b`, `llama3.2:3b`, `gemma2:2b` |
| Качественные (7–8B) | `qwen2.5:7b`, `mistral:7b`, `llama3.1:8b` |

---

## AI Tools — параметры инструментов

Каждый инструмент отправляет запрос к LLM с индивидуальными параметрами. Они заданы в `TOOL_CONFIGS` и не зависят от пользовательских настроек.

| Tool ID | `maxTokens` | `temperature` | `top_p` | Макс. фраз в промпте |
|---------|:-----------:|:------------:|:-------:|:--------------------:|
| `rename-groups` | 60 | 0.2 | 0.8 | 15 |
| `group-notes` | 100 | 0.3 | 0.9 | 15 |

**Логика выбора фраз для промпта:**

Если группа содержит больше 15 фраз, в промпт попадают только топ-15. Приоритет отбора:
1. Фразы с `frequency > 0` — сортируются по убыванию частотности, берутся первые 15
2. Если ни у одной нет частотности — берутся первые 15 из массива по порядку

---

## useAIStore — состояние и управление

Zustand-стор AI-плагина. Доступен из `plugin-sdk` (в React-компонентах) или через `.getState()` (вне компонентов).

```ts
import { useAIStore } from 'plugin-sdk';

// В React-компоненте:
const status = useAIStore(s => s.connectionStatus);
const queue  = useAIStore(s => s.queue);

// Вне компонента:
const store = useAIStore.getState();
```

### Состояние (read)

```ts
interface AIStore {
  connectionStatus:  'disconnected' | 'connecting' | 'connected' | 'error';
  connectionError:   string | null;
  currentModel:      string | null;   // имя активной модели
  responseTime:      number | null;   // время последнего запроса (мс)
  logs:              AILogEntry[];    // лог запросов, последние 500
  queue:             AIQueueItem[];   // активные задачи
  service:           AIService | null;
  debugMode:         boolean;
  concurrencyLimit:  number;          // по умолчанию 2
  activeCount:       number;          // задач выполняется прямо сейчас
}
```

### Типы записей

```ts
interface AILogEntry {
  id:                string;
  timestamp:         number;
  level:             'info' | 'warn' | 'error';
  message:           string;
  duration?:         number;   // мс — длительность запроса
  promptTokens?:     number;
  completionTokens?: number;
  totalTokens?:      number;
  modelName?:        string;
}

interface AIQueueItem {
  id:           string;
  toolId:       'rename-groups' | 'group-notes';
  label:        string;          // человекочитаемое описание задачи
  status:       'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress:     number;          // 0–100
  total:        number;          // всего элементов в батче
  processed:    number;          // обработано
  error?:       string;
  startedAt?:   number;
  completedAt?: number;
}
```

### Методы (write)

```ts
const store = useAIStore.getState();

// --- Статус подключения ---
store.setConnectionStatus('connected');
store.setConnectionStatus('error', 'Connection refused');
store.setCurrentModel('qwen2.5:3b');
store.setResponseTime(342);          // мс
store.setService(aiServiceInstance);
store.setDebugMode(true);

// --- Логи ---
store.addLog('info', 'Запрос отправлен', {
  duration: 320,
  promptTokens: 85,
  completionTokens: 12,
  totalTokens: 97,
  modelName: 'qwen2.5:3b',
});
store.clearLogs();

// --- Очередь задач ---
const id = store.addQueueItem('rename-groups', 'Переименование: Телефоны', 10);
store.updateQueueItem(id, { status: 'processing', progress: 50, processed: 5 });
store.removeQueueItem(id);
store.cancelQueueItem(id);   // отменяет через AbortController, ставит status: 'cancelled'
store.cancelAll();           // отменяет все задачи + очищает pendingQueue

// --- AbortController для HTTP-запросов ---
const ctrl = new AbortController();
store.registerAbortController(id, ctrl);   // привязать контроллер к задаче
store.abortTask(id);                       // abort() + unregister
store.unregisterAbortController(id);       // только unregister
```

---

## AIService — HTTP-клиент к LLM

`AIService` — единственный класс, который общается с LLM по HTTP. Экземпляр создаётся AI-плагином при инициализации и хранится в `useAIStore.getState().service`.

### Получение экземпляра

```ts
import { useAIStore } from 'plugin-sdk';

const service = useAIStore.getState().service;
if (!service) {
  // AI-плагин выключен или ещё не инициализирован
  return;
}
```

### Проверка доступности LLM

```ts
// Проверить, запущен ли сервер (быстрый HEAD-like запрос к /api/tags или /v1/models)
const isUp = await service.isAvailable();  // boolean

// Полная проверка: отправить тестовый chat-запрос
const status = await service.checkConnection();
// → 'connected' | 'error'
```

### Список моделей

```ts
const models = await service.getModels();
// → ['qwen2.5:3b', 'qwen2.5:7b', 'llama3.1:8b', ...]
// Пробует /api/tags (Ollama), потом /v1/models (OpenAI-compatible)
```

### Семантические операции

```ts
import type { Phrase } from 'plugin-sdk';

const phrases: Phrase[] = ctx.store.getState().phrases
  .filter(p => p.groupId === 'target-group-id');

// Сгенерировать название группы (2–4 слова)
const name = await service.renameGroup(phrases);
// → 'Купить телефон'

// Сгенерировать описание группы (1 предложение)
const notes = await service.generateGroupNotes(phrases);
// → 'Коммерческие запросы по покупке смартфонов'
```

### Произвольный chat-запрос

Для плагинов, которым нужна кастомная LLM-логика:

```ts
const response = await service.chat([
  { role: 'system', content: 'Ты PPC-специалист. Отвечай кратко.' },
  { role: 'user',   content: 'Какова тематика: купить ноутбук, ноутбук цена, ноутбук недорого?' },
]);

response.content           // строка с ответом LLM
response.model             // имя модели, которая ответила
response.duration          // мс — время запроса
response.usage             // { promptTokens, completionTokens, totalTokens } | undefined
```

### Управление и кэш

```ts
service.cancel();                 // прервать все активные HTTP-запросы (AbortController)
service.clearCache();             // сбросить кэш ответов
const cacheSize = service.getCacheSize();  // количество записей

service.updateSettings({
  provider:     'ollama',
  endpoint:     'http://localhost:11434',
  model:        'qwen2.5:7b',
  temperature:  0.1,
  timeout:      30000,
  batchSize:    50,
  maxTokens:    2048,
  enabled:      true,
  debugMode:    false,
  cacheEnabled: true,
});
```

### Кэш — детали

| Параметр | Значение |
|----------|----------|
| TTL | 5 минут |
| Максимум записей | 200 (LRU: вытесняется самая старая) |
| Ключ записи | `toolId + sortedKeywords + model + promptHash` |
| Выключить | `cacheEnabled: false` в настройках |

Кэш учитывает изменение промпта: если шаблон отредактирован, `promptHash` изменится и старые записи перестанут совпадать.

### Retry-логика

| Ситуация | Поведение |
|----------|-----------|
| HTTP 429 (Rate Limited) | Exponential backoff: 1s → 2s → 4s (max), до `retries` раз |
| Сетевая ошибка | 1 повтор с задержкой |
| AbortController.abort() | Немедленная отмена, без retry |
| Таймаут (timeout мс) | AbortController.abort() → нет retry |

---

## AIQueueManager — очередь задач

Синглтон для батчинга AI-задач. Управляет конкурентностью, приоритетами и отменой.

### Получение экземпляра

```ts
import { AIQueueManager } from 'plugin-sdk';

const qm = AIQueueManager.getInstance();          // конкурентность 2 (по умолчанию)
const qm = AIQueueManager.getInstance(4);         // конкурентность 4
```

### Добавить задачу

```ts
const taskId = qm.enqueue({
  toolId:   'rename-groups',
  label:    'Переименование: Телефоны Samsung',
  priority: 1,                   // больше число = выше приоритет
  run: async (service, signal) => {
    if (signal.aborted) return;
    const phrases = ctx.store.getState().phrases.filter(p => p.groupId === 'g-id');
    const name = await service.renameGroup(phrases);
    ctx.store.dispatch('renameGroup', { id: 'g-id', name });
  },
});
```

### Батч задач

```ts
const groups = ctx.store.getState().groups.filter(g => !g.isTrash);

const taskIds = qm.enqueueBatch(
  groups.map(group => ({
    toolId:   'rename-groups' as const,
    label:    `Переименование: ${group.name}`,
    priority: 1,
    run: async (service, signal) => {
      if (signal.aborted) return;
      const phrases = ctx.store.getState().phrases.filter(p => p.groupId === group.id);
      if (phrases.length === 0) return;
      const name = await service.renameGroup(phrases);
      ctx.store.dispatch('renameGroup', { id: group.id, name });
    },
  }))
);
```

### Управление

```ts
qm.cancel(taskId);        // отменить конкретную задачу
qm.cancelAll();           // отменить все задачи в очереди
qm.setConcurrency(4);     // изменить параллельность (1–8)
AIQueueManager.reset();   // уничтожить синглтон (используется при пересоздании сервиса)
```

### Как работает очередь

- Задачи сортируются по `priority` (по убыванию) перед запуском
- Одновременно выполняется не более `concurrencyLimit` задач (по умолчанию 2)
- Каждая задача получает свой `AbortController`, зарегистрированный в `useAIStore`
- Прогресс задач отражается в `useAIStore.queue` → `AIProgressPopup` в статус-баре
- После завершения/отмены задачи `tryProcess()` немедленно запускает следующую из очереди

---

## PromptManager — шаблоны промптов

Управляет шаблонами промптов для AI-инструментов. Поддерживает кастомизацию, пресеты, экспорт/импорт.

```ts
import { promptManager } from 'plugin-sdk';
import type { PromptKey } from 'plugin-sdk';

// PromptKey = 'rename' | 'group-notes'
```

### Чтение и редактирование шаблонов

```ts
// Получить текущий шаблон (с учётом кастомизации пользователя)
const template = promptManager.getTemplate('rename');
// → строка с {{keywords}} как переменной

// Установить кастомный шаблон
promptManager.setTemplate('rename', `Ты PPC-специалист. Придумай название:\n{{keywords}}`);

// Сбросить к дефолту
promptManager.resetToDefault('rename');
promptManager.resetAll();   // сбросить все шаблоны

// Получить все шаблоны сразу
const all = promptManager.getAllTemplates();
// → { rename: '...', 'group-notes': '...' }
```

### Построение промпта

```ts
// Подставить переменные в шаблон
const prompt = promptManager.buildPrompt('rename', {
  keywords: '- купить телефон\n- телефон цена\n- смартфон недорого',
});
// → готовая строка для отправки в LLM

// Получить системный промпт для инструмента
const sysMsg = promptManager.buildSystemMessage('rename-groups');
// → 'Ты PPC-специалист. Отвечай ТОЛЬКО 2-4 словами ...'
```

### Пресеты

```ts
promptManager.savePreset('Агрессивный PPC');          // сохранить текущие шаблоны как пресет
const names = promptManager.listPresets();             // → ['Агрессивный PPC', 'SEO-стиль']
promptManager.loadPreset('Агрессивный PPC');           // загрузить пресет
promptManager.deletePreset('Агрессивный PPC');         // удалить пресет
```

### Экспорт / импорт

```ts
// Экспорт в JSON-строку
const json = promptManager.exportPrompts();
// → '{ "rename": "...", "group-notes": "..." }'

// Импорт из JSON-строки (возвращает null если OK, строку ошибки если нет)
const error = promptManager.importPrompts(json);
if (error) console.error('Ошибка импорта:', error);
```

### Валидация

```ts
const error = promptManager.validate('rename');
// → null                                       — OK
// → 'Отсутствует переменная {{keywords}}'      — ошибка
// → 'Prompt пуст'                              — ошибка
// → 'Prompt превышает 10000 символов'          — ошибка
```

### Переменные шаблона

```ts
const vars = promptManager.getVariables('rename');
// → ['keywords']
// Возвращает все {{variable}} из текущего шаблона
```

**Хранение:** шаблоны сохраняются в `localStorage` (`STORAGE_KEYS.AI_PROMPT_OVERRIDES`). Пресеты — в `STORAGE_KEYS.AI_PROMPT_PRESETS`. Дефолтные шаблоны в код не записываются — только переопределения.

---

## Использование из другого плагина

AI-плагин не экспортирует публичный API явно, но `useAIStore` и `AIQueueManager` доступны через `plugin-sdk`. Это позволяет любому плагину использовать AI.

### Проверка готовности AI

```ts
import { useAIStore } from 'plugin-sdk';

function checkAI(ctx: PluginContext): boolean {
  const { service, connectionStatus } = useAIStore.getState();
  if (!service || connectionStatus !== 'connected') {
    ctx.eventBus.emit('notify', {
      message: 'AI не подключён. Включите AI-плагин и проверьте соединение.',
      duration: 4000,
    });
    return false;
  }
  return true;
}
```

### Полный пример: батчевое переименование групп

```ts
import type { AppModule, PluginContext } from 'plugin-sdk';
import { useAIStore, AIQueueManager } from 'plugin-sdk';

const myPlugin: AppModule = {
  manifest: {
    id: 'my-ai-tool',
    name: 'My AI Tool',
    version: '1.0.0',
    description: 'Переименование групп через AI',
    slot: ['left-panel'],
  },

  init(ctx: PluginContext) {
    ctx.registerCommand('rename-all-groups', async () => {
      const service = useAIStore.getState().service;
      if (!service) {
        ctx.eventBus.emit('notify', { message: 'AI не подключён', duration: 3000 });
        return;
      }

      const state = ctx.store.getState();
      const groups = state.groups.filter(g => !g.isTrash);

      if (groups.length === 0) {
        ctx.eventBus.emit('notify', { message: 'Нет групп для переименования', duration: 2000 });
        return;
      }

      const qm = AIQueueManager.getInstance();

      qm.enqueueBatch(
        groups.map(group => ({
          toolId: 'rename-groups' as const,
          label:  `Переименование: ${group.name}`,
          priority: 1,
          run: async (svc, signal) => {
            if (signal.aborted) return;

            const phrases = state.phrases.filter(p => p.groupId === group.id);
            if (phrases.length === 0) return;

            const name = await svc.renameGroup(phrases);

            if (!signal.aborted) {
              ctx.store.dispatch('renameGroup', { id: group.id, name });
            }
          },
        }))
      );

      ctx.eventBus.emit('notify', {
        message: `Запущено переименование ${groups.length} групп`,
        duration: 2000,
      });
    });
  },

  destroy() {},
};

export default myPlugin;
```

### Пример: произвольный AI-запрос

```ts
import { useAIStore } from 'plugin-sdk';

async function classifyIntent(text: string): Promise<string> {
  const service = useAIStore.getState().service;
  if (!service) throw new Error('AI service not available');

  const response = await service.chat([
    {
      role: 'system',
      content: 'Ты PPC-специалист. Определи интент запроса. Отвечай одним словом: transactional, commercial, informational или navigational.',
    },
    {
      role: 'user',
      content: text,
    },
  ]);

  return response.content.trim().toLowerCase();
}
```
