import React from 'react';
import type { Phrase, KCID } from 'plugin-sdk';
function MIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

interface MinusWordsPreviewProps {
  phrases: Phrase[];
  pendingRemoveIds: Set<KCID>;
  onToggleExclude: (id: KCID) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function MinusWordsPreview({ phrases, pendingRemoveIds, onToggleExclude, onCancel, onConfirm }: MinusWordsPreviewProps) {
  const removeCount = phrases.length - pendingRemoveIds.size;

  return (
    <div className="border-t border-[var(--kc-border)] flex flex-col shrink-0" style={{ maxHeight: '45%' }}>
      <div className="flex items-center gap-2 px-3 py-2 shrink-0 bg-[var(--kc-surface)]">
        <MIcon name="preview" className="!text-[13px] text-[var(--kc-blue)]" />
        <span className="text-[11px] font-semibold flex-1">
          Будет перемещено в корзину:
          <strong className="text-[var(--kc-red)] ml-1">{removeCount} фраз</strong>
          {pendingRemoveIds.size > 0 && (
            <span className="text-[var(--kc-text-secondary)] ml-1">
              (исключено: {pendingRemoveIds.size})
            </span>
          )}
        </span>
        <button className="tool-btn !w-5 !h-5" onClick={onCancel} title="Закрыть предпросмотр" aria-label="Закрыть предпросмотр">
          <MIcon name="close" className="!text-[12px]" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-2 py-1 space-y-0.5 compact-scroll">
        {phrases.length === 0 ? (
          <div className="text-[12px] text-[var(--kc-text-secondary)] text-center py-4">
            <MIcon name="check_circle" className="!text-[20px] text-[var(--kc-green)] block mx-auto mb-1" />
            Нет фраз, подходящих под минус-слова
          </div>
        ) : (
          phrases.map(p => {
            const isExcluded = pendingRemoveIds.has(p.id);
            return (
              <div key={p.id} className={`text-[11px] py-0.5 px-1.5 rounded flex items-center gap-1.5 ${isExcluded ? 'opacity-40 line-through' : 'hover:bg-[var(--kc-surface-hover)]'}`}>
                <button
                  className="shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-[var(--kc-border)]"
                  title={isExcluded ? 'Вернуть в список' : 'Исключить из удаления'}
                  onClick={() => onToggleExclude(p.id)}
                >
                  <MIcon name={isExcluded ? 'undo' : 'close'} className={`!text-[11px] ${isExcluded ? 'text-[var(--kc-text-secondary)]' : 'text-[var(--kc-red)]'}`} />
                </button>
                <span className="truncate">{p.text}</span>
              </div>
            );
          })
        )}
      </div>
      <div className="flex gap-2 px-3 py-2 shrink-0 border-t border-[var(--kc-border)]">
        <button
          className="flex-1 h-7 text-[12px] rounded border border-[var(--kc-border)] bg-[var(--kc-surface)] hover:bg-[var(--kc-surface-hover)] text-[var(--kc-text)]"
          onClick={onCancel}
        >
          Отмена
        </button>
        <button
          className="flex-1 h-7 text-[12px] rounded bg-[var(--kc-red)] text-white hover:opacity-90 disabled:opacity-40"
          disabled={removeCount === 0}
          onClick={onConfirm}
        >
          Переместить {removeCount} фраз
        </button>
      </div>
    </div>
  );
}
