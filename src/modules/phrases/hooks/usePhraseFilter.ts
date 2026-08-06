import { useMemo, useCallback } from 'react';
import type { Phrase, KCID } from '@/plugin-sdk';
import { isNumericColumn } from '../shared';

export function usePhraseFilter(params: {
  phrases: Phrase[];
  groups: { id: KCID; isTrash?: boolean }[];
  activeGroupIds: Set<KCID>;
  labelFilter: string | null;
  tagFilter: string | null;
  searchQuery: string;
  showStarredOnly: boolean;
  columnFilters: Record<string, { type: string; value: string } | null>;
  sortField: string;
  sortDir: 'asc' | 'desc';
}) {
  const { phrases, groups, activeGroupIds, labelFilter, tagFilter, searchQuery, showStarredOnly, columnFilters, sortField, sortDir } = params;

  const passesColumnFilters = useCallback((phrase: Phrase): boolean => {
    for (const [colKey, filter] of Object.entries(columnFilters)) {
      if (!filter || filter.value === '') continue;
      const cellValue = phrase[colKey as keyof Phrase];

      if (isNumericColumn(colKey)) {
        const numValue = typeof cellValue === 'number' ? cellValue : null;
        const filterNum = parseFloat(filter.value);
        if (isNaN(filterNum)) continue;
        if (numValue === null || numValue === undefined) return false;
        switch (filter.type) {
          case 'eq': if (numValue !== filterNum) return false; break;
          case 'gt': if (numValue <= filterNum) return false; break;
          case 'lt': if (numValue >= filterNum) return false; break;
        }
      } else {
        const strValue = typeof cellValue === 'string' ? cellValue.toLowerCase() : '';
        const filterStr = filter.value.toLowerCase();
        if (filter.type === 'eq' && !strValue.includes(filterStr)) return false;
        if (filter.type === 'gt' && strValue <= filterStr) return false;
        if (filter.type === 'lt' && strValue >= filterStr) return false;
      }
    }
    return true;
  }, [columnFilters]);

  const filteredPhrases = useMemo(() => {
    const trashGroupId = groups.find(g => g.isTrash)?.id;
    let result = trashGroupId ? phrases.filter(p => p.groupId !== trashGroupId) : phrases;

    result = result.filter(p => activeGroupIds.has(p.groupId));
    if (labelFilter) {
      result = result.filter(p => (p.tags ?? []).includes(labelFilter));
    }
    if (tagFilter) {
      result = result.filter(p => (p.tags ?? []).includes(tagFilter));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => p.text.toLowerCase().includes(q));
    }
    if (showStarredOnly) {
      result = result.filter(p => !!p.starredAt);
    }
    result = result.filter(passesColumnFilters);
    return result;
  }, [phrases, activeGroupIds, groups, searchQuery, showStarredOnly, passesColumnFilters, labelFilter, tagFilter]);

  const sortedPhrases = useMemo(() => {
    return filteredPhrases.slice().sort((a, b) => {
      const av = a[sortField as keyof Phrase];
      const bv = b[sortField as keyof Phrase];
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return 0;
    });
  }, [filteredPhrases, sortField, sortDir]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    phrases.forEach(p => p.tags?.forEach(t => set.add(t)));
    return [...set].sort();
  }, [phrases]);

  const activeFilterCount = useMemo(() => {
    let count = Object.values(columnFilters).filter(f => f && f.value !== '').length;
    if (showStarredOnly) count++;
    return count;
  }, [columnFilters, showStarredOnly]);

  return { passesColumnFilters, filteredPhrases, sortedPhrases, allTags, activeFilterCount };
}