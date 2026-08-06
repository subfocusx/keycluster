'use client';

import React, { useMemo, useCallback } from 'react';
import { useAppStore } from '@/plugin-sdk';
import { useActiveGroupIds } from '../useActiveGroupIds';
import { isNumericColumn } from '../shared';
import type { CellRendererDeps } from '../CellRenderer';
import { getCellStyle, getHeaderStyle, renderCellValue } from '../CellRenderer';
import { usePhraseTableState } from './usePhraseTableState';
import type { ModuleUIContribution, PhraseActionContext, Phrase, KCID } from '@/plugin-sdk';

export function usePhraseTableData(
  S: ReturnType<typeof usePhraseTableState>,
  columnColors: Record<string, string>,
  editingNotesId: string | null,
  editingNotesValue: string,
  setEditingNotesValue: (v: string) => void,
  commitNotesEdit: () => void,
  cancelNotesEdit: () => void,
  startNotesEdit: (id: KCID, notes: string) => void,
  phraseActions: ModuleUIContribution[],
  phraseActionCtx: PhraseActionContext,
) {
  const phrases = useAppStore(s => s.phrases);
  const groups = useAppStore(s => s.groups);
  const minusWords = useAppStore(s => s.minusWords);
  const addMinusWord = useAppStore(s => s.addMinusWord);
  const removeMinusWord = useAppStore(s => s.removeMinusWord);
  const activeGroupId = useAppStore(s => s.activeGroupId);
  const togglePhraseSelection = useAppStore(s => s.togglePhraseSelection);
  const selectPhraseRange = useAppStore(s => s.selectPhraseRange);

  const minusWordTexts = useMemo(() => ({
    exactTexts: new Set(minusWords.filter(mw => mw.isExact).map(mw => mw.text.toLowerCase())),
    broadTexts: new Set(minusWords.filter(mw => !mw.isExact).map(mw => mw.text.toLowerCase())),
  }), [minusWords]);

  const passesColumnFilters = useCallback((phrase: Phrase) => {
    const filters = S.columnFilters;
    for (const [colKey, filter] of Object.entries(filters)) {
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
  }, [S.columnFilters]);

  const activeGroupIds = useActiveGroupIds();

  const filteredPhrases = useMemo(() => {
    const trashGroupId = groups.find(g => g.isTrash)?.id;
    let result = trashGroupId ? phrases.filter(p => p.groupId !== trashGroupId) : phrases;
    result = result.filter(p => activeGroupIds.has(p.groupId));
    const labelFilter = S.labelFilter;
    if (labelFilter) result = result.filter(p => (p.tags ?? []).includes(labelFilter));
    const tagFilter = S.tagFilter;
    if (tagFilter) result = result.filter(p => (p.tags ?? []).includes(tagFilter));
    if (S.searchQuery) {
      const q = S.searchQuery.toLowerCase();
      result = result.filter(p => p.text.toLowerCase().includes(q));
    }
    if (S.showStarredOnly) result = result.filter(p => !!p.starredAt);
    result = result.filter(passesColumnFilters);
    return result;
  }, [phrases, activeGroupIds, groups, S.searchQuery, S.showStarredOnly, S.labelFilter, S.tagFilter, passesColumnFilters]);

  const sortedPhrases = useMemo(() => {
    return filteredPhrases.slice().sort((a, b) => {
      const av = a[S.sortField as keyof Phrase];
      const bv = b[S.sortField as keyof Phrase];
      if (typeof av === 'string' && typeof bv === 'string') {
        return S.sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      if (typeof av === 'number' && typeof bv === 'number') {
        return S.sortDir === 'asc' ? av - bv : bv - av;
      }
      return 0;
    });
  }, [filteredPhrases, S.sortField, S.sortDir]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    phrases.forEach(p => p.tags?.forEach(t => set.add(t)));
    return [...set].sort();
  }, [phrases]);

  const handleSort = (field: keyof Phrase) => {
    if (S.sortField === field) {
      S.setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      S.setSortField(field);
      S.setSortDir('asc');
    }
  };

  const activeFilterCount = useMemo(() => {
    let count = Object.values(S.columnFilters).filter(f => f && f.value !== '').length;
    if (S.showStarredOnly) count++;
    return count;
  }, [S.columnFilters, S.showStarredOnly]);

  const broadMinusTextSet = useMemo(() => {
    const s = new Set<string>();
    for (const mw of minusWords) {
      if (!mw.isExact && mw.searchType === 'broad') s.add(mw.text.toLowerCase());
    }
    return s;
  }, [minusWords]);

  const handleWordClick = (word: string) => {
    const lowerWord = word.toLowerCase();
    if (broadMinusTextSet.has(lowerWord)) {
      const existingMW = minusWords.find(mw => mw.text.toLowerCase() === lowerWord && !mw.isExact && mw.searchType === 'broad');
      if (existingMW) removeMinusWord(existingMW.id);
    } else {
      addMinusWord(word, false, activeGroupId, 'broad');
    }
  };

  const handlePhraseClick = (phrase: Phrase, event?: React.MouseEvent, lastClickedId?: KCID | null, setLastClickedId?: (id: KCID) => void) => {
    if (event?.ctrlKey || event?.metaKey) {
      togglePhraseSelection(phrase.id);
    } else if (event?.shiftKey && lastClickedId != null && sortedPhrases.length > 0) {
      const ids = sortedPhrases.map((p: Phrase) => p.id);
      selectPhraseRange(lastClickedId, phrase.id, ids);
    } else {
      togglePhraseSelection(phrase.id);
    }
    if (setLastClickedId) setLastClickedId(phrase.id);
  };

  const getGroupName = useCallback((groupId: KCID) => groups.find(g => g.id === groupId)?.name ?? '—', [groups]);
  const getGroupColor = useCallback((groupId: KCID) => groups.find(g => g.id === groupId)?.color, [groups]);

  const cellRendererDeps: CellRendererDeps = useMemo(() => ({
    minusWordTexts, handleWordClick,
    editingNotesId, editingNotesValue, setEditingNotesValue,
    commitNotesEdit, cancelNotesEdit, startNotesEdit,
    getGroupName, getGroupColor, columnColors,
    phraseActions, phraseActionCtx,
  }), [minusWordTexts, handleWordClick, editingNotesId, editingNotesValue, setEditingNotesValue,
      commitNotesEdit, cancelNotesEdit, startNotesEdit,
      getGroupName, getGroupColor, columnColors,
      phraseActions, phraseActionCtx]);

  const boundRenderCellValue = useCallback(
    (colKey: string, phrase: Phrase) => renderCellValue(colKey, phrase, cellRendererDeps),
    [cellRendererDeps]
  );

  const boundGetCellStyle = useCallback(
    (colKey: string, phrase: Phrase) => getCellStyle(colKey, phrase, columnColors),
    [columnColors]
  );

  const boundGetHeaderStyle = useCallback(
    (colKey: string) => getHeaderStyle(colKey, columnColors),
    [columnColors]
  );

  return {
    minusWordTexts, passesColumnFilters, activeGroupIds,
    filteredPhrases, sortedPhrases, allTags,
    handleSort, activeFilterCount,
    broadMinusTextSet, handleWordClick, handlePhraseClick,
    getGroupName, getGroupColor,
    cellRendererDeps, boundRenderCellValue, boundGetCellStyle, boundGetHeaderStyle,
  };
}