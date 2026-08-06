// ============================================================
// PanelManager — Side Panels, Resizable Panels, and Status Bar
// v2: Dynamic — resolves tool panels from ribbon:tools slot registry
// Manages left overlay panel, right resizable panel, and status bar
// Modals (ToolModal, TrashModal) extracted to src/components/modals/
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { TrashModal } from '@/components/modals/TrashModal';
import { ToolModal, PluginToolModal } from '@/components/modals/ToolModal';
import { LeftOverlayPanel } from './left-overlay-panel';
import { ModuleGuard } from './ModuleGuard';
import { getRuntime, TOOL_REGISTRY, getEventBus } from '@/plugin-sdk';
import type { ModuleUIContribution } from '@/plugin-sdk';

export { ResizablePanel } from './resizable-panel';
export { StatusBar } from './status-bar';

const BUILTIN_TOOL_MODULES = Object.keys(TOOL_REGISTRY);

export interface PanelManagerProps {
  ctx: any;
  toolModal: string | null;
  onToolModalChange: (id: string | null) => void;
  trashOpen: boolean;
  onTrashOpenChange: (v: boolean) => void;
}

export function PanelManager({
  ctx, toolModal, onToolModalChange, trashOpen, onTrashOpenChange,
}: PanelManagerProps) {
  const [toolContribs, setToolContribs] = useState<ModuleUIContribution[]>([]);

  useEffect(() => {
    const update = () => {
      const rt = getRuntime();
      if (rt) setToolContribs(rt.getUIContributions('ribbon:tools'));
    };
    update();
    const bus = getEventBus();
    const unsubs = ['module:initialized', 'module:enabled', 'module:disabled'].map(e =>
      bus.on(e, update)
    );
    return () => unsubs.forEach(u => u());
  }, []);

  const builtinContribs = toolContribs.filter(c => c.moduleId && BUILTIN_TOOL_MODULES.includes(c.moduleId));
  const userContribs = toolContribs.filter(c => c.moduleId && !BUILTIN_TOOL_MODULES.includes(c.moduleId));

  return (
    <>
      <LeftOverlayPanel ctx={ctx} />

      {builtinContribs.filter(c => c.component).map(contrib => (
        <ModuleGuard key={contrib.moduleId} moduleId={contrib.moduleId!}>
          <ToolModal
            open={toolModal === contrib.moduleId}
            onOpenChange={(o) => onToolModalChange(o ? contrib.moduleId! : null)}
            title={contrib.label}
            icon={contrib.icon || 'extension'}
            moduleId={contrib.moduleId!}
            ctx={ctx}
            PanelComponent={contrib.component!}
          />
        </ModuleGuard>
      ))}

      <PluginToolModal
        activeTool={toolModal}
        onClose={() => onToolModalChange(null)}
      />

      <TrashModal open={trashOpen} onOpenChange={onTrashOpenChange} ctx={ctx} />
    </>
  );
}
