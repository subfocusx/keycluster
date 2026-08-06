// ============================================================
// Unit tests for AutoSaveSettings component (using Vitest)
// ============================================================

import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { AutoSaveSettings } from '@/components/AutoSaveSettings';
import * as projectService from '@/plugin-sdk';

vi.mock('@/core/project-service', () => ({
  isAutoSaveEnabled: vi.fn(() => false),
  enableAutoSave: vi.fn(),
  disableAutoSave: vi.fn(),
  getAutoSaveIntervalMinutes: vi.fn(() => 10),
  setAutoSaveIntervalMinutes: vi.fn(),
  getSaveStatus: vi.fn(() => 'idle'),
  getLastSaveTime: vi.fn(() => 0),
  getLastSaveError: vi.fn(() => null),
}));

describe('AutoSaveSettings', () => {
  it('toggles auto-save on and off', () => {
    render(<AutoSaveSettings />);
    const toggle = screen.getByRole('switch');
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    expect(projectService.enableAutoSave).toHaveBeenCalled();
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(projectService.disableAutoSave).toHaveBeenCalled();
    expect(toggle).not.toBeChecked();
  });

  it('changes preset interval', async () => {
    const ue = userEvent.setup();
    render(<AutoSaveSettings />);
    const toggle = screen.getByRole('switch');
    await ue.click(toggle);
    await ue.click(screen.getByRole('combobox'));
    await ue.click(screen.getByRole('option', { name: '20 мин' }));
    expect(projectService.setAutoSaveIntervalMinutes).toHaveBeenCalledWith(20);
  });

  it('handles custom interval input', async () => {
    const ue = userEvent.setup();
    render(<AutoSaveSettings />);
    const toggle = screen.getByRole('switch');
    await ue.click(toggle);
    await ue.click(screen.getByRole('combobox'));
    await ue.click(screen.getByRole('option', { name: 'Свой...' }));
    const input = screen.getByPlaceholderText('мин');
    await ue.type(input, '30');
    await ue.tab();
    expect(projectService.setAutoSaveIntervalMinutes).toHaveBeenCalledWith(30);
  });
});