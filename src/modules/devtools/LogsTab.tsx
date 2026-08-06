import type { LogEntry, LogFilter, LogLevel } from '@/plugin-sdk';
import React, { useState, useEffect, useRef } from 'react';
import { LogStore } from '@/plugin-sdk';

const LEVEL_COLORS: Record<string, string> = {
  debug: '#888',
  info: 'var(--accent-blue)',
  warn: 'var(--accent-orange, #f59e0b)',
  error: 'var(--accent-red)',
};

const LEVEL_ORDER: LogLevel[] = ['debug', 'info', 'warn', 'error'];

export function LogsTab() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [level, setLevel] = useState<LogLevel | 'all'>('all');
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLenRef = useRef(0);

  useEffect(() => {
    const update = () => {
      const filter: LogFilter = {};
      if (level !== 'all') filter.level = level;
      if (search) filter.search = search;
      if (moduleFilter) filter.module = moduleFilter;
      setEntries(filter.search || filter.level || filter.module ? LogStore.getFiltered(filter) : LogStore.getAll());
    };
    const unsub = LogStore.subscribe(update);
    update();
    return unsub;
  }, [level, search, moduleFilter]);

  useEffect(() => {
    if (autoScroll && entries.length > prevLenRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevLenRef.current = entries.length;
  }, [entries, autoScroll]);

  return (
    <div className="h-full flex flex-col p-2 gap-2">
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-0.5">
          {(['all', ...LEVEL_ORDER] as const).map(l => (
            <button
              key={l}
              className={`px-1.5 py-0.5 rounded text-[10px] border cursor-pointer ${
                level === l ? 'font-medium' : 'opacity-60 hover:opacity-100'
              }`}
              style={{
                borderColor: 'var(--border-color)',
                backgroundColor: level === l ? 'var(--bg-base)' : undefined,
                color: l !== 'all' ? LEVEL_COLORS[l] : undefined,
              }}
              onClick={() => setLevel(l)}
            >
              {l === 'all' ? 'Все' : l.charAt(0).toUpperCase() + l.slice(1)}
            </button>
          ))}
        </div>
        <input
          className="flex-1 max-w-[120px] px-1.5 py-0.5 rounded text-[10px] border bg-transparent"
          style={{ borderColor: 'var(--border-color)' }}
          placeholder="Модуль..."
          value={moduleFilter}
          onChange={e => setModuleFilter(e.target.value)}
        />
        <input
          className="flex-1 max-w-[150px] px-1.5 py-0.5 rounded text-[10px] border bg-transparent"
          style={{ borderColor: 'var(--border-color)' }}
          placeholder="Поиск..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex-1" />
        <button
          className="px-1.5 py-0.5 rounded text-[10px] border cursor-pointer opacity-60 hover:opacity-100"
          style={{ borderColor: 'var(--border-color)' }}
          onClick={() => {
            const text = entries.map(e => {
              const ts = new Date(e.timestamp);
              const time = `${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}:${String(ts.getSeconds()).padStart(2,'0')}.${String(ts.getMilliseconds()).padStart(3,'0')}`;
              return `${time} [${e.level.toUpperCase()}] [${e.module}] ${e.message}${e.duration !== undefined ? ` (${e.duration.toFixed(0)}ms)` : ''}`;
            }).join('\n');
            navigator.clipboard.writeText(text);
          }}
        >
          Copy All
        </button>
        <label className="flex items-center gap-1 text-[10px] cursor-pointer opacity-70">
          <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} />
          Auto-scroll
        </label>
        <button
          className="px-1.5 py-0.5 rounded text-[10px] border cursor-pointer opacity-60 hover:opacity-100"
          style={{ borderColor: 'var(--border-color)' }}
          onClick={() => {
            const filter: any = {};
            if (level !== 'all') filter.level = level;
            if (search) filter.search = search;
            if (moduleFilter) filter.module = moduleFilter;
            const json = LogStore.exportJSON(Object.keys(filter).length ? filter : undefined);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `logs-${Date.now()}.json`; a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export JSON
        </button>
        <button
          className="px-1.5 py-0.5 rounded text-[10px] border cursor-pointer opacity-60 hover:opacity-100"
          style={{ borderColor: 'var(--border-color)' }}
          onClick={() => LogStore.clear()}
        >
          Clear
        </button>
      </div>

      <div className="flex-1 overflow-auto font-mono text-[10px] leading-[1.4] border rounded" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-base)' }}>
        {entries.length === 0 ? (
          <div className="flex items-center justify-center h-full opacity-40">No log entries</div>
        ) : (
          entries.map(e => {
            const ts = new Date(e.timestamp);
            const time = `${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}:${String(ts.getSeconds()).padStart(2,'0')}.${String(ts.getMilliseconds()).padStart(3,'0')}`;
            return (
              <div key={e.id} className="flex gap-2 px-1.5 py-[1px] hover:opacity-100 group" style={{ opacity: e.level === 'debug' ? 0.6 : 0.85 }}>
                <span className="tabular-nums shrink-0 opacity-50">{time}</span>
                <span className="shrink-0 tabular-nums" style={{ color: LEVEL_COLORS[e.level] }}>
                  {e.level.toUpperCase().padEnd(5)}
                </span>
                <span className="shrink-0 opacity-70">[{e.module}]</span>
                <span className="flex-1 truncate">{e.message}</span>
                {e.duration !== undefined && (
                  <span className="shrink-0 tabular-nums opacity-50">({e.duration.toFixed(0)}ms)</span>
                )}
                <button
                  className="shrink-0 px-1 rounded text-[9px] opacity-0 group-hover:opacity-60 hover:opacity-100 cursor-pointer"
                  style={{ borderColor: 'var(--border-color)' }}
                  onClick={() => { navigator.clipboard.writeText(`[${e.level.toUpperCase()}] [${e.module}] ${e.message}${e.duration !== undefined ? ` (${e.duration.toFixed(0)}ms)` : ''}`); }}
                  title="Copy Entry"
                >
                  copy
                </button>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
