import type { ModuleManifest } from '@/plugin-sdk';
import React, { useState, useEffect } from 'react';
import { getRuntime } from '@/plugin-sdk';
import ModuleSettingsPanel from '@/components/ModuleSettingsPanel';

function ModuleSettingsInline({ moduleId }: { moduleId: string }) {
  const [manifest, setManifest] = useState<ModuleManifest | null>(null);

  useEffect(() => {
    const rt = getRuntime();
    if (!rt) return;
    const mod = rt.getModule(moduleId);
    if (mod) {
      setManifest(mod.manifest);
    }
  }, [moduleId]);

  if (!manifest) {
    return (
      <div className="p-3 text-[11px] text-[var(--kc-text-disabled)]">
        Не удалось загрузить информацию о модуле
      </div>
    );
  }

  return (
    <div className="border-t border-[var(--kc-border)] bg-[var(--kc-bg)]">
      <ModuleSettingsPanel manifest={manifest} />
    </div>
  );
}

export { ModuleSettingsInline };
