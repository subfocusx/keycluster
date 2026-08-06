# План улучшения тестового покрытия

## Текущее состояние

| Модуль | Файлов | Тестов | Покрытие |
|--------|--------|--------|----------|
| clustering | 11 | 44 | ~4% |
| group-analysis | 3 | 27 | ~3-4% |

---

## 1. Clustering Algorithm Tests

### 1.1 clusterByWords — опции не протестированы

**Текущее покрытие**: базовые случаи есть, но опции не тестировались.

**Нужно добавить**:

```typescript
// Lemmatize option
it('should lemmatize words before clustering', () => {
  const phrases = [
    { id: '1', text: 'купить ноутбуки', ... },
    { id: '2', text: 'купить ноутбук', ... },
  ];
  const clusters = clusterByWords(phrases, 1, { lemmatize: true });
  // Both should cluster together
});

// ignoreNumbers option
it('should ignore numbers in phrases', () => {
  const phrases = [
    { id: '1', text: 'iphone 15', ... },
    { id: '2', text: 'iphone 16', ... },
  ];
  const clusters = clusterByWords(phrases, 1, { ignoreNumbers: true });
  // Both should cluster on 'iphone'
});

// Custom stopWords
it('should use custom stop words', () => {
  const phrases = [
    { id: '1', text: 'купить в москве', ... },
    { id: '2', text: 'купить в питере', ... },
  ];
  const clusters = clusterByWords(phrases, 1, { stopWords: new Set(['москве', 'питере']) });
  // 'купить' should be the cluster key
});

// scanMode: 'wide-to-narrow'
it('should process wide phrases first in wide-to-narrow mode', () => {
  // Test that ordering affects clustering results
});

// splitByStrength
it('should split clusters by strength threshold', () => {
  // Test that higher minCommon creates more/smaller clusters
});
```

### 1.2 clusterByJaccard — опции не протестированы

Те же опции для Jaccard:
- `lemmatize`, `ignoreNumbers`, `synonyms`, `stopWords`, `scanMode`, `splitByStrength`

### 1.3 generateClusterName — неполное покрытие

**Текущее**: есть только косвенные тесты через clusterByWords.

**Нужно добавить**:

```typescript
describe('generateClusterName', () => {
  it('should use top 2 words when available', () => {
    // sortedWords.length >= 2
  });

  it('should use single word when only one available', () => {
    // sortedWords.length === 1
  });

  it('should use "Кластер" when no words', () => {
    // sortedWords.length === 0 (all stop words)
  });

  it('should append (2), (3) etc for duplicate names', () => {
    // existingNames collision handling
  });
});
```

### 1.4 Edge cases — не хватает

```typescript
// Empty phrases array
it('should return empty map for empty input', () => {});

// Single phrase
it('should return 1 cluster for single phrase', () => {});

// All phrases identical
it('should cluster identical phrases together', () => {});

// No common words
it('should create separate clusters when no common words', () => {});

// Whitespace-only text
it('should handle whitespace-only text', () => {});

// Very long phrases
it('should handle long phrases with many words', () => {});

// Special characters
it('should handle punctuation', () => {});
it('should handle emoji', () => {});
```

---

## 2. Group Analysis Tests

### 2.1 groupByWords — дополнительные edge cases

**Уже хорошо покрыт**, но не хватает:

```typescript
// Edge: word appears in only 1 phrase (should be filtered)
it('should filter words appearing in only 1 phrase', () => {});

// Edge: phrase with no significant words
it('should handle phrase with only stop words', () => {});

// Performance: many phrases with overlapping words
it('should handle 100+ phrases efficiently', () => {});
```

### 2.2 DEFAULT_STOP_WORDS_LIST экспорт

Тесты для константы:
```typescript
it('should export DEFAULT_STOP_WORDS_LIST', () => {
  expect(DEFAULT_STOP_WORDS_LIST).toBeDefined();
  expect(Array.isArray(DEFAULT_STOP_WORDS_LIST)).toBe(true);
});
```

---

## 3. Приоритеты реализации

### HIGH PRIORITY (критичные баги)
1. `clusterByWords` опции — `lemmatize`, `ignoreNumbers`, `stopWords`
2. `generateClusterName` edge cases — "Кластер" fallback
3. Duplicate key handling — (2), (3) suffix

### MEDIUM PRIORITY (улучшение покрытия)
4. `scanMode: 'wide-to-narrow'` тесты
5. `splitByStrength` тесты
6. Edge cases: empty, whitespace, special chars

### LOW PRIORITY (nice to have)
7. Performance тесты
8. Unicode/emoji обработка

---

## 4. Файлы для создания/модификации

### Создать:
- `src/__tests__/modules/clustering-algorithms.test.ts` — опции для clusterByWords/clusterByJaccard
- `src/__tests__/modules/clustering-edge-cases.test.ts` — edge cases
- `src/__tests__/modules/generate-cluster-name.test.ts` — unit тесты для generateClusterName

### Модифицировать:
- `src/__tests__/modules/clustering.test.ts` — добавить опции тесты
- `src/__tests__/modules/group-analysis-ui.test.tsx` — добавить edge cases

---

## 5. Метрики успеха

- **Цель**: увеличить покрытие clustering с ~4% до ~15-20%
- **Цель**: увеличить покрытие group-analysis с ~3-4% до ~10-15%
- **Добавить**: ~30-50 новых тест-кейсов
