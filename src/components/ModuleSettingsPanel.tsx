// ============================================================
// KeyCluster Module Settings Panel — авто-рендер формы по схеме
// ============================================================
//
// Принимает manifest модуля со settingsSchema,
// рендерит форму автоматически:
//   boolean → Switch (shadcn)
//   string  → Input
//   number  → Input[type=number]
//   select  → Select (shadcn)
//
// Сохранение onChange (без кнопки Submit)
// ============================================================

'use client';

import React from 'react';
import type { ModuleManifest, SettingFieldSchema } from '@/plugin-sdk';
import { useSettingsStore } from '@/plugin-sdk';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface ModuleSettingsPanelProps {
  manifest: ModuleManifest;
}

export default function ModuleSettingsPanel({ manifest }: ModuleSettingsPanelProps) {
  const { settings, setModuleSetting } = useSettingsStore();
  const schema = manifest.settingsSchema;

  if (!schema || schema.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[13px] text-[var(--kc-text-disabled)]">
        У модуля нет настраиваемых параметров
      </div>
    );
  }

  const moduleSettings = settings[manifest.id] ?? {};

  // Initialize defaults if missing
  const getEffectiveValue = (field: SettingFieldSchema): unknown => {
    if (field.key in moduleSettings) return moduleSettings[field.key];
    return field.default;
  };

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="text-[14px] font-semibold text-[var(--kc-text)]">
        {manifest.name}
      </div>
      <div className="text-[12px] text-[var(--kc-text-secondary)]">
        {manifest.description}
      </div>

      <div className="h-px bg-[var(--kc-border)]" />

      {schema.map(field => {
        const value = getEffectiveValue(field);

        return (
          <div key={field.key} className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <Label className="text-[13px] text-[var(--kc-text)] leading-tight">
                {field.label}
              </Label>
              {field.type === 'select' && field.options && (
                <div className="mt-1.5">
                  <Select
                    value={String(value ?? field.default)}
                    onValueChange={v => setModuleSetting(manifest.id, field.key, v)}
                  >
                    <SelectTrigger className="h-8 text-[12px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map(opt => (
                        <SelectItem key={opt} value={opt} className="text-[12px]">
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {field.type === 'string' && (
                <Input
                  className="mt-1.5 h-8 text-[12px]"
                  value={String(value ?? field.default)}
                  onChange={e => setModuleSetting(manifest.id, field.key, e.target.value)}
                />
              )}
              {field.type === 'number' && (
                <Input
                  type="number"
                  className="mt-1.5 h-8 text-[12px] w-32"
                  value={String(value != null ? Number(value).toFixed(2).replace(/\.?0+$/, '') : field.default)}
                  min={field.min}
                  max={field.max}
                  step={field.step ?? 1}
                  onChange={e => {
                    const num = Number(e.target.value);
                    if (!isNaN(num)) setModuleSetting(manifest.id, field.key, num);
                  }}
                />
              )}
            </div>

            {field.type === 'boolean' && (
              <Switch
                checked={Boolean(value ?? field.default)}
                onCheckedChange={v => setModuleSetting(manifest.id, field.key, v)}
                className="mt-0.5"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
