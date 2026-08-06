import React, { useRef, useState } from 'react';
import { useAppStore } from '@/plugin-sdk';
import { LogsTab } from './LogsTab';
import { ErrorsTab } from './ErrorsTab';
import { EventsTab } from './EventsTab';
import { InspectorTab } from './InspectorTab';
import { ModulesTab } from './ModulesTab';
import { NetworkTab } from './NetworkTab';
import { SnapshotsTab } from './SnapshotsTab';
import { ApiTab } from './ApiTab';

export function DevToolsToggle() {
  const open = useAppStore(s => s.devtools.devtoolsOpen);
  const toggle = useAppStore(s => s.toggleDevtools);
  return (
    <button
      data-testid="devtools-toggle"
      className="flex items-center gap-1 px-1.5 h-full hover:opacity-100 cursor-pointer text-[11px]"
      style={{ opacity: open ? 1 : 0.6, color: open ? 'var(--accent-blue)' : undefined }}
      onClick={toggle}
      title="DevTools (Ctrl+Shift+D)"
    >
      <span className="material-symbols-outlined !text-[12px]">settings_code</span>
    </button>
  );
}

const TABS = [
  { id: 'modules' as const, label: 'Модули', icon: 'extension' },
  { id: 'logs' as const, label: 'Логи', icon: 'list_alt' },
  { id: 'errors' as const, label: 'Ошибки', icon: 'bug_report' },
  { id: 'events' as const, label: 'События', icon: 'sync_alt' },
  { id: 'inspector' as const, label: 'Инспектор', icon: 'travel_explore' },
  { id: 'network' as const, label: 'Network', icon: 'wifi' },
  { id: 'snapshots' as const, label: 'Снапшоты', icon: 'history' },
  { id: 'api' as const, label: 'API', icon: 'api' },
];

export function DevToolsPanel() {
  const open = useAppStore(s => s.devtools.devtoolsOpen);
  const activeTab = useAppStore(s => s.devtools.devtoolsTab);
  const setTab = useAppStore(s => s.setDevtoolsTab);
  const close = useAppStore(s => s.setDevtoolsOpen);
  const [height, setHeight] = useState(300);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ y: number; h: number } | null>(null);

  const onDragPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStart.current = { y: e.clientY, h: height };
  };

  const onDragPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const delta = dragStart.current.y - e.clientY;
    setHeight(Math.max(150, Math.min(600, dragStart.current.h + delta)));
  };

  const onDragPointerUp = (e: React.PointerEvent) => {
    dragStart.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      data-testid="devtools-panel"
      className="fixed bottom-0 left-0 right-0 z-50 flex flex-col border-t shadow-lg"
      style={{
        height,
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-color)',
      }}
    >
      <div
        className="h-[3px] cursor-row-resize shrink-0"
        style={{ backgroundColor: 'var(--accent-blue)' }}
        onPointerDown={onDragPointerDown}
        onPointerMove={onDragPointerMove}
        onPointerUp={onDragPointerUp}
        onPointerCancel={onDragPointerUp}
      />

      <div className="flex items-center h-[32px] shrink-0 px-2 border-b gap-0.5 select-none" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex items-center gap-1 mr-2 text-[11px] font-semibold opacity-70">
          <span className="material-symbols-outlined !text-[14px]">settings_code</span>
          DevTools
        </div>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`flex items-center gap-1 px-2 h-full text-[11px] border-b-[2px] transition-colors cursor-pointer ${
              activeTab === tab.id ? 'font-medium' : 'opacity-60 hover:opacity-100'
            }`}
            style={{
              borderBottomColor: activeTab === tab.id ? 'var(--accent-blue)' : 'transparent',
            }}
            onClick={() => setTab(tab.id)}
          >
            <span className="material-symbols-outlined !text-[12px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          className="flex items-center justify-center w-[22px] h-[22px] rounded hover:opacity-100 cursor-pointer opacity-60"
          onClick={() => close(false)}
          title="Закрыть"
        >
          <span className="material-symbols-outlined !text-[14px]">close</span>
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'modules' && <ModulesTab />}
        {activeTab === 'logs' && <LogsTab />}
        {activeTab === 'errors' && <ErrorsTab />}
        {activeTab === 'events' && <EventsTab />}
        {activeTab === 'inspector' && <InspectorTab />}
        {activeTab === 'network' && <NetworkTab />}
        {activeTab === 'snapshots' && <SnapshotsTab />}
        {activeTab === 'api' && <ApiTab />}
      </div>
    </div>
  );
}