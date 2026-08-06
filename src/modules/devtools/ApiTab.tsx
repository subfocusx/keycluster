import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface RequestLogEntry {
  method: string;
  path: string;
  status: number;
  timestamp_ms: number;
  duration_ms: number;
}

type ApiStatus = {
  running: boolean;
  port: number;
  uptime_secs: number;
};

export function ApiTab() {
  const [token, setToken] = useState('');
  const [tokenRevealed, setTokenRevealed] = useState(false);
  const [status, setStatus] = useState<ApiStatus | null>(null);
  const [log, setLog] = useState<RequestLogEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [t, s, l] = await Promise.all([
        invoke<string>('get_api_token'),
        invoke<ApiStatus>('get_api_status'),
        invoke<RequestLogEntry[]>('get_api_request_log'),
      ]);
      setToken(t);
      setStatus(s);
      setLog(l);
      setError(null);
    } catch (err: any) {
      setError(err.message ?? String(err));
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const handleRegenerate = async () => {
    try {
      const newToken = await invoke<string>('regenerate_api_token');
      setToken(newToken);
      setTokenRevealed(true);
    } catch (err: any) {
      setError(err.message ?? String(err));
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="h-full flex flex-col p-2 gap-2 text-[11px]">
      {/* Status bar */}
      <div className="flex items-center gap-3 shrink-0 p-2 rounded" style={{ backgroundColor: 'var(--bg-surface)' }}>
        <span>
          <span className={`inline-block w-2 h-2 rounded-full mr-1 ${status?.running ? 'bg-green-500' : 'bg-red-500'}`} />
          {status?.running ? '\u{1F7E2} Running' : '\u{1F534} Stopped'}
        </span>
        <span className="opacity-50">|</span>
        <span>Port: <span className="font-mono">{status?.port ?? '—'}</span></span>
        <span className="opacity-50">|</span>
        <span>Uptime: <span className="font-mono">{status ? `${status.uptime_secs}s` : '—'}</span></span>
      </div>

      {/* Token */}
      <div className="flex items-center gap-2 shrink-0 p-2 rounded" style={{ backgroundColor: 'var(--bg-surface)' }}>
        <span className="font-semibold opacity-70">Token:</span>
        <span className="font-mono text-[10px] flex-1 truncate">
          {tokenRevealed ? token : '\u2022'.repeat(32)}
        </span>
        <button
          className="px-1.5 py-0.5 rounded text-[10px] border cursor-pointer opacity-60 hover:opacity-100"
          style={{ borderColor: 'var(--border-color)' }}
          onClick={() => setTokenRevealed(!tokenRevealed)}
        >
          {tokenRevealed ? 'Hide' : 'Show'}
        </button>
        <button
          className="px-1.5 py-0.5 rounded text-[10px] border cursor-pointer opacity-60 hover:opacity-100"
          style={{ borderColor: 'var(--border-color)' }}
          onClick={handleCopy}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button
          className="px-1.5 py-0.5 rounded text-[10px] border cursor-pointer opacity-60 hover:opacity-100"
          style={{ borderColor: 'var(--border-color)' }}
          onClick={handleRegenerate}
        >
          Regenerate
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="text-[10px] px-2 py-1 rounded" style={{ backgroundColor: 'var(--accent-red)', color: '#fff' }}>
          {error}
        </div>
      )}

      {/* Log table */}
      <div className="flex items-center justify-between shrink-0">
        <span className="font-semibold opacity-70">Request log (last {log.length})</span>
        <button
          className="px-1.5 py-0.5 rounded text-[10px] border cursor-pointer opacity-60 hover:opacity-100"
          style={{ borderColor: 'var(--border-color)' }}
          onClick={refresh}
        >
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-[10px] border-collapse font-mono">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
              <th className="px-1.5 py-1 text-left font-semibold opacity-60">METHOD</th>
              <th className="px-1.5 py-1 text-left font-semibold opacity-60">PATH</th>
              <th className="px-1.5 py-1 text-right font-semibold opacity-60">STATUS</th>
              <th className="px-1.5 py-1 text-right font-semibold opacity-60">TIME</th>
              <th className="px-1.5 py-1 text-right font-semibold opacity-60">DURATION</th>
            </tr>
          </thead>
          <tbody>
            {log.length === 0 && (
              <tr>
                <td colSpan={5} className="px-1.5 py-3 text-center opacity-40">No requests yet</td>
              </tr>
            )}
            {log.map((entry, i) => (
              <tr key={i} className="border-b last:border-b-0" style={{ borderColor: 'var(--border-color)' }}>
                <td className="px-1.5 py-[3px] whitespace-nowrap">{entry.method}</td>
                <td className="px-1.5 py-[3px] truncate max-w-[300px]">{entry.path}</td>
                <td className={`px-1.5 py-[3px] text-right ${
                  entry.status >= 200 && entry.status < 300 ? '' :
                  entry.status >= 400 ? 'text-red-500' : 'text-yellow-500'
                }`}>{entry.status}</td>
                <td className="px-1.5 py-[3px] text-right whitespace-nowrap">{formatTime(entry.timestamp_ms)}</td>
                <td className="px-1.5 py-[3px] text-right">{entry.duration_ms}ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
