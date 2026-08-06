import React, { useState, useEffect, useCallback } from 'react';
import { getCurrentProjectId, getCurrentProjectName } from '@/core/project-service-state';
import { restoreSnapshot, getBackupManagerInstance } from '@/core/project-service';
import type { SnapshotItem } from '@/core/project-types';

export function SnapshotsTab() {
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const pid = getCurrentProjectId();
    if (!pid) { setSnapshots([]); return; }
    setLoading(true);
    setError(null);
    try {
      const items = await getBackupManagerInstance().listSnapshots(pid);
      setSnapshots(items);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleRestore = async (backupId: string) => {
    setRestoring(backupId);
    setError(null);
    setSuccessMsg(null);
    try {
      const ok = await restoreSnapshot(backupId);
      if (ok) {
        setSuccessMsg('Snapshot restored');
        await refresh();
      } else {
        setError('Failed to restore snapshot');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRestoring(null);
    }
  };

  const pid = getCurrentProjectId();
  const pname = getCurrentProjectName();

  return (
    <div className="h-full flex flex-col p-2 gap-2">
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[11px] font-semibold opacity-70">
          Snapshots{pid ? ` — ${pname ?? pid}` : ''}
        </span>
        <div className="flex-1" />
        <span className="text-[10px] opacity-50">{snapshots.length} snapshots</span>
        <button
          className="px-1.5 py-0.5 rounded text-[10px] border cursor-pointer opacity-60 hover:opacity-100"
          style={{ borderColor: 'var(--border-color)' }}
          onClick={refresh}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="text-[10px] px-2 py-1 rounded" style={{ backgroundColor: 'var(--accent-red)', color: '#fff' }}>
          {error}
        </div>
      )}

      {successMsg && (
        <div className="text-[10px] px-2 py-1 rounded" style={{ backgroundColor: 'var(--accent-green)', color: '#fff' }}>
          {successMsg}
        </div>
      )}

      {!pid && (
        <div className="flex-1 flex items-center justify-center text-[11px] opacity-40">
          No project loaded
        </div>
      )}

      {pid && snapshots.length === 0 && !loading && (
        <div className="flex-1 flex items-center justify-center text-[11px] opacity-40">
          No snapshots yet
        </div>
      )}

      {snapshots.length > 0 && (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                <th className="px-1.5 py-1 text-left font-semibold opacity-60">Date</th>
                <th className="px-1.5 py-1 text-left font-semibold opacity-60">Label</th>
                <th className="px-1.5 py-1 text-right font-semibold opacity-60">Groups</th>
                <th className="px-1.5 py-1 text-right font-semibold opacity-60">Phrases</th>
                <th className="px-1.5 py-1 text-center font-semibold opacity-60">Type</th>
                <th className="px-1.5 py-1 text-right font-semibold opacity-60" />
              </tr>
            </thead>
            <tbody>
              {snapshots.map(s => (
                <tr key={s.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--border-color)' }}>
                  <td className="px-1.5 py-[3px] whitespace-nowrap font-mono text-[9px]">
                    {new Date(s.createdAt).toLocaleString()}
                  </td>
                  <td className="px-1.5 py-[3px]">{s.label || '-'}</td>
                  <td className="px-1.5 py-[3px] text-right">{s.groupCount}</td>
                  <td className="px-1.5 py-[3px] text-right">{s.phraseCount}</td>
                  <td className="px-1.5 py-[3px] text-center">
                    <span className="px-1 rounded text-[9px]" style={{
                      backgroundColor: s.auto ? 'var(--accent-blue)' : 'var(--accent-green)',
                      color: '#fff',
                    }}>
                      {s.auto ? 'auto' : 'manual'}
                    </span>
                  </td>
                  <td className="px-1.5 py-[3px] text-right">
                    <button
                      className="px-1.5 py-0.5 rounded text-[9px] border cursor-pointer opacity-60 hover:opacity-100 disabled:opacity-30"
                      style={{ borderColor: 'var(--border-color)' }}
                      onClick={() => handleRestore(s.id)}
                      disabled={restoring === s.id}
                    >
                      {restoring === s.id ? 'Restoring...' : 'Restore'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
