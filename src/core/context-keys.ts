// ============================================================
// KeyCluster Context Keys — условная видимость UI-элементов
// ============================================================
//
// Система контекстных ключей (аналог VS Code Context Keys).
// Модули указывают when-условие при registerUI(),
// runtime фильтрует contributions через contextKeyService.evaluate().
//
// Поддерживаемые выражения:
//   'key'                    — truthy проверка
//   '!key'                   — negation
//   'key > N'               — число больше N
//   'key >= N'              — число больше или равно N
//   'key < N'               — число меньше N
//   'key === "str"'         — строгое равенство строке
//   'key !== "str"'         — строгое неравенство
//   'expr1 && expr2'        — логическое AND
//   'expr1 || expr2'        — логическое OR
//   Скобки НЕ поддерживаются (KISS для v1)
// ============================================================

type ContextValue = boolean | number | string;

interface Subscription {
  expression: string;
  callback: (result: boolean) => void;
}

class ContextKeyServiceImpl {
  private keys = new Map<string, ContextValue>();
  private subscriptions: Subscription[] = [];

  /**
   * Установить значение контекстного ключа.
   * При изменении уведомляет всех подписчиков, чьи выражения затронуты.
   *
   * @param key — имя ключа (например, 'hasSelection', 'phraseCount')
   * @param value — значение (boolean, number или string)
   */
  setKey(key: string, value: ContextValue): void {
    const prev = this.keys.get(key);
    if (prev === value) return; // нет изменений — не уведомляем

    this.keys.set(key, value);

    // Уведомляем подписчиков
    for (const sub of this.subscriptions) {
      try {
        const result = this.evaluate(sub.expression);
        sub.callback(result);
      } catch {
        // ignore evaluation errors in callbacks
      }
    }
  }

  /**
   * Получить значение контекстного ключа.
   */
  getKey(key: string): ContextValue | undefined {
    return this.keys.get(key);
  }

  /**
   * Получить все установленные ключи.
   */
  getAllKeys(): Record<string, ContextValue> {
    const result: Record<string, ContextValue> = {};
    for (const [k, v] of this.keys) {
      result[k] = v;
    }
    return result;
  }

  /**
   * Вычислить when-выражение и вернуть boolean.
   *
   * Поддерживаемый синтаксис:
   *   - 'key' — truthy проверка (key существует и !== 0 && !== false && !== '')
   *   - '!key' — negation
   *   - 'key > N', 'key >= N', 'key < N' — числовые сравнения
   *   - 'key === "str"', 'key !== "str"' — строковые сравнения
   *   - 'expr1 && expr2' — AND (приоритет выше чем OR)
   *   - 'expr1 || expr2' — OR
   *
   * Скобки не поддерживаются в v1.
   */
  evaluate(expression: string): boolean {
    const trimmed = expression.trim();
    if (!trimmed) return true;

    // Handle || (lowest precedence)
    const orParts = splitRespectingQuotes(trimmed, '||');
    if (orParts.length > 1) {
      return orParts.some(part => this.evaluate(part));
    }

    // Handle && (higher precedence than ||)
    const andParts = splitRespectingQuotes(trimmed, '&&');
    if (andParts.length > 1) {
      return andParts.every(part => this.evaluate(part));
    }

    // Single expression
    const expr = trimmed;

    // Negation: !key
    if (expr.startsWith('!')) {
      const key = expr.slice(1).trim();
      return !this.isTruthy(key);
    }

    // Numeric comparison: key > N, key >= N, key < N
    const numericMatch = expr.match(/^(\w+)\s*(>=|>|<=|<)\s*(\d+(?:\.\d+)?)$/);
    if (numericMatch) {
      const [, key, op, numStr] = numericMatch;
      const val = this.keys.get(key);
      const num = parseFloat(numStr);
      if (typeof val !== 'number') return false;
      switch (op) {
        case '>': return val > num;
        case '>=': return val >= num;
        case '<': return val < num;
        case '<=': return val <= num;
      }
    }

    // Strict equality/inequality: key === "str", key !== "str"
    const eqMatch = expr.match(/^(\w+)\s*(===|!==)\s*["'](.+?)["']$/);
    if (eqMatch) {
      const [, key, op, strVal] = eqMatch;
      const val = this.keys.get(key);
      if (op === '===') return val === strVal;
      if (op === '!==') return val !== strVal;
    }

    // Simple truthy check: key
    return this.isTruthy(expr);
  }

  /**
   * Подписаться на изменения выражения.
   * Callback вызывается каждый раз когда значение выражения может измениться.
   *
   * @returns функция отписки
   */
  subscribe(expression: string, callback: (result: boolean) => void): () => void {
    const sub: Subscription = { expression, callback };
    this.subscriptions.push(sub);

    // Сразу вызываем с текущим значением
    try {
      callback(this.evaluate(expression));
    } catch {
      // ignore
    }

    return () => {
      const idx = this.subscriptions.indexOf(sub);
      if (idx !== -1) this.subscriptions.splice(idx, 1);
    };
  }

  /** Очистить все ключи и подписки (для тестов) */
  clear(): void {
    this.keys.clear();
    this.subscriptions = [];
  }

  // ---- Private ----

  private isTruthy(key: string): boolean {
    const val = this.keys.get(key);
    if (val === undefined) return false;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val > 0;
    if (typeof val === 'string') return val.length > 0;
    return Boolean(val);
  }
}

// ---- Singleton ----

let instance: ContextKeyServiceImpl | null = null;

export function getContextKeyService(): ContextKeyServiceImpl {
  if (!instance) {
    instance = new ContextKeyServiceImpl();
  }
  return instance;
}

/** Для тестов — создать свежий сервис */
export function createContextKeyService(): ContextKeyServiceImpl {
  instance = new ContextKeyServiceImpl();
  return instance;
}

// ---- Helpers ----

/**
 * Split string by operator (&& or ||), respecting quoted strings.
 */
function splitRespectingQuotes(str: string, operator: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';
  let i = 0;

  while (i < str.length) {
    const ch = str[i];

    // Track quotes
    if ((ch === '"' || ch === "'") && (i === 0 || str[i - 1] !== '\\')) {
      if (!inQuote) {
        inQuote = true;
        quoteChar = ch;
      } else if (ch === quoteChar) {
        inQuote = false;
      }
    }

    // Check for operator (outside quotes)
    if (!inQuote && str.slice(i, i + operator.length) === operator) {
      parts.push(current);
      current = '';
      i += operator.length;
      continue;
    }

    current += ch;
    i++;
  }

  if (current.trim()) {
    parts.push(current);
  }

  return parts;
}
