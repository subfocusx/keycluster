'use client';

import React from 'react';
import type { Phrase } from 'plugin-sdk';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from 'plugin-sdk';

function MIcon({ name, className = '', style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}

export function PreviewDialog({
  open,
  onOpenChange,
  previewResults,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  previewResults: Map<string, Phrase[]> | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] flex flex-col overflow-hidden !p-0 !gap-0">
        <DialogHeader className="px-4 pt-4 pb-2 shrink-0 border-b border-[var(--kc-border-light)] min-w-0">
          <DialogTitle className="flex items-center gap-2 text-[14px]">
            <MIcon name="visibility" className="!text-[18px] text-[var(--accent-blue)] shrink-0" />
            Предпросмотр кластеризации
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto compact-scroll p-4">
          {!previewResults || previewResults.size === 0 ? (
            <div className="text-[12px] text-[var(--text-secondary)] text-center py-8">
              Нет кластеров. Попробуйте изменить настройки.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-[11px] text-[var(--text-secondary)]">
                Показано на первых 500 фразах · {previewResults.size} кластеров
              </div>
              {Array.from(previewResults.entries()).map(([name, phrases]) => (
                <div key={name} className="border border-[var(--border)] rounded-[4px] overflow-hidden">
                  <div className="flex items-center justify-between px-2 py-1 bg-[var(--bg-panel)] text-[11px] font-medium">
                    <span className="truncate">{name}</span>
                    <span className="text-[var(--text-secondary)] font-mono ml-2">{phrases.length}</span>
                  </div>
                  <div className="px-2 py-1 max-h-[120px] overflow-y-auto compact-scroll">
                    {phrases.slice(0, 10).map(p => (
                      <div key={p.id} className="text-[10px] text-[var(--text-secondary)] truncate py-0.5">{p.text}</div>
                    ))}
                    {phrases.length > 10 && (
                      <div className="text-[10px] text-[var(--text-disabled)] pt-0.5">... ещё {phrases.length - 10} фраз</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}