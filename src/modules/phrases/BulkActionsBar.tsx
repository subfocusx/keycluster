import React from 'react';
import type { KCID } from '@/plugin-sdk';
import { MIcon } from '@/shell/shared-icon';

export interface BulkActionsBarProps {
  selectedCount: number;
  sortedPhrases: { id: KCID }[];
  onMove: () => void;
  onCopy: () => void;
  onSelectAll: () => void;
  onDeselect: () => void;
  onDelete: () => void;
}

export const BulkActionsBar = React.memo(function BulkActionsBar(props: BulkActionsBarProps) {
  return (
    <div className={`flex items-center gap-2 px-3 border-b border-[var(--kc-border)] bg-[var(--kc-surface-active)] shrink-0 overflow-hidden transition-all duration-200 ease-out ${props.selectedCount > 0 ? 'h-[28px] opacity-100' : 'h-0 opacity-0 border-transparent p-0'}`}>
      <span className="text-[11px] font-medium text-[var(--kc-blue)] tabular-nums shrink-0">{props.selectedCount} выбрано</span>
      <div className="w-px h-3.5 bg-[var(--kc-border-light)] shrink-0" />
      <button className="tool-btn !w-6 !h-6 shrink-0" title="Перенести в группу"
        onClick={props.onMove}>
        <MIcon name="drive_file_move_outline" className="!text-[14px]" />
      </button>
      <button className="tool-btn !w-6 !h-6 shrink-0" title="Копировать в группу"
        onClick={props.onCopy}>
        <MIcon name="content_copy" className="!text-[14px]" />
      </button>
      <button className="tool-btn !w-6 !h-6 shrink-0" title="Выделить все"
        onClick={props.onSelectAll}>
        <MIcon name="select_all" className="!text-[14px]" />
      </button>
      <button className="tool-btn !w-6 !h-6 shrink-0" title="Снять выделение"
        onClick={props.onDeselect}>
        <MIcon name="deselect" className="!text-[14px]" />
      </button>
      <div className="w-px h-3.5 bg-[var(--kc-border-light)] shrink-0" />
      <button className="tool-btn !w-6 !h-6 shrink-0" style={{ color: 'var(--kc-red)' }} title="Удалить выбранные"
        onClick={props.onDelete}>
        <MIcon name="delete" className="!text-[14px]" />
      </button>
    </div>
  );
});