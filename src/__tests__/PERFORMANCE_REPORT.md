# KeyCluster — Отчёт по нагрузочным тестам

**Дата:** 2026-05-03 (после фиксов)
**Окружение:** Node.js, Vitest, 100k SEO-ключевых фраз
**Команда запуска:** `npx vitest run --config vitest.config.perf.ts src/__tests__/perf/`

---

## Итог: 38/38 тестов ✅

| Компонент       | 10k         | 50k         | 100k         | Статус |
|-----------------|-------------|-------------|--------------|--------|
| Память (MB)     | 17.8        | 29.5        | 42.9         | ✅     |
| Store мутация   | 0.02ms avg  | —           | 0.02ms avg   | ✅     |
| Persist сериал. | —           | —           | **0.0ms**    | ✅     |
| Рендер таблицы  | 3ms / 11 узлов | —       | — (экстр. 110 узлов) | ✅ |
| Кластеризация   |             |             |              |        |
| — ByWords       | 1,237ms     | —           | —            | ✅     |
| — Jaccard       | 544ms       | —           | —            | ✅     |
| — Jaccard+Lemm  | 539ms       | —           | —            | ✅     |
| — N-grams(2)    | **122ms**   | —           | —            | ✅     |
| — N-grams(3)    | **133ms**   | —           | —            | ✅     |
| — TF-IDF        | 146ms       | —           | —            | ✅     |
| — GroupByWords  | 13ms        | 50ms        | —            | ✅     |
| Worker          | 1,950ms     | 10,015ms    | —            | ✅     |

---

## Фиксы и их результаты

### ФИКС 1 — O(N²) preprocessing → O(N) предвычисление

**Проблема:** `preprocessPhrase()` и `getNgrams()` вызывались O(N²) раз внутри вложенных циклов.

**Решение:**
1. Предвычисление всех preprocessing результатов ДО вложенного цикла — O(N)
2. Инвертированный индекс для N-grams (n-gram → Set<phraseId>) — ищем только кандидатов
3. Оптимизированный Jaccard: итерация по меньшему множеству + ранний выход

**Результат:**

| Алгоритм | До фикса | После фикса | Ускорение |
|---|---|---|---|
| N-grams(2) 10k | 20,593ms | **122ms** | **169x** |
| N-grams(3) 10k | 38,438ms | **133ms** | **289x** |
| Jaccard+Lemm 10k | 9,535ms | **539ms** | **18x** |
| Jaccard 10k | 1,863ms | **544ms** | **3.4x** |
| Лемматизация замедление | 5.12x | **1.12x** | ✅ < 3x |

**Файлы:** `clustering/index.ts`, `clustering/clustering.worker.ts`, `ngrams/index.ts`

---

### ФИКС 2 — Виртуализация таблицы

**Проблема:** 700k DOM-узлов при 100k строк → UI зависает.

**Решение:** `@tanstack/react-virtual` — рендерятся только видимые строки + overscan.

**Результат:**

| Метрика | До фикса | После фикса |
|---|---|---|
| DOM-узлов 10k | 70,011 | **11** |
| Render 10k | 1,168ms | **3ms** |
| Экстраполяция 100k | 700,110 узлов | **110 узлов** |

**Файлы:** `phrases/components.tsx`

---

### ФИКС 3 — Store сериализация

**Проблема:** Zustand persist сериализовал ВСЁ состояние (включая 100k фраз) → 471ms при каждом изменении.

**Решение:** Исключить `phrases` из `partialize()` — фразы сохраняются через SQLite DB persistence, не localStorage.

**Результат:**

| Метрика | До фикса | После фикса |
|---|---|---|
| Persist сериализация | 471ms | **0.0ms** |
| Полная сериализация (справочно) | 471ms | 347ms (не persisted) |

**Файлы:** `core/store.ts`

---

## Сводка изменений

| Файл | Изменение |
|---|---|
| `src/modules/clustering/index.ts` | Предвычисление preprocessPhrase(), оптимизированный Jaccard |
| `src/modules/clustering/clustering.worker.ts` | Предвычисление word sets, оптимизированный Jaccard |
| `src/modules/ngrams/index.ts` | Предвычисление N-grams + инвертированный индекс |
| `src/modules/phrases/components.tsx` | @tanstack/react-virtual виртуализация строк |
| `src/core/store.ts` | Исключение phrases из persist partialize() |
| `package.json` | Добавлена зависимость @tanstack/react-virtual |

---

## Оставшиеся рекомендации

| Приоритет | Проблема | Рекомендация |
|-----------|----------|--------------|
| P1 | Worker без таймаута/отмены | Добавить AbortController + timeout в ClusteringWorkerBridge |
| P2 | N-grams/TF-IDF не в Worker | Перенести в Web Worker для неблокирующего UI |
| P2 | Полная сериализация фраз 347ms | Использовать SQLite для всех данных, localStorage только для UI |
