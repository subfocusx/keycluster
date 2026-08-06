// ============================================================
// Module: Phrases — Virtualized Rows Component
// ============================================================

'use client';

import React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Phrase, MinusWord, Group, KCID, PluginContext, ModuleUIContribution, PhraseActionContext } from '@/plugin-sdk';
import { getRuntime } from '@/plugin-sdk';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/components/ui/context-menu';
import { LABEL_COLORS, LABEL_NAMES, LABEL_COLOR_MAP, COLUMN_COLORS, ColDef, CHECKBOX_COL } from './shared';
import { toast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { MIcon } from '@/shell/shared-icon';
import { AppEvents } from '@/plugin-sdk';

const ROW_HEIGHT = 25;
const OVERSCAN = 10;

interface VirtualizedRowsProps {
  sortedPhrases: Phrase[];
  visibleCols: ColDef[];
  selectedPhraseIdSet: Set<KCID>;
  tableContainerRef: React.RefObject<HTMLDivElement | null>;
  lastClickedPhraseId: KCID | null;
  setLastClickedPhraseId: (id: KCID) => void;
  handlePhraseClick: (phrase: Phrase, event?: React.MouseEvent, lastClickedId?: KCID | null, setLastClickedId?: (id: KCID) => void) => void;
  setContextWord: (word: string | null) => void;
  togglePhraseSelection: (id: KCID) => void;
  getCellClass: (colKey: string) => string;
  getCellStyle: (colKey: string, phrase: Phrase) => React.CSSProperties;
  renderCellValue: (colKey: string, phrase: Phrase) => React.ReactNode;
  minusWords: MinusWord[];
  minusWordTexts: { exactTexts: Set<string>; broadTexts: Set<string> };
  addMinusWord: (text: string, isExact: boolean, groupId?: KCID | null, searchType?: MinusWord['searchType']) => void;
  removeMinusWord: (id: KCID) => void;
  groups: Group[];
  setMoveAction: (action: 'move' | 'copy') => void;
  setShowMoveDialog: (show: boolean) => void;
  moveToTrash: (ids: KCID[]) => void;
  togglePhraseSelectionDirect: (id: KCID) => void;
  editingPhraseId: KCID | null;
  editingValue: string;
  onEditChange: (val: string) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onStartEdit: (id: KCID, text: string) => void;
  ctx: PluginContext;
  allTags: string[];
  addTagToPhrase: (id: KCID, tag: string) => void;
  removeTagFromPhrase: (id: KCID, tag: string) => void;
}

function VirtualizedRows({
  sortedPhrases,
  visibleCols,
  selectedPhraseIdSet,
  tableContainerRef,
  handlePhraseClick,
  lastClickedPhraseId,
  setLastClickedPhraseId,
  setContextWord,
  togglePhraseSelection,
  getCellClass,
  getCellStyle,
  renderCellValue,
  minusWords,
  minusWordTexts,
  addMinusWord,
  removeMinusWord,
  groups,
  setMoveAction,
  setShowMoveDialog,
  moveToTrash,
  editingPhraseId,
  editingValue,
  onEditChange,
  onCommitEdit,
  onCancelEdit,
  onStartEdit,
  ctx,
  allTags,
  addTagToPhrase,
  removeTagFromPhrase,
}: VirtualizedRowsProps) {
  const [phraseMenuContribs, setPhraseMenuContribs] = React.useState<ModuleUIContribution[]>([]);
  React.useEffect(() => {
    const rt = getRuntime();
    if (rt) setPhraseMenuContribs(rt.getUIContributions('context-menu:phrase'));
  }, []);

  const rowVirtualizer = useVirtualizer({
    count: sortedPhrases.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <>
      <tr style={{ height: rowVirtualizer.getTotalSize(), visibility: 'hidden' }}>
        <td colSpan={1 + visibleCols.length} style={{ padding: 0 }} />
      </tr>
      {virtualItems.map((virtualRow) => {
        const phrase = sortedPhrases[virtualRow.index];
        if (!phrase) return null;
        const isSelected = selectedPhraseIdSet.has(phrase.id);
        const rowClass = isSelected
          ? 'data-row-selected'
          : virtualRow.index % 2 === 0
            ? 'data-row-even'
            : 'data-row-odd';

        return (
          <ContextMenu key={phrase.id}>
            <ContextMenuTrigger asChild>
              <tr
                className={`border-b border-[var(--kc-border-light)] cursor-pointer transition-colors ${rowClass}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={(e) => handlePhraseClick(phrase, e, lastClickedPhraseId, setLastClickedPhraseId)}
                onDoubleClick={() => onStartEdit(phrase.id, phrase.text)}
                onContextMenu={(e) => {
                  const target = e.target as HTMLElement;
                  const wordEl = target.closest('[data-word]');
                  setContextWord(wordEl ? wordEl.getAttribute('data-word') : null);
                }}
              >
                <td className="px-0 col-separator-left" style={{ width: CHECKBOX_COL }}>
                  <div className="flex items-center justify-center h-full min-h-[25px]">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => togglePhraseSelection(phrase.id)}
                      className="kc-checkbox"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </td>
                {visibleCols.map(c => {
                  if (c.key === 'text' && phrase.id === editingPhraseId) {
                    return (
                      <td key={c.key} className={`${getCellClass(c.key)} col-separator-left`}
                        style={{ ...getCellStyle(c.key, phrase), width: c.width, padding: '1px 4px' }}
                      >
                        <input
                          className="w-full h-full bg-[var(--kc-surface)] border border-[var(--kc-blue)] rounded-[2px] px-1 text-[12px] focus:outline-none"
                          autoFocus
                          value={editingValue}
                          onChange={e => onEditChange(e.target.value)}
                          onBlur={onCommitEdit}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); onCommitEdit(); }
                            if (e.key === 'Escape') { e.preventDefault(); onCancelEdit(); }
                          }}
                          onClick={e => e.stopPropagation()}
                        />
                      </td>
                    );
                  }
                  return (
                    <td
                      key={c.key}
                      className={`${getCellClass(c.key)} col-separator-left`}
                      style={{ ...getCellStyle(c.key, phrase), width: c.width }}
                    >
                      {renderCellValue(c.key, phrase)}
                    </td>
                  );
                })}
              </tr>
            </ContextMenuTrigger>
            <ContextMenuContent className="text-[12px]">
              <ContextMenuItem onClick={() => {
                const targetGroup = groups.find(g => g.id === phrase.groupId);
                if (targetGroup) {
                  if (!selectedPhraseIdSet.has(phrase.id)) {
                    togglePhraseSelection(phrase.id);
                  }
                  setMoveAction('move');
                  setShowMoveDialog(true);
                }
              }}>
                <MIcon name="drive_file_move_outline" className="!text-[14px] mr-2" /> Перенести в группу
              </ContextMenuItem>
              <ContextMenuItem onClick={async () => {
                const ids = selectedPhraseIdSet.has(phrase.id)
                  ? [...selectedPhraseIdSet]
                  : [phrase.id];
                const selectedPhrases = sortedPhrases.filter(p => ids.includes(p.id));
                const text = selectedPhrases.map(p => p.text).join('\n');
                try {
                  await navigator.clipboard.writeText(text);
                  toast({ title: `Скопировано: ${selectedPhrases.length} фраз`, duration: 2000 });
                } catch { /* fallback ignored */ }
              }}>
                <MIcon name="content_copy" className="!text-[14px] mr-2" /> Копировать
              </ContextMenuItem>
              <ContextMenuSub>
                <ContextMenuSubTrigger className="flex items-center gap-2">
                  <MIcon name="label" className="!text-[14px]" /> Метки
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="text-[12px] p-2 min-w-[200px]">
                  <div className="text-[9px] text-[var(--text-disabled)] uppercase tracking-wider px-2 pb-1">Цветные метки</div>
                  {LABEL_COLORS.map(lc => {
                    const isActive = (phrase.tags ?? []).includes(lc.name);
                    return (
                      <div key={lc.name} className="flex items-center justify-between px-2 py-1 rounded cursor-pointer hover:bg-[var(--bg-hover)]"
                        onClick={(e) => { e.stopPropagation();
                          if (isActive) {
                            removeTagFromPhrase(phrase.id, lc.name);
                          } else {
                            addTagToPhrase(phrase.id, lc.name);
                          }
                        }}>
                        <span className="flex items-center gap-2 text-[12px]">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: lc.value }} />
                          {LABEL_NAMES[lc.name] || lc.name}
                        </span>
                        {isActive && <MIcon name="check" className="!text-[12px] text-[var(--text-secondary)]" />}
                      </div>
                    );
                  })}
                  {allTags.filter(t => !LABEL_COLOR_MAP[t]).length > 0 && (
                    <>
                      <div className="border-t border-[var(--border)] my-1" />
                      <div className="text-[9px] text-[var(--text-disabled)] uppercase tracking-wider px-2 pb-1">Теги</div>
                      {allTags.filter(t => !LABEL_COLOR_MAP[t]).map(tag => (
                        <div key={tag} className="flex items-center justify-between px-2 py-1 rounded cursor-pointer hover:bg-[var(--bg-hover)]"
                          onClick={(e) => { e.stopPropagation();
                            const tags = phrase.tags ?? [];
                            if (tags.includes(tag)) {
                              removeTagFromPhrase(phrase.id, tag);
                            } else {
                              addTagToPhrase(phrase.id, tag);
                            }
                          }}>
                          <span className="text-[12px]">{tag}</span>
                          <span className={`ml-2 w-3 h-3 rounded border border-[var(--border)] flex items-center justify-center ${(phrase.tags ?? []).includes(tag) ? 'bg-[var(--accent-blue)]' : ''}`}>
                            {(phrase.tags ?? []).includes(tag) && (
                              <MIcon name="check" className="!text-[10px] text-white" />
                            )}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                  <div className="border-t border-[var(--border)] mt-1 pt-1">
                    <TagInput phraseId={phrase.id} addTagToPhrase={addTagToPhrase} />
                  </div>
                </ContextMenuSubContent>
              </ContextMenuSub>
              <ContextMenuItem className="text-[var(--kc-red)]" onClick={() => {
                moveToTrash([phrase.id]);
                ctx.eventBus.emit(AppEvents.PHRASES_CHANGED);
              }}>
                <MIcon name="delete" className="!text-[14px] mr-2" /> Удалить фразу
              </ContextMenuItem>
              {phraseMenuContribs.length > 0 && (
                <>
                  <ContextMenuSeparator />
                  {phraseMenuContribs.map(contrib => (
                    <ContextMenuItem
                      key={contrib.moduleId}
                      onClick={() => {
                        if (contrib.action) {
                          const phraseCtx: PhraseActionContext = { store: ctx.store, eventBus: ctx.eventBus };
                          contrib.action(phrase, phraseCtx);
                        }
                      }}
                    >
                      {contrib.icon && (
                        <MIcon name={contrib.icon} className="!text-[14px] mr-2" />
                      )}
                      {contrib.label}
                    </ContextMenuItem>
                  ))}
                </>
              )}
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
    </>
  );
}

// ---- Tag Input ----

function TagInput({ phraseId, addTagToPhrase: addTag }: { phraseId: KCID; addTagToPhrase: (id: KCID, tag: string) => void }) {
  const [value, setValue] = React.useState('');
  return (
    <div className="flex gap-1 items-center">
      <input
        className="flex-1 h-6 text-[11px] rounded border border-[var(--kc-border)] bg-[var(--kc-surface)] px-1 outline-none focus:border-[var(--kc-blue)]"
        placeholder="Новый тег..."
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && value.trim()) {
            addTag(phraseId, value.trim().toLowerCase());
            setValue('');
          }
        }}
      />
      {value.trim() && (
        <button
          className="shrink-0 h-6 px-1.5 text-[11px] rounded bg-[var(--kc-primary)] text-white hover:opacity-80"
          onClick={() => { addTag(phraseId, value.trim().toLowerCase()); setValue(''); }}
        >
          +
        </button>
      )}
    </div>
  );
}

export default React.memo(VirtualizedRows);
export { TagInput };