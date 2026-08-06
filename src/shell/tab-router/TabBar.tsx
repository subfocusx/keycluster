import type { CustomTab } from '@/plugin-sdk';
import React, { useState, useCallback, useRef } from 'react';
import { useTabStore } from '@/plugin-sdk';
import { useKCDialog } from '@/components/KCDialog';
import { MIcon } from '@/shell/shared-icon';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

function AddTabInlineMenuItem({ onDone }: { onDone: () => void }) {
  const addTab = useTabStore(s => s.addTab);
  const [showInput, setShowInput] = useState(false);
  const [value, setValue] = useState('');

  const commit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed) {
      addTab(trimmed);
      setValue('');
      setShowInput(false);
      onDone();
    }
  }, [value, addTab, onDone]);

  if (showInput) {
    return (
      <div className="px-2 py-1" onClick={e => e.stopPropagation()}>
        <input
          className="bg-[var(--bg-input)] border border-[var(--border)] rounded px-1 text-sm w-full outline-none"
          value={value}
          autoFocus
          placeholder="Название вкладки..."
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setShowInput(false); setValue(''); }
            e.stopPropagation();
          }}
          onBlur={() => { if (!value.trim()) setShowInput(false); }}
        />
      </div>
    );
  }

  return (
    <DropdownMenuItem onClick={e => { e.preventDefault(); setShowInput(true); }}>
      <MIcon name="add" className="mr-2 !text-[14px]" />
      Новая вкладка
    </DropdownMenuItem>
  );
}

function AddTabButton() {
  const addTab = useTabStore(s => s.addTab);
  const [showInput, setShowInput] = useState(false);
  const [value, setValue] = useState('');

  const handleAdd = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed) {
      addTab(trimmed);
      setValue('');
      setShowInput(false);
    }
  }, [value, addTab]);

  if (showInput) {
    return (
      <div className="flex items-center px-1">
        <input
          className="bg-[var(--bg-input)] border border-[var(--border)] rounded px-1 text-sm w-24 outline-none"
          value={value}
          autoFocus
          placeholder="Название..."
          onKeyDown={e => {
            if (e.key === 'Enter') handleAdd();
            if (e.key === 'Escape') { setShowInput(false); setValue(''); }
          }}
          onBlur={() => { if (!value.trim()) setShowInput(false); else handleAdd(); }}
          onChange={e => setValue(e.target.value)}
        />
      </div>
    );
  }

  return (
    <button
      className="ribbon-tab ribbon-tab--add text-[var(--kc-text-secondary)] hover:text-[var(--kc-text)] px-2 text-lg leading-none"
      title="Добавить вкладку (ПКМ на вкладке — переименовать / удалить)"
      onClick={() => setShowInput(true)}
    >
      +
    </button>
  );
}

export function TabBar({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: CustomTab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  const renameTab = useTabStore(s => s.renameTab);
  const removeTab = useTabStore(s => s.removeTab);
  const kcDialog = useKCDialog();
  const overrides = useTabStore(s => s.toolTabOverrides);

  const [contextTabId, setContextTabId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  const openContextMenu = useCallback((e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextTabId(tabId);
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextTabId(null);
  }, []);

  const startRename = useCallback((tab: CustomTab) => {
    closeContextMenu();
    setRenamingId(tab.id);
    setRenameValue(tab.label);
  }, [closeContextMenu]);

  const commitRename = useCallback((id: string) => {
    const trimmed = renameValue.trim();
    if (trimmed) {
      renameTab(id, trimmed);
    }
    setRenamingId(null);
    setRenameValue('');
  }, [renameValue, renameTab]);

  const handleRemove = useCallback(async (tab: CustomTab) => {
    closeContextMenu();
    if (tab.isBuiltin) return;

    const assignedTools = Object.entries(overrides)
      .filter(([, tabId]) => tabId === tab.id)
      .map(([toolId]) => toolId);

    const warningText = assignedTools.length > 0
      ? `Вкладка «${tab.label}» содержит ${assignedTools.length} перемещённых инструмент(ов). При удалении они вернутся на свои вкладки по умолчанию.`
      : `Удалить вкладку «${tab.label}»?`;

    const confirmed = await kcDialog.confirm(warningText, {
      title: 'Удаление вкладки',
      confirmLabel: 'Удалить',
      variant: 'destructive',
    });

    if (confirmed) {
      try {
        removeTab(tab.id);
      } catch {
      }
    }
  }, [closeContextMenu, overrides, kcDialog, removeTab]);

  return (
    <div className="flex items-end bg-[var(--bg-panel)] border-b border-[var(--border)] px-1 pt-0.5 select-none">
      {tabs.map(tab => (
        <div key={tab.id} className="relative">
          <button
            className={`ribbon-tab ${activeTab === tab.id ? 'active' : ''}`}
            data-tab={tab.id}
            onClick={() => {
              if (renamingId === tab.id) return;
              onTabChange(tab.id);
            }}
            onContextMenu={e => openContextMenu(e, tab.id)}
          >
            {renamingId === tab.id ? (
              <input
                ref={renameInputRef}
                className="bg-[var(--bg-input)] border border-[var(--border)] rounded px-1 text-sm w-24 outline-none"
                value={renameValue}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') commitRename(tab.id);
                  if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
                  e.stopPropagation();
                }}
                onBlur={() => commitRename(tab.id)}
                onChange={e => setRenameValue(e.target.value)}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              tab.label
            )}
          </button>

          <DropdownMenu
            open={contextTabId === tab.id}
            onOpenChange={open => { if (!open) closeContextMenu(); }}
          >
            <DropdownMenuTrigger asChild>
              <span
                className="absolute inset-0 pointer-events-none"
                aria-hidden
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="start">
              <DropdownMenuItem onClick={() => startRename(tab)}>
                <MIcon name="edit" className="mr-2 !text-[14px]" />
                Переименовать
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <AddTabInlineMenuItem onDone={closeContextMenu} />

              {!tab.isBuiltin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => handleRemove(tab)}
                  >
                    <MIcon name="delete" className="mr-2 !text-[14px]" />
                    Удалить вкладку
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}

      <AddTabButton />
    </div>
  );
}
