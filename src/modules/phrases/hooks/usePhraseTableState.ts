import { useState } from 'react';
import type { KCID } from '@/plugin-sdk';
import { type ColumnFilters } from '../shared';

export function usePhraseTableState() {
  const [sortField, setSortField] = useState<string>('text');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [moveAction, setMoveAction] = useState<'move' | 'copy'>('move');
  const [targetGroupId, setTargetGroupId] = useState<KCID | null>(null);
  const [showNewGroupInMove, setShowNewGroupInMove] = useState(false);
  const [newGroupInMoveName, setNewGroupInMoveName] = useState('');
  const [newGroupInMoveParentId, setNewGroupInMoveParentId] = useState<KCID | null>(null);
  const [contextWord, setContextWord] = useState<string | null>(null);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [filterPopoverCol, setFilterPopoverCol] = useState<string | null>(null);
  const [filterInputValue, setFilterInputValue] = useState('');
  const [filterType, setFilterType] = useState<'eq' | 'gt' | 'lt'>('eq');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showStatsDialog, setShowStatsDialog] = useState(false);

  // Inline editing state
  const [editingPhraseId, setEditingPhraseId] = useState<KCID | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [editingNotesId, setEditingNotesId] = useState<KCID | null>(null);
  const [editingNotesValue, setEditingNotesValue] = useState('');

  // Column manager popover state
  const [colManagerOpen, setColManagerOpen] = useState(false);
  const [renameCol, setRenameCol] = useState<{ key: string; label: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');

  return {
    sortField, setSortField,
    sortDir, setSortDir,
    searchQuery, setSearchQuery,
    tagFilter, setTagFilter,
    labelFilter, setLabelFilter,
    showStarredOnly, setShowStarredOnly,
    showMoveDialog, setShowMoveDialog,
    moveAction, setMoveAction,
    targetGroupId, setTargetGroupId,
    showNewGroupInMove, setShowNewGroupInMove,
    newGroupInMoveName, setNewGroupInMoveName,
    newGroupInMoveParentId, setNewGroupInMoveParentId,
    contextWord, setContextWord,
    columnFilters, setColumnFilters,
    filterPopoverCol, setFilterPopoverCol,
    filterInputValue, setFilterInputValue,
    filterType, setFilterType,
    showAddDialog, setShowAddDialog,
    showStatsDialog, setShowStatsDialog,
    editingPhraseId, setEditingPhraseId,
    editingValue, setEditingValue,
    editingNotesId, setEditingNotesId,
    editingNotesValue, setEditingNotesValue,
    colManagerOpen, setColManagerOpen,
    renameCol, setRenameCol,
    renameValue, setRenameValue,
  };
}