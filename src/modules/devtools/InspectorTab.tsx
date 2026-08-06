import React, { useState, useEffect } from 'react';
import { useAppStore, getRuntime } from '@/plugin-sdk';

function takeSnapshot(): Record<string, unknown> {
  const state = useAppStore.getState();
  const keys = Object.keys(state).filter(k => k !== 'undoStack' && k !== 'redoStack');
  const subset: Record<string, unknown> = {};
  for (const k of keys) {
    const v = (state as unknown as Record<string, unknown>)[k];
    subset[k] = v instanceof Map ? Object.fromEntries(v) : v;
  }
  return subset;
}

export function InspectorTab() {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [snapshot, setSnapshot] = useState('');
  const [search, setSearch] = useState('');

  const rt = getRuntime();
  const moduleStatuses = rt ? rt.getModuleStatuses() : [];

  const refresh = () => setSnapshot(JSON.stringify(takeSnapshot(), null, 2));

  useEffect(() => {
    refresh();
    if (!autoRefresh) return;
    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const filtered = search
    ? snapshot.split('\n').filter(l => l.toLowerCase().includes(search.toLowerCase())).join('\n')
    : snapshot;

  const statusColors: Record<string, string> = {
    ok: 'var(--accent-green)', failed: 'var(--accent-red)',
    loading: 'var(--accent-blue)', disabled: '#888', 'not-loaded': '#666',
  };

  return (
    <div className="h-full flex flex-col p-2 gap-2">
      <div className="flex items-center gap-2 shrink-0">
        <label className="flex items-center gap-1 text-[10px] cursor-pointer opacity-70">
          <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
          Auto-refresh (1s)
        </label>
        <input
          className="px-1.5 py-0.5 rounded text-[10px] border bg-transparent w-[200px]"
          style={{ borderColor: 'var(--border-color)' }}
          placeholder="Search in state..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex-1" />
        <button
          className="px-1.5 py-0.5 rounded text-[10px] border cursor-pointer opacity-60 hover:opacity-100"
          style={{ borderColor: 'var(--border-color)' }}
          onClick={() => navigator.clipboard.writeText(JSON.stringify(takeSnapshot(), null, 2))}
        >
          Copy
        </button>
        <button
          className="px-1.5 py-0.5 rounded text-[10px] border cursor-pointer opacity-60 hover:opacity-100"
          style={{ borderColor: 'var(--border-color)' }}
          onClick={refresh}
        >
          Refresh
        </button>
      </div>

      {moduleStatuses.length > 0 && (
        <div className="shrink-0 border rounded" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-surface)' }}>
          <div className="text-[10px] font-semibold px-1.5 py-1 opacity-60 border-b" style={{ borderColor: 'var(--border-color)' }}>
            Runtime Modules ({moduleStatuses.length})
          </div>
          <table className="w-full text-[10px] border-collapse">
            <tbody>
              {moduleStatuses.map(m => (
                <tr key={m.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--border-color)' }}>
                  <td className="px-1.5 py-[2px] w-[14px]">
                    <span className="w-[6px] h-[6px] rounded-full inline-block" style={{ backgroundColor: statusColors[m.status] ?? '#888' }} />
                  </td>
                  <td className="px-1.5 py-[2px] font-mono">{m.id}</td>
                  <td className="px-1.5 py-[2px]">
                    <span style={{ color: statusColors[m.status] ?? '#888' }}>{m.status}</span>
                  </td>
                  <td className="px-1.5 py-[2px] text-[9px] opacity-50 text-right">{m.version}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex-1 overflow-auto font-mono text-[10px] leading-[1.3] border rounded p-2" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-base)' }}>
        <pre className="m-0">{filtered}</pre>
      </div>
    </div>
  );
}
