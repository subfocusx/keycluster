import React, { useState, useEffect, useRef } from 'react';
import { getEventBus , globalEventFilter} from '@/plugin-sdk';

interface EventEntry {
  id: number;
  name: string;
  timestamp: number;
  payload?: unknown;
}

const INTERNAL_EVENTS = new Set(['log:entry', 'module:registered', 'module:initialized']);

export function EventsTab() {
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [showInternal, setShowInternal] = useState(false);
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);

  useEffect(() => {
    const bus = getEventBus();
    if (!bus) return;

    const handler = (name: string, payload?: unknown) => {
      if (paused) return;
      idCounter.current++;
      setEvents(prev => {
        const next = [...prev, { id: idCounter.current, name, timestamp: Date.now(), payload }];
        return next.length > 1000 ? next.slice(-1000) : next;
      });
    };

    const knownEvents = [
      'groups:changed', 'phrases:changed', 'minus-words:changed',
      'group:selected', 'phrase:selected', 'selection:changed',
      'left-panel:open', 'left-panel:close', 'tool:open',
      'bootstrap:started', 'bootstrap:completed', 'tool:close',
      'module:registered', 'module:initialized', 'module:error',
      'module:disabled', 'module:enabled', 'module:reloaded',
      'plugin:hot-reloaded',
      'phrases:add', 'phrases:delete', 'phrases:move',
      'group:add', 'group:delete', 'group:rename',
      'project:loaded', 'project:updated',
      'demo:load', 'ipc:error', 'runtime:error',
    ];

    const unsubs = knownEvents.map(event => {
      const fn = (payload: unknown) => handler(event, payload);
      if (event === 'log:entry') {
        return globalEventFilter.on(bus, event, fn);
      }
      return bus.on(event, fn as any);
    });
    return () => unsubs.forEach(u => u());
  }, [paused]);

  useEffect(() => {
    if (showInternal) {
      globalEventFilter.unblockExact('log:entry');
    } else {
      globalEventFilter.blockExact('log:entry');
    }
  }, [showInternal]);

  useEffect(() => {
    if (autoScroll && !paused) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events, autoScroll, paused]);

  let filtered = showInternal ? events : events.filter(e => !INTERNAL_EVENTS.has(e.name));
  if (filter) {
    if (useRegex) {
      try {
        const re = new RegExp(filter);
        filtered = filtered.filter(e => re.test(e.name));
      } catch { /* invalid regex — skip filter */ }
    } else {
      const q = filter.toLowerCase();
      filtered = filtered.filter(e => e.name.toLowerCase().includes(q));
    }
  }

  return (
    <div className="h-full flex flex-col p-2 gap-2">
      <div className="flex items-center gap-2 shrink-0">
        <input
          className="px-1.5 py-0.5 rounded text-[10px] border bg-transparent w-[160px]"
          style={{ borderColor: 'var(--border-color)' }}
          placeholder={useRegex ? 'Regex...' : 'Filter events...'}
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <label className="flex items-center gap-1 text-[10px] cursor-pointer opacity-70" title="Use regex instead of plain text">
          <input type="checkbox" checked={useRegex} onChange={e => setUseRegex(e.target.checked)} />
          .*
        </label>
        <button
          className={`px-1.5 py-0.5 rounded text-[10px] border cursor-pointer ${paused ? 'font-medium' : 'opacity-60 hover:opacity-100'}`}
          style={{ borderColor: 'var(--border-color)' }}
          onClick={() => setPaused(!paused)}
        >
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>
        <button
          className="px-1.5 py-0.5 rounded text-[10px] border cursor-pointer opacity-60 hover:opacity-100"
          style={{ borderColor: 'var(--border-color)' }}
          onClick={() => setEvents([])}
        >
          Clear
        </button>
        <div className="flex-1" />
        <label className="flex items-center gap-1 text-[10px] cursor-pointer opacity-70">
          <input type="checkbox" checked={showInternal} onChange={e => setShowInternal(e.target.checked)} />
          Internal
        </label>
        <label className="flex items-center gap-1 text-[10px] cursor-pointer opacity-70">
          <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} />
          Auto-scroll
        </label>
        <span className="text-[10px] opacity-50 tabular-nums">{filtered.length} events</span>
      </div>

      <div className="flex-1 overflow-auto font-mono text-[10px] leading-[1.4] border rounded" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-base)' }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-40 gap-1">
            <span className="material-symbols-outlined !text-[24px]">sync_alt</span>
            <span className="text-[11px]">Ожидание событий...</span>
            <span className="text-[10px]">События появятся при действиях в приложении</span>
          </div>
        ) : (
          filtered.slice().reverse().map(e => (
            <div key={e.id} className="flex gap-2 px-1.5 py-[1px] hover:opacity-100" style={{ opacity: INTERNAL_EVENTS.has(e.name) ? 0.4 : 0.8 }}>
              <span className="tabular-nums shrink-0 opacity-50">{new Date(e.timestamp).toLocaleTimeString()}</span>
              <span className="shrink-0" style={{ color: 'var(--accent-blue)' }}>{e.name}</span>
              {e.payload !== undefined && (
                <span className="flex-1 truncate opacity-60">
                  {typeof e.payload === 'object' ? JSON.stringify(e.payload).slice(0, 200) : String(e.payload)}
                </span>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
