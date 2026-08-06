export type FilterMode = 'ALLOW_ALL_ON_EMPTY' | 'STRICT_EMPTY_BLOCK';

export function applyOrDefault<T>(
  items: T[],
  enabled: T[] | null | undefined,
  defaultItems: T[],
): T[] {
  if (!enabled || enabled.length === 0) {
    return defaultItems;
  }
  return items.filter(i => enabled.includes(i));
}

export function safeFilter<T>(
  items: T[],
  enabled: T[] | null | undefined,
  mode: FilterMode = 'ALLOW_ALL_ON_EMPTY',
): T[] {
  if (!enabled || enabled.length === 0) {
    return mode === 'ALLOW_ALL_ON_EMPTY' ? items : [];
  }
  return items.filter(i => enabled.includes(i));
}

export function isEnabled(id: string, enabled: string[] | null | undefined): boolean {
  return !enabled || enabled.length === 0 || enabled.includes(id);
}

export function filterOrPass<T>(
  items: T[],
  predicate: ((item: T) => boolean) | null | undefined,
): T[] {
  if (!predicate) return items;
  return items.filter(predicate);
}
