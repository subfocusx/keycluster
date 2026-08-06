import React, { useEffect, useRef } from 'react';
import { useAIStore } from 'plugin-sdk';
function MIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

function LogsSection() {
  const logs = useAIStore(s => s.logs);
  const clearLogs = useAIStore(s => s.clearLogs);
  const debugMode = useAIStore(s => s.debugMode);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  return (
    <div className="space-y-2 flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between shrink-0">
        <span className="font-label-caps text-[var(--text-secondary)]">Логи</span>
        <div className="flex items-center gap-1">
          {debugMode && (
            <span className="text-[8px] text-[var(--accent-orange)] font-mono">
              DEBUG
            </span>
          )}
          <button
            className="tool-btn !w-5 !h-5"
            title="Скопировать логи"
            aria-label="Скопировать логи"
            onClick={() => {
              const text = logs.map(l => `${new Date(l.timestamp).toLocaleString()} [${l.level.toUpperCase()}] ${l.message}${l.duration ? ` (${l.duration}ms)` : ''}`).join('\n');
              navigator.clipboard.writeText(text);
            }}
            disabled={logs.length === 0}
          >
            <MIcon name="content_copy" className="!text-[12px]" />
          </button>
          <button className="tool-btn !w-5 !h-5" title="Очистить логи" aria-label="Очистить логи" onClick={clearLogs}>
            <MIcon name="delete" className="!text-[12px]" />
          </button>
        </div>
      </div>
      <div className="ai-log-area flex-1 overflow-auto compact-scroll p-2 text-[11px] leading-relaxed">
        {logs.length === 0 ? (
          <span className="text-[var(--text-disabled)]">Нет записей</span>
        ) : (
          logs.map(log => (
            <div key={log.id} className={`${log.level === 'error' ? 'text-[var(--accent-red)]' : log.level === 'warn' ? 'text-[var(--accent-orange)]' : 'text-[var(--text-secondary)]'}`}>
              <span className="text-[var(--text-disabled)]">{new Date(log.timestamp).toLocaleTimeString()}</span>
              {' '}{log.message}
              {log.duration && (
                <span className="text-[var(--text-disabled)] ml-1">({log.duration}ms</span>
              )}
              {log.modelName && (
                <span className="text-[var(--text-disabled)]">, {log.modelName}</span>
              )}
              {log.totalTokens && (
                <span className="text-[var(--text-disabled)]">, {log.totalTokens} tok</span>
              )}
              {log.duration && <span className="text-[var(--text-disabled)]">)</span>}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

export { LogsSection };
