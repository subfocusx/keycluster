import type { AIQueueItem } from 'plugin-sdk';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAIStore } from 'plugin-sdk';
// ⚠ PROTECTED: Do NOT add features/blocks to this popup without approval.

const STATUS_COLORS: Record<AIQueueItem['status'], string> = {
  pending: '#4A90D9',
  processing: '#4A90D9',
  completed: '#4CAF50',
  cancelled: '#F57C00',
  failed: '#D32F2F',
};

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}м ${s % 60}с`;
  return `${s}.${Math.floor((ms % 1000) / 100)}с`;
}

function AIProgressPopup() {
  const queue = useAIStore(s => s.queue);
  const service = useAIStore(s => s.service);
  const [minimized, setMinimized] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  const active = queue.find(q => q.status === 'processing' || q.status === 'pending');

  useEffect(() => {
    if (active && !active.startedAt && active.status === 'processing') {
      useAIStore.getState().updateQueueItem(active.id, { startedAt: Date.now() });
    }
    if (active?.startedAt) {
      startTimeRef.current = active.startedAt;
    } else if (!active) {
      startTimeRef.current = null;
      setElapsed(0);
    }
  }, [active?.id, active?.status, active?.startedAt]);

  useEffect(() => {
    if (!startTimeRef.current) return;
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTimeRef.current!);
    }, 200);
    return () => clearInterval(interval);
  }, [active?.id]);

  const statusColor = active ? STATUS_COLORS[active.status] : STATUS_COLORS.processing;

  const handleStop = useCallback(() => {
    const aiState = useAIStore.getState();
    aiState.cancelAll();
    aiState.addLog('warn', '[AI] Все задачи остановлены пользователем');
  }, []);

  const handleClose = useCallback(() => {
    if (!active) return;
    if (active.status === 'completed' || active.status === 'cancelled' || active.status === 'failed') {
      useAIStore.getState().removeQueueItem(active.id);
    }
  }, [active]);

  if (!active) return null;

  if (minimized) {
    return (
      <div
        className="fixed bottom-3 right-3 z-50 flex items-center gap-2 px-2.5 py-1 rounded-[4px] cursor-pointer shadow-lg border transition-all duration-200 hover:opacity-90"
        style={{
          backgroundColor: 'var(--kc-surface)',
          borderColor: statusColor,
        }}
        onClick={() => setMinimized(false)}
      >
        <span className="material-symbols-outlined !text-[12px]" style={{ color: statusColor }}>auto_awesome</span>
        <span className="text-[10px] font-medium" style={{ color: statusColor }}>{active.label}</span>
        <span className="text-[9px] tabular-nums" style={{ color: statusColor }}>{active.progress}%</span>
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-3 right-3 z-50 w-[300px] rounded-[6px] shadow-lg border overflow-hidden transition-all duration-200"
      style={{ backgroundColor: 'var(--kc-surface)', borderColor: 'var(--kc-border)' }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--kc-border-light)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined !text-[16px] shrink-0" style={{ color: statusColor }}>auto_awesome</span>
          <div className="min-w-0">
            <div className="text-[11px] font-medium truncate">{active.label}</div>
            {active.status === 'processing' && startTimeRef.current && (
              <div className="text-[9px] text-[var(--kc-text-secondary)]">{formatElapsed(elapsed)}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            className="w-5 h-5 flex items-center justify-center rounded-[3px] hover:bg-[var(--kc-surface-hover)] cursor-pointer text-[var(--kc-text-secondary)]"
            onClick={() => setMinimized(true)}
          >
            <span className="material-symbols-outlined !text-[12px]">minimize</span>
          </button>
          <button
            className="w-5 h-5 flex items-center justify-center rounded-[3px] hover:bg-[var(--kc-surface-hover)] cursor-pointer text-[var(--kc-text-secondary)]"
            onClick={handleClose}
          >
            <span className="material-symbols-outlined !text-[12px]">close</span>
          </button>
        </div>
      </div>

      <div className="px-3 py-2 space-y-1.5">
        <div className="w-full h-1.5 rounded-[2px] overflow-hidden" style={{ backgroundColor: 'var(--kc-border-light)' }}>
          <div
            className="h-full rounded-[2px] transition-all duration-300 ease-out"
            style={{ width: `${active.progress}%`, backgroundColor: statusColor }}
          />
        </div>
        <div className="flex items-center justify-between text-[9px] text-[var(--kc-text-secondary)] tabular-nums">
          <span>{active.progress}%</span>
          <span>Batch {active.processed}/{active.total}</span>
          {startTimeRef.current && <span>{formatElapsed(elapsed)}</span>}
        </div>
        <div className="text-[9px] text-[var(--kc-text-secondary)]">
          {active.status === 'processing' && 'Processing...'}
          {active.status === 'completed' && 'Completed'}
          {active.status === 'cancelled' && 'Cancelled'}
          {active.status === 'failed' && `Failed`}
          {active.error && <span className="text-[var(--kc-red)] ml-1">{active.error}</span>}
        </div>
      </div>

      {active.status === 'processing' && (
        <div className="px-3 py-1.5 border-t flex justify-end" style={{ borderColor: 'var(--kc-border-light)' }}>
          <button
            className="px-3 py-0.5 text-[9px] font-medium rounded-[3px] border transition-colors cursor-pointer hover:bg-[var(--kc-red-light)]"
            style={{ borderColor: 'var(--kc-red)', color: 'var(--kc-red)' }}
            onClick={handleStop}
          >
            STOP
          </button>
        </div>
      )}
    </div>
  );
}

export default AIProgressPopup;
