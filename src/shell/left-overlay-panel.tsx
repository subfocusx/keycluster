import type { ModuleUIContribution } from '@/plugin-sdk';
'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAppStore, getRuntime } from '@/plugin-sdk';
import { getEventBus } from '@/plugin-sdk';
import { ModuleErrorBoundary } from '@/components/ModuleErrorBoundary';
import { MIcon } from '@/shell/shared-icon';





function PluginLeftPanelTitle({ moduleId }: { moduleId: string | null }) {
  const [contributions, setContributions] = useState<ModuleUIContribution[]>([]);

  useEffect(() => {
    const rt = getRuntime();
    if (rt) setContributions([...rt.getUIContributions('left-panel')]);

    const unsub = getEventBus().on('module:registered', () => {
      const rtt = getRuntime();
      if (rtt) setContributions([...rtt.getUIContributions('left-panel')]);
    });
    return unsub;
  }, []);

  if (!moduleId) return null;
  const contribution = contributions.find(c => c.moduleId === moduleId);
  if (!contribution) return null;

  return <>{contribution.label}</>;
}

function PluginLeftPanelContent({ moduleId }: { moduleId: string }) {
  const [contributions, setContributions] = useState<ModuleUIContribution[]>([]);

  useEffect(() => {
    const rt = getRuntime();
    if (rt) setContributions([...rt.getUIContributions('left-panel')]);

    const unsub = getEventBus().on('module:registered', () => {
      const rtt = getRuntime();
      if (rtt) setContributions([...rtt.getUIContributions('left-panel')]);
    });
    return unsub;
  }, []);

  const contribution = contributions.find(c => c.moduleId === moduleId);
  if (!contribution) {
    return (
      <div className="p-3 font-body-sm text-[var(--kc-text-secondary)]">
        Модуль не найден
      </div>
    );
  }

  const Comp = contribution.component;
  if (!Comp) return null;
  return (
    <ModuleErrorBoundary moduleId={moduleId}>
      <Comp />
    </ModuleErrorBoundary>
  );
}

export function LeftOverlayPanel({ ctx }: { ctx: any }) {
  const ui = useAppStore(s => s.ui);
  const setLeftPanel = useAppStore(s => s.setLeftPanel);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ui.leftPanel.open) return;

    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setLeftPanel(false);
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [ui.leftPanel.open, setLeftPanel]);

  if (!ui.leftPanel.open) return null;

  return (
    <div
      ref={panelRef}
      className="absolute top-0 left-0 z-30 w-[320px] h-[calc(100vh-22px)] bg-[var(--bg-surface)] border-r border-[var(--border)] shadow-lg flex flex-col"
    >
      <div className="flex items-center justify-between px-3 h-8 border-b border-[var(--border)] bg-[var(--bg-panel)] shrink-0">
        <span className="font-h2 text-[var(--text-primary)]">
          <PluginLeftPanelTitle moduleId={ui.leftPanel.module} />
        </span>
        <button
          className="tool-btn !w-6 !h-6"
          onClick={() => setLeftPanel(false)}
        >
          <MIcon name="close" className="!text-[16px]" />
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {ui.leftPanel.module ? (
          <PluginLeftPanelContent moduleId={ui.leftPanel.module} />
        ) : (
          <div className="p-3 font-body-sm text-[var(--kc-text-secondary)]">
            Выберите инструмент из панели
          </div>
        )}
      </div>
    </div>
  );
}
