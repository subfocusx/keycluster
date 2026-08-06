import React, { useState } from 'react';
import { Input, Button, ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'plugin-sdk';
import { MinusWordRow } from './minus-word-row';
import type { MinusWord, MinusWordGroup, Phrase, KCID } from 'plugin-sdk';
function MIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

interface MinusWordsListProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  minusWords: MinusWord[];
  filteredCount: number;
  totalCount: number;
  selectedMwIds: Set<KCID>;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  moveSelectedToGroup: (mwGroupId: KCID | null) => void;
  minusWordGroups: MinusWordGroup[];
  handleBulkDelete: () => void;
  showMatched: boolean;
  onToggleMatched: () => void;
  matchedPhrases: Phrase[];
  groupedMinusWords: Map<string | null, MinusWord[]>;
  minusWordGroupsList: MinusWordGroup[];
  expandedGroups: Set<KCID>;
  onToggleGroup: (id: KCID) => void;
  editingGroupId: KCID | null;
  editingGroupName: string;
  onEditingGroupChange: (id: KCID | null, name: string) => void;
  onRenameGroup: (id: KCID) => void;
  onCopyGroup: (id: KCID | null) => void;
  onDeleteGroup: (id: KCID) => void;
  onToggleMw: (id: KCID) => void;
  onDeleteMw: (id: KCID) => void;
  groups: { id: KCID; name: string }[];
}

export function MinusWordsList({
  searchQuery, onSearchChange, minusWords, filteredCount, totalCount,
  selectedMwIds, allSelected, onToggleSelectAll, moveSelectedToGroup,
  minusWordGroups, handleBulkDelete, showMatched, onToggleMatched, matchedPhrases,
  groupedMinusWords, minusWordGroupsList, expandedGroups, onToggleGroup,
  editingGroupId, editingGroupName, onEditingGroupChange, onRenameGroup,
  onCopyGroup, onDeleteGroup, onToggleMw, onDeleteMw, groups,
}: MinusWordsListProps) {
  const [folderValue, setFolderValue] = useState('__none__');
  return (
    <div className="flex-1 overflow-y-auto compact-scroll p-3 pt-1 space-y-2">
      <div className="relative">
        <MIcon name="search" className="!text-[14px] absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
        <input
          className="w-full h-6 pl-7 pr-7 text-[11px] rounded-[3px] border border-[var(--border)] bg-[var(--bg-surface)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)] focus:border-[var(--accent-blue)]"
          placeholder="Найти минус-фразу"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
        />
        {searchQuery && (
          <button className="absolute right-1 top-1/2 -translate-y-1/2 tool-btn !w-4 !h-4" onClick={() => onSearchChange('')}>
            <MIcon name="close" className="!text-[12px]" />
          </button>
        )}
      </div>
      <div className="flex items-center justify-between min-h-[24px]">
        <div className="flex items-center gap-1">
          {selectedMwIds.size > 0 && (
            <>
              <span className="text-[11px] text-[var(--kc-blue)] font-medium tabular-nums">{selectedMwIds.size}</span>
              <Select
                value={folderValue}
                onValueChange={(v) => { if (v !== '__none__') moveSelectedToGroup(v === '__none2__' ? null : v); setFolderValue('__none__'); }}
              >
                <SelectTrigger className="h-5 rounded-[3px] border border-[var(--kc-border)] bg-[var(--kc-surface)] text-[10px] w-auto max-w-[90px]" aria-label="Переместить в папку">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" disabled>в папку...</SelectItem>
                  <SelectItem value="__none2__">Без папки</SelectItem>
                  {minusWordGroups.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button className="tool-btn !w-5 !h-5" style={{ color: 'var(--kc-red)' }} onClick={handleBulkDelete} title="Удалить выбранные" aria-label="Удалить выбранные">
                <MIcon name="delete" className="!text-[14px]" />
              </button>
            </>
          )}
          <button className="tool-btn !w-5 !h-5" onClick={onToggleSelectAll} title={allSelected ? 'Снять выделение' : 'Выбрать все'} aria-label={allSelected ? 'Снять выделение' : 'Выбрать все'} disabled={minusWords.length === 0}>
            <MIcon name={allSelected ? 'deselect' : 'select_all'} className="!text-[14px]" />
          </button>
          <span className="text-[12px] font-semibold ml-1">{filteredCount}</span>
          {searchQuery && <span className="text-[10px] text-[var(--text-disabled)] ml-1">из {totalCount}</span>}
        </div>
        <Button variant="ghost" size="sm" className="h-5 text-[10px] gap-1 px-1" onClick={onToggleMatched} title={showMatched ? 'Скрыть совпадения' : 'Показать совпадения'}>
          <MIcon name={showMatched ? 'visibility_off' : 'visibility'} className="!text-[14px]" />
        </Button>
      </div>
      {minusWords.length === 0 ? (
        <p className="text-[12px] text-[var(--kc-text-secondary)] py-2">Нет минус-фраз</p>
      ) : (
        <div className="space-y-1">
          {(() => {
            const ungrouped = groupedMinusWords.get('__nogroup__') ?? [];
            return (
              <>
                {minusWordGroupsList.map(g => {
                  const items = groupedMinusWords.get(g.id) ?? [];
                  const isExpanded = expandedGroups.has(g.id);
                  return (
                    <div key={g.id} className="border border-[var(--kc-border-light)] rounded-[3px] overflow-hidden">
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-[var(--kc-surface-hover)] cursor-pointer select-none"
                            onClick={() => onToggleGroup(g.id)}
                          >
                            <MIcon name={isExpanded ? 'expand_more' : 'chevron_right'} className="!text-[14px]" />
                            <span className="flex-1 truncate">{g.name}</span>
                            <span className="text-[10px] text-[var(--kc-text-secondary)]">{items.length}</span>
                            {editingGroupId === g.id ? (
                              <div className="flex gap-1 items-center" onClick={e => e.stopPropagation()}>
                                <Input
                                  className="h-5 text-[11px] w-[100px] border-[var(--kc-border)]"
                                  value={editingGroupName}
                                  onChange={e => onEditingGroupChange(g.id, e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') onRenameGroup(g.id); if (e.key === 'Escape') onEditingGroupChange(null, ''); }}
                                  autoFocus
                                />
                                <button className="tool-btn !w-4 !h-4" onClick={() => onRenameGroup(g.id)}><MIcon name="check" className="!text-[11px]" /></button>
                              </div>
                            ) : null}
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="text-[12px]">
                          <ContextMenuItem onClick={() => onEditingGroupChange(g.id, g.name)}>
                            <MIcon name="edit" className="!text-[14px] mr-2" /> Переименовать
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => onToggleGroup(g.id)}>
                            <MIcon name={isExpanded ? 'expand_more' : 'chevron_right'} className="!text-[14px] mr-2" /> {isExpanded ? 'Свернуть' : 'Развернуть'}
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => onCopyGroup(g.id)}>
                            <MIcon name="content_copy" className="!text-[14px] mr-2" /> Копировать в буфер
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem className="text-[var(--kc-red)]" onClick={() => onDeleteGroup(g.id)}>
                            <MIcon name="delete" className="!text-[14px] mr-2" /> Удалить папку
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                      {isExpanded && (
                        <div className="space-y-0.5 p-1">
                          {items.map(mw => (
                            <MinusWordRow
                              key={mw.id}
                              mw={mw}
                              isSelected={selectedMwIds.has(mw.id)}
                              groupName={groups.find(g => g.id === mw.groupId)?.name ?? 'все'}
                              onToggle={onToggleMw}
                              onDelete={onDeleteMw}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {ungrouped.length > 0 && (
                  <>
                    {minusWordGroupsList.length > 0 && <div className="h-px bg-[var(--kc-border-light)] my-1" />}
                    <div className="space-y-0.5">
                      {ungrouped.map(mw => (
                        <MinusWordRow
                          key={mw.id}
                          mw={mw}
                          isSelected={selectedMwIds.has(mw.id)}
                          groupName={groups.find(g => g.id === mw.groupId)?.name ?? 'все'}
                          onToggle={onToggleMw}
                          onDelete={onDeleteMw}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            );
          })()}
        </div>
      )}
      {showMatched && matchedPhrases.length > 0 && (
        <div className="border border-[var(--kc-red)] rounded-[3px] p-2" style={{ backgroundColor: 'var(--kc-red-light)' }}>
          <span className="text-[12px] font-semibold" style={{ color: 'var(--kc-red)' }}>
            Будет перемещено в корзину: {matchedPhrases.length} фраз
          </span>
          <div className="mt-1 max-h-[150px] overflow-y-auto compact-scroll">
            {matchedPhrases.map(p => (
              <div key={p.id} className="text-[11px] text-[var(--kc-text-secondary)] truncate">{p.text}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
