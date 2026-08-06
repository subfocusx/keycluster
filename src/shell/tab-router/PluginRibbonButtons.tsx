import type { ModuleUIContribution } from '@/plugin-sdk';
import React, { useState } from 'react';
import { getRuntime } from '@/plugin-sdk';
import { pluginRegistry } from '@/plugin-sdk';
import { MIcon } from '@/shell/shared-icon';
import { useRuntimeEvents } from '@/shell/useRuntimeEvents';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

export function PluginRibbonButtons({ onToolOpen, activeTool }: { onToolOpen: (id: string) => void; activeTool: string | null }) {
  const [contributions, setContributions] = useState<ModuleUIContribution[]>([]);

  useRuntimeEvents(() => {
    const rt = getRuntime();
    if (!rt) return;
    const all = rt.getUIContributions('ribbon:tools');
    const userOnly = all.filter(c => {
      if (!c.moduleId) return false;
      const record = pluginRegistry.get(c.moduleId);
      return record?.source === 'user';
    });
    setContributions(userOnly);
  });

  if (contributions.length === 0) return null;

  const VISIBLE_LIMIT = 5;
  const visible = contributions.slice(0, VISIBLE_LIMIT);
  const overflow = contributions.slice(VISIBLE_LIMIT);

  return (
    <>
      {visible.map((c) => {
        const moduleId = c.moduleId ?? 'unknown';
        return (
          <button
            key={moduleId}
            className={`ribbon-btn ${activeTool === moduleId ? 'active' : ''}`}
            title={c.label}
            onClick={() => c.action ? (c.action as () => void)() : onToolOpen(moduleId)}
          >
            <MIcon name={c.icon || 'extension'} className="ribbon-icon" />
            <span className="ribbon-label">{c.label}</span>
          </button>
        );
      })}
      {overflow.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ribbon-btn" title={`Ещё ${overflow.length} плагинов`}>
              <MIcon name="more_horiz" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {overflow.map(c => (
              <DropdownMenuItem key={c.moduleId ?? 'unknown'} onClick={() => c.action ? (c.action as () => void)() : onToolOpen(c.moduleId!)}>
                <MIcon name={c.icon || 'extension'} className="mr-2" />
                {c.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}