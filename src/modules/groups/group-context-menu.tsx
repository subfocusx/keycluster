// ============================================================
// Group Context Menu — extracted from components.tsx (Extraction #4)
// ============================================================

'use client';

import React, { Suspense } from 'react';
import { useAppStore , AppEvents} from '@/plugin-sdk';
import type { KCID, Group, Phrase, PluginContext, ModuleUIContribution, PhraseActionContext } from '@/plugin-sdk';
import { toast } from '@/hooks/use-toast';
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { ColorPickerSubmenu } from './color-picker-submenu';

function MIcon({ name, className = '', style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}

type KCDialogHandle = {
  prompt: (message: string, options?: any) => Promise<string | null>;
  confirm: (message: string, options?: any) => Promise<boolean>;
};

export function GroupItemContextMenu({ group, groups, phrases, ctx, kcDialog, setGroupColor, deleteGroup, pluginContribs = [] }: {
  group: Group;
  groups: Group[];
  phrases: Phrase[];
  ctx: PluginContext;
  kcDialog: KCDialogHandle;
  setGroupColor: (id: KCID, color: string) => void;
  deleteGroup: (id: KCID) => void;
  pluginContribs?: ModuleUIContribution[];
}) {
  return (
    <ContextMenuContent className="text-[12px]">
      {/* Add subgroup */}
      <ContextMenuItem onClick={async () => {
        const name = await kcDialog.prompt('Название подгруппы:', { title: 'Создать подгруппу', placeholder: 'Название...', defaultValue: '' });
        if (name) {
          ctx.store.dispatch('addGroup', { name, parentId: group.id });
          ctx.eventBus.emit(AppEvents.GROUPS_CHANGED);
        }
      }}>
        <MIcon name="create_new_folder" className="!text-[14px] mr-2" /> Создать подгруппу
      </ContextMenuItem>

      {/* Rename */}
      <ContextMenuItem onClick={async () => {
        const name = await kcDialog.prompt('Переименовать:', { title: 'Переименование', defaultValue: group.name });
        if (name) {
          useAppStore.getState().renameGroup(group.id, name);
          ctx.eventBus.emit(AppEvents.GROUPS_CHANGED);
        }
      }}>
        <MIcon name="edit" className="!text-[14px] mr-2" /> Переименовать
      </ContextMenuItem>

      {/* Color picker */}
      <ColorPickerSubmenu group={group} setGroupColor={(id, color) => {
        setGroupColor(id, color);
        ctx.eventBus.emit(AppEvents.GROUPS_CHANGED);
      }} />

      {/* Export phrases */}
      <ContextMenuItem onClick={async () => {
        const collectIds = (gid: KCID): KCID[] => {
          const ids: KCID[] = [gid];
          groups.filter(g => g.parentId === gid).forEach(child => ids.push(...collectIds(child.id)));
          return ids;
        };
        const groupIds = new Set(collectIds(group.id));
        const groupPhrases = phrases.filter(p => groupIds.has(p.groupId));
        const text = groupPhrases.map(p => p.text).join('\n');
        try {
          await navigator.clipboard.writeText(text);
          toast({ title: `Скопировано: ${groupPhrases.length} фраз из "${group.name}"`, duration: 2000 });
        } catch { /* fallback */ }
      }}>
        <MIcon name="content_copy" className="!text-[14px] mr-2" /> Экспортировать фразы
      </ContextMenuItem>

      <ContextMenuSeparator />

      {/* Delete */}
      {!group.isTrash && (
        <ContextMenuItem className="text-[var(--kc-red)]" onClick={async () => {
          if (await kcDialog.confirm(`Удалить группу "${group.name}" и все вложенные?`, { title: 'Удаление группы', confirmLabel: 'Удалить', variant: 'destructive' })) {
            deleteGroup(group.id);
            ctx.eventBus.emit(AppEvents.GROUPS_CHANGED);
            ctx.eventBus.emit(AppEvents.PHRASES_CHANGED);
          }
        }}>
          <MIcon name="delete" className="!text-[14px] mr-2" /> Удалить
        </ContextMenuItem>
      )}

      {/* Plugin contributions for context-menu:group */}
      {pluginContribs.length > 0 && (
        <>
          <ContextMenuSeparator />
          {pluginContribs.map(contrib => {
            if (contrib.action) {
              const groupCtx: PhraseActionContext = { store: ctx.store, eventBus: ctx.eventBus };
              return (
                <ContextMenuItem
                  key={contrib.moduleId ?? contrib.label}
                  onClick={() => contrib.action!(group, groupCtx)}
                >
                  {contrib.icon && <MIcon name={contrib.icon} className="!text-[14px] mr-2" />}
                  {contrib.label}
                </ContextMenuItem>
              );
            }
            if (contrib.component) {
              const Component = contrib.component;
              return (
                <Suspense key={contrib.moduleId ?? contrib.label} fallback={<span className="text-xs opacity-50">...</span>}>
                  <Component groupId={group.id} />
                </Suspense>
              );
            }
            return null;
          })}
        </>
      )}
    </ContextMenuContent>
  );
}