import type { PhraseFilter } from './types';

class FilterRegistry {
  private filters = new Map<string, PhraseFilter>();

  register(filter: PhraseFilter): void {
    this.filters.set(filter.id, filter);
  }

  getAll(): PhraseFilter[] {
    return Array.from(this.filters.values());
  }

  get(id: string): PhraseFilter | undefined {
    return this.filters.get(id);
  }
}

export const filterRegistry = new FilterRegistry();

filterRegistry.register({
  id: 'more-than-6',
  name: 'Ключи > 6 слов',
  check: (t: string) => t.split(/\s+/).filter(Boolean).length > 6,
});

filterRegistry.register({
  id: 'more-than-7',
  name: 'Ключи > 7 слов',
  check: (t: string) => t.split(/\s+/).filter(Boolean).length > 7,
});

filterRegistry.register({
  id: 'more-than-8',
  name: 'Ключи > 8 слов',
  check: (t: string) => t.split(/\s+/).filter(Boolean).length > 8,
});

filterRegistry.register({
  id: 'contains-number',
  name: 'Содержит число',
  check: (t: string) => /\d/.test(t),
});

filterRegistry.register({
  id: 'questions',
  name: 'Вопросительные запросы',
  check: (t: string) => {
    const lower = t.toLowerCase();
    const questionWords = [
      'как', 'что', 'где', 'когда', 'почему',
      'зачем', 'какой', 'какая', 'какие', 'сколько',
    ];
    return questionWords.some(w => lower.includes(w)) || t.includes('?');
  },
});

filterRegistry.register({
  id: 'intent-transactional',
  name: 'Транзакционные',
  check: (_t: string, p?: any) => p?.intent === 'transactional',
});

filterRegistry.register({
  id: 'intent-commercial',
  name: 'Коммерческие',
  check: (_t: string, p?: any) => p?.intent === 'commercial',
});

filterRegistry.register({
  id: 'intent-informational',
  name: 'Информационные',
  check: (_t: string, p?: any) => p?.intent === 'informational',
});

filterRegistry.register({
  id: 'intent-navigational',
  name: 'Навигационные',
  check: (_t: string, p?: any) => p?.intent === 'navigational',
});

export function createLengthMoreFilter(n: number): PhraseFilter {
  return {
    id: `length-more-${n}`,
    name: `Длина > ${n} символов`,
    check: (t: string) => t.length > n,
  };
}

export function createLengthLessFilter(n: number): PhraseFilter {
  return {
    id: `length-less-${n}`,
    name: `Длина < ${n} символов`,
    check: (t: string) => t.length < n,
  };
}

export function createFrequencyMoreFilter(n: number): PhraseFilter {
  return {
    id: `frequency-more-${n}`,
    name: `Частота > ${n}`,
    check: (_t: string, p?: any) => (p?.frequency ?? 0) > n,
  };
}

export function createSubstringFilter(query: string): PhraseFilter {
  const q = query.toLowerCase();
  return {
    id: `substring-${q}`,
    name: `Поиск "${query}"`,
    check: (t: string) => t.toLowerCase().includes(q),
  };
}

export function deduplicate(phrases: string[]): string[] {
  const seen = new Set<string>();
  return phrases.filter(p => {
    const key = (p ?? '').trim().toLowerCase();
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function removeEmpty(phrases: (string | null | undefined)[]): string[] {
  return phrases.filter(p => p != null && p.trim().length > 0) as string[];
}

export function removeSpecialChars(text: string): string {
  return text
    .replace(/[!@#$%^&*()\[\]{}<>|\\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function cleanSpecialChars(phrases: string[]): string[] {
  return phrases.map(p => removeSpecialChars(p)).filter(Boolean);
}

// --- Pure functions for context-menu batch operations (Task 1) ---

export function batchDeduplicateInState(state: any, groupId: string): number {
  const phrases = state.phrases?.filter((p: any) => p.groupId === groupId) ?? [];
  const seen = new Set<string>();
  let removed = 0;
  for (const p of phrases) {
    const key = (p.text ?? '').trim().toLowerCase();
    if (!key || seen.has(key)) {
      const idx = state.phrases.indexOf(p);
      if (idx !== -1) {
        state.phrases.splice(idx, 1);
        removed++;
      }
    } else {
      seen.add(key);
    }
  }
  return removed;
}

export function batchRemoveEmptyInState(state: any, groupId: string): number {
  const toRemove = (state.phrases ?? []).filter(
    (p: any) => p.groupId === groupId && (p.text == null || p.text.trim().length === 0)
  );
  for (const p of toRemove) {
    const idx = state.phrases.indexOf(p);
    if (idx !== -1) state.phrases.splice(idx, 1);
  }
  return toRemove.length;
}

export function batchCleanCharsInState(state: any, groupId: string): number {
  const phrases = state.phrases?.filter((p: any) => p.groupId === groupId) ?? [];
  let count = 0;
  for (const p of phrases) {
    const cleaned = removeSpecialChars(p.text ?? '');
    if (cleaned !== p.text) {
      if (!cleaned) {
        const idx = state.phrases.indexOf(p);
        if (idx !== -1) state.phrases.splice(idx, 1);
      } else {
        p.text = cleaned;
      }
      count++;
    }
  }
  return count;
}
