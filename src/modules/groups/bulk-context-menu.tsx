// ============================================================
// Bulk Context Menu — extracted from components.tsx (Extraction #4)
// ============================================================

'use client';

import React from 'react';
import type { KCID } from '@/plugin-sdk';
import { ContextMenuContent, ContextMenuItem } from '@/components/ui/context-menu';
import { BulkColorPickerSubmenu } from './color-picker-submenu';
import { MIcon } from '@/shell/shared-icon';


export function GroupBulkContextMenu({ ids, bulkCount, multigroupMode, onBulkDelete, onBulkMove, onBulkSetColor, setMultigroupMode }: {
  ids: KCID[];
  bulkCount: number;
  multigroupMode: boolean;
  onBulkDelete: (ids: KCID[]) => void;
  onBulkMove: (ids: KCID[]) => void;
  onBulkSetColor: (ids: KCID[], color: string) => void;
  setMultigroupMode: (v: boolean) => void;
}) {
  return (
    <ContextMenuContent className="text-[12px]">
      <ContextMenuItem className="text-[var(--kc-red)]" onClick={() => {
        if (ids.length > 0) onBulkDelete(ids);
      }}>
        <MIcon name="delete" className="!text-[14px] mr-2" /> Удалить ({bulkCount} групп)
      </ContextMenuItem>
      <ContextMenuItem onClick={() => {
        if (ids.length > 0) onBulkMove(ids);
      }}>
        <MIcon name="drive_file_move" className="!text-[14px] mr-2" /> Переместить в...
      </ContextMenuItem>
      <BulkColorPickerSubmenu onSelectColor={(color) => {
        if (ids.length > 0) onBulkSetColor(ids, color);
      }} />
      {!multigroupMode && (
        <ContextMenuItem onClick={() => setMultigroupMode(true)}>
          <MIcon name="account_tree" className="!text-[14px] mr-2" /> Добавить в мультигруппу
        </ContextMenuItem>
      )}
    </ContextMenuContent>
  );
}