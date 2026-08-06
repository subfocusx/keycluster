// ============================================================
// KeyCluster Shell — Main Application Orchestrator
// Reproduces Key Collector desktop UI style
// Tab bar + Ribbon toolbar + Main Content + Right Panel + Status Bar
//
// Refactored: components extracted to TabRouter, PanelManager, ShellLayout, useModuleCtx
// ============================================================

'use client';

import React, { useEffect, useState, useCallback } from 'react';
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
import { useModuleCtx } from './useModuleCtx';
import { DevToolsPanel } from '@/modules/devtools/DevToolsPanel';
import { ModuleGuard } from './ModuleGuard';
import { useRuntimeEvents } from '@/shell/useRuntimeEvents';
import { PhrasesTable } from '@/modules/phrases/components';
import { ImportDialog } from '@user-plugins/import-export/import-dialog';

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
          <div className="flex-1 flex min-h-0 relative">
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

            {/* Main table */}
            <div className="flex-1 min-w-0 overflow-hidden bg-[var(--bg-surface)]">
              <ModuleGuard moduleId="phrases">
                <PhrasesTable ctx={ctx} />
              </ModuleGuard>
            </div>

            {/* ARCH: GroupsPanel рендерится напрямую (не через SlotRenderer) */}
            {/* Причина: требует ResizablePanel + ModuleGuard обёрток */}
            {/* Изменять только если SlotRenderer получит поддержку wrapper-контейнеров */}

            {/* Right panel — Groups, resizable */}
            <ResizablePanel
              initialWidth={280}
              minWidth={180}
              maxWidth={500}
              onWidthChange={(w) => useAppStore.getState().setRightPanelWidth(w)}
            >
              <ModuleGuard moduleId="groups">
                <GroupsPanel ctx={ctx} />
              </ModuleGuard>
            </ResizablePanel>

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