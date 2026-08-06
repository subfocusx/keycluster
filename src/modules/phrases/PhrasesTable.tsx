'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useAppStore, getRuntime , AppEvents} from '@/plugin-sdk';
import type { PluginContext, KCID, Phrase, ModuleUIContribution, PhraseActionContext } from '@/plugin-sdk';
import { useKCDialog } from '@/components/KCDialog';
import { ProjectStatisticsDialog } from '@/components/ProjectStatisticsDialog';

import { type ColDef } from './shared';
import { getCellClass } from './CellRenderer';
import { renderSortIcon } from './SortIcon';
import VirtualizedRows from './PhraseRow';
import { AddPhrasesDialog } from './AddPhrasesDialog';
import { PhrasesToolbar } from './PhrasesToolbar';
import { BulkActionsBar } from './BulkActionsBar';
import { PhraseTableHeader } from './PhraseTableHeader';
import { MoveDialog } from './MoveDialog';
import { usePhraseTableState } from './hooks/usePhraseTableState';
import { useColumnSizing } from './hooks/useColumnSizing';
import { useTableKeyboard } from './hooks/useTableKeyboard';
import { usePhraseTableData } from './hooks/usePhraseTableData';
import { EmptyPhrasesState } from './EmptyPhrasesState';
import { RenameColumnDialog } from './RenameColumnDialog';

export function PhrasesTable({ ctx }: { ctx: PluginContext }) {
  const groups = useAppStore(s => s.groups);
  const activeGroupId = useAppStore(s => s.activeGroupId);
  const selectedPhraseIds = useAppStore(s => s.selectedPhraseIds);
  const togglePhraseSelection = useAppStore(s => s.togglePhraseSelection);
  const selectAllPhrases = useAppStore(s => s.selectAllPhrases);
  const clearPhraseSelection = useAppStore(s => s.clearPhraseSelection);
  const moveToTrash = useAppStore(s => s.moveToTrash);
  const movePhrases = useAppStore(s => s.movePhrases);
  const copyPhrases = useAppStore(s => s.copyPhrases);
  const updatePhrase = useAppStore(s => s.updatePhrase);
  const addTagToPhrase = useAppStore(s => s.addTagToPhrase);
  const removeTagFromPhrase = useAppStore(s => s.removeTagFromPhrase);
  const addGroup = useAppStore(s => s.addGroup);
  const kcDialog = useKCDialog();

  const columnLabels = useAppStore(s => s.ui.columnLabels);
  const columnColors = useAppStore(s => s.ui.columnColors);
  const columnVisibility = useAppStore(s => s.ui.columnVisibility);
  const toggleColumnVisibility = useAppStore(s => s.toggleColumnVisibility);
  const setColumnLabel = useAppStore(s => s.setColumnLabel);
  const setColumnColor = useAppStore(s => s.setColumnColor);
  const resetColumnSettings = useAppStore(s => s.resetColumnSettings);


  const S = usePhraseTableState();
  const nonTrashGroups = groups.filter(g => !g.isTrash);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [lastClickedPhraseId, setLastClickedPhraseId] = useState<KCID | null>(null);

  useEffect(() => {
    const unsub = ctx.eventBus.on('phrases:open-add-dialog', () => S.setShowAddDialog(true));
    return () => { unsub(); };
  }, [ctx.eventBus]);

  useTableKeyboard(ctx, activeGroupId, selectedPhraseIds);

  const [phraseActions, setPhraseActions] = useState<ModuleUIContribution[]>([]);
  useEffect(() => {
    const rt = getRuntime();
    if (rt) setPhraseActions([...rt.getUIContributions('phrase-row:actions')]);
  }, []);

  const phraseActionCtx: PhraseActionContext = useMemo(() => ({
    store: ctx.store,
    eventBus: ctx.eventBus,
  }), [ctx.store, ctx.eventBus]);

  const startEdit = useCallback((id: KCID, text: string) => {
    S.setEditingPhraseId(id);
    S.setEditingValue(text);
  }, []);

  const commitEdit = useCallback(() => {
    if (S.editingPhraseId && S.editingValue.trim()) {
      updatePhrase(S.editingPhraseId, { text: S.editingValue.trim() });
    }
    S.setEditingPhraseId(null);
    S.setEditingValue('');
  }, [S.editingPhraseId, S.editingValue, updatePhrase]);

  const cancelEdit = useCallback(() => {
    S.setEditingPhraseId(null);
    S.setEditingValue('');
  }, []);

  const startNotesEdit = useCallback((id: KCID, notes: string) => {
    S.setEditingNotesId(id);
    S.setEditingNotesValue(notes);
  }, []);

  const commitNotesEdit = useCallback(() => {
    if (S.editingNotesId) {
      updatePhrase(S.editingNotesId, { notes: S.editingNotesValue.trim() });
    }
    S.setEditingNotesId(null);
    S.setEditingNotesValue('');
  }, [S.editingNotesId, S.editingNotesValue, updatePhrase]);

  const cancelNotesEdit = useCallback(() => {
    S.setEditingNotesId(null);
    S.setEditingNotesValue('');
  }, []);

  const multigroupMode = useAppStore(s => s.ui.multigroupMode);
  const selectedGroupIdsCount = useAppStore(s => s.selectedGroupIds.size);
  useEffect(() => {
    S.setTagFilter(null);
  }, [activeGroupId, multigroupMode, selectedGroupIdsCount]);

  useEffect(() => {
    const unsub = ctx.eventBus.on('favorites:toggle-filter', (payload: unknown) => {
      const p = payload as { showStarredOnly: boolean } | undefined;
      if (p) S.setShowStarredOnly(p.showStarredOnly);
    });
    return unsub;
  }, [ctx.eventBus]);

  useEffect(() => {
    const unsub = ctx.eventBus.on('phrases:start-edit', (payload: { id: KCID; text: string }) => {
      startEdit(payload.id, payload.text);
    });
    return unsub;
  }, [ctx.eventBus, startEdit]);

  useEffect(() => {
    const el = tableContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      setContainerWidth(Math.floor(entries[0].contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const baseCols: ColDef[] = useMemo(() => [
    { key: 'text', label: columnLabels['text'] ?? 'Ключевая фраза', width: 340, minWidth: 100, maxWidth: 2000, align: 'left', sortable: true, visible: true },
    { key: 'notes', label: columnLabels['notes'] ?? 'Заметки', width: 120, minWidth: 60, maxWidth: 400, align: 'left', sortable: false, visible: false },
    { key: 'frequency', label: columnLabels['frequency'] ?? 'Частота', width: 100, minWidth: 70, maxWidth: 300, align: 'right', sortable: true, visible: true },
    { key: 'kei', label: columnLabels['kei'] ?? 'KEI', width: 80, minWidth: 55, maxWidth: 150, align: 'right', sortable: true, visible: true },
    { key: 'cpc', label: columnLabels['cpc'] ?? 'CPC', width: 90, minWidth: 55, maxWidth: 150, align: 'right', sortable: true, visible: true },
    { key: 'group', label: columnLabels['group'] ?? 'Группа', width: 140, minWidth: 80, maxWidth: 400, align: 'left', sortable: false, visible: true },
  ], [columnLabels]);

  const defaultCols: ColDef[] = useMemo(() => baseCols.map(c => ({
    ...c,
    visible: c.key === 'group' ? ((columnVisibility[c.key] ?? c.visible) && !activeGroupId) : (columnVisibility[c.key] ?? c.visible),
  })), [baseCols, columnVisibility, activeGroupId]);

  const { colDefs, visibleCols, tableWidth, handleColResize } = useColumnSizing(baseCols, defaultCols, containerWidth, activeGroupId);

  const data = usePhraseTableData(S, columnColors, S.editingNotesId, S.editingNotesValue, S.setEditingNotesValue, commitNotesEdit, cancelNotesEdit, startNotesEdit, phraseActions, phraseActionCtx);

  const allSelected = data.sortedPhrases.length > 0 && selectedPhraseIds.size > 0 && data.sortedPhrases.every(p => selectedPhraseIds.has(p.id));

  const handleConfirmMove = useCallback(() => {
    if (S.targetGroupId) {
      if (S.moveAction === 'move') {
        movePhrases([...selectedPhraseIds], S.targetGroupId);
      } else {
        copyPhrases([...selectedPhraseIds], S.targetGroupId);
      }
      clearPhraseSelection();
      ctx.eventBus.emit(AppEvents.PHRASES_CHANGED);
      S.setShowMoveDialog(false);
    }
  }, [S.targetGroupId, S.moveAction, selectedPhraseIds, movePhrases, copyPhrases, clearPhraseSelection, ctx.eventBus]);

  return (
    <div className="flex flex-col h-full">
      <PhrasesToolbar
        searchQuery={S.searchQuery}
        setSearchQuery={S.setSearchQuery}
        labelFilter={S.labelFilter}
        setLabelFilter={S.setLabelFilter}
        tagFilter={S.tagFilter}
        setTagFilter={S.setTagFilter}
        allTags={data.allTags}
        sortedPhrasesLength={data.sortedPhrases.length}
        activeFilterCount={data.activeFilterCount}
        colManagerOpen={S.colManagerOpen}
        setColManagerOpen={S.setColManagerOpen}
        baseCols={baseCols}
        columnVisibility={columnVisibility}
        toggleColumnVisibility={toggleColumnVisibility}
        resetColumnSettings={resetColumnSettings}
        setShowStatsDialog={S.setShowStatsDialog}
        showStarredOnly={S.showStarredOnly}
        onToggleStarred={() => { S.setShowStarredOnly(!S.showStarredOnly); }}
        clearAllFilters={() => { S.setColumnFilters({}); S.setShowStarredOnly(false); }}
      />

      <BulkActionsBar
        selectedCount={selectedPhraseIds.size}
        sortedPhrases={data.sortedPhrases}
        onMove={() => { S.setMoveAction('move'); S.setShowMoveDialog(true); }}
        onCopy={() => { S.setMoveAction('copy'); S.setShowMoveDialog(true); }}
        onSelectAll={() => {
          if (data.sortedPhrases.length > 0) {
            useAppStore.setState({ selectedPhraseIds: new Set(data.sortedPhrases.map(p => p.id)) });
          } else {
            selectAllPhrases();
          }
        }}
        onDeselect={() => clearPhraseSelection()}
        onDelete={async () => {
          if (await kcDialog.confirm(`Удалить ${selectedPhraseIds.size} фраз?`, { title: 'Удаление', confirmLabel: 'Удалить', variant: 'destructive' })) {
            moveToTrash([...selectedPhraseIds]);
            ctx.eventBus.emit(AppEvents.PHRASES_CHANGED);
          }
        }}
      />

      <div className="flex-1 overflow-auto compact-scroll" ref={tableContainerRef}>
        <table className="border-collapse" style={{ tableLayout: 'fixed', width: tableWidth }}>
          <PhraseTableHeader
            visibleCols={visibleCols}
            baseCols={baseCols}
            allSelected={allSelected}
            sortedPhrasesLength={data.sortedPhrases.length}
            onSelectAllChange={() => {
              if (allSelected) clearPhraseSelection();
              else if (data.sortedPhrases.length > 0) useAppStore.setState({ selectedPhraseIds: new Set(data.sortedPhrases.map(p => p.id)) });
              else selectAllPhrases();
            }}
            onSort={data.handleSort}
            handleColResize={handleColResize}
            getHeaderStyle={data.boundGetHeaderStyle}
            renderSortIcon={(field: keyof Phrase) => renderSortIcon(field, S.sortField as keyof Phrase | null, S.sortDir)}
            columnColors={columnColors}
            setColumnColor={setColumnColor}
            columnLabels={columnLabels}
            toggleColumnVisibility={toggleColumnVisibility}
            onRenameCol={(key, label) => { S.setRenameCol({ key, label }); S.setRenameValue(label); }}
            columnFilters={S.columnFilters}
            filterPopoverCol={S.filterPopoverCol}
            setFilterPopoverCol={S.setFilterPopoverCol}
            filterInputValue={S.filterInputValue}
            setFilterInputValue={S.setFilterInputValue}
            filterType={S.filterType}
            setFilterType={S.setFilterType}
            onApplyFilter={(colKey: string) => {
              if (S.filterInputValue.trim() === '') {
                S.setColumnFilters(prev => { const n = { ...prev }; delete n[colKey]; return n; });
              } else {
                S.setColumnFilters(prev => ({ ...prev, [colKey]: { type: S.filterType, value: S.filterInputValue.trim() } }));
              }
              S.setFilterPopoverCol(null);
            }}
            onClearFilter={(colKey: string) => {
              S.setColumnFilters(prev => { const n = { ...prev }; delete n[colKey]; return n; });
              S.setFilterPopoverCol(null);
            }}
            hasColumnFilter={(colKey: string) => {
              const f = S.columnFilters[colKey];
              return !!f && f.value !== '';
            }}
          />
          <tbody style={{ position: 'relative' }}>
            {data.sortedPhrases.length === 0 ? (
              <EmptyPhrasesState activeGroupId={activeGroupId} ctx={ctx} numVisibleCols={visibleCols.length} />
            ) : (
              <VirtualizedRows
                sortedPhrases={data.sortedPhrases}
                visibleCols={visibleCols}
                selectedPhraseIdSet={selectedPhraseIds}
                tableContainerRef={tableContainerRef}
                handlePhraseClick={data.handlePhraseClick}
                lastClickedPhraseId={lastClickedPhraseId}
                setLastClickedPhraseId={setLastClickedPhraseId}
                setContextWord={S.setContextWord}
                togglePhraseSelection={togglePhraseSelection}
                getCellClass={getCellClass}
                getCellStyle={data.boundGetCellStyle}
                renderCellValue={data.boundRenderCellValue}
                minusWords={useAppStore.getState().minusWords}
                minusWordTexts={data.minusWordTexts}
                addMinusWord={useAppStore.getState().addMinusWord}
                removeMinusWord={useAppStore.getState().removeMinusWord}
                groups={groups}
                setMoveAction={S.setMoveAction}
                setShowMoveDialog={S.setShowMoveDialog}
                moveToTrash={moveToTrash}
                togglePhraseSelectionDirect={togglePhraseSelection}
                editingPhraseId={S.editingPhraseId}
                editingValue={S.editingValue}
                onEditChange={S.setEditingValue}
                onCommitEdit={commitEdit}
                onCancelEdit={cancelEdit}
                onStartEdit={startEdit}
                ctx={ctx}
                allTags={data.allTags}
                addTagToPhrase={addTagToPhrase}
                removeTagFromPhrase={removeTagFromPhrase}
              />
            )}
          </tbody>
        </table>
      </div>

      <MoveDialog
        open={S.showMoveDialog}
        onOpenChange={(v: boolean) => { if (!v) { S.setShowMoveDialog(false); S.setShowNewGroupInMove(false); } }}
        moveAction={S.moveAction}
        setMoveAction={S.setMoveAction}
        selectedCount={selectedPhraseIds.size}
        nonTrashGroups={nonTrashGroups}
        targetGroupId={S.targetGroupId}
        setTargetGroupId={S.setTargetGroupId}
        showNewGroupInMove={S.showNewGroupInMove}
        setShowNewGroupInMove={S.setShowNewGroupInMove}
        newGroupInMoveName={S.newGroupInMoveName}
        setNewGroupInMoveName={S.setNewGroupInMoveName}
        newGroupInMoveParentId={S.newGroupInMoveParentId}
        setNewGroupInMoveParentId={S.setNewGroupInMoveParentId}
        onConfirm={handleConfirmMove}
        addGroup={addGroup}
      />

      <RenameColumnDialog
        columnKey={S.renameCol?.key ?? null}
        columnLabel={S.renameCol?.label ?? ''}
        onApply={(key, label) => { setColumnLabel(key, label); S.setRenameCol(null); }}
        onCancel={() => S.setRenameCol(null)}
      />

      <AddPhrasesDialog open={S.showAddDialog} onOpenChange={S.setShowAddDialog} ctx={ctx} />
      <ProjectStatisticsDialog open={S.showStatsDialog} onOpenChange={S.setShowStatsDialog}
        selectedPhrases={selectedPhraseIds.size === 1 ? useAppStore.getState().phrases.filter(p => selectedPhraseIds.has(p.id)) : undefined} />
    </div>
  );
}
