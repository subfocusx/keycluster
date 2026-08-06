// ============================================================
// Group Notes — extracted from components.tsx (Extraction #3)
// ============================================================

'use client';

import React, { useState, useCallback } from 'react';
import { useAppStore , AppEvents} from '@/plugin-sdk';
import type { Group, Phrase, PluginContext } from '@/plugin-sdk';
import { toast } from '@/hooks/use-toast';

function MIcon({ name, className = '', style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}

// ---- Group Notes Section ----

export function GroupNotesSection({ group, phrases, ctx }: { group: Group; phrases: Phrase[]; ctx: PluginContext }) {
  const [expanded, setExpanded] = useState(!!group.notes);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(group.notes ?? '');
  const setGroupNotes = useAppStore(s => s.setGroupNotes);

  const handleCopy = useCallback(async () => {
    if (group.notes) {
      try {
        await navigator.clipboard.writeText(group.notes);
        toast({ title: 'Описание скопировано', duration: 1500 });
      } catch { /* noop */ }
    }
  }, [group.notes]);

  const handleSaveEdit = useCallback(() => {
    setGroupNotes(group.id, editValue.trim());
    setEditing(false);
    ctx.eventBus.emit(AppEvents.GROUPS_CHANGED);
  }, [group.id, editValue, setGroupNotes, ctx.eventBus]);

  if (!expanded && !group.notes) return null;

  return (
    <div className="border-t border-[var(--kc-border-light)] mx-2 my-1 pt-1">
      <button
        className="flex items-center gap-1 w-full text-left cursor-pointer px-1 py-0.5 rounded hover:bg-[var(--kc-surface-active)]"
        onClick={() => setExpanded(!expanded)}
      >
        <MIcon name={expanded ? 'expand_less' : 'expand_more'} className="!text-[14px] text-[var(--kc-text-secondary)]" />
        <span className="text-[10px] font-medium text-[var(--kc-text-secondary)] uppercase tracking-wider">Описание группы</span>
        {group.notes && !expanded && (
          <span className="text-[9px] text-[var(--kc-text-disabled)] truncate ml-1 flex-1">{group.notes}</span>
        )}
      </button>

      {expanded && (
        <div className="px-2 py-1 space-y-1">
          {editing ? (
            <div className="space-y-1">
              <textarea
                className="w-full min-h-[60px] text-[11px] rounded-[3px] border border-[var(--kc-border)] bg-[var(--kc-surface)] px-2 py-1 resize-vertical focus:outline-none focus:ring-1 focus:ring-[var(--kc-blue)] focus:border-[var(--kc-blue)]"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                autoFocus
              />
              <div className="flex items-center gap-1">
                <button
                  className="text-[10px] px-2 py-0.5 rounded bg-[var(--kc-blue)] text-white hover:opacity-90"
                  onClick={handleSaveEdit}
                  disabled={!editValue.trim()}
                >
                  Сохранить
                </button>
                <button
                  className="text-[10px] px-2 py-0.5 rounded border border-[var(--kc-border)] hover:bg-[var(--kc-surface-active)]"
                  onClick={() => { setEditing(false); setEditValue(group.notes ?? ''); }}
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : group.notes ? (
            <div>
              <p className="text-[11px] text-[var(--kc-text-secondary)] leading-relaxed">{group.notes}</p>
              <div className="flex items-center gap-1 mt-1">
                <button
                  className="text-[9px] px-1.5 py-0.5 rounded text-[var(--kc-blue)] hover:bg-[var(--kc-blue-light)]"
                  onClick={() => { setEditing(true); setEditValue(group.notes ?? ''); }}
                >
                  <MIcon name="edit" className="!text-[10px] mr-0.5" /> Править
                </button>
                <button
                  className="text-[9px] px-1.5 py-0.5 rounded text-[var(--kc-text-secondary)] hover:bg-[var(--kc-surface-active)]"
                  onClick={handleCopy}
                >
                  <MIcon name="content_copy" className="!text-[10px] mr-0.5" /> Копировать
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-[10px] text-[var(--kc-text-disabled)]">Описание не создано</p>
              <button
                className="text-[9px] px-1.5 py-0.5 rounded text-[var(--kc-blue)] hover:bg-[var(--kc-blue-light)] mt-1"
                onClick={() => { setEditing(true); setEditValue(''); }}
              >
                <MIcon name="edit" className="!text-[10px] mr-0.5" /> Добавить описание
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}