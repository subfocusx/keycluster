'use client';

import type { PluginContext } from 'plugin-sdk';
import React, { useState } from 'react';
import { useAppStore } from 'plugin-sdk';
import { LogStore } from 'plugin-sdk';
import { EXPORT_TEMPLATES } from './export-templates';
import { getAllExportFormats } from 'plugin-sdk';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'plugin-sdk';
import { importExportSettings } from './index';

function MIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export function ExportDialog({ open, onOpenChange, ctx }: { open: boolean; onOpenChange: (v: boolean) => void; ctx: PluginContext }) {
  const [formatId, setFormatId] = useState<string>(importExportSettings.defaultFormat);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('__all__');
  const [templateId, setTemplateId] = useState(EXPORT_TEMPLATES[0].id);
  const [isExporting, setIsExporting] = useState(false);
  const phrases = useAppStore(s => s.phrases);
  const groups = useAppStore(s => s.groups);
  const minusWords = useAppStore(s => s.minusWords);

  const formats = React.useMemo(() => getAllExportFormats(), []);
  const currentFormat = formats.find(f => f.id === formatId) ?? formats[0];
  const template = EXPORT_TEMPLATES.find(t => t.id === templateId) ?? EXPORT_TEMPLATES[0];
  const allGroups = React.useMemo(() => groups.filter(g => !g.isTrash), [groups]);

  const trashIds = React.useMemo(() => new Set(groups.filter(g => g.isTrash).map(g => g.id)), [groups]);

  const data = selectedGroupId === '__all__'
    ? phrases.filter(p => !trashIds.has(p.groupId))
    : phrases.filter(p => p.groupId === selectedGroupId);

  const exportCount = template.exportMinusWords ? minusWords.length : data.length;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeTextFile, writeFile } = await import('@tauri-apps/plugin-fs');

      if (!currentFormat) return;

      const defaultName = `keycluster-export.${currentFormat.extension}`;
      const filePath = await save({
        filters: [currentFormat.fileFilter],
        defaultPath: defaultName,
      });
      if (!filePath) return;

      const content = await currentFormat.serialize({
        phrases: data,
        groups,
        minusWords,
        columns: template.columns,
        includeHeader: template.includeHeader,
        exportMinusWords: template.exportMinusWords,
      });

      if (typeof content === 'string') {
        await writeTextFile(filePath, content);
      } else {
        await writeFile(filePath, content);
      }

      LogStore._log('info', 'import-export', `Export completed: ${filePath} (${exportCount} rows)`);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      LogStore._log('error', 'import-export', `Export failed: ${msg}`, { error: msg });
    } finally {
      setIsExporting(false);
    }
  };

  const selectedGroupLabel = selectedGroupId === '__all__'
    ? 'все группы'
    : (allGroups.find(g => g.id === selectedGroupId)?.name ?? '—');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Экспорт данных</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[13px] font-medium mb-1 block">Шаблон</label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger className="w-full h-8 rounded-[3px] border border-[var(--kc-border)] bg-[var(--kc-surface)] px-3 text-[12px]" aria-label="Шаблон экспорта">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPORT_TEMPLATES.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-[var(--kc-text-secondary)] mt-1">{template.description}</p>
          </div>

          <div>
            <label className="text-[13px] font-medium mb-1 block">Формат</label>
            <Select value={formatId} onValueChange={setFormatId}>
              <SelectTrigger className="w-full h-8 rounded-[3px] border border-[var(--kc-border)] bg-[var(--kc-surface)] px-3 text-[12px]" aria-label="Формат экспорта">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {formats.map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!template.exportMinusWords && (
            <div>
              <label className="text-[13px] font-medium mb-1 block">Группа</label>
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger className="w-full h-8 rounded-[3px] border border-[var(--kc-border)] bg-[var(--kc-surface)] px-3 text-[12px]" aria-label="Группа для экспорта">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">— Все группы —</SelectItem>
                  {allGroups.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <p className="text-[11px] text-[var(--kc-text-secondary)]">
            {template.exportMinusWords
              ? `Экспорт минус-фраз: ${exportCount}`
              : `Экспорт ${selectedGroupLabel}: ${exportCount} фраз`}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={handleExport} disabled={exportCount === 0 || isExporting}
            style={{ backgroundColor: 'var(--kc-blue)', color: 'white' }}
          >
            {isExporting ? (
              <>
                <MIcon name="progress_activity" className="!text-[14px] mr-1 animate-spin" />
                Экспорт...
              </>
            ) : (
              <>
                <MIcon name="download" className="!text-[14px] mr-1" /> Экспорт
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}