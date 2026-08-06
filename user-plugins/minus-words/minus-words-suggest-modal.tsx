import React from 'react';
import { Checkbox } from 'plugin-sdk';
import type { MinusWordResult } from 'plugin-sdk';
function MIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

interface MinusWordsSuggestModalProps {
  results: MinusWordResult[];
  isWordAdded: (word: string) => boolean;
  onAddWord: (word: string) => void;
  onAddAll: () => void;
  onClose: () => void;
}

export function MinusWordsSuggestModal({ results, isWordAdded, onAddWord, onAddAll, onClose }: MinusWordsSuggestModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="w-[450px] max-h-[70vh] flex flex-col rounded-[6px] shadow-lg border" style={{ backgroundColor: 'var(--kc-surface)', borderColor: 'var(--kc-border)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-3 py-2 border-b shrink-0" style={{ borderColor: 'var(--kc-border-light)' }}>
          <span className="text-[12px] font-semibold">Подобранные минус-слова</span>
          <button className="tool-btn !w-5 !h-5" onClick={onClose}>
            <MIcon name="close" className="!text-[12px]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto compact-scroll p-2 space-y-0.5">
          {results.map((r, i) => {
            const exists = isWordAdded(r.word);
            return (
              <div key={`${r.word}-${i}`} className="flex items-center gap-2 py-1 px-2 rounded-[2px] hover:bg-[var(--kc-surface-hover)] text-[12px]">
                <Checkbox
                  checked={!exists}
                  disabled={exists}
                  onCheckedChange={() => onAddWord(r.word)}
                />
                <span className={`flex-1 truncate ${exists ? 'text-[var(--kc-text-disabled)] line-through' : ''}`}>{r.word}</span>
                <span className="text-[9px] px-1 rounded" style={{ backgroundColor: r.source === 'dictionary' ? 'var(--kc-blue-light)' : 'var(--kc-surface-hover)' }}>
                  {r.source}
                </span>
                <span className="text-[10px] text-[var(--kc-text-secondary)]">{(r.confidence * 100).toFixed(0)}%</span>
                <button
                  className="tool-btn !w-5 !h-5"
                  disabled={exists}
                  onClick={() => onAddWord(r.word)}
                  title={exists ? 'Уже добавлено' : 'Добавить'}
                >
                  <MIcon name="add_circle" className="!text-[13px]" />
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 px-3 py-2 border-t shrink-0" style={{ borderColor: 'var(--kc-border-light)' }}>
          <button className="flex-1 h-7 text-[11px] rounded border border-[var(--kc-border)] bg-transparent hover:bg-[var(--kc-surface-hover)]" onClick={onClose}>
            Закрыть
          </button>
          <button className="flex-1 h-7 text-[11px] rounded text-white" style={{ backgroundColor: 'var(--kc-blue)' }} onClick={onAddAll}>
            Добавить все ({results.length})
          </button>
        </div>
      </div>
    </div>
  );
}
