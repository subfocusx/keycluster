// ============================================================
// KeyCluster — Save Status Indicator (Toolbar)
// ============================================================
//
// Compact save status indicator for the app toolbar.
// Shows: saving animation, saved time, error, or nothing.
//
// IMPORTANT: This component uses ONLY dynamic imports inside
// useEffect to avoid pulling project-service (and its heavy
// dependency chain: SaveQueue, Transport, Store, etc.) into
// the SSR/client bundle at module level.
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// ---- Types ----

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ---- Icon helper ----

function MIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

// ---- Component ----

export function SaveStatusIndicator() {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [lastSave, setLastSave] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [unsaved, setUnsaved] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    let cancelled = false;

    // Load project-service dynamically to avoid SSR issues
    import('@/core/project-service').then((svc) => {
      if (cancelled) return;

      const updateStatus = () => {
        try {
          setStatus(svc.getSaveStatus());
          setLastSave(svc.getLastSaveTime());
          setError(svc.getLastSaveError());
          setUnsaved(svc.getHasUnsavedChanges());
        } catch {
          // Service not available
        }
      };

      // Initial check
      updateStatus();

      // Poll every 2 seconds
      const interval = setInterval(updateStatus, 2000);

      // Cleanup on unmount
      return () => clearInterval(interval);
    }).catch(() => {
      // project-service not available (e.g., during SSR)
    });

    return () => { cancelled = true; };
  }, []);

  // Don't render until client-side mounted
  if (!mounted) return null;

  // Don't render anything if no project is loaded
  if (status === 'idle' && !unsaved && lastSave === 0) {
    return null;
  }

  const timeStr = lastSave > 0
    ? new Date(lastSave).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  let icon: React.ReactNode;
  let label: string;
  let colorClass: string;

  if (status === 'saving') {
    icon = <MIcon name="sync" className="!text-[15px] animate-spin" />;
    label = 'Сохранение...';
    colorClass = 'text-[var(--kc-blue)]';
  } else if (status === 'error') {
    icon = <MIcon name="error" className="!text-[15px]" />;
    label = error ?? 'Ошибка сохранения';
    colorClass = 'text-[var(--kc-red)]';
  } else if (unsaved) {
    icon = <MIcon name="cloud_upload" className="!text-[15px]" />;
    label = 'Есть несохранённые изменения';
    colorClass = 'text-[var(--kc-text-secondary)]';
  } else if (status === 'saved' && timeStr) {
    icon = <MIcon name="cloud_done" className="!text-[15px] text-green-500" />;
    label = `Сохранено в ${timeStr}`;
    colorClass = 'text-[var(--kc-text-secondary)]';
  } else {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`flex items-center gap-1 cursor-default select-none ${colorClass}`}>
          {icon}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-[11px]">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
