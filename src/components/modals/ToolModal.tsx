import type { ModuleUIContribution } from '@/plugin-sdk';
// ============================================================
// ToolModal — Модальное окно для инструментов (7 builtin + plugin)
// Extracted from PanelManager.tsx (shell decomposition)
// ============================================================

'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { getRuntime } from '@/plugin-sdk';
import { pluginRegistry } from '@/plugin-sdk';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { ModuleErrorBoundary } from '@/components/ModuleErrorBoundary';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// ---- Icon helper ----

function MIcon({ name, className = '', style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}

// ---- Help texts for each module ----

const MODULE_HELP: Record<string, string> = {
  'group-analysis': 'Группировка фраз по отдельным словам (как в Key Collector). Каждая группа — это все фразы, содержащие данное значимое слово. Одна фраза может попасть в несколько групп, если содержит несколько значимых слов. Стоп-слова (предлоги, союзы) исключаются. После анализа нажмите «Создать структуру», чтобы перенести группы в проект.',
  'clustering': 'Автоматическое группирование ключевых фраз по смысловому сходству. Алгоритм «По словам» объединяет фразы с общими словами — чем выше сила, тем больше общих слов требуется. Алгоритм «Жаккар» сравнивает состав фраз по коэффициенту Жаккара и работает в фоновом потоке, не блокируя интерфейс. Поддерживается предобработка: лемматизация, игнорирование чисел, синонимы, стоп-слова. Режим сканирования определяет порядок обхода фраз. Разбивка по силе отделяет слабо связанные фразы в отдельные кластеры. После кластеризации можно создать структуру групп одним нажатием.',
  'minus-words': 'Управление минус-фразами — словами и выражениями, по которым фразы будут исключены из проекта. Каждая минус-фраза может быть привязана к конкретной группе (свой список группы) или быть глобальной. Главная папка «Все минус-фразы» собирает их со всех групп. Когда выбрана группа, список показывает только её минус-фразы и глобальные, а кнопка «Применить» исключает фразы в пределах этой группы. В дереве групп иконка со счётчиком рядом с группой открывает её список минус-фраз. Минус-фразы могут быть точными (полное совпадение) или широкими (вхождение подстроки).',
  'cross-search': 'Поиск фраз, которые встречаются одновременно в нескольких группах. Позволяет выявить дубликаты и уникальные фразы. Для каждой фразы показывается, в каких группах она встречается.',
  'find-replace': 'Поиск и замена текста в ключевых фразах. Поддерживает регулярные выражения для сложных шаблонов, учёт регистра и поиск по целым словам. Перед заменой показывается предпросмотр всех изменений, чтобы избежать ошибок.',
  'ngrams': 'Группировка фраз по N-граммам (биграммам, триграммам). Фразы с одинаковыми последовательностями слов объединяются. Учитывает порядок слов.',
  'tfidf': 'Группировка по TF-IDF + косинусной мере. Редкие и важные слова получают больший вес, частые — штрафуются. Более умная альтернатива Жаккару.',
  'implicit-duplicates': 'Поиск неявных дублей — фраз, которые не совпадают точно, но являются вариациями одной и той же фразы: перестановки слов ("купить телефон" ≈ "телефон купить"), морфологические формы ("ремонт квартир" ≈ "ремонт квартиры"), опечатки, лишние или недостающие стоп-слова. Алгоритм использует комбинированную метрику (Жаккар + Дайс + Левенштейн + перестановки) и группирует дубли через Union-Find. Можно настроить порог схожести и выбрать стратегию: игнорировать стоп-слова, учитывать порядок слов, оставлять фразу с большей частотностью.',
};

// ---- Tool Modal (for clustering, minus-words, cross-search, find-replace, ngrams, tfidf) ----

export function ToolModal({
  open,
  onOpenChange,
  title,
  icon,
  moduleId,
  ctx,
  PanelComponent,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  icon: string;
  moduleId: string;
  ctx: any;
  PanelComponent: React.ComponentType<{ ctx: any }>;
}) {
  const helpText = MODULE_HELP[moduleId];
  const [size, setSize] = useState({ width: 700, height: 600 });
  const widthRef = useRef(size.width);
  const heightRef = useRef(size.height);
  widthRef.current = size.width;
  heightRef.current = size.height;
  const mouseMoveRef = useRef<((e: MouseEvent) => void) | null>(null);
  const mouseUpRef = useRef<((e: MouseEvent) => void) | null>(null);

  useEffect(() => {
    return () => {
      if (mouseMoveRef.current) document.removeEventListener('mousemove', mouseMoveRef.current);
      if (mouseUpRef.current) document.removeEventListener('mouseup', mouseUpRef.current);
    };
  }, []);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = widthRef.current;
    const startHeight = heightRef.current;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.min(Math.max(startWidth + moveEvent.clientX - startX, 400), window.innerWidth - 40);
      const newHeight = Math.min(Math.max(startHeight + moveEvent.clientY - startY, 300), window.innerHeight - 40);
      setSize({ width: newWidth, height: newHeight });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      mouseMoveRef.current = null;
      mouseUpRef.current = null;
    };

    mouseMoveRef.current = onMouseMove;
    mouseUpRef.current = onMouseUp;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="kc-dialog-content flex flex-col overflow-auto !p-0 !gap-0"
        style={{ width: size.width, height: size.height, maxWidth: 'calc(100vw - 2rem)', maxHeight: 'calc(100vh - 2rem)' }}
      >
        <DialogHeader className="flex flex-row items-center gap-2 px-4 pr-10 pt-4 pb-2 shrink-0 border-b border-[var(--border)] min-w-0">
          <MIcon name={icon} className="!text-[16px] text-[var(--accent-blue)] shrink-0" />
          <DialogTitle className="text-[14px] font-bold truncate flex-1">{title}</DialogTitle>
          {helpText && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] cursor-pointer shrink-0"
                  title="Справка"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[11px] font-bold leading-none">?</span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="right"
                align="start"
                className="max-w-[320px] text-[12px] leading-[16px] p-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                    <MIcon name={icon} className="!text-[14px] text-[var(--accent-blue)]" />
                    {title}
                  </div>
                  <p className="text-[var(--text-secondary)]">{helpText}</p>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </DialogHeader>
        <div className="flex-1 overflow-auto min-h-0 min-w-0">
          <PanelComponent ctx={ctx} />
        </div>
        <div
          className="absolute bottom-0 right-0 w-[10px] h-[10px] cursor-nwse-resize z-50 opacity-40 hover:opacity-100"
          style={{
            borderRight: '2px solid var(--text-secondary)',
            borderBottom: '2px solid var(--text-secondary)',
          }}
          onMouseDown={handleResizeMouseDown}
        />
      </DialogContent>
    </Dialog>
  );
}

// ---- Plugin Tool Modal (dynamic from slot registry) ----

export function PluginToolModal({ activeTool, onClose }: { activeTool: string | null; onClose: () => void }) {
  const [contributions, setContributions] = useState<ModuleUIContribution[]>([]);

  useEffect(() => {
    const update = () => {
      const rt = getRuntime();
      if (!rt) return;
      const all = rt.getUIContributions('ribbon:tools');
      const userOnly = all.filter(c => {
        if (!c.moduleId) return false;
        const record = pluginRegistry.get(c.moduleId);
        return record?.source === 'user';
      });
      setContributions(userOnly);
    };
    update();
    const interval = setInterval(update, 2000);
    return () => clearInterval(interval);
  }, []);

  const [size, setSize] = useState({ width: 700, height: 600 });
  const widthRef = useRef(size.width);
  const heightRef = useRef(size.height);
  widthRef.current = size.width;
  heightRef.current = size.height;
  const pMouseMoveRef = useRef<((e: MouseEvent) => void) | null>(null);
  const pMouseUpRef = useRef<((e: MouseEvent) => void) | null>(null);

  useEffect(() => {
    return () => {
      if (pMouseMoveRef.current) document.removeEventListener('mousemove', pMouseMoveRef.current);
      if (pMouseUpRef.current) document.removeEventListener('mouseup', pMouseUpRef.current);
    };
  }, []);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = widthRef.current;
    const startHeight = heightRef.current;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.min(Math.max(startWidth + moveEvent.clientX - startX, 400), window.innerWidth - 40);
      const newHeight = Math.min(Math.max(startHeight + moveEvent.clientY - startY, 300), window.innerHeight - 40);
      setSize({ width: newWidth, height: newHeight });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      pMouseMoveRef.current = null;
      pMouseUpRef.current = null;
    };

    pMouseMoveRef.current = onMouseMove;
    pMouseUpRef.current = onMouseUp;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  // Find the contribution that matches the active tool
  const contribution = contributions.find(c => c.moduleId === activeTool);

  if (!contribution) return null;

  const Comp = contribution.component;
  const moduleId = contribution.moduleId ?? 'unknown';
  const helpText = MODULE_HELP[moduleId];

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="kc-dialog-content flex flex-col overflow-auto !p-0 !gap-0"
        style={{ width: size.width, height: size.height, maxWidth: 'calc(100vw - 2rem)', maxHeight: 'calc(100vh - 2rem)' }}
      >
        <DialogHeader className="flex flex-row items-center gap-2 px-4 pr-10 pt-4 pb-2 shrink-0 border-b border-[var(--border)] min-w-0">
          <MIcon name={contribution.icon || 'extension'} className="!text-[16px] text-[var(--accent-blue)] shrink-0" />
          <DialogTitle className="text-[14px] font-bold truncate flex-1">{contribution.label}</DialogTitle>
          {helpText && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] cursor-pointer shrink-0"
                  title="Справка"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[11px] font-bold leading-none">?</span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="right"
                align="start"
                className="max-w-[320px] text-[12px] leading-[16px] p-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                    <MIcon name={contribution.icon || 'extension'} className="!text-[14px] text-[var(--accent-blue)]" />
                    {contribution.label}
                  </div>
                  <p className="text-[var(--text-secondary)]">{helpText}</p>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </DialogHeader>
        <div className="flex-1 overflow-auto min-h-0 min-w-0">
          {Comp && (
            <ModuleErrorBoundary moduleId={moduleId}>
              <Suspense fallback={<span className="text-xs opacity-50">...</span>}>
                <Comp />
              </Suspense>
            </ModuleErrorBoundary>
          )}
        </div>
        <div
          className="absolute bottom-0 right-0 w-[10px] h-[10px] cursor-nwse-resize z-50 opacity-40 hover:opacity-100"
          style={{
            borderRight: '2px solid var(--text-secondary)',
            borderBottom: '2px solid var(--text-secondary)',
          }}
          onMouseDown={handleResizeMouseDown}
        />
      </DialogContent>
    </Dialog>
  );
}