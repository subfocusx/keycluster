'use client';

import React from 'react';
import { Slider, RadioGroup, RadioGroupItem, Label, Checkbox } from 'plugin-sdk';

function MIcon({ name, className = '', style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}

export interface ClusteringSettingsProps {
  algorithm: 'words' | 'jaccard';
  onAlgorithmChange: (v: 'words' | 'jaccard') => void;
  strength: number;
  onStrengthChange: (v: number) => void;
  minGroupSize: number;
  onMinGroupSizeChange: (v: number) => void;
  lemmatize: boolean;
  onLemmatizeChange: (v: boolean) => void;
  ignoreNumbers: boolean;
  onIgnoreNumbersChange: (v: boolean) => void;
  splitByStrength: boolean;
  onSplitByStrengthChange: (v: boolean) => void;
  scanMode: 'narrow-to-wide' | 'wide-to-narrow';
  onScanModeChange: (v: 'narrow-to-wide' | 'wide-to-narrow') => void;
  synonymsText: string;
  onSynonymsTextChange: (v: string) => void;
  stopWordsText: string;
  onStopWordsTextChange: (v: string) => void;
}

export function ClusteringSettings(props: ClusteringSettingsProps) {
  return (
    <>
      <div style={{ maxWidth: '100%' }}>
        <Label className="text-[12px] font-semibold text-[var(--kc-text)]">Алгоритм</Label>
        <RadioGroup
          value={props.algorithm}
          onValueChange={v => props.onAlgorithmChange(v as 'words' | 'jaccard')}
          className="mt-2 space-y-2"
        >
          <div className="flex items-start gap-2" style={{ maxWidth: '100%' }}>
            <RadioGroupItem value="words" id="words" className="mt-0.5 shrink-0" />
            <div className="min-w-0" style={{ maxWidth: '100%' }}>
              <Label htmlFor="words" className="text-[12px] font-medium">По словам</Label>
              <p className="text-[11px] text-[var(--kc-text-secondary)] mt-0.5">
                Группирует фразы с общими словами. Чем выше сила — тем больше общих слов требуется.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2" style={{ maxWidth: '100%' }}>
            <RadioGroupItem value="jaccard" id="jaccard" className="mt-0.5 shrink-0" />
            <div className="min-w-0" style={{ maxWidth: '100%' }}>
              <Label htmlFor="jaccard" className="text-[12px] font-medium">По составу (Жаккар)</Label>
              <p className="text-[11px] text-[var(--kc-text-secondary)] mt-0.5">
                Сравнивает набор слов по коэффициенту Жаккара в Web Worker. Не блокирует UI.
              </p>
            </div>
          </div>
        </RadioGroup>
      </div>

      <div className="h-px bg-[var(--kc-border-light)]" />

      <div style={{ maxWidth: '100%' }}>
        <div className="flex justify-between items-center mb-1">
          <Label className="text-[12px] font-medium">Сила кластеризации</Label>
          <span className="text-[12px] text-[var(--kc-text-secondary)] font-mono shrink-0">{props.strength}%</span>
        </div>
        <Slider
          value={[props.strength]}
          onValueChange={([v]) => props.onStrengthChange(v)}
          min={10}
          max={90}
          step={5}
          className="mt-1"
        />
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-[var(--kc-text-secondary)]">Слабая</span>
          <span className="text-[10px] text-[var(--kc-text-secondary)]">Сильная</span>
        </div>
      </div>

      <div style={{ maxWidth: '100%' }}>
        <div className="flex justify-between items-center mb-1">
          <Label className="text-[12px] font-medium">Мин. размер группы</Label>
          <span className="text-[12px] text-[var(--kc-text-secondary)] font-mono shrink-0">{props.minGroupSize}</span>
        </div>
        <Slider
          value={[props.minGroupSize]}
          onValueChange={([v]) => props.onMinGroupSizeChange(v)}
          min={1}
          max={10}
          step={1}
          className="mt-1"
        />
      </div>

      <div className="h-px bg-[var(--kc-border-light)]" />

      <div style={{ maxWidth: '100%' }}>
        <Label className="text-[12px] font-semibold text-[var(--kc-text)]">Предобработка</Label>
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="clustering-lemmatize"
              checked={props.lemmatize}
              onCheckedChange={(v) => props.onLemmatizeChange(v === true)}
            />
            <Label htmlFor="clustering-lemmatize" className="text-[12px] font-normal cursor-pointer">Лемматизация</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="clustering-ignore-numbers"
              checked={props.ignoreNumbers}
              onCheckedChange={(v) => props.onIgnoreNumbersChange(v === true)}
            />
            <Label htmlFor="clustering-ignore-numbers" className="text-[12px] font-normal cursor-pointer">Игнорировать числа</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="clustering-split-strength"
              checked={props.splitByStrength}
              onCheckedChange={(v) => props.onSplitByStrengthChange(v === true)}
            />
            <Label htmlFor="clustering-split-strength" className="text-[12px] font-normal cursor-pointer">Разбивать по силе</Label>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '100%' }}>
        <Label className="text-[12px] font-medium">Режим сканирования</Label>
        <RadioGroup
          value={props.scanMode}
          onValueChange={v => props.onScanModeChange(v as 'narrow-to-wide' | 'wide-to-narrow')}
          className="mt-2 space-y-1"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="narrow-to-wide" id="scan-narrow" />
            <Label htmlFor="scan-narrow" className="text-[11px] font-normal cursor-pointer">От точных к широким</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="wide-to-narrow" id="scan-wide" />
            <Label htmlFor="scan-wide" className="text-[11px] font-normal cursor-pointer">От широких к точным</Label>
          </div>
        </RadioGroup>
      </div>

      <div style={{ maxWidth: '100%' }}>
        <Label className="text-[12px] font-medium mb-1 block">Синонимы (слово=замена, по строке)</Label>
        <textarea
          className="w-full min-h-[48px] rounded-[3px] border border-[var(--kc-border)] bg-[var(--kc-surface)] px-2 py-1 text-[11px] resize-y focus:outline-none focus:ring-1 focus:ring-[var(--kc-blue)] focus:border-[var(--kc-blue)]"
          value={props.synonymsText}
          onChange={e => props.onSynonymsTextChange(e.target.value)}
          placeholder={"мрт=магнитно резонансная томография\nseo=поисковая оптимизация"}
        />
      </div>

      <div style={{ maxWidth: '100%' }}>
        <Label className="text-[12px] font-medium mb-1 block">Стоп-слова (через запятую)</Label>
        <textarea
          className="w-full min-h-[48px] rounded-[3px] border border-[var(--kc-border)] bg-[var(--kc-surface)] px-2 py-1 text-[11px] resize-y focus:outline-none focus:ring-1 focus:ring-[var(--kc-blue)] focus:border-[var(--kc-blue)]"
          value={props.stopWordsText}
          onChange={e => props.onStopWordsTextChange(e.target.value)}
          placeholder="в, на, с, и, по, из..."
        />
      </div>
    </>
  );
}
