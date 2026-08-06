'use client';

import React from 'react';
import type { KCID, Group } from '@/plugin-sdk';
import {
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/components/ui/context-menu';
import { MIcon } from '@/shell/shared-icon';


export const GROUP_COLORS = [
  { value: '#4A90D9', label: 'Синий' },
  { value: '#E67E22', label: 'Оранжевый' },
  { value: '#2ECC71', label: 'Зелёный' },
  { value: '#E74C3C', label: 'Красный' },
  { value: '#9B59B6', label: 'Фиолетовый' },
  { value: '#1ABC9C', label: 'Бирюзовый' },
  { value: '#F1C40F', label: 'Жёлтый' },
  { value: '#E91E8C', label: 'Розовый' },
  { value: '#7F8C8D', label: 'Серый' },
  { value: '#34495E', label: 'Тёмно-серый' },
];

export function ColorPickerSubmenu({ group, setGroupColor }: { group: Group; setGroupColor: (id: KCID, color: string) => void }) {
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger className="flex items-center gap-2">
        <MIcon name="palette" className="!text-[14px] mr-2" /> Цвет
        {group.color && (
          <span
            className="ml-auto w-3 h-3 rounded-full border border-[var(--kc-border)]"
            style={{ backgroundColor: group.color }}
          />
        )}
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="text-[12px] p-2">
        <ColorPickerGrid currentColor={group.color} onSelect={(color) => setGroupColor(group.id, color)} />
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}

function ColorPickerGrid({ currentColor, onSelect }: { currentColor?: string; onSelect: (color: string) => void }) {
  return (
    <div className="grid grid-cols-5 gap-1.5 w-[140px]">
      {GROUP_COLORS.map(c => (
        <button
          key={c.value}
          className={`w-6 h-6 rounded border-2 transition-transform hover:scale-110 ${
            currentColor === c.value ? 'border-[var(--kc-text)] scale-110' : 'border-transparent'
          }`}
          style={{ backgroundColor: c.value }}
          title={c.label}
          onClick={() => onSelect(c.value)}
        />
      ))}
      {currentColor && (
        <button
          className="col-span-5 mt-1 text-[10px] text-[var(--kc-text-secondary)] hover:text-[var(--kc-red)] transition-colors text-center py-0.5"
          onClick={() => onSelect('')}
        >
          Сбросить цвет
        </button>
      )}
    </div>
  );
}

export function BulkColorPickerSubmenu({ onSelectColor }: { onSelectColor: (color: string) => void }) {
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger className="flex items-center gap-2">
        <MIcon name="palette" className="!text-[14px] mr-2" /> Цвет
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="text-[12px] p-2">
        <ColorPickerGrid onSelect={(color) => onSelectColor(color)} />
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}
