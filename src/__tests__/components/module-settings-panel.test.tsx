// ============================================================
// Module Settings Panel UI Tests
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModuleSettingsPanel from '@/components/ModuleSettingsPanel';
import { useSettingsStore } from '@/plugin-sdk';
import type { ModuleManifest } from '@/plugin-sdk';

const baseManifest: ModuleManifest = {
  id: 'test-mod',
  name: 'Тестовый модуль',
  version: '1.0',
  description: 'Модуль для тестирования настроек',
  slot: [],
};

const manifestWithSchema: ModuleManifest = {
  ...baseManifest,
  settingsSchema: [
    { key: 'enabled', type: 'boolean', label: 'Включено', default: true },
    { key: 'name', type: 'string', label: 'Имя', default: 'test' },
    { key: 'threshold', type: 'number', label: 'Порог', default: 0.5 },
    { key: 'mode', type: 'select', label: 'Режим', default: 'auto', options: ['auto', 'manual', 'semi'] },
  ],
};

describe('ModuleSettingsPanel', () => {
  beforeEach(() => {
    useSettingsStore.setState({ settings: {} });
  });

  it('should show "no settings" message for module without schema', () => {
    render(<ModuleSettingsPanel manifest={baseManifest} />);
    expect(screen.getByText('У модуля нет настраиваемых параметров')).toBeInTheDocument();
  });

  it('should render module name and description', () => {
    render(<ModuleSettingsPanel manifest={manifestWithSchema} />);
    expect(screen.getByText('Тестовый модуль')).toBeInTheDocument();
    expect(screen.getByText('Модуль для тестирования настроек')).toBeInTheDocument();
  });

  it('should render boolean field as Switch', () => {
    render(<ModuleSettingsPanel manifest={manifestWithSchema} />);
    // Label is rendered
    expect(screen.getByText('Включено')).toBeInTheDocument();
    // Switch button exists (shadcn renders as role="switch")
    const switchEl = screen.getByRole('switch');
    expect(switchEl).toBeInTheDocument();
  });

  it('should render string field as Input', () => {
    render(<ModuleSettingsPanel manifest={manifestWithSchema} />);
    expect(screen.getByText('Имя')).toBeInTheDocument();
    const input = screen.getByDisplayValue('test');
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
  });

  it('should render number field as Input[type=number]', () => {
    render(<ModuleSettingsPanel manifest={manifestWithSchema} />);
    expect(screen.getByText('Порог')).toBeInTheDocument();
    const input = screen.getByDisplayValue('0.5');
    expect(input).toBeInTheDocument();
  });

  it('should render select field with options', async () => {
    render(<ModuleSettingsPanel manifest={manifestWithSchema} />);
    expect(screen.getByText('Режим')).toBeInTheDocument();
    // Select trigger is rendered
    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeInTheDocument();
  });

  it('should update boolean setting on toggle', async () => {
    render(<ModuleSettingsPanel manifest={manifestWithSchema} />);

    const switchEl = screen.getByRole('switch');
    expect(switchEl).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(switchEl);

    const value = useSettingsStore.getState().getModuleSetting('test-mod', 'enabled');
    expect(value).toBe(false);
  });

  it('should update string setting on type', async () => {
    render(<ModuleSettingsPanel manifest={manifestWithSchema} />);

    const input = screen.getByDisplayValue('test');
    await userEvent.clear(input);
    await userEvent.type(input, 'hello');

    const value = useSettingsStore.getState().getModuleSetting('test-mod', 'name');
    expect(value).toBe('hello');
  });

  it('should update number setting on type', async () => {
    render(<ModuleSettingsPanel manifest={manifestWithSchema} />);

    const input = screen.getByDisplayValue('0.5');
    await userEvent.clear(input);
    await userEvent.type(input, '0.8');

    const value = useSettingsStore.getState().getModuleSetting('test-mod', 'threshold');
    expect(value).toBe(0.8);
  });

  it('should use default values when no settings are saved', () => {
    render(<ModuleSettingsPanel manifest={manifestWithSchema} />);

    expect(screen.getByDisplayValue('test')).toBeInTheDocument();
    expect(screen.getByDisplayValue('0.5')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('should use saved values over defaults', () => {
    useSettingsStore.getState().setModuleSetting('test-mod', 'name', 'saved-name');
    useSettingsStore.getState().setModuleSetting('test-mod', 'threshold', 0.9);

    render(<ModuleSettingsPanel manifest={manifestWithSchema} />);

    expect(screen.getByDisplayValue('saved-name')).toBeInTheDocument();
    expect(screen.getByDisplayValue('0.9')).toBeInTheDocument();
  });
});
