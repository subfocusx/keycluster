import React from 'react';
import type { Group, PluginContext } from '@/plugin-sdk';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MIcon } from '@/shell/shared-icon';
import { LABEL_COLOR_MAP, LABEL_COLORS, LABEL_NAMES } from './shared';
import { type ColDef } from './shared';

export interface PhrasesToolbarProps {
  /** Путь активной группы от корня (для хлебных крошек) */
  groupPath: { id: string; name: string }[];
  onSelectGroup: (id: string) => void;
  /** Число фраз в области без учёта фильтров */
  totalCount: number;
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
  const chips: { key: string; label: string; onClear: () => void }[] = [];
  if (props.searchQuery) {
    chips.push({ key: 'search', label: `Поиск: «${props.searchQuery}»`, onClear: () => props.setSearchQuery('') });
  }
  if (props.labelFilter) {
    chips.push({ key: 'label', label: `Метка: ${LABEL_NAMES[props.labelFilter] ?? props.labelFilter}`, onClear: () => props.setLabelFilter(null) });
  }
  if (props.tagFilter) {
    chips.push({ key: 'tag', label: `Тег: ${props.tagFilter}`, onClear: () => props.setTagFilter(null) });
  }
  if (props.showStarredOnly) {
    chips.push({ key: 'star', label: 'Только избранное', onClear: () => props.onToggleStarred() });
  }

  return (
    <div className="shrink-0 border-b border-[var(--kc-border)] bg-[var(--kc-toolbar-bg)]">
      {(props.groupPath.length > 0 || chips.length > 0) && (
        <div className="flex items-center gap-2 px-3 h-[24px] border-b border-[var(--kc-border-light)] overflow-x-auto">
          {props.groupPath.length > 0 && (
            <nav aria-label="Путь активной группы" className="flex items-center gap-0.5 shrink-0">
              {props.groupPath.map((g, i) => (
                <React.Fragment key={g.id}>
                  {i > 0 && <MIcon name="chevron_right" className="!text-[12px] text-[var(--kc-text-disabled)]" />}
                  <button
                    className={`text-[11px] px-1 py-0.5 rounded hover:bg-[var(--kc-surface-hover)] truncate max-w-[160px] ${
                      i === props.groupPath.length - 1
                        ? 'text-[var(--kc-text)] font-medium'
                        : 'text-[var(--kc-text-secondary)]'
                    }`}
                    onClick={() => props.onSelectGroup(g.id)}
                    title={g.name}
                  >
                    {g.name}
                  </button>
                </React.Fragment>
              ))}
            </nav>
          )}
          {chips.length > 0 && (
            <div className="flex items-center gap-1 ml-1 shrink-0">
              {chips.map(c => (
                <span
                  key={c.key}
                  className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(14,156,232,0.1)', border: '1px solid rgba(14,156,232,0.25)', color: 'var(--kc-blue)' }}
                >
                  <span className="truncate max-w-[180px]">{c.label}</span>
                  <button
                    className="opacity-70 hover:opacity-100"
                    onClick={c.onClear}
                    title={`Сбросить: ${c.label}`}
                    aria-label={`Сбросить фильтр ${c.label}`}
                  >
                    <MIcon name="close" className="!text-[10px]" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 px-3 h-[30px]">
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
      <Select
        value={props.labelFilter ?? '__all__'}
        onValueChange={(v) => props.setLabelFilter(v === '__all__' ? null : v)}
      >
        <SelectTrigger className="h-6 pl-2 pr-6 text-[11px] rounded-[3px] border border-[var(--kc-border)] bg-[var(--kc-surface)] text-[var(--kc-text)] max-w-[110px] truncate" title="Фильтр по метке" aria-label="Фильтр по метке">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Все метки</SelectItem>
          {LABEL_COLORS.map(lc => (
            <SelectItem key={lc.name} value={lc.name}>
              {LABEL_NAMES[lc.name]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {props.allTags.length > 0 && (
        <Select
          value={props.tagFilter ?? '__all__'}
          onValueChange={(v) => props.setTagFilter(v === '__all__' ? null : v)}
        >
          <SelectTrigger className="h-6 pl-2 pr-6 text-[11px] rounded-[3px] border border-[var(--kc-border)] bg-[var(--kc-surface)] text-[var(--kc-text)] max-w-[130px] truncate" title="Фильтр по тегу" aria-label="Фильтр по тегу">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Все теги</SelectItem>
            {props.allTags.filter(t => !LABEL_COLOR_MAP[t]).map(tag => (
              <SelectItem key={tag} value={tag}>{tag}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        {props.totalCount !== props.sortedPhrasesLength && (
          <span className="opacity-70"> из {props.totalCount}</span>
        )}
        {props.activeFilterCount > 0 && <span style={{ color: 'var(--kc-blue)' }}> · {props.activeFilterCount} фильтр.</span>}
      </span>
      </div>
    </div>
  );
});