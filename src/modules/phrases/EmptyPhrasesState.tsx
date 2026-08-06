'use client';

import React from 'react';
import type { PluginContext, KCID } from '@/plugin-sdk';
import { MIcon } from '@/shell/shared-icon';

export function EmptyPhrasesState({ ctx, activeGroupId, numVisibleCols }: { ctx: PluginContext; activeGroupId: KCID | null; numVisibleCols: number }) {
  if (activeGroupId) {
    return (
      <tr>
        <td colSpan={numVisibleCols + 1}>
          <div className="flex flex-col items-center gap-3 py-8">
            <MIcon name="text_snippet" className="!text-[32px] text-[var(--kc-text-disabled)]" />
            <p className="text-[12px] text-[var(--kc-text-secondary)]">
              В этой группе пока нет фраз
            </p>
            <div className="flex gap-2">
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded-[4px] border border-[var(--kc-blue)] text-[var(--kc-blue)] hover:bg-[var(--kc-blue)]/5 transition-colors cursor-pointer"
                onClick={() => { ctx.eventBus.emit('phrases:open-add-dialog') }}>
                <MIcon name="add" className="!text-[14px]" /> Добавить фразы
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded-[4px] border border-[var(--kc-border)] hover:border-[var(--kc-blue)] transition-colors cursor-pointer"
                onClick={() => ctx.eventBus.emit('import-export:open-import')}>
                <MIcon name="upload" className="!text-[14px]" /> Импорт
              </button>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td colSpan={numVisibleCols + 1}>
        <div className="flex flex-col items-center justify-center gap-4 py-16 px-8 text-center">
          <MIcon name="account_tree" className="!text-[48px] text-[var(--kc-text-disabled)]" />
          <div>
            <p className="text-[13px] text-[var(--kc-text-secondary)] font-medium">Выберите группу слева</p>
            <p className="text-[11px] text-[var(--kc-text-disabled)] mt-1">Или создайте новую группу в панели групп</p>
          </div>
        </div>
      </td>
    </tr>
  );
}