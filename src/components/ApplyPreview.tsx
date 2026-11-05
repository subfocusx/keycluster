// ============================================================
// KeyCluster — ApplyPreview
//
// Единый переиспользуемый шаблон «предпросмотр перед применением»
// для разрушающих операций (удаление дублей, неявных дублей,
// удаление по минус-словам и т.п.).
//
// Компонент показывает:
//   • заголовок операции;
//   • сводку «что изменится» (счётчики);
//   • список примеров с подсветкой того, что будет удалено/изменено;
//   • две кнопки — «Применить» и «Отмена».
//
// Использование:
//   <ApplyPreview
//     title="Предпросмотр дедупликации"
//     counters={[{ label: 'Будет удалено', value: 12 }]}
//     items={[{ id: p.id, text: p.text, type: 'remove' }]}
//     onApply={handleApply}
//     onCancel={handleCancel}
//   />
// ============================================================

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { MIcon } from '@/shell/shared-icon';

/** Тип изменения, показываемого в строке предпросмотра. */
export type ApplyPreviewChangeType = 'remove' | 'replace' | 'update';

/** Одна строка предпросмотра — пример того, что изменится. */
export interface ApplyPreviewItem {
  /** Ключ строки (обычно id фразы). */
  id?: string;
  /** Текст, который будет удалён или изменён. */
  text: string;
  /** Тип изменения. По умолчанию — 'remove'. */
  type?: ApplyPreviewChangeType;
  /** Новое значение (для type='replace'). */
  replacement?: string;
  /** Дополнительная поясняющая подпись (например, «останется: …»). */
  note?: string;
}

/** Счётчик в сводке «что изменится». */
export interface ApplyPreviewCounter {
  label: string;
  value: number | string;
}

export interface ApplyPreviewProps {
  /** Заголовок предпросмотра. */
  title: string;
  /** Дополнительный текст сводки под заголовком. */
  summary?: React.ReactNode;
  /** Счётчики сводки (сколько фраз/групп затронуто). */
  counters?: ApplyPreviewCounter[];
  /** Список примеров изменений. */
  items: ApplyPreviewItem[];
  /** Всего изменений (если список примеров усечён). */
  totalCount?: number;
  /** Текст кнопки применения. */
  applyLabel?: string;
  /** Текст кнопки отмены. */
  cancelLabel?: string;
  /** Состояние выполнения — блокирует кнопки. */
  busy?: boolean;
  /** Текст, если список изменений пуст. */
  emptyMessage?: string;
  /** Максимальная высота списка примеров. */
  maxHeight?: number | string;
  /** Дополнительные классы контейнера. */
  className?: string;
  /** Обработчик применения изменений. */
  onApply: () => void;
  /** Обработчик отмены. */
  onCancel: () => void;
}

const CHANGE_META: Record<ApplyPreviewChangeType, { icon: string; label: string }> = {
  remove: { icon: 'delete', label: 'Удаление' },
  replace: { icon: 'swap_horiz', label: 'Замена' },
  update: { icon: 'edit', label: 'Изменение' },
};

export function ApplyPreview({
  title,
  summary,
  counters,
  items,
  totalCount,
  applyLabel = 'Применить',
  cancelLabel = 'Отмена',
  busy = false,
  emptyMessage = 'Нет изменений для применения',
  maxHeight = '40vh',
  className = '',
  onApply,
  onCancel,
}: ApplyPreviewProps) {
  const shown = items.length;
  const total = totalCount ?? shown;
  const isEmpty = shown === 0;

  return (
    <div
      role="region"
      aria-label={title}
      data-testid="apply-preview"
      className={`border border-[var(--kc-border)] rounded-lg bg-[var(--kc-surface)] flex flex-col overflow-hidden ${className}`}
    >
      {/* ---- Шапка: заголовок + сводка ---- */}
      <div className="flex items-start gap-2 px-3 py-2 shrink-0 border-b border-[var(--kc-border-light)] bg-[var(--kc-surface)]">
        <MIcon name="preview" className="!text-[15px] text-[var(--kc-blue)] mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-[var(--kc-text)]">{title}</div>
          {summary && (
            <div className="text-[11px] text-[var(--kc-text-secondary)] mt-0.5">{summary}</div>
          )}
          {counters && counters.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {counters.map((c, i) => (
                <span
                  key={`${c.label}-${i}`}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--kc-border)] bg-[var(--kc-surface-alt)] text-[var(--kc-text-secondary)]"
                >
                  {c.label}: <strong className="text-[var(--kc-text)]">{c.value}</strong>
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          className="shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--kc-surface-hover)] text-[var(--kc-text-secondary)]"
          onClick={onCancel}
          title="Закрыть предпросмотр"
          aria-label="Закрыть предпросмотр"
        >
          <MIcon name="close" className="!text-[12px]" />
        </button>
      </div>

      {/* ---- Список примеров ---- */}
      <div
        className="flex-1 overflow-y-auto min-h-0 px-2 py-1 space-y-0.5 compact-scroll"
        style={{ maxHeight }}
      >
        {isEmpty ? (
          <div className="text-[11px] text-[var(--kc-text-secondary)] text-center py-4 flex flex-col items-center gap-1">
            <MIcon name="check_circle" className="!text-[20px] text-[var(--kc-green)]" />
            {emptyMessage}
          </div>
        ) : (
          items.map((item, index) => {
            const type: ApplyPreviewChangeType = item.type ?? 'remove';
            const meta = CHANGE_META[type];
            return (
              <div
                key={item.id ?? `${type}-${index}`}
                className="text-[11px] py-0.5 px-1.5 rounded flex items-start gap-1.5 hover:bg-[var(--kc-surface-hover)]"
                data-testid="apply-preview-item"
              >
                <MIcon
                  name={meta.icon}
                  className={`!text-[12px] mt-[1px] shrink-0 ${
                    type === 'remove'
                      ? 'text-[var(--kc-red)]'
                      : type === 'replace'
                        ? 'text-[var(--kc-orange)]'
                        : 'text-[var(--kc-blue)]'
                  }`}
                />
                <span className="flex-1 min-w-0 break-words">
                  {type === 'remove' ? (
                    <span className="bg-[var(--kc-red-light)] text-[var(--kc-red)] line-through rounded px-0.5">
                      {item.text}
                    </span>
                  ) : type === 'replace' ? (
                    <>
                      <span className="bg-[var(--kc-red-light)] text-[var(--kc-red)] line-through rounded px-0.5">
                        {item.text}
                      </span>
                      <span className="mx-1 text-[var(--kc-text-secondary)]">→</span>
                      <span className="bg-[var(--kc-green-light)] text-[var(--kc-green)] rounded px-0.5">
                        {item.replacement ?? ''}
                      </span>
                    </>
                  ) : (
                    <span className="bg-[var(--kc-blue-light)] text-[var(--kc-text)] rounded px-0.5">
                      {item.text}
                    </span>
                  )}
                  {item.note && (
                    <span className="ml-1.5 text-[10px] text-[var(--kc-text-secondary)]">
                      {item.note}
                    </span>
                  )}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* ---- Подвал: «Отмена» / «Применить» ---- */}
      <div className="flex items-center gap-2 px-3 py-2 shrink-0 border-t border-[var(--kc-border-light)]">
        <span className="flex-1 text-[10px] text-[var(--kc-text-disabled)]">
          {isEmpty
            ? 'Нет изменений'
            : total > shown
              ? `Показано ${shown} из ${total}`
              : `Всего: ${total}`}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[11px] px-3"
          onClick={onCancel}
          disabled={busy}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-7 text-[11px] px-3"
          style={{ backgroundColor: 'var(--kc-red)', color: 'white' }}
          onClick={onApply}
          disabled={busy || isEmpty}
        >
          {busy ? 'Применение...' : applyLabel}
        </Button>
      </div>
    </div>
  );
}

export default ApplyPreview;
