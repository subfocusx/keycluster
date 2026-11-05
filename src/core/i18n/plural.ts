// ============================================================
// Pluralization helpers for Russian UI text
// ============================================================

/**
 * Choose the correct Russian plural form for a noun.
 *   plural(1, 'шаг', 'шага', 'шагов')      → 'шаг'
 *   plural(2, 'шаг', 'шага', 'шагов')      → 'шага'
 *   plural(5, 'шаг', 'шага', 'шагов')      → 'шагов'
 *   plural(0, 'плагин', 'плагина', 'плагинов') → 'плагинов'
 */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}

/** "5 плагинов" / "1 плагин" / "2 плагина" */
export function pluralize(n: number, one: string, few: string, many: string): string {
  return `${n} ${plural(n, one, few, many)}`;
}
