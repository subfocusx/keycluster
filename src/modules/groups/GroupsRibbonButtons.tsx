'use client';

import { useState } from 'react';
import { useKCDialog } from '@/components/KCDialog';
import { Button } from '@/components/ui/button';
import type { PluginContext } from '@/plugin-sdk';
import { AppEvents } from '@/plugin-sdk';
import { AddGroupListDialog } from './dialogs';
import { MIcon } from '@/shell/shared-icon';


export function GroupsRibbonButtons({ ctx }: { ctx: PluginContext }) {
  const [showListDialog, setShowListDialog] = useState(false);
  const kcDialog = useKCDialog();

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-[11px] gap-1"
        title="Создать группу (системный элемент — нельзя переместить)"
        onClick={async () => {
          const name = await kcDialog.prompt('Название группы:', { title: 'Создать группу', placeholder: 'Название...' });
          if (name) {
            ctx.store.dispatch('addGroup', { name, parentId: null });
            ctx.eventBus.emit(AppEvents.GROUPS_CHANGED);
          }
        }}
      >
        <MIcon name="create_new_folder" className="!text-[14px]" />
        Группа
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-[11px] gap-1"
        title="Создать группу по списку (системный элемент — нельзя переместить)"
        onClick={() => setShowListDialog(true)}
      >
        <MIcon name="playlist_add" className="!text-[14px]" />
        По списку
      </Button>
      <AddGroupListDialog open={showListDialog} onOpenChange={setShowListDialog} ctx={ctx} />
    </>
  );
}
