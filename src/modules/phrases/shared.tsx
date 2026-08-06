// ============================================================
// Module: Phrases — Shared constants, types, and utilities
// ============================================================

import React from 'react';
import { useSyncExternalStore } from 'react';
import { labelRegistry } from '@/plugin-sdk';
import { MIcon } from '@/shell/shared-icon';

// ---- Dynamic color labels from registry ----

export function useLabels() {
  return useSyncExternalStore(
    labelRegistry.subscribe.bind(labelRegistry),
    labelRegistry.getAll.bind(labelRegistry),
  );
}

export const LABEL_COLORS = labelRegistry.getAll().map(l => ({ value: l.value, name: l.name }));
export const LABEL_NAMES: Record<string, string> = Object.fromEntries(
  labelRegistry.getAll().map(l => [l.name, l.displayName])
);
export const LABEL_COLOR_MAP: Record<string, string> = Object.fromEntries(
  labelRegistry.getAll().map(l => [l.name, l.value])
);

// ---- Color palette for columns (same as groups) ----

export const COLUMN_COLORS = [
  { value: '#4A90D9', label: 'Синий' },
  { value: '#E67E22', label: 'Оранжевый' },
  { value: '#2ECC71', label: 'Зелёный' },
  { value: '#E74C3C', label: 'Красный' },
  { value: '#9B59B6', label: 'Фиолетовый' },
  { value: '#1ABC9C', label: 'Бирюзовый' },
  { value: '#F1C40F', label: 'Жёлтый' },
  { value: '#E91E8C', label: 'Розовый' },
  { value: '#7F8C8D', label: 'Серый' },
  { value: '#34495E', label: 'Тёмно-серый' },
];

// ---- Column definition ----

export interface ColDef {
  key: string;
  label: string;
  width: number;
  minWidth: number;
  maxWidth: number;
  align: 'left' | 'right';
  sortable: boolean;
  visible: boolean;
}

export const CHECKBOX_COL = 32;

// ---- Column filter types ----

export interface ColumnFilter {
  type: 'eq' | 'gt' | 'lt';
  value: string;
}

export type ColumnFilters = Record<string, ColumnFilter | null>;

// Determine if a column key is numeric
export function isNumericColumn(key: string): boolean {
  return key === 'frequency' || key === 'kei' || key === 'cpc';
}
