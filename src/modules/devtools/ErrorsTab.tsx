import type { ErrorRecord } from '@/plugin-sdk';
import React, { useState, useEffect } from 'react';
import { globalErrorCollector } from '@/plugin-sdk';

export function ErrorsTab() {
  const [errors, setErrors] = useState<ErrorRecord[]>([]);
  const [moduleFilter, setModuleFilter] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const update = () => setErrors(globalErrorCollector.getAll());
    const unsub = globalErrorCollector.subscribe(update);
    update();
    return unsub;
  }, []);

  const filtered = errors.filter(e => {
    if (moduleFilter && !e.moduleId.includes(moduleFilter)) return false;
    if (phaseFilter !== 'all' && e.phase !== phaseFilter) return false;
    return true;
  });

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col p-2 gap-2">
      <div className="flex items-center gap-2 shrink-0">
        <input
          className="px-1.5 py-0.5 rounded text-[10px] border bg-transparent w-[120px]"
          style={{ borderColor: 'var(--border-color)' }}
          placeholder="Модуль..."
          value={moduleFilter}
          onChange={e => setModuleFilter(e.target.value)}
        />
        <select
          className="px-1.5 py-0.5 rounded text-[10px] border bg-transparent"
          style={{ borderColor: 'var(--border-color)' }}
          value={phaseFilter}
          onChange={e => setPhaseFilter(e.target.value)}
        >
          <option value="all">All phases</option>
          <option value="init">init</option>
          <option value="render">render</option>
          <option value="runtime">runtime</option>
          <option value="ipc">ipc</option>
          <option value="unknown">unknown</option>
        </select>
        <div className="flex-1" />
        <span className="text-[10px] opacity-50 tabular-nums">{filtered.length} errors</span>
        {moduleFilter && (
          <button
            className="px-1.5 py-0.5 rounded text-[10px] border cursor-pointer opacity-60 hover:opacity-100"
            style={{ borderColor: 'var(--border-color)' }}
            onClick={() => globalErrorCollector.clearForModule(moduleFilter)}
          >
            Clear module
          </button>
        )}
        <button
          className="px-1.5 py-0.5 rounded text-[10px] border cursor-pointer opacity-60 hover:opacity-100"
          style={{ borderColor: 'var(--border-color)' }}
          onClick={() => globalErrorCollector.clear()}
        >
          Clear all
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="opacity-60 text-left">
              <th className="px-2 py-1 font-medium">Time</th>
              <th className="px-2 py-1 font-medium">Module</th>
              <th className="px-2 py-1 font-medium">Phase</th>
              <th className="px-2 py-1 font-medium">Message</th>
              <th className="px-2 py-1 font-medium">Count</th>
              <th className="px-2 py-1 font-medium">Resolved</th>
              <th className="px-2 py-1 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => (
              <React.Fragment key={e.id}>
                <tr className="border-t" style={{ borderColor: 'var(--border-color)', opacity: e.resolved ? 0.5 : 1 }}>
                  <td className="px-2 py-1 tabular-nums text-[10px]">
                    {new Date(e.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-2 py-1 font-mono">{e.moduleId}</td>
                  <td className="px-2 py-1">
                    <span className="px-1 rounded text-[10px]" style={{ backgroundColor: 'var(--bg-base)' }}>
                      {e.phase}
                    </span>
                  </td>
                  <td className="px-2 py-1 max-w-[250px] truncate" style={{ color: 'var(--accent-red)' }}>
                    <button className="cursor-pointer text-left w-full" onClick={() => toggleExpand(e.id)} title="Show stack trace">
                      {e.message}
                    </button>
                  </td>
                  <td className="px-2 py-1 tabular-nums">{e.count}</td>
                  <td className="px-2 py-1">
                    <span style={{ color: e.resolved ? 'var(--accent-green)' : '#888' }}>
                      {e.resolved ? '✅' : '❌'}
                    </span>
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-1">
                      <button
                        className="px-1.5 py-0.5 rounded text-[10px] border cursor-pointer opacity-60 hover:opacity-100"
                        style={{ borderColor: 'var(--border-color)' }}
                        onClick={() => { navigator.clipboard.writeText(`[${e.moduleId}] ${e.message}`); }}
                        title="Copy Error"
                      >
                        Copy
                      </button>
                      {e.stack && (
                        <button
                          className="px-1.5 py-0.5 rounded text-[10px] border cursor-pointer opacity-60 hover:opacity-100"
                          style={{ borderColor: 'var(--border-color)' }}
                          onClick={() => { navigator.clipboard.writeText(e.stack!); }}
                          title="Copy Stack"
                        >
                          Stack
                        </button>
                      )}
                      {!e.resolved && (
                        <button
                          className="px-1.5 py-0.5 rounded text-[10px] border cursor-pointer opacity-60 hover:opacity-100"
                          style={{ borderColor: 'var(--border-color)' }}
                          onClick={() => globalErrorCollector.markResolved(e.id)}
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {expanded.has(e.id) && e.stack && (
                  <tr>
                    <td colSpan={7} className="px-2 pb-2">
                      <pre className="m-0 text-[9px] leading-[1.3] rounded p-2 whitespace-pre-wrap max-h-[200px] overflow-auto" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--accent-orange, #f59e0b)' }}>
                        {e.stack}
                      </pre>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="flex items-center justify-center h-full opacity-40 text-[12px]">No errors</div>
        )}
      </div>
    </div>
  );
}
