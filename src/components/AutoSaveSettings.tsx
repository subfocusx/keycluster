import type { SaveStatus } from '@/plugin-sdk';
// ============================================================
// KeyCluster — Auto-Save Settings Component
// ============================================================
//
// Provides UI for enabling/disabling auto-save and configuring
// the save interval. Includes:
//   - Checkbox to enable/disable auto-save
//   - Preset interval selector (3, 10, 20 min, 1h, 2h)
//   - Custom interval input field
//   - Save status indicator (saving/saved/error)
// ============================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  enableAutoSave,
  disableAutoSave,
  isAutoSaveEnabled,
  getAutoSaveIntervalMinutes,
  setAutoSaveIntervalMinutes,
  getSaveStatus,
  getLastSaveTime,
  getLastSaveError as getLastError,
} from '@/plugin-sdk';

// ---- Icon helper ----

function MIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

// ---- Preset intervals ----

const INTERVAL_PRESETS = [
  { value: '3', label: '3 мин' },
  { value: '10', label: '10 мин' },
  { value: '20', label: '20 мин' },
  { value: '60', label: '1 час' },
  { value: '120', label: '2 часа' },
  { value: 'custom', label: 'Свой...' },
] as const;

// ---- Save Status Indicator ----

function SaveStatusIndicator({ status, lastSave, error }: {
  status: SaveStatus;
  lastSave: number;
  error: string | null;
}) {
  const timeStr = lastSave > 0
    ? new Date(lastSave).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1 text-[11px] text-[var(--kc-blue)]">
        <MIcon name="sync" className="!text-[13px] animate-spin" />
        Сохранение...
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span className="flex items-center gap-1 text-[11px] text-[var(--kc-red)]" title={error ?? undefined}>
        <MIcon name="error" className="!text-[13px]" />
        Ошибка сохранения
      </span>
    );
  }

  if (status === 'saved' && timeStr) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-[var(--kc-text-secondary)]">
        <MIcon name="cloud_done" className="!text-[13px] text-green-500" />
        Сохранено в {timeStr}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-[11px] text-[var(--kc-text-disabled)]">
      <MIcon name="cloud_off" className="!text-[13px]" />
      Не сохранено
    </span>
  );
}

// ---- Auto-Save Settings Component ----

interface AutoSaveSettingsProps {
  /** Compact mode — for inline use in dialogs */
  compact?: boolean;
}

export function AutoSaveSettings({ compact = false }: AutoSaveSettingsProps) {
  const [enabled, setEnabled] = useState(isAutoSaveEnabled());
  const [currentMinutes, setCurrentMinutes] = useState(getAutoSaveIntervalMinutes());
  const [selectValue, setSelectValue] = useState<string>(() => {
    const min = getAutoSaveIntervalMinutes();
    const preset = INTERVAL_PRESETS.find(p => p.value !== 'custom' && Number(p.value) === min);
    return preset ? preset.value : 'custom';
  });
  const [customValue, setCustomValue] = useState(() => {
    const min = getAutoSaveIntervalMinutes();
    const preset = INTERVAL_PRESETS.find(p => p.value !== 'custom' && Number(p.value) === min);
    return preset ? '' : String(min);
  });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSave, setLastSave] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  // Poll save status for the indicator
  useEffect(() => {
    const interval = setInterval(() => {
      setSaveStatus(getSaveStatus());
      setLastSave(getLastSaveTime());
      setLastError(getLastError());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = useCallback((checked: boolean) => {
    if (checked) {
      enableAutoSave();
    } else {
      disableAutoSave();
    }
    setEnabled(checked);
  }, []);

  const handleIntervalChange = useCallback((value: string) => {
    setSelectValue(value);
    if (value === 'custom') {
      // Don't change interval yet — wait for custom input
      return;
    }
    const minutes = Number(value);
    setAutoSaveIntervalMinutes(minutes);
    setCurrentMinutes(minutes);
  }, []);

  const handleCustomValueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomValue(e.target.value);
  }, []);

  const handleCustomValueCommit = useCallback(() => {
    const minutes = Number(customValue);
    if (minutes >= 1 && minutes <= 120) {
      setAutoSaveIntervalMinutes(minutes);
      setCurrentMinutes(minutes);
    }
  }, [customValue]);

  const handleCustomKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCustomValueCommit();
    }
  }, [handleCustomValueCommit]);

  if (compact) {
    return (
      <div className="space-y-2">
        {/* Toggle + status in compact mode */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch checked={enabled} onCheckedChange={handleToggle} id="auto-save-toggle" />
            <Label htmlFor="auto-save-toggle" className="text-[12px] cursor-pointer">
              Автосохранение
            </Label>
          </div>
          <SaveStatusIndicator status={saveStatus} lastSave={lastSave} error={lastError} />
        </div>

        {/* Interval selector */}
        {enabled && (
          <div className="flex items-center gap-2 pl-1">
            <span className="text-[11px] text-[var(--kc-text-secondary)]">Интервал:</span>
            <Select value={selectValue} onValueChange={handleIntervalChange}>
              <SelectTrigger className="h-6 text-[11px] w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVAL_PRESETS.map(preset => (
                  <SelectItem key={preset.value} value={preset.value} className="text-[11px]">
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectValue === 'custom' && (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={customValue}
                  onChange={handleCustomValueChange}
                  onBlur={handleCustomValueCommit}
                  onKeyDown={handleCustomKeyDown}
                  className="h-6 w-[60px] text-[11px] px-1.5"
                  placeholder="мин"
                />
                <span className="text-[11px] text-[var(--kc-text-secondary)]">мин</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full mode
  return (
    <div className="space-y-3 p-3 border border-[var(--kc-border)] rounded-[3px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MIcon name="sync" className="!text-[18px] text-[var(--kc-blue)]" />
          <span className="font-h2 text-[13px]">Автосохранение</span>
        </div>
        <Switch checked={enabled} onCheckedChange={handleToggle} id="auto-save-toggle-full" />
      </div>

      {/* Status */}
      <SaveStatusIndicator status={saveStatus} lastSave={lastSave} error={lastError} />

      {/* Interval configuration */}
      {enabled && (
        <div className="space-y-2 pl-1">
          <Label className="text-[11px] text-[var(--kc-text-secondary)]">Интервал сохранения</Label>
          <div className="flex items-center gap-2">
            <Select value={selectValue} onValueChange={handleIntervalChange}>
              <SelectTrigger className="h-7 text-[12px] w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVAL_PRESETS.map(preset => (
                  <SelectItem key={preset.value} value={preset.value} className="text-[12px]">
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectValue === 'custom' && (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={customValue}
                  onChange={handleCustomValueChange}
                  onBlur={handleCustomValueCommit}
                  onKeyDown={handleCustomKeyDown}
                  className="h-7 w-[70px] text-[12px] px-2"
                  placeholder="мин"
                  autoFocus
                />
                <span className="text-[12px] text-[var(--kc-text-secondary)]">минут</span>
              </div>
            )}
          </div>
          <p className="text-[10px] text-[var(--kc-text-disabled)]">
            Изменения сохраняются автоматически через указанный интервал после последнего редактирования.
          </p>
        </div>
      )}
    </div>
  );
}
