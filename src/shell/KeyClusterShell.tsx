// ============================================================
// KeyCluster Shell — Main Application Orchestrator
// Reproduces Key Collector desktop UI style
// Tab bar + Ribbon toolbar + Main Content + Right Panel + Status Bar
//
// Refactored: components extracted to TabRouter, PanelManager, ShellLayout, useModuleCtx
// ============================================================

'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useTheme } from 'next-themes';
import { useAppStore, getRuntime } from '@/plugin-sdk';
import { getEventBus } from '@/plugin-sdk';
import type { ModuleUIContribution, PluginContext, WorkspaceLayoutProps } from '@/plugin-sdk';
import { keybindingManager } from '@/plugin-sdk';
import { GroupsPanel } from '@/modules/groups/components';
import { MIcon } from '@/shell/shared-icon';
import CommandPalette from '@/components/CommandPalette';
import SettingsModal from '@/components/SettingsModal';
import { ProjectManagerDialog } from '@/components/ProjectManagerDialog';
import { ModuleErrorBoundary } from '@/components/ModuleErrorBoundary';
import { useKCDialog } from '@/components/KCDialog';
import { ShellLayout, ShellLoadingScreen } from './ShellLayout';
import { TabRouter } from './TabRouter';
import { PanelManager, ResizablePanel, StatusBar } from './PanelManager';
import { LeftOverlayPanel } from './left-overlay-panel';
import { useModuleCtx } from './useModuleCtx';
import { DevToolsPanel } from '@/modules/devtools/DevToolsPanel';
import { ModuleGuard } from './ModuleGuard';
import { useRuntimeEvents } from '@/shell/useRuntimeEvents';
import { PhrasesTable } from '@/modules/phrases/components';
import { ImportDialog } from '@user-plugins/import-export/import-dialog';

// ---- Workspace area (левая/правая панель групп + таблица фраз) ----

/** Контейнер панели групп слева (ручка изменения ширины справа) */
function LeftResizablePanel({
  initialWidth,
  minWidth,
  maxWidth,
  onWidthChange,
  children,
}: {
  initialWidth: number;
  minWidth: number;
  maxWidth: number;
  onWidthChange?: (width: number) => void;
  children: React.ReactNode;
}) {
  const [width, setWidth] = useState(initialWidth);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const widthRef = useRef(width);
  widthRef.current = width;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = widthRef.current;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = e.clientX - startX.current;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth.current + delta));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      onWidthChange?.(widthRef.current);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [minWidth, maxWidth, onWidthChange]);

  return (
    <div
      className="border-r border-[var(--border)] bg-[var(--bg-surface)] flex flex-col shrink-0 relative"
      style={{ width: `${width}px` }}
    >
      {children}
      <div
        className="panel-resize-handle absolute right-0 top-0 bottom-0 w-[3px] cursor-col-resize z-10"
        style={{ transform: 'translateX(50%)' }}
        onMouseDown={handleMouseDown}
        title="Потяните, чтобы изменить ширину панели"
      />
    </div>
  );
}

export interface WorkspaceAreaProps {
  ctx: PluginContext;
  panelContribs: ModuleUIContribution[];
  /** Узел панели групп (дерево) */
  groupsPanel: React.ReactNode;
  /** Узел таблицы фраз */
  table: React.ReactNode;
}

/**
 * Рабочая область: панель групп справа (по умолчанию) или слева
 * (режим «дерево слева»), таблица фраз — всегда рядом с деревом.
 */
export function WorkspaceArea({ ctx, panelContribs, groupsPanel, table }: WorkspaceAreaProps) {
  const treeOnLeft = useAppStore(s => s.ui.groupsTreeOnLeft) ?? false;
  const collapsed = useAppStore(s => s.ui.groupsPanelCollapsed) ?? false;
  const panelWidth = useAppStore(s => s.ui.groupsPanelWidth) ?? 280;

  const groupsSlot = collapsed ? (
    <div
      className={`${treeOnLeft ? 'border-r' : 'border-l'} border-[var(--border)] bg-[var(--bg-surface)] flex flex-col shrink-0`}
      style={{ width: '40px' }}
      data-testid="groups-panel-slot"
    >
      {groupsPanel}
    </div>
  ) : treeOnLeft ? (
    <LeftResizablePanel
      initialWidth={panelWidth}
      minWidth={180}
      maxWidth={500}
      onWidthChange={(w) => {
        useAppStore.getState().setGroupsPanelWidth(w);
        useAppStore.getState().setRightPanelWidth(w);
      }}
    >
      {groupsPanel}
    </LeftResizablePanel>
  ) : (
    <ResizablePanel
      initialWidth={panelWidth}
      minWidth={180}
      maxWidth={500}
      onWidthChange={(w) => {
        useAppStore.getState().setGroupsPanelWidth(w);
        useAppStore.getState().setRightPanelWidth(w);
      }}
    >
      {groupsPanel}
    </ResizablePanel>
  );

  return (
    <div className="flex-1 flex min-h-0 relative" data-testid="workspace-area">
      {/* Left overlay panel (AI, tool panels) — внутри рабочей области,
          чтобы не перекрывать ленту с вкладками */}
      <LeftOverlayPanel ctx={ctx} />
      {/* Workspace panel contributions (left side) */}
      {panelContribs.filter(c => c.component && c.order !== undefined && c.order < 0).map(c => {
        const Comp = c.component!;
        return (
          <div key={c.moduleId ?? c.label} className="border-r border-[var(--border)] flex flex-col min-w-[200px] max-w-[400px]">
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border)] bg-[var(--bg-panel)]">
              {c.icon && <MIcon name={c.icon} className="!text-[14px]" />}
              <span className="text-[11px] font-semibold">{c.label}</span>
            </div>
            <div className="flex-1 overflow-auto">
              <Comp ctx={ctx} />
            </div>
          </div>
        );
      })}

      {/* Панель групп слева (режим «дерево слева») */}
      {treeOnLeft && groupsSlot}

      {/* Main table */}
      <div className="flex-1 min-w-0 overflow-hidden bg-[var(--bg-surface)]" data-testid="phrases-table-slot">
        {table}
      </div>

      {/* ARCH: GroupsPanel рендерится напрямую (не через SlotRenderer) */}
      {/* Причина: требует ResizablePanel + ModuleGuard обёрток */}
      {/* Изменять только если SlotRenderer получит поддержку wrapper-контейнеров */}

      {/* Right panel — Groups, resizable */}
      {!treeOnLeft && groupsSlot}

      {/* Workspace panel contributions (right side) */}
      {panelContribs.filter(c => c.component && ((c.order ?? 0) >= 0)).map(c => {
        const Comp = c.component!;
        return (
          <div key={c.moduleId ?? c.label} className="border-l border-[var(--border)] flex flex-col min-w-[200px] max-w-[400px]">
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border)] bg-[var(--bg-panel)]">
              {c.icon && <MIcon name={c.icon} className="!text-[14px]" />}
              <span className="text-[11px] font-semibold">{c.label}</span>
            </div>
            <div className="flex-1 overflow-auto">
              <Comp ctx={ctx} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- Main Shell ----

export default function KeyClusterShell() {
  const [initialized, setInitialized] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [toolModal, setToolModal] = useState<string | null>(null);
  const [projectManagerOpen, setProjectManagerOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const ctx = useModuleCtx();
  const kcDialog = useKCDialog();
  const setTheme = useAppStore(s => s.setTheme);
  const { setTheme: setNextTheme, theme: nextTheme } = useTheme();

  const isDarkTheme = (t: string) => t === 'dark' || t === 'dark-pro';

  // Sync Zustand persisted theme → next-themes on mount
  useEffect(() => {
    const savedTheme = useAppStore.getState().ui.theme;
    setNextTheme(savedTheme);
    document.documentElement.classList.toggle('dark', isDarkTheme(savedTheme));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setThemeExplicit = useCallback((theme: 'light' | 'dark' | 'dark-pro') => {
    setTheme(theme);
    setNextTheme(theme);
    document.documentElement.classList.toggle('dark', isDarkTheme(theme));
  }, [setTheme, setNextTheme]);

  // Global keybinding handler — delegates to KeybindingManager
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Special case: Ctrl+K toggles Command Palette (not a module command)
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(prev => !prev);
        return;
      }
      // Ctrl+/ — справка по хоткеям (открывает палитру команд)
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setPaletteOpen(prev => !prev);
        return;
      }
      // F2 — edit selected phrase
      if (e.key === 'F2') {
        if (!['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
          e.preventDefault();
          const selectedIds = [...useAppStore.getState().selectedPhraseIds];
          if (selectedIds.length === 1) {
            const phrase = useAppStore.getState().phrases.find(p => p.id === selectedIds[0]);
            if (phrase) {
              getEventBus().emit('phrases:start-edit', { id: phrase.id, text: phrase.text });
            }
          }
        }
        return;
      }
      // Ctrl+A — select all phrases
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        if (!['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
          e.preventDefault();
          useAppStore.getState().selectAllPhrases();
          return;
        }
      }
      // Delete — move selected to trash (with confirmation)
      if (e.key === 'Delete') {
        if (!['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
          const ids = [...useAppStore.getState().selectedPhraseIds];
          if (ids.length > 0) {
            e.preventDefault();
            kcDialog.confirm(`Удалить ${ids.length} фраз?`, { title: 'Удаление', confirmLabel: 'Удалить', variant: 'destructive' })
              .then(ok => { if (ok) useAppStore.getState().moveToTrash(ids); });
            return;
          }
        }
      }
      // All other keybindings go through KeybindingManager
      keybindingManager.handleKeydown(e);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [kcDialog]);

  const modulesLoading = useAppStore(s => s.ui.modulesLoading);
const [layoutContribs, setLayoutContribs] = useState<ModuleUIContribution[]>([]);
const [panelContribs, setPanelContribs] = useState<ModuleUIContribution[]>([]);

  useEffect(() => {
    if (!modulesLoading && !initialized) {
      setInitialized(true);
    }
  }, [modulesLoading, initialized]);

  const updateLayoutAndPanels = useCallback(() => {
    const rtt = getRuntime();
    if (rtt) {
      setLayoutContribs(rtt.getUIContributions('workspace:layout'));
      setPanelContribs(rtt.getUIContributions('workspace:panel'));
    }
  }, []);

  useRuntimeEvents(updateLayoutAndPanels);

  // Listen for TOOL_OPEN event (e.g. F9 → open minus-words modal)
  useEffect(() => {
    if (!initialized) return;
    const unsub = getEventBus().on<{ toolId: string }>('tool:open', (payload) => {
      if (payload?.toolId) setToolModal(payload.toolId);
    });
    return unsub;
  }, [initialized]);

  // Global import dialog handler — always active regardless of current tab
  useEffect(() => {
    const unsub = getEventBus().on('import-export:open-import', () => setImportDialogOpen(true));
    return unsub;
  }, []);

  
  if (!initialized || modulesLoading) {
    return <ShellLoadingScreen />;
  }

  return (
    <ShellLayout
      tabBar={
        <TabRouter
          ctx={ctx}
          activeTool={toolModal}
          onToolOpen={(id) => setToolModal(id)}
          onSettingsOpen={() => setSettingsOpen(true)}
          onProjectOpen={() => setProjectManagerOpen(true)}
          onThemeChange={setThemeExplicit}
          onRefresh={() => {
            const s = useAppStore.getState();
            s.clearPhraseSelection();
            s.clearGroupSelection();
          }}
        />
      }
      mainContent={(() => {
        const mainContentNode = (
          <WorkspaceArea
            ctx={ctx}
            panelContribs={panelContribs}
            groupsPanel={
              <ModuleGuard moduleId="groups">
                <GroupsPanel ctx={ctx} />
              </ModuleGuard>
            }
            table={
              <ModuleGuard moduleId="phrases">
                <PhrasesTable ctx={ctx} />
              </ModuleGuard>
            }
          />
        );

        const activeLayout = layoutContribs[0];
        return activeLayout?.layoutComponent
          ? React.createElement(activeLayout.layoutComponent, { ctx, children: mainContentNode } as WorkspaceLayoutProps)
          : mainContentNode;
      })()}
      statusBar={<StatusBar onTrashOpen={() => setTrashOpen(true)} />}
      overlays={
        <>
          {/* ARCH: DevToolsPanel рендерится напрямую в overlays (не через SlotRenderer) */}
          {/* Причина: позиционирование как drawer/overlay вне основного контента */}

          {/* DevTools Panel (bottom drawer) */}
          <DevToolsPanel />

          {/* Command Palette (Ctrl+K) */}
          <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

          {/* Settings Modal */}
          <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

          {/* Project Manager */}
          <ProjectManagerDialog open={projectManagerOpen} onOpenChange={setProjectManagerOpen} />

          {/* Global Import Dialog — always mounted, not tied to any tab */}
          <ImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} ctx={ctx} />

          {/* Panel Manager — Tool modals, Trash, Left overlay */}
          <PanelManager
            ctx={ctx}
            toolModal={toolModal}
            onToolModalChange={setToolModal}
            trashOpen={trashOpen}
            onTrashOpenChange={setTrashOpen}
          />
        </>
      }
    />
  );
}