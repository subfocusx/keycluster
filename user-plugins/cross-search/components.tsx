// ============================================================
// Module: Cross Search — UI Panel (Key Collector style)
// ============================================================

import type { PluginContext } from 'plugin-sdk';
import React, { useState } from 'react';
import { useAppStore, Button, Badge, useKCDialog } from 'plugin-sdk';
import { findDuplicates } from './index';

// ---- Icon helper ----

function MIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export function CrossSearchPanel(_props: { ctx: PluginContext }) {
  const phrases = useAppStore(s => s.phrases);
  const groups = useAppStore(s => s.groups);
  const deletePhrases = useAppStore(s => s.deletePhrases);
  const kcDialog = useKCDialog();

  const [duplicates, setDuplicates] = useState<ReturnType<typeof findDuplicates> | null>(null);

  const handleSearch = () => {
    const result = findDuplicates(phrases);
    setDuplicates(result);
  };

  const handleRemoveDuplicates = async (textKey: string) => {
    const entry = duplicates?.get(textKey);
    if (!entry) return;

    const matching = phrases.filter(p => p.text.toLowerCase().trim() === textKey);
    if (matching.length <= 1) return;

    const toDelete = matching.slice(1).map(p => p.id);
    const ok = await kcDialog.confirm(`Удалить ${toDelete.length} дублей?`, { title: 'Удаление дублей', confirmLabel: 'Удалить', variant: 'destructive' });
    if (!ok) return;
    deletePhrases(toDelete);
    setDuplicates(prev => {
      if (!prev) return prev;
      const next = new Map(prev);
      next.delete(textKey);
      return next;
    });
  };

  const getGroupName = (id: string) => groups.find(g => g.id === id)?.name ?? '—';

  return (
    <div className="h-full flex flex-col" style={{ maxWidth: '100%', width: '100%' }}>
        <div className="flex-1 overflow-y-auto compact-scroll p-3 space-y-3">
          <p className="text-[12px] text-[var(--kc-text-secondary)]">
            Найдите фразы, которые встречаются в нескольких группах одновременно.
          </p>

          {duplicates && duplicates.size > 0 && (
            <div className="space-y-2">
              <span className="text-[12px] font-semibold">Найдено дубликатов: {duplicates.size}</span>
              <div className="max-h-[250px] overflow-y-auto compact-scroll space-y-2">
                {Array.from(duplicates.entries()).map(([key, entry]) => (
                  <div key={key} className="border border-[var(--kc-border)] rounded-[3px] p-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-medium truncate max-w-[200px]">{entry.text}</span>
                      <Badge variant="secondary" className="text-[10px]">{entry.count}x</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {Array.from(entry.groupIds).map(gid => (
                        <Badge key={gid} variant="outline" className="text-[10px]">{getGroupName(gid)}</Badge>
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px]"
                      style={{ color: 'var(--kc-red)' }}
                      onClick={() => handleRemoveDuplicates(key)}
                    >
                      Удалить дубликаты
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {duplicates && duplicates.size === 0 && (
            <p className="text-[12px] text-[var(--kc-text-secondary)]">Дубликатов не найдено.</p>
          )}
        </div>

      {/* Footer: pinned to bottom */}
      <div className="shrink-0 border-t border-[var(--kc-border-light)] p-3" style={{ background: 'var(--kc-bg, var(--kc-surface))' }}>
        <Button onClick={handleSearch} className="w-full" style={{ backgroundColor: 'var(--kc-blue)', color: 'white' }}>
          <MIcon name="content_copy" className="!text-[16px] mr-1" />
          Найти дубликаты
        </Button>
      </div>
    </div>
  );
}
