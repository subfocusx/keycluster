import type { Group, KCID, PluginContext, ModuleUIContribution } from '@/plugin-sdk';
// ============================================================
// Module: Groups — GroupItem component
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/plugin-sdk';
import { AppEvents } from '@/plugin-sdk';
import type { GroupSortField } from './utils/sort';
import {
  ContextMenu,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useKCDialog } from '@/components/KCDialog';
import { GroupItemContextMenu } from './group-context-menu';
import { GroupBulkContextMenu } from './bulk-context-menu';
import { getRuntime } from '@/plugin-sdk';
import { MIcon } from '@/shell/shared-icon';


const REASON_LOCALIZATIONS: [RegExp, string][] = [
  [/same (commercial|transactional|informational|navigational) intent/i, 'Большинство фраз имеют одинаковый $1 интент'],
  [/mixed (commercial|transactional|informational|navigational) intent/i, 'Смешанный $1 интент'],
  [/high diversity/i, 'Высокое разнообразие тематик'],
  [/low diversity/i, 'Низкое разнообразие тематик'],
  [/good cluster/i, 'Хороший кластер'],
  [/poor cluster/i, 'Слабый кластер'],
  [/high relevance/i, 'Высокая релевантность'],
  [/low relevance/i, 'Низкая релевантность'],
  [/commercial/i, 'Коммерческий'],
  [/informational/i, 'Информационный'],
  [/transactional/i, 'Транзакционный'],
  [/navigational/i, 'Навигационный'],
  [/keywords are too diverse/i, 'Фразы слишком разнообразны'],
  [/keywords share similar/i, 'Фразы имеют схожую'],
];

function localizeReason(reason: string): string {
  for (const [regex, ru] of REASON_LOCALIZATIONS) {
    if (regex.test(reason)) {
      return reason.replace(regex, ru);
    }
  }
  return reason;
}

// ---- Group Item (no DnD, just click + context menu) ----

function GroupItem({ group, depth, ctx, isActive, phraseCount, minusCount, isSelected, isHighlighted, flatVisibleGroupIds, setLastClickedGroupId, getLastClickedGroupId, onBulkDelete, onBulkMove, localSort, onLocalSort, children }: {
  group: Group;
  depth: number;
  ctx: PluginContext;
  isActive: boolean;
  phraseCount: number;
  minusCount: number;
  isSelected?: boolean;
  isHighlighted?: boolean;
  flatVisibleGroupIds: KCID[];
  setLastClickedGroupId: (id: KCID) => void;
  getLastClickedGroupId: () => KCID | null;
  onBulkDelete: (ids: KCID[]) => void;
  onBulkMove: (ids: KCID[]) => void;
  localSort?: { field: GroupSortField; dir: 'asc' | 'desc' };
  onLocalSort?: (groupId: string, field: GroupSortField, dir: 'asc' | 'desc') => void;
  children?: React.ReactNode;
}) {
  const setActiveGroup = useAppStore(s => s.setActiveGroup);
  const toggleGroupSelection = useAppStore(s => s.toggleGroupSelection);
  const selectGroupRange = useAppStore(s => s.selectGroupRange);
  const clearGroupSelection = useAppStore(s => s.clearGroupSelection);
  const selectedGroupIds = useAppStore(s => s.selectedGroupIds);
  const multigroupMode = useAppStore(s => s.ui.multigroupMode);
  const toggleExpand = useAppStore(s => s.toggleExpand);
  const deleteGroup = useAppStore(s => s.deleteGroup);
  const setGroupColor = useAppStore(s => s.setGroupColor);
  const setGroupsColor = useAppStore(s => s.setGroupsColor);
  const setMultigroupMode = useAppStore(s => s.setMultigroupMode);
  const groups = useAppStore(s => s.groups);
  const phrases = useAppStore(s => s.phrases);
  const kcDialog = useKCDialog();
  const childCount = groups.filter(g => g.parentId === group.id).length;
  const childrenCount = groups.filter(g => g.parentId === group.id && !g.isTrash).length;
  const hasChildren = childrenCount > 0;

  const [groupMenuContribs, setGroupMenuContribs] = useState<ModuleUIContribution[]>([]);
  useEffect(() => {
    const rt = getRuntime();
    if (rt) setGroupMenuContribs(rt.getUIContributions('context-menu:group'));
  }, []);

  const [menuSnapshot, setMenuSnapshot] = useState<{ ids: KCID[]; size: number } | null>(null);
  const showBulkMenu = (menuSnapshot?.size ?? selectedGroupIds.size) > 1;
  const bulkCount = menuSnapshot?.size ?? selectedGroupIds.size;

  const handleClick = (e: React.MouseEvent) => {
    if (multigroupMode) {
      toggleGroupSelection(group.id);
      setLastClickedGroupId(group.id);
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      toggleGroupSelection(group.id);
      setLastClickedGroupId(group.id);
    } else if (e.shiftKey && flatVisibleGroupIds.length > 0) {
      const lastId = getLastClickedGroupId();
      selectGroupRange(lastId || group.id, group.id, flatVisibleGroupIds);
      setLastClickedGroupId(group.id);
    } else {
      if (selectedGroupIds.size > 0) clearGroupSelection();
      setActiveGroup(group.id);
      setLastClickedGroupId(group.id);
    }
  };

  const highlightStyle = isHighlighted
    ? { backgroundColor: 'rgba(251, 197, 48, 0.45)' }
    : undefined;

  return (
    <ContextMenu onOpenChange={(open) => {
      if (open) {
        const state = useAppStore.getState();
        const ids = new Set(state.selectedGroupIds);
        setMenuSnapshot({
          ids: [...ids],
          size: ids.size,
        });
      } else {
        setMenuSnapshot(null);
      }
    }}>
      <ContextMenuTrigger asChild onContextMenu={(e: React.MouseEvent) => e.stopPropagation()}>
        <div
          className={`tree-item ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''} ${isHighlighted ? 'tree-item-highlighted' : ''}`}
          data-depth={depth}
          style={{
            paddingLeft: `${depth * 14 + 6}px`,
            position: 'relative',
            ...highlightStyle,
          }}
          onClick={handleClick}
        >
          {/* Indent lines for subgroups (VS Code style) */}
          {depth > 0 && Array.from({ length: depth }).map((_, i) => (
            <span
              key={`vl-${i}`}
              style={{
                position: 'absolute',
                left: `${i * 14 + 13}px`,
                top: 0,
                bottom: 0,
                width: '1px',
                background: 'var(--border)',
                opacity: 0.4,
                pointerEvents: 'none',
              }}
              aria-hidden="true"
            />
          ))}
          {/* Horizontal connector from last vertical line to folder icon */}
          {depth > 0 && (
            <span
              style={{
                position: 'absolute',
                left: `${(depth - 1) * 14 + 13}px`,
                top: '50%',
                width: '8px',
                height: '1px',
                background: 'var(--border)',
                opacity: 0.4,
                pointerEvents: 'none',
              }}
              aria-hidden="true"
            />
          )}
          {/* Expand toggle */}
          {childrenCount > 0 ? (
            <button
              className="expand-btn"
              onClick={(e) => { e.stopPropagation(); toggleExpand(group.id); }}
            >
              <MIcon name={group.isExpanded ? 'expand_more' : 'chevron_right'} className="!text-[11px]" />
            </button>
          ) : (
            <span className="w-[14px] shrink-0" />
          )}

          {/* Color dot */}
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              flexShrink: 0,
              marginRight: '4px',
              backgroundColor: group.color || 'transparent',
            }}
          />

          {/* Folder icon */}
          {group.isTrash ? (
            <MIcon name="delete" className="tree-icon" style={{ color: 'var(--kc-red)' }} />
          ) : (
            <MIcon name={group.isExpanded && childrenCount > 0 ? 'folder_open' : 'folder'} className="tree-icon" style={{
              color: isHighlighted ? '#b45309' : (group.color || undefined),
            }} />
          )}

          {/* Name */}
          <span className="truncate flex-1">{group.name}</span>

          {/* Cluster quality indicator */}
          {group.clusterQuality && (
            <span
              style={{
                fontSize: '9px',
                fontWeight: 700,
                padding: '1px 4px',
                borderRadius: '3px',
                marginRight: '3px',
                flexShrink: 0,
                lineHeight: '14px',
                background: group.clusterQuality.score >= 4
                  ? 'rgba(78,201,148,.15)'
                  : group.clusterQuality.score >= 3
                  ? 'rgba(232,210,69,.15)'
                  : 'rgba(244,71,71,.15)',
                color: group.clusterQuality.score >= 4 ? '#4ec994'
                  : group.clusterQuality.score >= 3 ? '#c8a830'
                  : '#f44747',
                border: `1px solid ${
                  group.clusterQuality.score >= 4
                    ? 'rgba(78,201,148,.3)'
                    : group.clusterQuality.score >= 3
                    ? 'rgba(232,210,69,.3)'
                    : 'rgba(244,71,71,.3)'
                }`,
              }}
              title={`Качество кластера: ${group.clusterQuality.score}/5`}
            >
              {group.clusterQuality.score}/5
            </span>
          )}

          {/* Children count badge */}
          {childrenCount > 0 && (
            <span
              className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded mr-1 shrink-0"
              style={{
                background: 'rgba(14,156,232,0.1)',
                border: '1px solid rgba(14,156,232,0.2)',
                color: 'var(--kc-blue)',
              }}
              title={`${childrenCount} подгрупп`}
            >
              <MIcon name="folder_copy" className="!text-[10px]" />
              {childrenCount}
            </span>
          )}

          {/* Local sort toolbar — visible on hover */}
          {hasChildren && (
            <div className="group-local-sort hidden group-hover:flex items-center gap-0.5 mr-1">
              <button
                className={`w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--kc-surface-hover)] ${
                  localSort?.field === 'name' ? 'text-[var(--kc-blue)]' : 'text-[var(--kc-text-secondary)]'
                }`}
                title={`Сортировать подгруппы по названию ${localSort?.field === 'name' && localSort?.dir === 'asc' ? '(↓ Z→A)' : '(↑ A→Z)'}`}
                onClick={e => {
                  e.stopPropagation();
                  const nextDir = localSort?.field === 'name' && localSort?.dir === 'asc' ? 'desc' : 'asc';
                  onLocalSort?.(group.id, 'name', nextDir);
                }}
              >
                <MIcon name="sort_by_alpha" className="!text-[12px]" />
              </button>
              <button
                className={`w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--kc-surface-hover)] ${
                  localSort?.field === 'phraseCount' ? 'text-[var(--kc-blue)]' : 'text-[var(--kc-text-secondary)]'
                }`}
                title={`Сортировать по кол-ву фраз ${localSort?.field === 'phraseCount' && localSort?.dir === 'desc' ? '(↑ меньше→больше)' : '(↓ больше→меньше)'}`}
                onClick={e => {
                  e.stopPropagation();
                  const nextDir = localSort?.field === 'phraseCount' && localSort?.dir === 'desc' ? 'asc' : 'desc';
                  onLocalSort?.(group.id, 'phraseCount', nextDir);
                }}
              >
                <MIcon name="filter_list" className="!text-[12px]" />
              </button>
            </div>
          )}

          {/* Minus-words indicator — always visible, aggregates nested groups */}
          {!group.isTrash && (
            <button
              className={`tree-minus${minusCount === 0 ? ' tree-minus-empty' : ''}`}
              title={`Минус-фразы группы: ${minusCount}`}
              onClick={(e) => {
                e.stopPropagation();
                useAppStore.getState().setActiveGroup(group.id);
                ctx.eventBus.emit(AppEvents.TOOL_OPEN, { toolId: 'minus-words' });
              }}
            >
              <MIcon name="block" className="!text-[12px]" />
              <span>{minusCount > 99 ? '99+' : minusCount}</span>
            </button>
          )}

          {/* Count */}
          <span className="tree-count" style={
            isHighlighted ? { color: '#b45309' } : undefined
          }>
            {phraseCount > 0 ? phraseCount.toLocaleString('ru') : ''}
          </span>
        </div>
      </ContextMenuTrigger>

      {showBulkMenu ? (
        <GroupBulkContextMenu
          ids={menuSnapshot?.ids ?? []}
          bulkCount={bulkCount}
          multigroupMode={multigroupMode}
          onBulkDelete={(ids) => onBulkDelete(ids)}
          onBulkMove={(ids) => onBulkMove(ids)}
          onBulkSetColor={(ids, color) => setGroupsColor(ids, color)}
          setMultigroupMode={setMultigroupMode}
        />
      ) : (
        <GroupItemContextMenu
          group={group}
          groups={groups}
          phrases={phrases}
          ctx={ctx}
          kcDialog={kcDialog}
          setGroupColor={setGroupColor}
          deleteGroup={deleteGroup}
          pluginContribs={groupMenuContribs}
        />
      )}
    </ContextMenu>
  );
}

export default GroupItem;
