import React from 'react';
import type { Group, PluginContext } from '@/plugin-sdk';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { MIcon } from '@/shell/shared-icon';
import { LABEL_COLOR_MAP, LABEL_COLORS, LABEL_NAMES } from './shared';
import { type ColDef } from './shared';

export interface PhrasesToolbarProps {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  labelFilter: string | null;
  setLabelFilter: (v: string | null) => void;
  tagFilter: string | null;
  setTagFilter: (v: string | null) => void;
  allTags: string[];
  sortedPhrasesLength: number;
  activeFilterCount: number;
  colManagerOpen: boolean;
  setColManagerOpen: (v: boolean) => void;
  baseCols: ColDef[];
  columnVisibility: Record<string, boolean>;
  toggleColumnVisibility: (key: string) => void;
  resetColumnSettings: () => void;
  setShowStatsDialog: (v: boolean) => void;
  showStarredOnly: boolean;
  onToggleStarred: () => void;
  clearAllFilters: () => void;
}

export const PhrasesToolbar = React.memo(function PhrasesToolbar(props: PhrasesToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-3 h-[30px] border-b border-[var(--kc-border)] bg-[var(--kc-toolbar-bg)] shrink-0">
      <Popover open={props.colManagerOpen} onOpenChange={props.setColManagerOpen}>
        <PopoverTrigger asChild>
          <button className="tool-btn !w-7 !h-7" title="Настройки столбцов">
            <MIcon name="view_column" className="!text-[16px]" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start" className="w-[240px] p-2" onClick={(e) => e.stopPropagation()}>
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-[var(--kc-text)] px-1 pb-1">Столбцы</div>
            {props.baseCols.map(c => (
              <label key={c.key} className="flex items-center gap-2 px-1 py-1 rounded-[3px] hover:bg-[var(--kc-surface-hover)] cursor-pointer">
                <Checkbox
                  checked={props.columnVisibility[c.key] !== false}
                  onCheckedChange={() => props.toggleColumnVisibility(c.key)}
                  className="kc-checkbox !w-3.5 !h-3.5"
                />
                <span className="text-[12px] flex-1 truncate">{c.label}</span>
              </label>
            ))}
            <div className="h-px bg-[var(--kc-border-light)] my-1" />
            <button
              className="text-[11px] text-[var(--kc-text-secondary)] hover:text-[var(--kc-blue)] px-1 py-0.5 transition-colors"
              onClick={() => { props.resetColumnSettings(); }}
            >
              Сбросить настройки
            </button>
          </div>
        </PopoverContent>
      </Popover>
      <div className="relative flex-1 max-w-[220px]">
        <MIcon name="search" className="!text-[14px] absolute left-2 top-1/2 -translate-y-1/2 text-[var(--kc-text-secondary)] pointer-events-none" />
        <input
          className="w-full h-6 pl-6 pr-6 text-[12px] rounded-[3px] border border-[var(--kc-border)] bg-[var(--kc-surface)] placeholder:text-[var(--kc-text-disabled)] focus:outline-none focus:ring-1 focus:ring-[var(--kc-blue)] focus:border-[var(--kc-blue)]"
          placeholder="Фильтр фраз..."
          value={props.searchQuery}
          onChange={e => props.setSearchQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') props.setSearchQuery(''); }}
        />
        {props.searchQuery && (
          <button
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded hover:bg-[var(--kc-surface-hover)] text-[var(--kc-text-secondary)] hover:text-[var(--kc-text)]"
            onClick={() => props.setSearchQuery('')}
            tabIndex={-1}
            title="Очистить поиск (Escape)"
          >
            <MIcon name="close" className="!text-[12px]" />
          </button>
        )}
      </div>
      <select
        className="h-6 pl-2 pr-6 text-[11px] rounded-[3px] border border-[var(--kc-border)] bg-[var(--kc-surface)] text-[var(--kc-text)] max-w-[110px] truncate"
        value={props.labelFilter ?? ''}
        onChange={e => props.setLabelFilter(e.target.value || null)}
        title="Фильтр по метке"
      >
        <option value="">Все метки</option>
        {LABEL_COLORS.map(lc => (
          <option key={lc.name} value={lc.name}>
            {LABEL_NAMES[lc.name]}
          </option>
        ))}
      </select>
      {props.allTags.length > 0 && (
        <select
          className="h-6 pl-2 pr-6 text-[11px] rounded-[3px] border border-[var(--kc-border)] bg-[var(--kc-surface)] text-[var(--kc-text)] max-w-[130px] truncate"
          value={props.tagFilter ?? ''}
          onChange={e => props.setTagFilter(e.target.value || null)}
          title="Фильтр по тегу"
        >
          <option value="">Все теги</option>
          {props.allTags.filter(t => !LABEL_COLOR_MAP[t]).map(tag => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>
      )}
      <div className="flex items-center gap-0.5">
        <button
          className="tool-btn !w-7 !h-7"
          title={props.showStarredOnly ? 'Показать все фразы' : 'Только избранное'}
          onClick={props.onToggleStarred}
          style={props.showStarredOnly ? { color: 'var(--kc-yellow)' } : {}}
        >
          <MIcon name={props.showStarredOnly ? 'star' : 'star_outline'} className="!text-[16px]" />
        </button>
      </div>
      <div className="flex items-center gap-0.5">
        <button
          className="tool-btn !w-7 !h-7"
          title="Статистика проекта"
          onClick={() => props.setShowStatsDialog(true)}
        >
          <MIcon name="bar_chart" className="!text-[16px]" />
        </button>
      </div>
      {props.activeFilterCount > 0 && (
        <button
          className="tool-btn !w-7 !h-7"
          title="Сбросить все фильтры"
          onClick={props.clearAllFilters}
          style={{ color: 'var(--kc-blue)' }}
        >
          <MIcon name="filter_alt_off" className="!text-[16px]" />
        </button>
      )}
      <span className="font-mono-data text-[var(--kc-text-secondary)] ml-auto">
        {props.sortedPhrasesLength}
        {props.activeFilterCount > 0 && <span style={{ color: 'var(--kc-blue)' }}> · {props.activeFilterCount} фильтр.</span>}
      </span>
    </div>
  );
});