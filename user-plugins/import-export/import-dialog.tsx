'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore, LogStore , AppEvents} from 'plugin-sdk';
import type { PluginContext, KCID } from 'plugin-sdk';
import { parseCSV, parseCSVStreaming } from './index';
import { Button, kcAlert, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Badge } from 'plugin-sdk';

function MIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export function ImportDialog({ open, onOpenChange, ctx }: { open: boolean; onOpenChange: (v: boolean) => void; ctx: PluginContext }) {
  const [rawData, setRawData] = useState<string[][] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<number, string>>({});
  const [targetGroupId, setTargetGroupId] = useState<KCID | null>(null);
  const [delimiter, setDelimiter] = useState<string>(',');
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [fileName, setFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<File | null>(null);
  const csvAbortRef = useRef<{ abort: () => void } | null>(null);

  useEffect(() => {
    if (open && !targetGroupId) {
      const activeId = useAppStore.getState().activeGroupId;
      if (activeId) setTargetGroupId(activeId);
    }
  }, [open]);

  const handleOpenChange = useCallback((v: boolean) => {
    if (!v) {
      csvAbortRef.current?.abort();
      csvAbortRef.current = null;
    }
    onOpenChange(v);
  }, [onOpenChange]);

  const allGroups = useAppStore(s => s.groups);
  const groups = React.useMemo(() => allGroups.filter(g => !g.isTrash), [allGroups]);

  const FIELDS = [
    { value: 'skip', label: '— Пропустить —' },
    { value: 'keyword', label: 'Ключевое слово (обязательное)' },
    { value: 'frequency', label: 'Частота' },
    { value: 'kei', label: 'KEI' },
    { value: 'cpc', label: 'CPC' },
    { value: 'competition', label: 'Конкуренция' },
    { value: 'group', label: 'Группа' },
    { value: 'notes', label: 'Заметки' },
  ];

  const parseFile = useCallback(async (file: File, delim: string) => {
    setFileName(file.name);
    setIsParsing(true);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'xlsx' || ext === 'xls') {
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (data.length > 0) {
          setHeaders(data[0].map((h: any) => String(h ?? '')));
          setRawData(data.slice(1));
          autoMapColumns(data[0].map((h: any) => String(h ?? '')));
        }
      } else {
        const text = await file.text();
        const effectiveDelim = ext === 'tsv' ? '\t' : delim;
        const data = parseCSV(text, effectiveDelim);
        if (data.length > 0) {
          setHeaders(data[0]);
          setRawData(data.slice(1));
          autoMapColumns(data[0]);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      LogStore._log('error', 'import-export', `File read failed: ${msg}`, { filename: fileName, error: msg });
      await kcAlert('Ошибка при чтении файла: ' + msg, { title: 'Ошибка' });
    } finally {
      setIsParsing(false);
    }
  }, []);

  // Re-parse when delimiter changes and a file is already loaded
  useEffect(() => {
    const file = fileRef.current;
    if (file && rawData) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'xlsx' && ext !== 'xls' && ext !== 'tsv') {
        parseFile(file, delimiter);
      }
    }
  }, [delimiter]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    fileRef.current = file;
    parseFile(file, delimiter);
  };

  const autoMapColumns = (headerRow: string[]) => {
    const mapping: Record<number, string> = {};
    headerRow.forEach((h, i) => {
      const lh = h.toLowerCase().trim();
      if (lh.includes('фраз') || lh.includes('keyword') || lh.includes('ключ') || lh.includes('запрос')) {
        mapping[i] = 'keyword';
      } else if (lh.includes('частот') || lh.includes('frequency') || lh.includes('freq')) {
        mapping[i] = 'frequency';
      } else if (lh.includes('kei') || lh.includes('кеи')) {
        mapping[i] = 'kei';
      } else if (lh.includes('cpc') || lh.includes('цена')) {
        mapping[i] = 'cpc';
      } else if (lh.includes('конкур') || lh.includes('compet')) {
        mapping[i] = 'competition';
      } else if (lh.includes('групп') || lh.includes('group')) {
        mapping[i] = 'group';
      } else if (lh.includes('замет') || lh.includes('note')) {
        mapping[i] = 'notes';
      } else {
        mapping[i] = 'skip';
      }
    });
    if (!Object.values(mapping).includes('keyword') && headerRow.length > 0) {
      mapping[0] = 'keyword';
    }
    setColumnMapping(mapping);
  };

  const handleImport = async () => {
    const file = fileRef.current;
    if (!file) {
      if (!rawData) return;
      await importFromRawData();
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    try {
      const store = useAppStore.getState();
      const keywordCol = Object.entries(columnMapping).find(([, v]) => v === 'keyword')?.[0];
      if (keywordCol === undefined) {
        await kcAlert('Укажите столбец с ключевыми словами!', { title: 'Ошибка импорта' });
        return;
      }

      let groupId = targetGroupId ?? store.activeGroupId;
      if (!groupId) {
        await kcAlert(
          'Выберите группу назначения в поле «Целевая группа» выше.',
          { title: 'Группа не выбрана' }
        );
        return;
      }

      const ext = file.name.split('.').pop()?.toLowerCase();
      const delim = ext === 'tsv' ? '\t' : delimiter;

      if (ext === 'xlsx' || ext === 'xls') {
        await importFromRawData(groupId);
        return;
      }

      const BATCH_SIZE = 1000;
      let batchTexts: string[] = [];
      let batchExtras: Record<string, any>[] = [];
      let rowCount = 0;

      const flushBatch = () => {
        if (batchTexts.length === 0) return;
        ctx.store.dispatch('addPhrases', { texts: batchTexts, groupId, extra: batchExtras });
        batchTexts = [];
        batchExtras = [];
      };

      csvAbortRef.current = null;
      await new Promise<void>((resolve, reject) => {
        const handle = parseCSVStreaming(
          file,
          delim,
          (row) => {
            const keyword = String(row[Number(keywordCol)] ?? '').trim();
            if (!keyword) return;

            batchTexts.push(keyword);
            const extra: Record<string, any> = {};
            for (const [colIdx, field] of Object.entries(columnMapping)) {
              if (field === 'keyword' || field === 'skip') continue;
              const val = String(row[Number(colIdx)] ?? '').trim();
              if (!val) continue;
              if (field === 'frequency' || field === 'kei' || field === 'cpc' || field === 'competition') {
                const num = parseFloat(val.replace(/[^\d.,]/g, '').replace(',', '.'));
                if (!isNaN(num)) extra[field] = num;
              } else if (field === 'notes') {
                extra.notes = val;
              }
            }
            batchExtras.push(extra);
            rowCount++;

            if (batchTexts.length >= BATCH_SIZE) {
              flushBatch();
              setImportProgress(rowCount);
            }
          },
          () => {
            csvAbortRef.current = null;
            flushBatch();
            resolve();
          },
          (err) => reject(err),
        );
        csvAbortRef.current = handle;
      });

      LogStore._log('info', 'import-export', `Import completed: ${rowCount} phrases`, { filename: fileName, count: rowCount });
      ctx.eventBus.emit(AppEvents.PHRASES_CHANGED);
      setImportProgress(0);
      setRawData(null);
      setHeaders([]);
      setColumnMapping({});
      setFileName('');
      fileRef.current = null;
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      LogStore._log('error', 'import-export', `Import failed: ${msg}`, { filename: fileName, error: msg });
      await kcAlert('Ошибка при импорте: ' + msg, { title: 'Ошибка импорта' });
    } finally {
      setIsImporting(false);
    }
  };

  const importFromRawData = async (overrideGroupId?: string) => {
    if (!rawData) return;
    setIsImporting(true);
    try {
      const store = useAppStore.getState();
      const keywordCol = Object.entries(columnMapping).find(([, v]) => v === 'keyword')?.[0];
      if (keywordCol === undefined) {
        await kcAlert('Укажите столбец с ключевыми словами!', { title: 'Ошибка импорта' });
        return;
      }
      let groupId = overrideGroupId ?? targetGroupId ?? store.activeGroupId;
      if (!groupId) {
        await kcAlert(
          'Выберите группу назначения в поле «Целевая группа» выше.',
          { title: 'Группа не выбрана' }
        );
        return;
      }
      const texts: string[] = [];
      const extras: Record<string, any>[] = [];
      for (const row of rawData) {
        const keyword = String(row[Number(keywordCol)] ?? '').trim();
        if (!keyword) continue;
        texts.push(keyword);
        const extra: Record<string, any> = {};
        for (const [colIdx, field] of Object.entries(columnMapping)) {
          if (field === 'keyword' || field === 'skip') continue;
          const val = String(row[Number(colIdx)] ?? '').trim();
          if (!val) continue;
          if (field === 'frequency' || field === 'kei' || field === 'cpc' || field === 'competition') {
            const num = parseFloat(val.replace(/[^\d.,]/g, '').replace(',', '.'));
            if (!isNaN(num)) extra[field] = num;
          } else if (field === 'notes') {
            extra.notes = val;
          }
        }
        extras.push(extra);
      }
      ctx.store.dispatch('addPhrases', { texts, groupId, extra: extras });
      LogStore._log('info', 'import-export', `Import completed (raw data): ${texts.length} phrases`);
      ctx.eventBus.emit(AppEvents.PHRASES_CHANGED);
      setRawData(null);
      setHeaders([]);
      setColumnMapping({});
      setFileName('');
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      LogStore._log('error', 'import-export', `Import (raw) failed: ${msg}`, { error: msg });
      await kcAlert('Ошибка при импорте: ' + msg, { title: 'Ошибка импорта' });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Импорт данных</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
          {isParsing ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <MIcon name="progress_activity" className="!text-[32px] text-[var(--kc-blue)] animate-spin" />
              <span className="text-[13px] text-[var(--kc-text-secondary)]">Чтение файла {fileName}...</span>
            </div>
          ) : !rawData ? (
            <div className="space-y-3">
              <div>
                <label htmlFor="import-file-input" className="text-[13px] font-medium mb-1 block">Выберите файл</label>
                <input
                  id="import-file-input"
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.tsv,.txt,.xlsx,.xls,.json"
                  onChange={handleFile}
                  className="block w-full text-[12px] file:mr-4 file:py-1.5 file:px-4 file:rounded-[3px] file:border-0 file:text-[12px] file:font-semibold file:bg-[var(--kc-blue)] file:text-white hover:file:bg-[var(--kc-blue-dark)]"
                />
                <p className="text-[11px] text-[var(--kc-text-secondary)] mt-1">
                  Поддерживаемые форматы: CSV, TSV, TXT, XLSX, XLS
                </p>
              </div>
              <div>
                <label className="text-[13px] font-medium mb-1 block">Разделитель (для CSV/TXT)</label>
                <select
                  className="w-full h-8 rounded-[3px] border border-[var(--kc-border)] bg-[var(--kc-surface)] px-3 text-[12px]"
                  value={delimiter}
                  onChange={e => setDelimiter(e.target.value)}
                >
                  <option value=",">Запятая (,)</option>
                  <option value="\t">Табуляция</option>
                  <option value=";">Точка с запятой (;)</option>
                </select>
              </div>
              <div>
                <label className="text-[13px] font-medium mb-1 block">Целевая группа</label>
                <select
                  className="w-full h-8 rounded-[3px] border border-[var(--kc-border)] bg-[var(--kc-surface)] px-3 text-[12px]"
                  value={targetGroupId ?? ''}
                  onChange={e => setTargetGroupId(e.target.value || null)}
                >
                  <option value="">— Выберите группу —</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium">Маппинг столбцов</span>
                <Badge variant="secondary">{rawData.length} строк</Badge>
              </div>

              <div className="space-y-2">
                {headers.map((header, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-[12px] w-24 truncate shrink-0 font-medium" title={header}>
                      {header || `Столбец ${idx + 1}`}
                    </span>
                    <Select
                      value={columnMapping[idx] ?? 'skip'}
                      onValueChange={v => setColumnMapping(prev => ({ ...prev, [idx]: v }))}
                    >
                      <SelectTrigger className="h-7 text-[12px] w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELDS.map(f => (
                          <SelectItem key={f.value} value={f.value} className="text-[12px]">
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div>
                <span className="text-[11px] font-medium text-[var(--kc-text-secondary)]">Предпросмотр (первые 5 строк)</span>
                <div className="mt-1 overflow-x-auto border border-[var(--kc-border)] rounded-[3px] text-[12px]">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[var(--kc-table-header)]">
                        {headers.map((h, i) => (
                          <th key={`${h}-${i}`} className="px-2 py-1 text-left font-medium truncate max-w-[150px]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rawData.slice(0, 5).map((row, ri) => (
                        <tr key={`preview-row-${ri}`} className="border-t border-[var(--kc-border-light)]">
                          {headers.map((_, ci) => (
                            <td key={`${ci}-${row[ci] ?? ''}`} className="px-2 py-1 truncate max-w-[150px]">{row[ci] ?? ''}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { csvAbortRef.current?.abort(); csvAbortRef.current = null; setRawData(null); setFileName(''); fileRef.current = null; onOpenChange(false); }} disabled={isImporting}>Отмена</Button>
          {rawData && (
            <Button onClick={handleImport} disabled={!Object.values(columnMapping).includes('keyword') || isImporting || (!targetGroupId && !groups.find(g => g.id === useAppStore.getState().activeGroupId))}
              style={{ backgroundColor: 'var(--kc-blue)', color: 'white' }}
            >
              {isImporting ? (
                <>
                  <MIcon name="progress_activity" className="!text-[14px] mr-1 animate-spin" />
                  {importProgress > 0 ? `${importProgress} строк...` : 'Импорт...'}
                </>
              ) : (
                <>
                  <MIcon name="upload" className="!text-[14px] mr-1" />
                  Импортировать
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
