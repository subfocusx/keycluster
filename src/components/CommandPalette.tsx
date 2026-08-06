import type { CommandEntry } from '@/plugin-sdk';
// ============================================================
// KeyCluster Command Palette — модальный оверлей (Ctrl+K / Cmd+K)
// ============================================================
//
// Фичи:
//   - Fuzzy-поиск по id и label (includes, case-insensitive)
//   - Подсветка совпадений через <mark>
//   - Навигация стрелками + Enter + Escape
//   - Категория (moduleId) рядом с командой
//   - 5 последних использованных команд наверху
// ============================================================

'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { getCommandRegistry, getEventBus } from '@/plugin-sdk';

// ---- Highlight helper ----

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;

  const q = query.toLowerCase();
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[var(--kc-blue-light)] text-[var(--kc-text)] rounded-[2px] px-px">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ---- Command Palette Component ----

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [version, setVersion] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const registry = useRef(getCommandRegistry());

  useEffect(() => {
    if (!open) return;
    const bus = getEventBus();
    const refresh = () => setVersion(v => v + 1);
    const events = ['module:enabled', 'module:disabled', 'module:reloaded', 'module:registered', 'plugin:uninstalled'];
    const unsubs = events.map(e => bus.on(e, refresh));
    return () => unsubs.forEach(u => u());
  }, [open]);

  // Get recent + filtered commands
  const recentIds = registry.current.getRecent();
  const allCommands = registry.current.getAll();
  const recentCommands = recentIds
    .map(id => allCommands.find(c => c.id === id))
    .filter((c): c is CommandEntry => c !== undefined);

  const filtered = query.trim()
    ? registry.current.search(query)
    : [...recentCommands, ...allCommands.filter(c => !recentIds.includes(c.id))];

  // Deduplicate (recent may overlap with all)
  const seen = new Set<string>();
  const results = filtered.filter(cmd => {
    if (seen.has(cmd.id)) return false;
    seen.add(cmd.id);
    return true;
  });

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      // Focus input after render
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Reset selection on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedIndex]);

  const executeAndClose = useCallback((cmd: CommandEntry) => {
    registry.current.execute(cmd.id);
    onClose();
  }, [onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          executeAndClose(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [results, selectedIndex, executeAndClose, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Palette */}
      <div
        className="relative w-[560px] max-h-[420px] bg-[var(--kc-surface)] border border-[var(--kc-border)] rounded-lg shadow-2xl flex flex-col overflow-hidden"
        style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 h-12 border-b border-[var(--kc-border)] shrink-0">
          <span className="material-symbols-outlined !text-[20px] text-[var(--kc-text-secondary)]">
            search
          </span>
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-[14px] text-[var(--kc-text)] placeholder:text-[var(--kc-text-disabled)] focus:outline-none"
            placeholder="Введите команду..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd className="text-[11px] px-1.5 py-0.5 rounded border border-[var(--kc-border)] bg-[var(--kc-bg)] text-[var(--kc-text-secondary)]">
            Esc
          </kbd>
        </div>

        {/* Results list */}
        <div ref={listRef} className="flex-1 overflow-y-auto compact-scroll py-1">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-[var(--kc-text-disabled)]">
              Команды не найдены
            </div>
          ) : (
            <>
              {/* Recent section header */}
              {!query.trim() && recentCommands.length > 0 && (
                <div className="px-4 py-1 text-[11px] font-semibold text-[var(--kc-text-secondary)] uppercase tracking-wider">
                  Недавние
                </div>
              )}
              {results.map((cmd, i) => {
                const isRecent = !query.trim() && i < recentCommands.length;
                const isFirstAfterRecent = !query.trim() && recentCommands.length > 0 && i === recentCommands.length;

                return (
                  <React.Fragment key={cmd.id}>
                    {isFirstAfterRecent && (
                      <div className="px-4 py-1 text-[11px] font-semibold text-[var(--kc-text-secondary)] uppercase tracking-wider mt-1">
                        Все команды
                      </div>
                    )}
                    <button
                      className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                        i === selectedIndex
                          ? 'bg-[var(--kc-blue-light)] text-[var(--kc-text)]'
                          : 'text-[var(--kc-text)] hover:bg-[var(--kc-bg)]'
                      }`}
                      onClick={() => executeAndClose(cmd)}
                      onMouseEnter={() => setSelectedIndex(i)}
                    >
                      {/* Icon */}
                      <span className="material-symbols-outlined !text-[18px] text-[var(--kc-text-secondary)] shrink-0">
                        {isRecent ? 'history' : 'terminal'}
                      </span>

                      {/* Label with highlight */}
                      <span className="flex-1 text-[13px] truncate">
                        <HighlightMatch text={cmd.label} query={query} />
                      </span>

                      {/* Category badge */}
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--kc-bg)] text-[var(--kc-text-secondary)] shrink-0">
                        {cmd.category}
                      </span>

                      {/* Keybinding */}
                      {cmd.keybinding && (
                        <kbd className="text-[11px] px-1.5 py-0.5 rounded border border-[var(--kc-border)] bg-[var(--kc-bg)] text-[var(--kc-text-secondary)] shrink-0">
                          {cmd.keybinding}
                        </kbd>
                      )}
                    </button>
                  </React.Fragment>
                );
              })}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 h-8 border-t border-[var(--kc-border)] text-[11px] text-[var(--kc-text-disabled)] shrink-0">
          <span className="flex items-center gap-1">
            <kbd className="px-1 border border-[var(--kc-border)] rounded text-[10px]">↑↓</kbd>
            навигация
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 border border-[var(--kc-border)] rounded text-[10px]">↵</kbd>
            выполнить
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 border border-[var(--kc-border)] rounded text-[10px]">Esc</kbd>
            закрыть
          </span>
        </div>
      </div>
    </div>
  );
}
