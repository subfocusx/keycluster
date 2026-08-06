'use client';

import React, { useState } from 'react';
import type { PluginContext } from '@/plugin-sdk';
import { AddPhrasesDialog } from './AddPhrasesDialog';
import { MIcon } from '@/shell/shared-icon';
export { AddPhrasesDialog } from './AddPhrasesDialog';
export { PhrasesTable } from './PhrasesTable';
export type { ColumnFilter, ColumnFilters } from './shared';

// ---- Ribbon Buttons ----

export function PhrasesRibbonButtons({ ctx }: { ctx: PluginContext }) {
  const [showAddDialog, setShowAddDialog] = useState(false);

  return (
    <>
      <button
        className="ribbon-btn"
        title="Добавить фразы (системный элемент — нельзя переместить)"
        onClick={() => setShowAddDialog(true)}
      >
        <MIcon name="playlist_add" className="ribbon-icon" />
        <span className="ribbon-label">Фразы</span>
      </button>
      <AddPhrasesDialog open={showAddDialog} onOpenChange={setShowAddDialog} ctx={ctx} />
    </>
  );
}