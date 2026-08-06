// ============================================================
// Module: Phrases — Add Phrases Dialog + Tag Input
// ============================================================

'use client';

import React, { useState } from 'react';
import { useAppStore , AppEvents} from '@/plugin-sdk';
import type { PluginContext, KCID } from '@/plugin-sdk';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// ---- Add Phrases Dialog ----

export function AddPhrasesDialog({ open, onOpenChange, ctx }: { open: boolean; onOpenChange: (v: boolean) => void; ctx: PluginContext }) {
  const [text, setText] = useState('');
  const [groupId, setGroupId] = useState<KCID | null>(null);
  const groups = useAppStore(s => s.groups);
  const activeGroupId = useAppStore(s => s.activeGroupId);

  const nonTrashGroups = groups.filter(g => !g.isTrash);
  const targetGroup = groupId ?? activeGroupId ?? nonTrashGroups[0]?.id ?? null;

  const handleAdd = () => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length > 0 && targetGroup) {
      const store = useAppStore.getState();
      store.addPhrases(lines, targetGroup);
      ctx.eventBus.emit(AppEvents.PHRASES_CHANGED);
      setText('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Добавить фразы</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="font-body-sm text-[var(--kc-text-secondary)] mb-1 block">Группа</label>
            <select
              className="w-full h-7 rounded-[3px] border border-[var(--kc-border)] bg-[var(--kc-surface)] px-2 text-[12px]"
              value={targetGroup ?? ''}
              onChange={e => setGroupId(e.target.value || null)}
            >
              <option value="">— Выберите —</option>
              {groups.filter(g => !g.isTrash).map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-body-sm text-[var(--kc-text-secondary)] mb-1 block">Фразы (по строкам)</label>
            <textarea
              className="w-full min-h-[150px] rounded-[3px] border border-[var(--kc-border)] bg-[var(--kc-surface)] px-2 py-1.5 text-[12px] resize-y focus:outline-none focus:ring-1 focus:ring-[var(--kc-blue)] focus:border-[var(--kc-blue)]"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={"аренда микроавтобуса\nмикроавтобус с водителем\nзаказать микроавтобус"}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={handleAdd} disabled={!text.trim() || !targetGroup}>Добавить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}