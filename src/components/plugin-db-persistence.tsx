import React from 'react';
import { useAppStore } from '@/plugin-sdk';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

function DBPersistenceToggle() {
  const dbPersistenceEnabled = useAppStore(s => s.ui.dbPersistenceEnabled);
  const setDbPersistenceEnabled = useAppStore(s => s.setDbPersistenceEnabled);
  const [intervalMin, setIntervalMin] = React.useState(() => {
    try {
      const { getAutoSaveIntervalMinutes } = require('@/core/project-service');
      return getAutoSaveIntervalMinutes();
    } catch {
      return 3;
    }
  });

  const handleToggle = async (checked: boolean) => {
    setDbPersistenceEnabled(checked);
    if (checked) {
      try {
        const { enableAutoSave, recoverFromCrash, setCurrentProjectId, getCurrentProjectId, setAutoSaveIntervalMinutes } = await import('@/core/project-service');
        setAutoSaveIntervalMinutes(intervalMin);
        if (!getCurrentProjectId()) {
          const result = await recoverFromCrash();
          if (result.success && result.project) {
            setCurrentProjectId(result.project.id);
          }
        }
        enableAutoSave();
      } catch (err) {
        console.error('[PluginManager] Failed to enable auto-save:', err);
      }
    } else {
      try {
        const { disableAutoSave } = await import('@/core/project-service');
        disableAutoSave();
      } catch (err) {
        console.error('[PluginManager] Failed to disable auto-save:', err);
      }
    }
  };

  const handleIntervalChange = async (value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 1 && num <= 60) {
      setIntervalMin(num);
      try {
        const { setAutoSaveIntervalMinutes, isAutoSaveEnabled } = await import('@/core/project-service');
        if (isAutoSaveEnabled()) {
          setAutoSaveIntervalMinutes(num);
        }
      } catch { /* service may not be available */ }
    }
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Switch checked={dbPersistenceEnabled} onCheckedChange={handleToggle} />
      {dbPersistenceEnabled && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Интервал:</span>
          <Input
            type="number"
            min={1}
            max={60}
            value={intervalMin}
            onChange={(e) => handleIntervalChange(e.target.value)}
            className="w-14 h-6 text-xs text-center px-1"
          />
          <span>мин</span>
        </div>
      )}
    </div>
  );
}

export { DBPersistenceToggle };