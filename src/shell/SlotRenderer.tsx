'use client';
import React from 'react';
import { getRuntime, pluginRegistry } from '@/plugin-sdk';
import { useRuntimeEvents } from './useRuntimeEvents';
import type { ModuleUIContribution } from '@/plugin-sdk';
import { ModuleErrorBoundary } from '@/components/ModuleErrorBoundary';

interface SlotRendererProps {
  slot: string;
  ctx?: unknown;
  filterSource?: 'builtin' | 'local' | 'user';
  className?: string;
  /** When true, wraps contributions in a parent div */
  wrapper?: boolean;
}

export function SlotRenderer({ slot, ctx, filterSource, className, wrapper }: SlotRendererProps) {
  const [contributions, setContributions] = React.useState<ModuleUIContribution[]>([]);

  const update = () => {
    const rt = getRuntime();
    if (!rt) { setContributions([]); return; }
    let contribs = rt.getUIContributions(slot);
    if (filterSource) {
      contribs = contribs.filter(c => {
        if (!c.moduleId) return false;
        const record = pluginRegistry.get(c.moduleId);
        return record?.source === filterSource;
      });
    }
    setContributions(contribs);
  };

  useRuntimeEvents(update);

  if (contributions.length === 0) return null;

  const content = contributions.filter(c => c.component).map((c, i) => {
    const Comp = c.component!;
    const moduleId = c.moduleId ?? 'unknown';
    return (
      <ModuleErrorBoundary moduleId={moduleId} key={`${slot}-${moduleId}-${i}`}>
        <Comp ctx={ctx} />
      </ModuleErrorBoundary>
    );
  });

  if (wrapper) return <div className={className}>{content}</div>;
  return <>{content}</>;
}