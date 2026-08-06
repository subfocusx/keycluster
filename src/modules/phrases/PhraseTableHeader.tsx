import React from 'react';
import type { KCID, Phrase } from '@/plugin-sdk';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MIcon } from '@/shell/shared-icon';
import { CHECKBOX_COL, COLUMN_COLORS, isNumericColumn, type ColDef } from './shared';

export interface PhraseTableHeaderProps {
  visibleCols: ColDef[];
  baseCols: ColDef[];
  allSelected: boolean;
  sortedPhrasesLength: number;
  onSelectAllChange: () => void;
  onSort: (field: keyof Phrase) => void;
  handleColResize: (colIdx: number, e: React.MouseEvent) => void;
  getHeaderStyle: (colKey: string) => React.CSSProperties;
  renderSortIcon: (field: keyof Phrase) => React.ReactNode;
  columnColors: Record<string, string>;
  setColumnColor: (key: string, color: string) => void;
  columnLabels: Record<string, string>;
  toggleColumnVisibility: (key: string) => void;
  onRenameCol: (key: string, label: string) => void;
  columnFilters: Record<string, any>;
  filterPopoverCol: string | null;
  setFilterPopoverCol: (col: string | null) => void;
  filterInputValue: string;
  setFilterInputValue: (v: string) => void;
  filterType: 'eq' | 'gt' | 'lt';
  setFilterType: (v: 'eq' | 'gt' | 'lt') => void;
  onApplyFilter: (colKey: string) => void;
  onClearFilter: (colKey: string) => void;
  hasColumnFilter: (colKey: string) => boolean;
}

export const PhraseTableHeader = React.memo(function PhraseTableHeader(props: PhraseTableHeaderProps) {
  return (
    <>
      <colgroup>
        <col style={{ width: `${CHECKBOX_COL}px` }} />
        {props.visibleCols.map(c => (
          <col key={c.key} style={{ width: `${c.width}px` }} />
        ))}
      </colgroup>
      <thead className="sticky top-0 bg-[var(--kc-table-header)] z-10">
        <tr className="border-b border-[var(--kc-border)]">
          <th className="px-0 col-separator-left">
            <div className="flex items-center justify-center min-h-[28px]">
              <Checkbox
                checked={props.allSelected}
                onCheckedChange={props.onSelectAllChange}
                className="kc-checkbox"
              />
            </div>
          </th>
          {props.visibleCols.map((c, colIdx) => (
            <ContextMenu key={c.key}>
              <ContextMenuTrigger asChild>
                <th
                  className={`phrases-col-header px-2 py-1 ${c.align === 'right' ? 'text-right' : 'text-left'} ${c.sortable ? 'cursor-pointer select-none' : ''} font-label-caps text-[var(--kc-text-secondary)] relative col-separator-left`}
                  style={props.getHeaderStyle(c.key)}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('[data-radix-popper-content-wrapper]') || target.closest('.col-filter-popover')) return;
                    if (c.sortable && !target.closest('.col-resize-handle') && !target.closest('.col-filter-trigger')) {
                      props.onSort(c.key as keyof Phrase);
                    }
                  }}
                >
                  <span className={`flex items-center ${c.align === 'right' ? 'justify-end' : ''} gap-0.5`}>
                    {c.label} {c.sortable ? props.renderSortIcon(c.key as keyof Phrase) : null}
                    <Popover
                      open={props.filterPopoverCol === c.key}
                      onOpenChange={(open) => {
                        if (open) {
                          const existing = props.columnFilters[c.key];
                          props.setFilterType(existing?.type ?? 'eq');
                          props.setFilterInputValue(existing?.value ?? '');
                          props.setFilterPopoverCol(c.key);
                        } else props.setFilterPopoverCol(null);
                      }}
                    >
                      <PopoverTrigger asChild>
                        <button
                          className="col-filter-trigger inline-flex items-center justify-center w-4 h-4 rounded-sm hover:bg-[var(--kc-blue-light)] transition-colors ml-0.5"
                          onClick={(e) => { e.stopPropagation(); }}
                          title="Фильтр столбца"
                        >
                          <MIcon
                            name="filter_list"
                            className={`!text-[12px] ${props.hasColumnFilter(c.key) ? 'text-[var(--kc-blue)]' : 'opacity-40'}`}
                          />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        side="bottom"
                        align="start"
                        className="w-[200px] p-2"
                        onClick={(e) => e.stopPropagation()}
                        onInteractOutside={(e) => {
                          const target = e.target as HTMLElement;
                          if (target.closest('.col-filter-popover')) return;
                          if (target.closest('[data-slot="select-content"]') || target.closest('[data-radix-popper-content-wrapper]')) return;
                          props.setFilterPopoverCol(null);
                        }}
                      >
                        <div className="col-filter-popover space-y-2">
                          <div className="text-[11px] font-semibold text-[var(--kc-text)]">
                            Фильтр: {c.label}
                          </div>
                          <Select
                            value={props.filterType}
                            onValueChange={(v) => props.setFilterType(v as 'eq' | 'gt' | 'lt')}
                          >
                            <SelectTrigger className="w-full h-6 text-[11px] rounded border border-[var(--kc-border)] bg-[var(--kc-surface)] px-1" aria-label="Тип фильтра">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {isNumericColumn(c.key) ? (
                                <>
                                  <SelectItem value="eq">{'Равно (=)'}</SelectItem>
                                  <SelectItem value="gt">{'Больше (>)'}</SelectItem>
                                  <SelectItem value="lt">{'Меньше (<)'}</SelectItem>
                                </>
                              ) : (
                                <>
                                  <SelectItem value="eq">Содержит</SelectItem>
                                  <SelectItem value="gt">{'Больше (>)'}</SelectItem>
                                  <SelectItem value="lt">{'Меньше (<)'}</SelectItem>
                                </>
                              )}
                            </SelectContent>
                          </Select>
                          <Input
                            className="h-6 text-[11px]"
                            placeholder={isNumericColumn(c.key) ? 'Число...' : 'Текст...'}
                            value={props.filterInputValue}
                            onChange={(e) => props.setFilterInputValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') props.onApplyFilter(c.key);
                              if (e.key === 'Escape') props.setFilterPopoverCol(null);
                            }}
                            autoFocus
                          />
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              className="h-6 text-[10px] px-2 flex-1"
                              onClick={() => props.onApplyFilter(c.key)}
                            >
                              Применить
                            </Button>
                            {props.hasColumnFilter(c.key) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px] px-2"
                                onClick={() => props.onClearFilter(c.key)}
                              >
                                Сброс
                              </Button>
                            )}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </span>
                  <div
                    className="col-resize-handle"
                    onMouseDown={(e) => props.handleColResize(colIdx, e)}
                  />
                </th>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-[180px]">
                {c.key !== 'text' && (
                  <ContextMenuItem
                    onClick={() => {
                      const currentLabel = props.columnLabels[c.key] ?? props.baseCols.find(bc => bc.key === c.key)?.label ?? c.key;
                      props.onRenameCol(c.key, currentLabel);
                    }}
                  >
                    <MIcon name="edit" className="!text-[16px] mr-2" />
                    Переименовать
                  </ContextMenuItem>
                )}
                <ContextMenuSub>
                  <ContextMenuSubTrigger className="flex items-center gap-2">
                    <MIcon name="palette" className="!text-[14px] mr-2" /> Цвет
                    {props.columnColors[c.key] && (
                      <span
                        className="ml-auto w-3 h-3 rounded-full border border-[var(--kc-border)]"
                        style={{ backgroundColor: props.columnColors[c.key] }}
                      />
                    )}
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="text-[12px] p-2">
                    <div className="grid grid-cols-5 gap-1.5 w-[140px]">
                      {COLUMN_COLORS.map(cl => (
                        <button
                          key={cl.value}
                          className={`w-6 h-6 rounded border-2 transition-transform hover:scale-110 ${
                            props.columnColors[c.key] === cl.value ? 'border-[var(--kc-text)] scale-110' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: cl.value }}
                          title={cl.label}
                          onClick={() => props.setColumnColor(c.key, cl.value)}
                        />
                      ))}
                      {props.columnColors[c.key] && (
                        <button
                          className="col-span-5 mt-1 text-[10px] text-[var(--kc-text-secondary)] hover:text-[var(--kc-red)] transition-colors text-center py-0.5"
                          onClick={() => props.setColumnColor(c.key, '')}
                        >
                          Сбросить цвет
                        </button>
                      )}
                    </div>
                  </ContextMenuSubContent>
                </ContextMenuSub>
                {c.key !== 'text' && <ContextMenuSeparator />}
                {c.key !== 'text' && (
                  <ContextMenuItem
                    onClick={() => props.toggleColumnVisibility(c.key)}
                    className="text-[var(--kc-red)]"
                  >
                    <MIcon name="visibility_off" className="!text-[16px] mr-2" />
                    Скрыть столбец
                  </ContextMenuItem>
                )}
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </tr>
      </thead>
    </>
  );
});