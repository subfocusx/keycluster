import type { ModuleUIContribution } from '@/plugin-sdk';
'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useAppStore , AppEvents} from '@/plugin-sdk';
import type { PluginContext, KCID, Group } from '@/plugin-sdk';
import { groupsSettings } from './index';
import { useKCDialog } from '@/components/KCDialog';
import { Button } from '@/components/ui/button';
import { parseGroupFilter, matchesFilter, subtreeMatchesFilter } from './utils/filter';
import { sortGroups } from './utils/sort';
import type { GroupSortField } from './utils/sort';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { toast } from '@/hooks/use-toast';
import { AddGroupListDialog, BulkMoveDialog } from './dialogs';
import { GroupNotesSection } from './notes';
import { GroupItemContextMenu } from './group-context-menu';
import { GroupBulkContextMenu } from './bulk-context-menu';
import GroupItem from './GroupItem';
import { getFlatVisibleGroupIds } from './groups-utils';
import { GroupsToolbar } from './groups-toolbar';
import { GroupsFilterBar } from './groups-filter';
import { getRuntime } from '@/plugin-sdk';
import { useRuntimeEvents } from '@/shell/useRuntimeEvents';

function MIcon({ name, className = '', style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}

export function GroupsPanel({ ctx }: { ctx: PluginContext }) {
  const groups = useAppStore(s => s.groups);

  const activeGroupId = useAppStore(s => s.activeGroupId);
  const setActiveGroup = useAppStore(s => s.setActiveGroup);
  const selectedGroupIds = useAppStore(s => s.selectedGroupIds);
  const multigroupMode = useAppStore(s => s.ui.multigroupMode);
  const setMultigroupMode = useAppStore(s => s.setMultigroupMode);
  const toggleExpand = useAppStore(s => s.toggleExpand);
  const setAllExpanded = useAppStore(s => s.setAllExpanded);
  const deleteGroup = useAppStore(s => s.deleteGroup);
  const deleteGroups = useAppStore(s => s.deleteGroups);
  const clearGroupSelection = useAppStore(s => s.clearGroupSelection);
  const setGroupColor = useAppStore(s => s.setGroupColor);
  const phrases = useAppStore(s => s.phrases);
  const minusWords = useAppStore(s => s.minusWords);
  const selectedPhraseIds = useAppStore(s => s.selectedPhraseIds);
  const kcDialog = useKCDialog();

  const [sortField, setSortField] = useState<GroupSortField | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [groupLocalSort, setGroupLocalSort] = useState<
    Record<string, { field: GroupSortField; dir: 'asc' | 'desc' }>
  >({});

  const [filterQuery, setFilterQuery] = useState('');
  const filterConditions = useMemo(() => parseGroupFilter(filterQuery), [filterQuery]);
  const hasFilter = filterConditions.length > 0;

  const phraseCountByGroup = useMemo(() => {
    const map = new Map<KCID, number>();
    for (const p of phrases) {
      map.set(p.groupId, (map.get(p.groupId) ?? 0) + 1);
    }
    return map;
  }, [phrases]);

  const getPhraseCount = useCallback((groupId: KCID): number => {
    let count = phraseCountByGroup.get(groupId) ?? 0;
    groups.filter(g => g.parentId === groupId && !g.isTrash)
          .forEach(child => { count += getPhraseCount(child.id); });
    return count;
  }, [phraseCountByGroup, groups]);

  const directMinusByGroup = useMemo(() => {
    const map = new Map<KCID, number>();
    for (const mw of minusWords) {
      if (mw.groupId === null || mw.groupId === undefined) continue;
      map.set(mw.groupId, (map.get(mw.groupId) ?? 0) + 1);
    }
    return map;
  }, [minusWords]);

  const getMinusCount = useCallback((groupId: KCID): number => {
    let count = directMinusByGroup.get(groupId) ?? 0;
    groups.filter(g => g.parentId === groupId && !g.isTrash)
          .forEach(child => { count += getMinusCount(child.id); });
    return count;
  }, [directMinusByGroup, groups]);

  const totalPhrases = phrases.length;
  const totalMinusWords = minusWords.length;
  const orphanCount = useMemo(() => {
    if (!hasFilter && phrases.length > 0) {
      return phrases.filter(p => !groups.some(g => g.id === p.groupId && !g.isTrash)).length;
    }
    return 0;
  }, [phrases, groups, hasFilter]);

  const lastClickedRef = React.useRef<KCID | null>(null);
  const setLastClickedGroupId = useCallback((id: KCID) => { lastClickedRef.current = id; }, []);

  const flatVisibleGroupIds = useMemo(() =>
    getFlatVisibleGroupIds(groups, null, filterConditions, hasFilter, getPhraseCount, sortField, sortDir, phrases, selectedPhraseIds, phraseCountByGroup),
    [groups, filterConditions, hasFilter, sortField, sortDir, phrases, selectedPhraseIds, phraseCountByGroup, getPhraseCount]
  );

  const [showBulkMoveDialog, setShowBulkMoveDialog] = useState(false);
  const bulkMoveTarget = React.useRef<{ ids: KCID[] } | null>(null);

  const bulkDeleteGroups = useCallback(async (ids: KCID[]) => {
    const nonTrashIds = ids.filter(id => !groups.find(g => g.id === id)?.isTrash);
    if (nonTrashIds.length === 0) return;
    const msg = nonTrashIds.length === 1
      ? `Удалить группу и все вложенные?`
      : `Удалить ${nonTrashIds.length} групп?`;
    if (await kcDialog.confirm(msg, { title: 'Удаление групп', confirmLabel: 'Удалить все', variant: 'destructive' })) {
      deleteGroups(nonTrashIds);
      ctx.eventBus.emit(AppEvents.GROUPS_CHANGED);
      ctx.eventBus.emit(AppEvents.PHRASES_CHANGED);
    }
  }, [deleteGroups, groups, kcDialog, ctx.eventBus]);

  const bulkMoveGroups = useCallback((ids: KCID[]) => {
    bulkMoveTarget.current = { ids };
    setShowBulkMoveDialog(true);
  }, []);

  const clearSelection = useCallback(() => {
    if (multigroupMode) {
      setMultigroupMode(false);
    } else if (selectedGroupIds.size > 0) {
      clearGroupSelection();
      lastClickedRef.current = null;
    }
  }, [multigroupMode, selectedGroupIds.size, clearGroupSelection, setMultigroupMode]);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
        if (multigroupMode) {
          setMultigroupMode(false);
        } else if (selectedGroupIds.size > 0) {
          clearGroupSelection();
          lastClickedRef.current = null;
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [multigroupMode, selectedGroupIds.size, clearGroupSelection, setMultigroupMode]);

  const [showListDialog, setShowListDialog] = useState(false);

  const rootGroups = useMemo(() => {
    const roots = groups.filter(g => g.parentId === null && !g.isTrash);
    if (!sortField) return roots;
    return sortGroups(roots, sortField, sortDir, getPhraseCount);
  }, [groups, sortField, sortDir, getPhraseCount]);

  const handleAddGroup = useCallback(async (parentId: KCID | null = null) => {
    const name = await kcDialog.prompt('Название группы:', { title: 'Создать группу', placeholder: 'Название...' });
    if (name) {
      ctx.store.dispatch('addGroup', { name, parentId });
      ctx.eventBus.emit(AppEvents.GROUPS_CHANGED);
    }
  }, [kcDialog, ctx]);

  const handleSort = useCallback((field: GroupSortField) => {
    setSortField(prev => {
      if (prev === field) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return field;
      }
      setSortDir('desc');
      return field;
    });
  }, []);

  const clearSort = useCallback(() => {
    setSortField(null);
    setSortDir('desc');
  }, []);

  const handleLocalSort = useCallback((groupId: string, field: GroupSortField, dir: 'asc' | 'desc') => {
    setGroupLocalSort(prev => ({ ...prev, [groupId]: { field, dir } }));
  }, []);

  const handleMultigroupToggle = useCallback(() => {
    if (multigroupMode) {
      setMultigroupMode(false);
    } else {
      const activeCountsAsSelected = activeGroupId && !selectedGroupIds.has(activeGroupId) ? 1 : 0;
      const effectiveCount = selectedGroupIds.size + activeCountsAsSelected;
      if (effectiveCount >= 2) {
        setMultigroupMode(true);
      }
    }
  }, [multigroupMode, activeGroupId, selectedGroupIds, setMultigroupMode]);

  const renderSubtree = (group: Group, depth: number = 0): React.ReactNode => {
    let children = groups.filter(g => g.parentId === group.id && !g.isTrash);

    const localSort = groupLocalSort[group.id];
    if (localSort) {
      children = sortGroups(children, localSort.field, localSort.dir, getPhraseCount);
    } else if (sortField) {
      children = sortGroups(children, sortField, sortDir, getPhraseCount);
    }

    const count = getPhraseCount(group.id);
    const isActive = activeGroupId === group.id;
    const isHighlighted = hasFilter && matchesFilter(group, filterConditions, groups, phrases, selectedPhraseIds, phraseCountByGroup);

    if (hasFilter && !subtreeMatchesFilter(group, filterConditions, groups, phrases, selectedPhraseIds, phraseCountByGroup)) {
      return null;
    }

    return (
      <React.Fragment key={group.id}>
        <GroupItem
          group={group}
          depth={depth}
          ctx={ctx}
          isActive={isActive}
          phraseCount={count}
          minusCount={getMinusCount(group.id)}
          isSelected={selectedGroupIds.has(group.id)}
          isHighlighted={isHighlighted}
          flatVisibleGroupIds={flatVisibleGroupIds}
          setLastClickedGroupId={setLastClickedGroupId}
          getLastClickedGroupId={() => lastClickedRef.current}
          onBulkDelete={(ids) => bulkDeleteGroups(ids)}
          onBulkMove={(ids) => bulkMoveGroups(ids)}
          localSort={groupLocalSort[group.id]}
          onLocalSort={handleLocalSort}
        />
        {group.isExpanded && children.map(child => renderSubtree(child, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {multigroupMode && (
        <div className="flex items-center gap-1.5 px-3 h-7 bg-[var(--kc-blue)] text-white text-[11px] shrink-0">
          <MIcon name="account_tree" className="!text-[14px]" />
          <span className="font-semibold">Мультигруппа</span>
          <span className="opacity-80">
            — {selectedGroupIds.size} {
              selectedGroupIds.size === 1 ? 'группа' :
              selectedGroupIds.size < 5 ? 'группы' : 'групп'
            }
          </span>
          <button
            className="ml-auto flex items-center gap-1 hover:bg-white/20 rounded px-1.5 py-0.5 transition-colors text-[10px]"
            title="Выйти из мультигруппы (Escape)"
            onClick={() => setMultigroupMode(false)}
          >
            <MIcon name="close" className="!text-[12px]" />
            Выйти
          </button>
        </div>
      )}

      <div className="flex items-center justify-between px-3 h-8 border-b border-[var(--border)] bg-[var(--bg-panel)] shrink-0">
        <span className="font-label-caps text-[var(--text-secondary)] flex items-center gap-1.5">
          <MIcon name="folder_special" className="!text-[13px]" style={{ color: 'var(--accent-orange)' }} />
          Управление группами
        </span>
        <div className="flex items-center gap-0.5">
          <button
            className="tool-btn !w-6 !h-6"
            title="Свернуть все"
            onClick={() => setAllExpanded(false)}
          >
            <MIcon name="unfold_less" className="!text-[14px]" />
          </button>
          <button
            className="tool-btn !w-6 !h-6"
            title="Развернуть все"
            onClick={() => setAllExpanded(true)}
          >
            <MIcon name="unfold_more" className="!text-[14px]" />
          </button>
        </div>
      </div>

      <GroupsToolbar
        onAddGroup={handleAddGroup}
        onAddList={() => setShowListDialog(true)}
        multigroupMode={multigroupMode}
        selectedGroupIds={selectedGroupIds}
        activeGroupId={activeGroupId}
        sortField={sortField}
        sortDir={sortDir}
        onSort={handleSort}
        onClearSort={clearSort}
        onMultigroupToggle={handleMultigroupToggle}
      />

      <GroupToolbarSlot groupId={activeGroupId} ctx={ctx} />

      <GroupsFilterBar value={filterQuery} onChange={setFilterQuery} />

      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex-1 overflow-y-auto compact-scroll py-1" onMouseDown={(e) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.tree-item')) {
              if (multigroupMode) {
                setMultigroupMode(false);
              } else if (selectedGroupIds.size > 0) {
                clearGroupSelection();
                lastClickedRef.current = null;
              }
            }
          }}>
            <div
              className={`tree-item ${!activeGroupId ? 'active' : ''}`}
              onClick={() => setActiveGroup(null)}
            >
              <span style={{ width: '16px', flexShrink: 0 }} />
              <MIcon name="folder_open" className="tree-icon" style={{ color: 'var(--accent-blue)' }} />
              <span style={{ flex: 1, fontSize: '12px', fontWeight: !activeGroupId ? 600 : 400 }}>
                Все фразы
              </span>
              {totalMinusWords > 0 && (
                <button
                  className="tree-minus"
                  title={`Всего минус-фраз: ${totalMinusWords}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveGroup(null);
                    ctx.eventBus.emit(AppEvents.TOOL_OPEN, { toolId: 'minus-words' });
                  }}
                >
                  <MIcon name="block" className="!text-[12px]" />
                  <span>{totalMinusWords > 99 ? '99+' : totalMinusWords}</span>
                </button>
              )}
              <span className="tree-count" style={{ color: 'var(--accent-blue)' }}>
                {totalPhrases.toLocaleString('ru')}
              </span>
            </div>

            {rootGroups.map(g => renderSubtree(g, 0))}

            {orphanCount > 0 && (
              <div className="tree-item">
                <span style={{ width: '16px', flexShrink: 0 }} />
                <MIcon name="lan" className="tree-icon" style={{ color: 'var(--accent-orange)' }} />
                <span style={{ flex: 1, fontSize: '12px', fontWeight: 400 }}>Несгруппированные</span>
                <span className="tree-count">{orphanCount}</span>
              </div>
            )}

            {activeGroupId && (() => {
              const activeGroup = groups.find(g => g.id === activeGroupId);
              if (!activeGroup || activeGroup.isTrash) return null;
              return <GroupNotesSection key={activeGroup.id} group={activeGroup} phrases={phrases} ctx={ctx} />;
            })()}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="text-[12px]">
          <ContextMenuItem onClick={() => handleAddGroup(null)}>
            <MIcon name="create_new_folder" className="!text-[14px] mr-2" /> Добавить группу
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <AddGroupListDialog open={showListDialog} onOpenChange={setShowListDialog} ctx={ctx} />

      {showBulkMoveDialog && bulkMoveTarget.current && (
        <BulkMoveDialog
          open={showBulkMoveDialog}
          onOpenChange={setShowBulkMoveDialog}
          groupIds={bulkMoveTarget.current.ids}
          ctx={ctx}
        />
      )}
    </div>
  );
}

function GroupToolbarSlot({ groupId, ctx }: { groupId: KCID | null; ctx: PluginContext }) {
  const [contribs, setContribs] = useState<ModuleUIContribution[]>([]);

  useRuntimeEvents(() => {
    const rt = getRuntime();
    if (rt) setContribs(rt.getUIContributions('group:toolbar'));
  });

  if (contribs.length === 0 || !groupId) return null;

  return (
    <div className="flex items-center gap-1 px-2 py-1 border-t border-[var(--border)] bg-[var(--bg-panel)]">
      {contribs.map(c => {
        if (!c.component) return null;
        const Comp = c.component;
        return (
          <div key={c.moduleId ?? c.label}>
            <Comp groupId={groupId} ctx={ctx} />
          </div>
        );
      })}
    </div>
  );
}