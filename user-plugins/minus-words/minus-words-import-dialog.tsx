import React from 'react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from 'plugin-sdk';

function MIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

interface ImportPreview {
  words: string[];
  duplicates: number;
  empty: number;
}

interface MinusWordsImportDialogProps {
  open: boolean;
  text: string;
  preview: ImportPreview | null;
  onOpenChange: (open: boolean) => void;
  onTextChange: (text: string) => void;
  onParse: () => void;
  onImportTxt: () => void;
  onConfirm: () => void;
}

export function MinusWordsImportDialog({ open, text, preview, onOpenChange, onTextChange, onParse, onImportTxt, onConfirm }: MinusWordsImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Импорт минус-фраз</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={onImportTxt}>
              <MIcon name="file_upload" className="!text-[12px]" /> Загрузить .txt
            </Button>
            <span className="text-[10px] text-[var(--kc-text-secondary)]">или вставьте текст ниже</span>
          </div>
          <textarea
            className="w-full min-h-[120px] flex-1 rounded-[3px] border border-[var(--kc-border)] bg-[var(--kc-surface)] px-2 py-1.5 text-[12px] resize-y focus:outline-none focus:ring-1 focus:ring-[var(--kc-blue)] focus:border-[var(--kc-blue)]"
            value={text}
            onChange={(e) => { onTextChange(e.target.value); }}
            placeholder={"минус-слово1\nминус-слово2, минус-слово3\nслово4;\tслово5"}
          />
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-7 text-[11px] px-3" onClick={onParse} disabled={!text.trim()}>
              <MIcon name="preview" className="!text-[14px] mr-1" /> Предпросмотр
            </Button>
            {preview && (
              <div className="flex items-center gap-3 text-[10px] text-[var(--kc-text-secondary)]">
                <span className="text-[var(--kc-blue)] font-semibold">{preview.words.length} новых</span>
                {preview.duplicates > 0 && <span className="text-[var(--kc-yellow)]">{preview.duplicates} дубликатов</span>}
                {preview.empty > 0 && <span className="text-[var(--kc-text-dimmed)]">{preview.empty} пропущено</span>}
              </div>
            )}
          </div>
          {preview && preview.words.length > 0 && (
            <div className="border border-[var(--kc-border)] rounded-[3px] overflow-y-auto max-h-[150px] compact-scroll p-1">
              {preview.words.slice(0, 100).map((w, i) => (
                <div key={`${w}-${i}`} className="text-[11px] py-0.5 px-1 truncate">{w}</div>
              ))}
              {preview.words.length > 100 && (
                <div className="text-[10px] text-[var(--kc-text-disabled)] px-1 py-0.5">... и ещё {preview.words.length - 100}</div>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={onConfirm} disabled={!preview || preview.words.length === 0}>
            Добавить {preview?.words.length ?? 0}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
