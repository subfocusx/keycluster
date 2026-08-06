import React, { useState, useEffect, useRef } from 'react';
import { NetworkStore } from '@/plugin-sdk';
import type { NetworkRecord, NetworkRequestStatus } from '@/plugin-sdk';

const STATUS_COLORS: Record<NetworkRequestStatus, string> = {
  pending:  'var(--accent-blue)',
  success:  'var(--accent-green)',
  error:    'var(--accent-red)',
  aborted:  'var(--text-disabled)',
};

const STATUS_LABELS: Record<NetworkRequestStatus, string> = {
  pending:  '…',
  success:  'OK',
  error:    'ERR',
  aborted:  'ABT',
};

function formatDuration(ms?: number): string {
  if (ms === undefined) return '…';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatSize(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

export function NetworkTab() {
  const [records, setRecords] = useState<NetworkRecord[]>([]);
  const [moduleFilter, setModuleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<NetworkRequestStatus | 'all'>('all');
  const [selected, setSelected] = useState<NetworkRecord | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLenRef = useRef(0);

  useEffect(() => {
    const update = () => setRecords(NetworkStore.getFiltered(
      moduleFilter || undefined,
      statusFilter,
    ));
    const unsub = NetworkStore.subscribe(update);
    update();
    return unsub;
  }, [moduleFilter, statusFilter]);

  useEffect(() => {
    if (autoScroll && records.length > prevLenRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevLenRef.current = records.length;
  }, [records, autoScroll]);

  return (
    <div className="h-full flex flex-col text-[10px]" style={{ color: 'var(--text-primary)' }}>
      <div className="flex items-center gap-2 px-2 py-1 shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
        <button
          className="px-1.5 py-0.5 rounded border cursor-pointer opacity-60 hover:opacity-100"
          style={{ borderColor: 'var(--border)' }}
          onClick={() => { NetworkStore.clear(); setSelected(null); }}
        >
          Очистить
        </button>

        <input
          className="px-1.5 py-0.5 rounded border bg-transparent w-[120px]"
          style={{ borderColor: 'var(--border)' }}
          placeholder="Модуль..."
          value={moduleFilter}
          onChange={e => setModuleFilter(e.target.value)}
        />

        <select
          className="px-1.5 py-0.5 rounded border bg-transparent"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as NetworkRequestStatus | 'all')}
        >
          <option value="all">Все статусы</option>
          <option value="pending">Pending</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
          <option value="aborted">Aborted</option>
        </select>

        <label className="flex items-center gap-1 cursor-pointer opacity-70 ml-auto">
          <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} />
          Auto-scroll
        </label>

        <span className="opacity-50">{records.length} запросов</span>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0" style={{ backgroundColor: 'var(--bg-panel)' }}>
            <tr>
              <th className="text-left px-1.5 py-1 font-medium opacity-60 w-[40px]">Ст.</th>
              <th className="text-left px-1.5 py-1 font-medium opacity-60 w-[40px]">Код</th>
              <th className="text-left px-1.5 py-1 font-medium opacity-60 w-[45px]">Мет.</th>
              <th className="text-left px-1.5 py-1 font-medium opacity-60">URL</th>
              <th className="text-left px-1.5 py-1 font-medium opacity-60 w-[80px]">Модуль</th>
              <th className="text-left px-1.5 py-1 font-medium opacity-60 w-[55px]">Время</th>
              <th className="text-left px-1.5 py-1 font-medium opacity-60 w-[45px]">Разм.</th>
              <th className="text-left px-1.5 py-1 font-medium opacity-60 w-[65px]">Начало</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && (
              <tr>
                <td colSpan={8} className="px-2 py-4 text-center opacity-40">
                  Сетевых запросов нет. Запросы появятся когда плагин вызовет fetch().
                </td>
              </tr>
            )}
            {records.map(rec => (
              <tr
                key={rec.id}
                className="border-b cursor-pointer hover:opacity-80"
                style={{
                  borderColor: 'var(--border)',
                  backgroundColor: selected?.id === rec.id ? 'var(--bg-selected)' : undefined,
                }}
                onClick={() => setSelected(prev => prev?.id === rec.id ? null : rec)}
              >
                <td className="px-1.5 py-0.5 font-mono font-semibold" style={{ color: STATUS_COLORS[rec.status] }}>
                  {STATUS_LABELS[rec.status]}
                </td>
                <td className="px-1.5 py-0.5 opacity-70">{rec.statusCode ?? '—'}</td>
                <td className="px-1.5 py-0.5 font-mono opacity-70">{rec.method}</td>
                <td className="px-1.5 py-0.5 font-mono truncate max-w-[200px]" title={rec.url}>
                  {rec.url}
                </td>
                <td className="px-1.5 py-0.5 opacity-60 truncate" title={rec.moduleId}>{rec.moduleId}</td>
                <td className="px-1.5 py-0.5 opacity-70">{formatDuration(rec.durationMs)}</td>
                <td className="px-1.5 py-0.5 opacity-70">{formatSize(rec.responseSize)}</td>
                <td className="px-1.5 py-0.5 opacity-50">{formatTime(rec.startedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div ref={bottomRef} />
      </div>

      {selected && (
        <div className="shrink-0 border-t p-2 max-h-[120px] overflow-auto font-mono" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-panel)' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold opacity-70">Детали</span>
            <button className="opacity-50 hover:opacity-100 cursor-pointer" onClick={() => setSelected(null)}>✕</button>
          </div>
          <div className="opacity-70 break-all">{selected.method} {selected.url}</div>
          {selected.error && (
            <div className="mt-1" style={{ color: 'var(--accent-red)' }}>
              Ошибка: {selected.error}
            </div>
          )}
          <div className="mt-1 opacity-50">
            Модуль: {selected.moduleId} · Длительность: {formatDuration(selected.durationMs)} · Размер ответа: {formatSize(selected.responseSize)}
          </div>
        </div>
      )}
    </div>
  );
}
