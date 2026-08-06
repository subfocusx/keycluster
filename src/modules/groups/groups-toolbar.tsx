import React from 'react';
import type { KCID } from '@/plugin-sdk';
import type { GroupSortField } from './utils/sort';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';

function MIcon({ name, className = '', style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}

interface GroupsToolbarProps {
  onAddGroup: (parentId: KCID | null) => void;
  onAddList: () => void;
  multigroupMode: boolean;
  selectedGroupIds: Set<KCID>;
  activeGroupId: KCID | null;
  sortField: GroupSortField | null;
  sortDir: 'asc' | 'desc';
  onSort: (field: GroupSortField) => void;
  onClearSort: () => void;
  onMultigroupToggle: () => void;
}

export function GroupsToolbar({
  onAddGroup,
  onAddList,
  multigroupMode,
  selectedGroupIds,
  activeGroupId,
  sortField,
  sortDir,
  onSort,
  onClearSort,
  onMultigroupToggle,
}: GroupsToolbarProps) {
  const sortDirIcon = sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward';

  return (
    <div className="flex items-center gap-0.5 px-3 py-1 border-b border-[var(--border)] bg-[var(--bg-panel)] shrink-0">
      {/* Add dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="tool-btn !w-6 !h-6" title="Добавить группу">
            <MIcon name="add" className="!text-[16px]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="text-[12px] min-w-[160px]" side="bottom" align="start">
          <DropdownMenuItem onClick={() => onAddGroup(null)}>
            <MIcon name="create_new_folder" className="!text-[14px] mr-2" />
            Добавить группу
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onAddList}>
            <MIcon name="playlist_add" className="!text-[14px] mr-2" />
            По списку
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Multigroup toggle */}
      <button
        className={`tool-btn !w-6 !h-6 ${multigroupMode ? 'active' : ''}`}
        title={
          multigroupMode
            ? `Мультигруппа активна: ${selectedGroupIds.size} групп. Кликайте группы чтобы добавить/убрать. Escape — выйти.`
            : (() => {
                const activeBonus = activeGroupId && !selectedGroupIds.has(activeGroupId) ? 1 : 0;
                const total = selectedGroupIds.size + activeBonus;
                if (total < 2) return 'Мультигруппа: выберите 2+ группы (Ctrl+клик), затем нажмите (F3)';
                return `Включить мультигруппу (${total} групп, F3)`;
              })()
        }
        onClick={onMultigroupToggle}
        style={multigroupMode ? { color: 'var(--kc-blue)', borderColor: 'var(--kc-blue)' } : undefined}
      >
        <MIcon name="account_tree" className="!text-[16px]" />
      </button>

      {/* Sort dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={`tool-btn !w-6 !h-6 ${sortField ? 'active' : ''}`}
            title={sortField
              ? `Сортировка: ${sortField === 'name' ? 'текст' : sortField === 'phraseCount' ? 'фразы' : 'создание'} (${sortDir === 'asc' ? '↑' : '↓'})`
              : 'Сортировка групп'
            }
          >
            <MIcon name="sort" className="!text-[16px]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="text-[12px] min-w-[180px]" side="bottom" align="start">
          <DropdownMenuItem
            onClick={() => onSort('name')}
            className={sortField === 'name' ? 'bg-[var(--kc-blue-light)]' : ''}
          >
            <MIcon name={sortField === 'name' ? 'radio_button_checked' : 'radio_button_unchecked'} className="!text-[14px] mr-2" />
            По тексту заголовка
            {sortField === 'name' && (
              <MIcon name={sortDirIcon} className="!text-[12px] ml-auto" />
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onSort('phraseCount')}
            className={sortField === 'phraseCount' ? 'bg-[var(--kc-blue-light)]' : ''}
          >
            <MIcon name={sortField === 'phraseCount' ? 'radio_button_checked' : 'radio_button_unchecked'} className="!text-[14px] mr-2" />
            По количеству фраз
            {sortField === 'phraseCount' && (
              <MIcon name={sortDirIcon} className="!text-[12px] ml-auto" />
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onSort('createdAt')}
            className={sortField === 'createdAt' ? 'bg-[var(--kc-blue-light)]' : ''}
          >
            <MIcon name={sortField === 'createdAt' ? 'radio_button_checked' : 'radio_button_unchecked'} className="!text-[14px] mr-2" />
            По порядку создания
            {sortField === 'createdAt' && (
              <MIcon name={sortDirIcon} className="!text-[12px] ml-auto" />
            )}
          </DropdownMenuItem>
          {sortField && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onClearSort}>
                <MIcon name="close" className="!text-[14px] mr-2" />
                Сбросить сортировку
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Selection counter */}
      {selectedGroupIds.size > 0 && (
        <span style={{
          marginLeft: 'auto',
          fontSize: '9px',
          color: 'var(--accent-blue)',
          background: 'rgba(14,156,232,.1)',
          border: '1px solid rgba(14,156,232,.2)',
          borderRadius: '10px',
          padding: '2px 7px',
          whiteSpace: 'nowrap',
        }}>
          {selectedGroupIds.size} выбрано
        </span>
      )}
    </div>
  );
}