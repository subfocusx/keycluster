import type { ModuleStatus, PluginDiagnostics } from '@/plugin-sdk';
import React, { useState, useEffect } from 'react';
import { getRuntime } from '@/plugin-sdk';
import { useRuntimeEvents } from '@/shell/useRuntimeEvents';

function HealthDetails({ moduleId }: { moduleId: string }) {
  const [diagnostics, setDiagnostics] = useState<PluginDiagnostics | null>(null);

  useEffect(() => {
    const rt = getRuntime();
    if (rt) setDiagnostics(rt.getPluginDiagnostics(moduleId));
  }, [moduleId]);

  if (!diagnostics) return null;

  const rows = [
    { label: 'Enabled', value: diagnostics.enabled ? '✓' : '✗' },
    { label: 'Initialized', value: diagnostics.initialized ? '✓' : '✗' },
    { label: 'Commands', value: diagnostics.commandCount },
    { label: 'UI Contributions', value: diagnostics.uiContributionCount },
    { label: 'Injected CSS', value: diagnostics.injectedCSSCount },
    { label: 'Status', value: diagnostics.status },
  ];

  const copyInfo = () => {
    navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
  };

  return (
    <div className="text-[10px] pl-8 py-1 opacity-80 space-y-0.5">
      {rows.map(r => (
        <div key={r.label} className="flex gap-2">
          <span className="w-28 text-[var(--text-secondary)]">{r.label}:</span>
          <span>{String(r.value)}</span>
        </div>
      ))}
      {diagnostics.errors && (
        <div className="flex gap-2">
          <span className="w-28 text-[var(--accent-red)]">Error:</span>
          <span className="text-[var(--accent-red)]">{diagnostics.errors}</span>
        </div>
      )}
      <button
        className="px-1.5 py-0.5 rounded text-[9px] border cursor-pointer opacity-60 hover:opacity-100 mt-1"
        style={{ borderColor: 'var(--border-color)' }}
        onClick={copyInfo}
      >
        Copy Plugin Info
      </button>
    </div>
  );
}

export function ModulesTab() {
  const [, forceUpdate] = useState(0);
  const [rtReady, setRtReady] = useState(() => getRuntime() !== null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const rt = getRuntime();

  useRuntimeEvents(() => {
    forceUpdate(n => n + 1);
    if (!rtReady && getRuntime() !== null) setRtReady(true);
  });

  const toggleEnabled = async (id: string, enabled: boolean) => {
    const rt = getRuntime();
    if (!rt) return;
    setPendingId(id);
    try {
      if (enabled) {
        await rt.enablePlugin(id);
      } else {
        await rt.disablePlugin(id);
      }
    } finally {
      setPendingId(null);
    }
  };

  if (!rt) {
    return (
      <div className="flex items-center justify-center h-full opacity-50 text-[12px]">
        Runtime not available (bootstrap pending...)
      </div>
    );
  }

  const modules: (ModuleStatus & { id: string })[] = rt
    ? rt.getModuleStatuses().map(m => ({ ...m as any, id: m.id }))
    : [];

  const statusColors: Record<string, string> = {
    ok: 'var(--accent-green)',
    failed: 'var(--accent-red)',
    loading: 'var(--accent-blue)',
    disabled: '#888',
    'no-ui': 'var(--accent-yellow)',
    'not-loaded': '#888',
  };

  const copyModulesJSON = () => {
    const data = modules.map(m => ({
      id: m.id, name: m.name, status: m.status, version: m.version,
      source: m.source, error: m.error, enabled: m.enabled,
    }));
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  };

  return (
    <div className="h-full overflow-auto p-2">
      <div className="flex items-center gap-2 px-1 pb-1">
        <span className="text-[11px] font-semibold opacity-70">Modules ({modules.length})</span>
        <div className="flex-1" />
        <button
          className="px-1.5 py-0.5 rounded text-[10px] border cursor-pointer opacity-60 hover:opacity-100"
          style={{ borderColor: 'var(--border-color)' }}
          onClick={copyModulesJSON}
        >
          Copy JSON
        </button>
      </div>
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="opacity-60 text-left">
            <th className="px-2 py-1 font-medium">ID</th>
            <th className="px-2 py-1 font-medium">Name</th>
            <th className="px-2 py-1 font-medium">Status</th>
            <th className="px-2 py-1 font-medium">Version</th>
            <th className="px-2 py-1 font-medium">Source</th>
            <th className="px-2 py-1 font-medium">Error</th>
            <th className="px-2 py-1 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {modules.map(mod => (
            <React.Fragment key={mod.id}>
              <tr
                className="border-t cursor-pointer hover:opacity-80"
                style={{ borderColor: 'var(--border-color)' }}
                onClick={() => setExpandedId(expandedId === mod.id ? null : mod.id)}
              >
                <td className="px-2 py-1 font-mono">{mod.id}</td>
                <td className="px-2 py-1">{mod.name}</td>
                <td className="px-2 py-1">
                  <span className="flex items-center gap-1">
                    <span className="w-[6px] h-[6px] rounded-full inline-block" style={{ backgroundColor: statusColors[mod.status] ?? '#888' }} />
                    {mod.status}
                  </span>
                </td>
                <td className="px-2 py-1">{mod.version}</td>
                <td className="px-2 py-1 text-[10px] opacity-60">{mod.source ?? '-'}</td>
                <td className="px-2 py-1 max-w-[150px] truncate" style={{ color: mod.error ? 'var(--accent-red)' : undefined }}>
                  {mod.error ?? '-'}
                </td>
                <td className="px-2 py-1">
                  <div className="flex items-center gap-1">
                    <button
                      className={`px-1.5 py-0.5 rounded text-[10px] border ${mod.status === 'disabled' ? 'opacity-100 font-medium' : 'opacity-60 hover:opacity-100'}`}
                      style={{ borderColor: 'var(--border-color)' }}
                      disabled={pendingId !== null}
                      onClick={e => { e.stopPropagation(); toggleEnabled(mod.id, mod.status === 'disabled'); }}
                    >
                      {pendingId === mod.id ? '...' : mod.status === 'disabled' ? 'Enable' : 'Disable'}
                    </button>
                    <button
                      className="px-1.5 py-0.5 rounded text-[10px] border opacity-60 hover:opacity-100"
                      style={{ borderColor: 'var(--border-color)' }}
                      disabled={pendingId !== null}
                      onClick={e => {
                        e.stopPropagation();
                        const rt = getRuntime();
                        setPendingId(mod.id);
                        (async () => { try { await rt?.reloadModule(mod.id); } finally { setPendingId(null); } })();
                      }}
                    >
                      Reload
                    </button>
                  </div>
                </td>
              </tr>
              {expandedId === mod.id && (
                <tr>
                  <td colSpan={7} className="p-0">
                    <HealthDetails moduleId={mod.id} />
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      {modules.length === 0 && (
        <div className="flex items-center justify-center h-full opacity-50 text-[12px]">
          Runtime not available
        </div>
      )}
    </div>
  );
}
