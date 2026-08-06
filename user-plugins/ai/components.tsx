// AI Panel — PROTECTED UI ZONE
// Contains ONLY: Connection, Logs, Prompt Settings
// AI Tools removed — now algorithmic in core/engine/

import React, { useCallback } from 'react';
import { useAppStore, Separator } from 'plugin-sdk';
import { ConnectionSection, getOrCreateService } from './connection-section';
import { LogsSection } from './logs-section';

export { getOrCreateService };

export function AIRibbonButtons() {
  const openPanel = useCallback(() => {
    const s = useAppStore.getState();
    if (s.ui.leftPanel.module === 'ai' && s.ui.leftPanel.open) {
      s.setLeftPanel(false);
    } else {
      s.setLeftPanel(true, 'ai');
    }
  }, []);

  return (
    <button className="ribbon-btn" title="AI Панель" onClick={openPanel}>
      <span className="material-symbols-outlined ribbon-icon">auto_awesome</span>
      <span className="ribbon-label">AI Панель</span>
    </button>
  );
}

export function AIPanel({ ctx }: { ctx: any }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto compact-scroll p-3 space-y-3 flex flex-col min-h-0">
        <ConnectionSection />
        <Separator />
        <LogsSection />
      </div>
    </div>
  );
}