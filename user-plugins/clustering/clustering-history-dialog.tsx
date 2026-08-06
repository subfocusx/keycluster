'use client';

import React, { useMemo } from 'react';
import { useAppStore , AppEvents} from 'plugin-sdk';
import type { PluginContext } from 'plugin-sdk';
import { clearHistory } from './clustering-history';
import type { ClusterHistoryEntry } from './clustering-history';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from 'plugin-sdk';

function MIcon({ name, className = '', style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}

function ClusterCompareView({ entry1, entry2, onClose }: { entry1: ClusterHistoryEntry; entry2: ClusterHistoryEntry; onClose: () => void }) {
  const diff = useMemo(() => {
    const map1 = new Map(entry1.phrases.map(p => [p.text, p.group]));
    const map2 = new Map(entry2.phrases.map(p => [p.text, p.group]));
    const allPhrases = new Set([...map1.keys(), ...map2.keys()]);
    const changed: Array<{ text: string; group1: string; group2: string }> = [];
    for (const text of allPhrases) {
      const g1 = map1.get(text) || '';
      const g2 = map2.get(text) || '';
      if (g1 !== g2) changed.push({ text, group1: g1, group2: g2 });
    }
    return { total: allPhrases.size, changed };
  }, [entry1, entry2]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px]">
          <span className="font-medium text-[var(--accent-blue)]">{diff.changed.length}</span>
          <span className="text-[var(--text-secondary)]"> / {diff.total} фраз изменили группу</span>
        </div>
        <button className="text-[10px] text-[var(--text-secondary)] hover:underline cursor-pointer" onClick={onClose}>Назад</button>
      </div>
      <div className="space-y-1 max-h-[300px] overflow-y-auto compact-scroll">
        {diff.changed.length === 0 ? (
          <div className="text-[11px] text-[var(--text-secondary)] text-center py-4">Результаты совпадают</div>
        ) : (
          diff.changed.slice(0, 100).map(({ text, group1, group2 }) => (
            <div key={text} className="flex items-start gap-2 text-[10px] border-b border-[var(--border-light)] py-1">
              <span className="flex-1 truncate min-w-0">{text}</span>
              <span className="shrink-0 text-[var(--text-disabled)] line-through decoration-[var(--accent-red)]">{group1 || '—'}</span>
              <MIcon name="arrow_forward" className="!text-[10px] text-[var(--accent-blue)] shrink-0" />
              <span className="shrink-0 text-[var(--accent-green)]">{group2 || '—'}</span>
            </div>
          ))
        )}
        {diff.changed.length > 100 && (
          <div className="text-[10px] text-[var(--text-disabled)] text-center pt-1">... и ещё {diff.changed.length - 100}</div>
        )}
      </div>
    </div>
  );
}

export function HistoryDialog({
  open,
  onOpenChange,
  history,
  ctx,
  compareEntry,
  setCompareEntry,
  compareEntry2,
  setCompareEntry2,
  showCompare,
  setShowCompare,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  history: ClusterHistoryEntry[];
  ctx: PluginContext;
  compareEntry: ClusterHistoryEntry | null;
  setCompareEntry: (v: ClusterHistoryEntry | null) => void;
  compareEntry2: ClusterHistoryEntry | null;
  setCompareEntry2: (v: ClusterHistoryEntry | null) => void;
  showCompare: boolean;
  setShowCompare: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setCompareEntry(null); setCompareEntry2(null); setShowCompare(false); } }}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col overflow-hidden !p-0 !gap-0">
        <DialogHeader className="px-4 pt-4 pb-2 shrink-0 border-b border-[var(--kc-border-light)] min-w-0">
          <DialogTitle className="flex items-center gap-2 text-[14px]">
            <MIcon name="history" className="!text-[18px] text-[var(--accent-blue)] shrink-0" />
            История кластеризации
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto compact-scroll p-4">
          {history.length === 0 ? (
            <div className="text-[12px] text-[var(--text-secondary)] text-center py-8">Нет записей</div>
          ) : (
            <div className="space-y-2">
              {showCompare && compareEntry && compareEntry2 ? (
                <ClusterCompareView entry1={compareEntry} entry2={compareEntry2} onClose={() => { setShowCompare(false); setCompareEntry(null); setCompareEntry2(null); }} />
              ) : (
                history.map(entry => (
                  <div key={entry.id} className="flex items-center justify-between border border-[var(--border)] rounded-[4px] px-3 py-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium">{entry.algorithm === 'words' ? 'По словам' : 'Жаккар'}</span>
                        <span className="text-[10px] text-[var(--text-secondary)]">{new Date(entry.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                        {entry.groupCount} групп, {entry.totalPhrases} фраз, сила {entry.strength}%
                        {entry.durationMs > 0 && `, ${(entry.durationMs / 1000).toFixed(1)}с`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        className="tool-btn !w-6 !h-6"
                        title="Сравнить"
                        onClick={() => {
                          if (!compareEntry) { setCompareEntry(entry); } else { setCompareEntry2(entry); setShowCompare(true); }
                        }}
                      >
                        <MIcon name="compare_arrows" className="!text-[12px]" />
                      </button>
                      <button
                        className="tool-btn !w-6 !h-6"
                        title="Применить результаты"
                        onClick={() => {
                          const groups: Map<string, any[]> = new Map();
                          for (const g of entry.groups) {
                            const phrases = entry.phrases.filter(p => p.group === g.name).map(p => ({ text: p.text }));
                            groups.set(g.name, phrases);
                          }
                          ctx.store.dispatch('setClusteringResults', groups);
                          if (groups.size > 0) {
                            ctx.store.dispatch('applyClusteringResults');
                            ctx.eventBus.emit(AppEvents.GROUPS_CHANGED);
                            ctx.eventBus.emit(AppEvents.PHRASES_CHANGED);
                          }
                          onOpenChange(false);
                        }}
                      >
                        <MIcon name="play_arrow" className="!text-[12px]" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <div className="px-4 py-3 border-t border-[var(--kc-border-light)] flex justify-between">
          <button className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--accent-red)] transition-colors cursor-pointer"
            onClick={() => { clearHistory(); onOpenChange(false); }}>
            Очистить историю
          </button>
          {compareEntry && !showCompare && (
            <span className="text-[10px] text-[var(--text-secondary)]">Выберите второй запуск для сравнения</span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}