import type { EventBus } from './types';

export const VALID_SLOTS = new Set([
  'ribbon:file', 'ribbon:tools', 'ribbon:import-export',
  'left-panel', 'right-panel',
  'context-menu:phrase', 'context-menu:group',
  'phrase-row:actions', 'group:toolbar',
  'workspace:panel', 'workspace:layout',
  'settings:tab', 'status-bar',
  'theme',
]);

export const UI_REQUIRED_SLOTS = new Set([...VALID_SLOTS]);
UI_REQUIRED_SLOTS.delete('status-bar');
UI_REQUIRED_SLOTS.delete('theme');

export const CORE_SLOTS: Array<{ id: string; label: string; defaultVisible?: boolean }> = [
  { id: 'phrase-row:actions', label: 'Действия в строке фразы' },
  { id: 'context-menu:phrase', label: 'Контекстное меню фразы' },
  { id: 'context-menu:group', label: 'Контекстное меню группы' },
  { id: 'group:toolbar', label: 'Панель группы' },
  { id: 'workspace:panel', label: 'Доп. панель рабочей области' },
  { id: 'workspace:layout', label: 'Layout рабочей области', defaultVisible: false },
  { id: 'settings:tab', label: 'Вкладка настроек' },
  { id: 'theme', label: 'Тема оформления', defaultVisible: false },
];

export function declareCoreSlots(runtime: { declareSlot: (id: string, options?: { label?: string; defaultVisible?: boolean }) => void }): void {
  for (const slot of CORE_SLOTS) {
    runtime.declareSlot(slot.id, { label: slot.label, defaultVisible: slot.defaultVisible });
  }
}
