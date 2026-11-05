'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore, getRuntime , AppEvents} from '@/plugin-sdk';
import { getEventBus } from '@/plugin-sdk';
import type { ModuleUIContribution } from '@/plugin-sdk';
import { SaveStatusIndicator } from '@/components/SaveStatusIndicator';
import { ProjectStatisticsDialog } from '@/components/ProjectStatisticsDialog';
import { ModuleErrorBoundary } from '@/components/ModuleErrorBoundary';
import { MIcon } from '@/shell/shared-icon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { UndoSnapshot } from '@/core/store/undoSlice';

/** Сколько последних действий показывать в подсказке статус-бара. */
export const HISTORY_TOOLTIP_LINES = 5;

/**
 * Превратить стек истории в строки подсказки вида «2. Перенос 6 фраз в «Кластеры»».
 * Первой идёт последнее действие — именно его отменит следующий клик.
 */
export function buildHistoryLines(stack: UndoSnapshot[]): string[] {
  return stack
    .slice(-HISTORY_TOOLTIP_LINES)
    .reverse()
    .map((snapshot, i) => `${i + 1}. ${snapshot.label ?? 'Действие'}`);
}

export function StatusBar({ onTrashOpen }: { onTrashOpen: () => void }) {
  const [statsOpen, setStatsOpen] = useState(false);
  const [statusBarContributions, setStatusBarContributions] = useState<ModuleUIContribution[]>([]);

  useEffect(() => {
    const rt = getRuntime();
    if (rt) setStatusBarContributions([...rt.getUIContributions('status-bar')]);

    const bus = getEventBus();
    if (!bus) return;
    const unsub = bus.on(AppEvents.MODULE_REGISTERED, () => {
      const rtt = getRuntime();
      if (rtt) setStatusBarContributions([...rtt.getUIContributions('status-bar')]);
    });
    return unsub;
  }, []);
  const phrases = useAppStore(s => s.phrases);
  const groups = useAppStore(s => s.groups);
  const activeGroupId = useAppStore(s => s.activeGroupId);
  const selectedPhraseIds = useAppStore(s => s.selectedPhraseIds);
  const clusteringResults = useAppStore(s => s.clusteringResults);
  const applyClusteringResults = useAppStore(s => s.applyClusteringResults);
  const undoStack = useAppStore(s => s.undoStack);
  const redoStack = useAppStore(s => s.redoStack);
  const undoCount = undoStack.length;
  const redoCount = redoStack.length;

  const undoHistory = useMemo(() => buildHistoryLines(undoStack), [undoStack]);
  const redoHistory = useMemo(() => buildHistoryLines(redoStack), [redoStack]);

  const activeGroup = groups.find(g => g.id === activeGroupId);
  const phraseCount = activeGroupId
    ? phrases.filter(p => p.groupId === activeGroupId).length
    : phrases.length;

  const trashGroup = groups.find(g => g.isTrash);
  const trashCount = trashGroup
    ? phrases.filter(p => p.groupId === trashGroup.id).length
    : 0;

  const selectedPhrasesForStats = selectedPhraseIds.size === 1
    ? phrases.filter(p => selectedPhraseIds.has(p.id))
    : undefined;

  return (
    <>
    <div className="flex items-center gap-3 px-3 h-[26px] bg-[var(--statusbar-bg)] text-[var(--statusbar-text)] shrink-0 text-[12px] select-none">
      <div className="flex items-center gap-2">
        <button
          className="flex items-center gap-1 hover:opacity-100 opacity-90 cursor-pointer"
          onClick={() => setStatsOpen(true)}
          title="Статистика проекта"
          aria-label="Статистика проекта"
        >
          <MIcon name="bar_chart" className="!text-[12px]" />
          {phraseCount} фраз
        </button>
        {selectedPhraseIds.size > 0 && (
          <>
            <span className="opacity-60">|</span>
            <span className="flex items-center gap-1">
              <MIcon name="checklist" className="!text-[12px]" />
              {selectedPhraseIds.size} выбрано
            </span>
          </>
        )}
        {groups.length > 0 && (
          <>
            <span className="opacity-60">|</span>
            <span className="flex items-center gap-1">
              <MIcon name="folder" className="!text-[12px]" />
              {groups.filter(g => !g.isTrash).length} групп
            </span>
          </>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center text-[12px]" />

      <div className="ml-auto flex items-center gap-2">
        <button
          className="flex items-center gap-1 hover:opacity-100 cursor-pointer"
          style={{ opacity: trashCount > 0 ? 1 : 0.6 }}
          onClick={onTrashOpen}
          title={trashCount > 0 ? `Корзина: ${trashCount} фраз` : 'Корзина пуста'}
          aria-label={trashCount > 0 ? `Корзина: ${trashCount} фраз` : 'Корзина пуста'}
        >
          <MIcon name="delete" className="!text-[12px]" style={{ color: trashCount > 0 ? 'var(--accent-red)' : undefined }} />
          {trashCount > 0 && <span>{trashCount}</span>}
        </button>

        {activeGroup && !activeGroup.isTrash && (
          <span className="opacity-80">{activeGroup.name}</span>
        )}
        <div
          className="status-progress"
          title={`Доля фраз активной группы: ${groups.length > 0 ? Math.min(100, Math.round((phraseCount / (phrases.length || 1)) * 100)) : 0}%`}
        >
          <div
            className="status-progress-bar"
            style={{ width: `${groups.length > 0 ? Math.min(100, (phraseCount / (phrases.length || 1)) * 100) : 0}%` }}
          />
        </div>
        {statusBarContributions.filter(c => c.component).map((c) => {
          const Comp = c.component!;
          return (
            <ModuleErrorBoundary moduleId={c.moduleId ?? 'unknown'} key={`statusbar-${c.label}`}>
              <Comp />
            </ModuleErrorBoundary>
          );
        })}
        <SaveStatusIndicator />
        {(undoCount > 0 || redoCount > 0) && (
          <span className="text-[11px] tabular-nums flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="flex items-center gap-0.5 hover:opacity-100 opacity-90 cursor-pointer disabled:opacity-40 disabled:cursor-default"
                  disabled={undoCount === 0}
                  onClick={() => useAppStore.getState().undo()}
                  aria-label={`Отменить (${undoCount})`}
                >
                  ↩ {undoCount}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[11px] text-left max-w-[340px]">
                {undoHistory.length > 0
                  ? undoHistory.map((line) => <div key={line}>{line}</div>)
                  : <div>Нет действий для отмены</div>}
              </TooltipContent>
            </Tooltip>
            {undoCount > 0 && redoCount > 0 && <span className="opacity-40">|</span>}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="flex items-center gap-0.5 hover:opacity-100 opacity-90 cursor-pointer disabled:opacity-40 disabled:cursor-default"
                  disabled={redoCount === 0}
                  onClick={() => useAppStore.getState().redo()}
                  aria-label={`Повторить (${redoCount})`}
                >
                  ↪ {redoCount}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[11px] text-left max-w-[340px]">
                {redoHistory.length > 0
                  ? redoHistory.map((line) => <div key={line}>{line}</div>)
                  : <div>Нет действий для повтора</div>}
              </TooltipContent>
            </Tooltip>
          </span>
        )}
        {clusteringResults && clusteringResults.size > 0 && (
          <button
            className="flex items-center gap-1 hover:opacity-100 cursor-pointer animate-pulse"
            style={{ color: 'var(--accent-blue)' }}
            onClick={applyClusteringResults}
            title={`Применить ${clusteringResults.size} кластеров`}
            aria-label={`Применить ${clusteringResults.size} кластеров`}
          >
            <MIcon name="hub" className="!text-[12px]" />
            Создать структуру ({clusteringResults.size})
          </button>
        )}
        <span className="opacity-80">KeyCluster v0.3</span>
      </div>
    </div>
    <ProjectStatisticsDialog
      open={statsOpen}
      onOpenChange={setStatsOpen}
      selectedPhrases={selectedPhrasesForStats}
    />
    </>
  );
}