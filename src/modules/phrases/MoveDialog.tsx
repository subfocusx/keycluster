import React from 'react';
import type { KCID, Group, PluginContext } from '@/plugin-sdk';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { MIcon } from '@/shell/shared-icon';

export interface MoveDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  moveAction: 'move' | 'copy';
  setMoveAction: (v: 'move' | 'copy') => void;
  selectedCount: number;
  nonTrashGroups: Group[];
  targetGroupId: KCID | null;
  setTargetGroupId: (id: KCID | null) => void;
  showNewGroupInMove: boolean;
  setShowNewGroupInMove: (v: boolean) => void;
  newGroupInMoveName: string;
  setNewGroupInMoveName: (v: string) => void;
  newGroupInMoveParentId: KCID | null;
  setNewGroupInMoveParentId: (id: KCID | null) => void;
  onConfirm: () => void;
  addGroup: (name: string, parentId: KCID | null) => KCID;
}

export const MoveDialog = React.memo(function MoveDialog(props: MoveDialogProps) {
  const { open, onOpenChange, moveAction, setMoveAction } = props;
  return (
    <Dialog open={open} onOpenChange={open2 => {
      if (!open2) { onOpenChange(false); props.setShowNewGroupInMove(false); }
    }}>
      <DialogContent className="max-w-md max-h-[70vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Перенос и копирование фраз</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 p-0.5 rounded-[4px] bg-[var(--kc-surface-hover)] shrink-0" style={{ background: 'var(--kc-surface-hover)' }}>
          <button
            onClick={() => setMoveAction('move')}
            className={`flex-1 h-7 text-[12px] rounded-[3px] transition-colors ${
              moveAction === 'move'
                ? 'bg-[var(--kc-surface)] text-[var(--kc-text)] font-semibold shadow-sm'
                : 'text-[var(--kc-text-secondary)] hover:text-[var(--kc-text)]'
            }`}
          >
            Перенести
          </button>
          <button
            onClick={() => setMoveAction('copy')}
            className={`flex-1 h-7 text-[12px] rounded-[3px] transition-colors ${
              moveAction === 'copy'
                ? 'bg-[var(--kc-surface)] text-[var(--kc-text)] font-semibold shadow-sm'
                : 'text-[var(--kc-text-secondary)] hover:text-[var(--kc-text)]'
            }`}
          >
            Копировать
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col mt-2">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[12px] text-[var(--kc-text-secondary)]">Целевая группа</label>
            <button
              className="text-[11px] text-[var(--kc-primary)] hover:underline flex items-center gap-0.5"
              onClick={() => {
                props.setShowNewGroupInMove(true);
                props.setNewGroupInMoveName('');
                props.setNewGroupInMoveParentId(null);
              }}
            >
              <MIcon name="add" className="!text-[13px]" />
              Новая группа
            </button>
          </div>

          {props.showNewGroupInMove && (
            <div className="mb-2 p-2 border border-[var(--kc-border)] rounded-[3px] space-y-1.5">
              <Input
                autoFocus
                value={props.newGroupInMoveName}
                onChange={e => props.setNewGroupInMoveName(e.target.value)}
                placeholder="Название группы..."
                className="h-7 text-[12px]"
                onKeyDown={e => {
                  if (e.key === 'Enter' && props.newGroupInMoveName.trim()) {
                    const id = props.addGroup(props.newGroupInMoveName.trim(), props.newGroupInMoveParentId);
                    props.setTargetGroupId(id);
                    props.setShowNewGroupInMove(false);
                    props.setNewGroupInMoveName('');
                  }
                  if (e.key === 'Escape') props.setShowNewGroupInMove(false);
                }}
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="h-6 text-[11px] flex-1"
                  disabled={!props.newGroupInMoveName.trim()}
                  onClick={() => {
                    const id = props.addGroup(props.newGroupInMoveName.trim(), props.newGroupInMoveParentId);
                    props.setTargetGroupId(id);
                    props.setShowNewGroupInMove(false);
                    props.setNewGroupInMoveName('');
                  }}
                >
                  Создать
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => props.setShowNewGroupInMove(false)}
                >
                  Отмена
                </Button>
              </div>
            </div>
          )}

          <div className="flex-1 border border-[var(--kc-border)] rounded-[3px] overflow-y-auto compact-scroll">
            {props.nonTrashGroups.length === 0 ? (
              <div className="p-4 text-center text-[12px] text-[var(--kc-text-secondary)]">
                Нет доступных групп
              </div>
            ) : (
              (() => {
                const renderTree = (parentId: KCID | null, depth: number): React.ReactNode[] => {
                  const children = props.nonTrashGroups.filter(g => g.parentId === parentId);
                  return children.flatMap(g => [
                    <div
                      key={g.id}
                      className={`flex items-center gap-1 px-1.5 py-1 cursor-pointer rounded-none text-[12px] transition-colors ${
                        props.targetGroupId === g.id
                          ? 'bg-[var(--kc-primary)] text-white'
                          : 'hover:bg-[var(--kc-surface-hover)] text-[var(--kc-text)]'
                      }`}
                      style={{ paddingLeft: `${12 + depth * 16}px` }}
                      onClick={() => {
                        props.setTargetGroupId(g.id);
                        props.setShowNewGroupInMove(false);
                      }}
                    >
                      <MIcon
                        name={depth === 0 ? 'folder' : 'subdirectory_arrow_right'}
                        className={`!text-[14px] shrink-0 ${props.targetGroupId === g.id ? 'text-white' : 'text-[var(--kc-text-secondary)]'}`}
                      />
                      <span className="truncate flex-1">{g.name}</span>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          props.setShowNewGroupInMove(true);
                          props.setNewGroupInMoveName('');
                          props.setNewGroupInMoveParentId(g.id);
                        }}
                        className="shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-black/10 transition-colors"
                        title="Создать подгруппу"
                      >
                        <MIcon name="add" className={`!text-[12px] ${props.targetGroupId === g.id ? 'text-white' : 'text-[var(--kc-text-secondary)]'}`} />
                      </button>
                    </div>,
                    ...renderTree(g.id, depth + 1),
                  ]);
                };
                return renderTree(null, 0);
              })()
            )}
          </div>

          <p className="text-[12px] text-[var(--kc-text-secondary)] mt-2 shrink-0">
            {props.selectedCount} фраз будет {moveAction === 'move' ? 'перенесено' : 'скопировано'}
            {props.targetGroupId && <> в группу <strong>{props.nonTrashGroups.find(g => g.id === props.targetGroupId)?.name ?? ''}</strong></>}
          </p>
        </div>

        <DialogFooter className="gap-2 shrink-0 mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button
            disabled={!props.targetGroupId}
            onClick={props.onConfirm}
          >
            {moveAction === 'move' ? 'Перенести' : 'Копировать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});