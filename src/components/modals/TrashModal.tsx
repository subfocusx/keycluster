import type { KCID } from '@/plugin-sdk';
// ============================================================
// TrashModal — Корзина: просмотр, восстановление, удаление фраз
// Extracted from PanelManager.tsx (shell decomposition)
// ============================================================

'use client';

import React, { useState } from 'react';
import { useAppStore, AppEvents } from '@/plugin-sdk';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useKCDialog } from '@/components/KCDialog';

// ---- Icon helper (shared with ToolModal) ----

function MIcon({ name, className = '', style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}

// ---- Trash Modal ----

export function TrashModal({ open, onOpenChange, ctx }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ctx: any;
}) {
  const phrases = useAppStore(s => s.phrases);
  const groups = useAppStore(s => s.groups);
  const restoreFromTrash = useAppStore(s => s.restoreFromTrash);
  const clearTrash = useAppStore(s => s.clearTrash);
  const deletePhrases = useAppStore(s => s.deletePhrases);
  const kcDialog = useKCDialog();
  const [selectedIds, setSelectedIds] = useState<KCID[]>([]);

  const trashGroup = groups.find(g => g.isTrash);
  const trashPhrases = trashGroup
    ? phrases.filter(p => p.groupId === trashGroup.id)
    : [];

  const toggleSelect = (id: KCID) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const selectAll = () => setSelectedIds(trashPhrases.map(p => p.id));
  const deselectAll = () => setSelectedIds([]);

  const handleRestore = () => {
    if (selectedIds.length > 0) {
      restoreFromTrash(selectedIds);
      setSelectedIds([]);
      ctx.eventBus.emit(AppEvents.PHRASES_CHANGED);
    }
  };

  const handleRestoreAll = () => {
    restoreFromTrash(trashPhrases.map(p => p.id));
    setSelectedIds([]);
    ctx.eventBus.emit(AppEvents.PHRASES_CHANGED);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length > 0 && await kcDialog.confirm(`Удалить безвозвратно ${selectedIds.length} фраз?`, { title: 'Удаление', confirmLabel: 'Удалить', variant: 'destructive' })) {
      deletePhrases(selectedIds);
      setSelectedIds([]);
    }
  };

  const handleClearTrash = async () => {
    if (await kcDialog.confirm('Очистить корзину? Все фразы будут удалены безвозвратно.', { title: 'Очистка корзины', confirmLabel: 'Очистить', variant: 'destructive' })) {
      clearTrash();
      setSelectedIds([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MIcon name="delete" className="!text-[20px] text-[var(--kc-red)]" />
            Корзина
            {trashPhrases.length > 0 && (
              <span className="text-[var(--kc-text-secondary)] font-normal text-[12px]">
                ({trashPhrases.length} фраз)
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {trashPhrases.length === 0 ? (
          <div className="py-8 text-center text-[var(--kc-text-secondary)]">
            <MIcon name="delete_outline" className="!text-[40px] text-[var(--kc-text-disabled)] mb-2" />
            <p>Корзина пуста</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Actions bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={selectAll} disabled={selectedIds.length === trashPhrases.length}>
                Выбрать все
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll} disabled={selectedIds.length === 0}>
                Снять выбор
              </Button>
              <div className="w-px h-5 bg-[var(--kc-border)]" />
              <Button variant="outline" size="sm" onClick={handleRestore} disabled={selectedIds.length === 0}
                className="text-[var(--kc-blue)]">
                <MIcon name="restore_from_trash" className="!text-[14px] mr-1" />
                Восстановить ({selectedIds.length || ''})
              </Button>
              <Button variant="outline" size="sm" onClick={handleRestoreAll}>
                <MIcon name="restore_from_trash" className="!text-[14px] mr-1" />
                Восстановить все
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleDeleteSelected} disabled={selectedIds.length === 0}
                  className="text-[var(--kc-red)]">
                  Удалить выбранные
                </Button>
                <Button variant="destructive" size="sm" onClick={handleClearTrash}>
                  Очистить корзину
                </Button>
              </div>
            </div>

            {/* Phrase list */}
            <div className="max-h-[300px] overflow-y-auto border border-[var(--kc-border)] rounded-[3px] compact-scroll">
              {trashPhrases.map(phrase => {
                const isSelected = selectedIds.includes(phrase.id);
                const originalGroup = (phrase as any)._originalGroupId
                  ? groups.find(g => g.id === (phrase as any)._originalGroupId)
                  : null;
                return (
                  <div
                    key={phrase.id}
                    className={`flex items-center gap-2 px-3 py-1.5 border-b border-[var(--kc-border-light)] cursor-pointer text-[12px] ${
                      isSelected ? 'bg-[var(--kc-blue-light)]' : 'hover:bg-[var(--kc-surface-hover)]'
                    }`}
                    onClick={() => toggleSelect(phrase.id)}
                  >
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(phrase.id)} className="kc-checkbox" />
                    <span className="flex-1 truncate">{phrase.text}</span>
                    {originalGroup && (
                      <span className="text-[10px] text-[var(--kc-text-secondary)] bg-[var(--kc-surface-hover)] px-1.5 py-0.5 rounded">
                        из: {originalGroup.name}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
