// ============================================================
// Plugin: Deduplicator — поиск дублей
//
// Логика вынесена в отдельный модуль, чтобы панель (components.tsx)
// не зависела от точки входа плагина (index.ts / собранный index.js).
// ============================================================

import type { Phrase } from 'plugin-sdk';

export interface DeduplicateOptions {
  caseSensitive: boolean;
  withinGroup: boolean;
}

/** Пара «дубль → оставленная оригинальная фраза». */
export interface DuplicateMatch {
  /** Фраза-дубль, которая будет удалена. */
  duplicate: Phrase;
  /** Фраза, которая останется (первое вхождение). */
  original: Phrase;
}

/**
 * Находит дубли и для каждого возвращает пару «дубль → оставленная фраза».
 * Используется для предпросмотра перед применением удаления.
 */
export function collectDuplicateMatches(
  phrases: Phrase[],
  options: DeduplicateOptions,
): DuplicateMatch[] {
  const { caseSensitive, withinGroup } = options;
  const matches: DuplicateMatch[] = [];

  if (withinGroup) {
    const groupSeen = new Map<string, Map<string, Phrase>>();
    for (const phrase of phrases) {
      const key = caseSensitive ? phrase.text : phrase.text.toLowerCase();
      if (!groupSeen.has(phrase.groupId)) {
        groupSeen.set(phrase.groupId, new Map());
      }
      const groupMap = groupSeen.get(phrase.groupId)!;
      const original = groupMap.get(key);
      if (original) {
        matches.push({ duplicate: phrase, original });
      } else {
        groupMap.set(key, phrase);
      }
    }
  } else {
    const seen = new Map<string, Phrase>();
    for (const phrase of phrases) {
      const key = caseSensitive ? phrase.text : phrase.text.toLowerCase();
      const original = seen.get(key);
      if (original) {
        matches.push({ duplicate: phrase, original });
      } else {
        seen.set(key, phrase);
      }
    }
  }

  return matches;
}

/** id фраз-дублей (всё, кроме первого вхождения). */
export function deduplicate(
  phrases: Phrase[],
  options: DeduplicateOptions,
): string[] {
  return collectDuplicateMatches(phrases, options).map(m => m.duplicate.id);
}
