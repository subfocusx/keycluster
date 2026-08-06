import { useState, useEffect } from 'react';
import { getRuntime, getEventBus } from '@/plugin-sdk';

export function useModuleEnabled(moduleId: string): boolean {
  const [enabled, setEnabled] = useState(() => {
    const rt = getRuntime();
    return rt ? !rt.isModuleDisabled(moduleId) : true;
  });

  useEffect(() => {
    const check = () => {
      const rt = getRuntime();
      setEnabled(rt ? !rt.isModuleDisabled(moduleId) : true);
    };

    const bus = getEventBus();
    if (!bus) return;

    const unsubs = [
      bus.on('module:disabled', (p: { id: string }) => { if (p.id === moduleId) check(); }),
      bus.on('module:enabled', (p: { id: string }) => { if (p.id === moduleId) check(); }),
      bus.on('module:error', (p: { moduleId: string }) => { if (p.moduleId === moduleId) check(); }),
      bus.on('module:reloaded', (p: { id: string }) => { if (p.id === moduleId) check(); }),
    ];
    return () => unsubs.forEach(u => u());
  }, [moduleId]);

  return enabled;
}
