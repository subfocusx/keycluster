import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuid } from 'uuid';
import type { ToolId } from '@/core/tool-registry';

export interface CustomTab {
  id: string;
  label: string;
  order: number;
  isBuiltin: boolean;
}

export interface TabSlice {
  customTabs: CustomTab[];
  toolTabOverrides: Record<string, string>;

  addTab: (label: string) => void;
  renameTab: (id: string, label: string) => void;
  removeTab: (id: string) => void;
  moveToolToTab: (toolId: string, targetTabId: string) => void;
  reorderTabs: (orderedIds: string[]) => void;
}

const BUILTIN_TABS: CustomTab[] = [
  { id: 'data', label: 'Данные', order: 0, isBuiltin: true },
  { id: 'algorithms', label: 'Алгоритмы', order: 1, isBuiltin: true },
  { id: 'ai', label: 'AI', order: 2, isBuiltin: true },
  { id: 'plugins', label: 'Плагины', order: 3, isBuiltin: true },
  { id: 'view', label: 'Вид', order: 4, isBuiltin: true },
];

function buildInitialTabs(): CustomTab[] {
  return BUILTIN_TABS.map(t => ({ ...t }));
}

export const useTabStore = create<TabSlice>()(
  persist(
    (set, get) => ({
      customTabs: buildInitialTabs(),
      toolTabOverrides: {},

      addTab: (label: string) => {
        const trimmed = label.trim();
        if (trimmed.length === 0) return;
        set(s => ({
          customTabs: [...s.customTabs, {
            id: `tab_${uuid().slice(0, 8)}`,
            label: trimmed,
            order: s.customTabs.reduce((m, t) => Math.max(m, t.order), 0) + 1,
            isBuiltin: false,
          }],
        }));
      },

      renameTab: (id: string, label: string) => {
        const trimmed = label.trim();
        if (trimmed.length === 0) return;
        set(s => ({
          customTabs: s.customTabs.map(t => t.id === id ? { ...t, label: trimmed } : t),
        }));
      },

      removeTab: (id: string) => {
        const state = get();
        const tab = state.customTabs.find(t => t.id === id);
        if (!tab) return;
        if (tab.isBuiltin) {
          throw new Error('Cannot remove builtin tab');
        }
        const removedOverrides: string[] = [];
        for (const [toolId, targetTabId] of Object.entries(state.toolTabOverrides)) {
          if (targetTabId === id) {
            removedOverrides.push(toolId);
          }
        }
        const newOverrides = { ...state.toolTabOverrides };
        for (const toolId of removedOverrides) {
          delete newOverrides[toolId];
        }
        set({
          customTabs: state.customTabs.filter(t => t.id !== id),
          toolTabOverrides: newOverrides,
        });
      },

      moveToolToTab: (toolId: string, targetTabId: string) => {
        const state = get();
        const tabExists = state.customTabs.some(t => t.id === targetTabId);
        if (!tabExists) {
          const newOverrides = { ...state.toolTabOverrides };
          delete newOverrides[toolId];
          set({ toolTabOverrides: newOverrides });
          return;
        }
        set({ toolTabOverrides: { ...state.toolTabOverrides, [toolId]: targetTabId } });
      },

      reorderTabs: (orderedIds: string[]) => {
        const state = get();
        const newTabs: CustomTab[] = [];
        const existing = new Map(state.customTabs.map(t => [t.id, t]));
        let order = 0;
        for (const id of orderedIds) {
          const tab = existing.get(id);
          if (tab) {
            newTabs.push({ ...tab, order: order++ });
          }
        }
        const remaining = state.customTabs
          .filter(t => !orderedIds.includes(t.id))
          .sort((a, b) => a.order - b.order);
        for (const tab of remaining) {
          newTabs.push({ ...tab, order: order++ });
        }
        set({ customTabs: newTabs });
      },
    }),
    {
      name: 'keycluster-tabs',
      partialize: (state) => ({
        customTabs: state.customTabs,
        toolTabOverrides: state.toolTabOverrides,
      }),
    }
  )
);
