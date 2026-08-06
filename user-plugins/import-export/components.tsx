import type { PluginContext } from 'plugin-sdk';
import React, { useState } from 'react';
import { Button, ScrollArea } from 'plugin-sdk';
import { ProjectButtons } from './project-buttons';
import { ImportDialog } from './import-dialog';
import { ExportDialog } from './export-dialog';

function MIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export function ImportExportRibbonButtons({ ctx }: { ctx: PluginContext }) {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  return (
    <>
      <button className="ribbon-btn" title="Импорт данных (системный элемент — нельзя переместить)" onClick={() => setShowImportDialog(true)}>
        <MIcon name="upload" className="ribbon-icon" />
        <span className="ribbon-label">Импорт</span>
      </button>
      <button className="ribbon-btn" title="Экспорт данных (системный элемент — нельзя переместить)" onClick={() => setShowExportDialog(true)}>
        <MIcon name="download" className="ribbon-icon" />
        <span className="ribbon-label">Экспорт</span>
      </button>
      <ImportDialog open={showImportDialog} onOpenChange={setShowImportDialog} ctx={ctx} />
      <ExportDialog open={showExportDialog} onOpenChange={setShowExportDialog} ctx={ctx} />
    </>
  );
}

export function ImportExportPanel({ ctx }: { ctx: PluginContext }) {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  return (
    <div className="h-full overflow-hidden">
      <ScrollArea className="h-full">
        <div className="p-3 space-y-2">
          <Button variant="outline" className="w-full justify-start text-[12px]" onClick={() => setShowImportDialog(true)}>
            <MIcon name="upload" className="!text-[16px] mr-2" /> Импорт из файла
          </Button>
          <Button variant="outline" className="w-full justify-start text-[12px]" onClick={() => setShowExportDialog(true)}>
            <MIcon name="download" className="!text-[16px] mr-2" /> Экспорт в файл
          </Button>
          <ProjectButtons ctx={ctx} />
        </div>
      </ScrollArea>
      <ImportDialog open={showImportDialog} onOpenChange={setShowImportDialog} ctx={ctx} />
      <ExportDialog open={showExportDialog} onOpenChange={setShowExportDialog} ctx={ctx} />
    </div>
  );
}