import React, { useState, useMemo } from 'react';
import { useAppStore , AppEvents} from '@/plugin-sdk';
import type { PluginContext, KCID } from '@/plugin-sdk';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// ---- Add Group List Dialog ----

export function AddGroupListDialog({ open, onOpenChange, ctx }: { open: boolean; onOpenChange: (v: boolean) => void; ctx: PluginContext }) {
  const [text, setText] = useState('');
  const [parentId, setParentId] = useState<KCID | null>(null);
  const groups = useAppStore(s => s.groups);

  const handleAdd = () => {
    const names = text.split('\n').map(n => n.trim()).filter(Boolean);
    if (names.length > 0) {
      const store = useAppStore.getState();
      store.addGroupFromList(names, parentId);
      ctx.eventBus.emit(AppEvents.GROUPS_CHANGED);
      setText('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Создать группы по списку</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="font-body-sm text-[var(--kc-text-secondary)] mb-1 block">Родительская группа</label>
            <select
              className="w-full h-7 rounded-[3px] border border-[var(--kc-border)] bg-[var(--kc-surface)] px-2 text-[12px]"
              value={parentId ?? ''}
              onChange={e => setParentId(e.target.value || null)}
            >
              <option value="">— Корень —</option>
              {groups.filter(g => !g.isTrash).map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-body-sm text-[var(--kc-text-secondary)] mb-1 block">Список названий (по строкам)</label>
            <textarea
              className="w-full min-h-[150px] rounded-[3px] border border-[var(--kc-border)] bg-[var(--kc-surface)] px-2 py-1.5 text-[12px] resize-y focus:outline-none focus:ring-1 focus:ring-[var(--kc-blue)] focus:border-[var(--kc-blue)]"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={"Группа 1\nГруппа 2\nГруппа 3"}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={handleAdd} disabled={!text.trim()}>Создать</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Bulk Move Dialog ----

export function BulkMoveDialog({ open, onOpenChange, groupIds, ctx }: { open: boolean; onOpenChange: (v: boolean) => void; groupIds: KCID[]; ctx: PluginContext }) {
  const groups = useAppStore(s => s.groups);
  const [targetId, setTargetId] = useState<KCID | null>(null);
  const [targetSelected, setTargetSelected] = useState(false);

  const availableTargets = useMemo(() => {
    const selectedSet = new Set(groupIds);
    const collectDescendants = (gid: KCID): Set<KCID> => {
      const result = new Set<KCID>();
      groups.filter(g => g.parentId === gid).forEach(child => {
        result.add(child.id);
        collectDescendants(child.id).forEach(id => result.add(id));
      });
      return result;
    };
    const descendants = new Set<KCID>();
    groupIds.forEach(id => collectDescendants(id).forEach(d => descendants.add(d)));
    const excluded = new Set([...selectedSet, ...descendants]);
    return groups.filter(g => !g.isTrash && !excluded.has(g.id));
  }, [groups, groupIds]);

  const handleMove = () => {
    if (!targetSelected) return;
    const store = useAppStore.getState();
    store.moveGroups(groupIds, targetId);
    ctx.eventBus.emit(AppEvents.GROUPS_CHANGED);
    onOpenChange(false);
    setTargetId(null);
    setTargetSelected(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onOpenChange(false); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Переместить группы</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-[12px] text-[var(--kc-text-secondary)]">
            Переместить {groupIds.length} групп в:
          </p>
          <select
            className="w-full h-7 rounded-[3px] border border-[var(--kc-border)] bg-[var(--kc-surface)] px-2 text-[12px]"
            value={targetId ?? ''}
            onChange={e => {
              setTargetId(e.target.value || null);
              setTargetSelected(true);
            }}
          >
            <option value="">— Корень —</option>
            {availableTargets.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={handleMove} disabled={!targetSelected}>Переместить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}