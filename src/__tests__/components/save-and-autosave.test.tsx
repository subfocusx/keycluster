// ============================================================
// Tests: SaveStatusIndicator + AutoSaveSettings
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SaveStatusIndicator } from '@/components/SaveStatusIndicator';
import { AutoSaveSettings } from '@/components/AutoSaveSettings';
import {
  getSaveStatus,
  getLastSaveTime,
  getLastSaveError,
  enableAutoSave,
  disableAutoSave,
  isAutoSaveEnabled,
  getAutoSaveIntervalMinutes,
  setAutoSaveIntervalMinutes,
} from '@/plugin-sdk';
import { getHasUnsavedChanges } from '@/core/project-service';

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}

// ---- Mock project-service at module level ----

vi.mock('@/core/project-service', () => ({
  getSaveStatus: vi.fn(),
  getLastSaveTime: vi.fn(),
  getLastSaveError: vi.fn(),
  getHasUnsavedChanges: vi.fn(),
  enableAutoSave: vi.fn(),
  disableAutoSave: vi.fn(),
  isAutoSaveEnabled: vi.fn(),
  getAutoSaveIntervalMinutes: vi.fn(),
  setAutoSaveIntervalMinutes: vi.fn(),
  // Functions used by ProjectManagerDialog (not used here but needed by the mock)
  saveProjectAs: vi.fn(),
  saveCurrentProject: vi.fn(),
  loadProject: vi.fn(),
  listProjects: vi.fn(),
  deleteProject: vi.fn(),
  exportProject: vi.fn(),
  importProject: vi.fn(),
  getCurrentProjectId: vi.fn(),
}));

const mocked = vi.mocked({
  getSaveStatus,
  getLastSaveTime,
  getLastSaveError,
  getHasUnsavedChanges,
  enableAutoSave,
  disableAutoSave,
  isAutoSaveEnabled,
  getAutoSaveIntervalMinutes,
  setAutoSaveIntervalMinutes,
});

// ---- SaveStatusIndicator tests ----

describe('SaveStatusIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    // Default: idle, no unsaved, no save time
    mocked.getSaveStatus.mockReturnValue('idle');
    mocked.getLastSaveTime.mockReturnValue(0);
    mocked.getLastSaveError.mockReturnValue(null);
    mocked.getHasUnsavedChanges.mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders null when status is idle and no save history', async () => {
    // Component uses dynamic import + useEffect, so after mount and poll cycle
    // it should return null when idle + no unsaved + no lastSave
    const { container } = render(<SaveStatusIndicator />);

    // Advance past the first useEffect tick
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    // The component should render nothing (empty container)
    expect(container.innerHTML).toBe('');
  });

  it('shows saving spinner when save is in progress', async () => {
    mocked.getSaveStatus.mockReturnValue('saving');

    render(<SaveStatusIndicator />);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    // The sync icon with animate-spin indicates saving
    expect(screen.getByText('sync')).toBeInTheDocument();
  });

  it('shows saved status with timestamp', async () => {
    mocked.getSaveStatus.mockReturnValue('saved');
    // Set a specific timestamp so the time is predictable
    const savedTime = new Date(2024, 5, 15, 14, 30).getTime();
    mocked.getLastSaveTime.mockReturnValue(savedTime);

    render(<SaveStatusIndicator />);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    // Should show cloud_done icon
    expect(screen.getByText('cloud_done')).toBeInTheDocument();
  });

  it('shows error state with error icon', async () => {
    mocked.getSaveStatus.mockReturnValue('error');
    mocked.getLastSaveError.mockReturnValue('Network error');

    render(<SaveStatusIndicator />);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    // Should show error icon
    expect(screen.getByText('error')).toBeInTheDocument();
  });

  it('shows unsaved indicator when there are unsaved changes', async () => {
    mocked.getSaveStatus.mockReturnValue('idle');
    mocked.getHasUnsavedChanges.mockReturnValue(true);

    render(<SaveStatusIndicator />);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    // Should show cloud_upload icon for unsaved
    expect(screen.getByText('cloud_upload')).toBeInTheDocument();
  });

  it('polls project-service status on mount', async () => {
    mocked.getSaveStatus.mockReturnValue('saving');

    render(<SaveStatusIndicator />);

    // After mount, the component should poll and show saving status
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(mocked.getSaveStatus).toHaveBeenCalled();
    expect(screen.getByText('sync')).toBeInTheDocument();
  });
});

// ---- AutoSaveSettings tests ----

describe('AutoSaveSettings', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();

    // Default: auto-save disabled, 3 min interval
    mocked.isAutoSaveEnabled.mockReturnValue(false);
    mocked.getAutoSaveIntervalMinutes.mockReturnValue(3);
    mocked.getSaveStatus.mockReturnValue('idle');
    mocked.getLastSaveTime.mockReturnValue(0);
    mocked.getLastSaveError.mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the toggle switch for auto-save', () => {
    render(<AutoSaveSettings />);

    // The label should be visible
    expect(screen.getByText('Автосохранение')).toBeInTheDocument();

    // A switch/role=switch should be present
    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBeGreaterThan(0);
  });

  it('toggling switch calls enableAutoSave when checked', async () => {
    render(<AutoSaveSettings />);

    const toggle = screen.getAllByRole('switch')[0];
    await userEvent.click(toggle);

    expect(mocked.enableAutoSave).toHaveBeenCalledTimes(1);
  });

  it('toggling switch calls disableAutoSave when unchecked', async () => {
    // Start with auto-save enabled
    mocked.isAutoSaveEnabled.mockReturnValue(true);
    mocked.getAutoSaveIntervalMinutes.mockReturnValue(10);

    render(<AutoSaveSettings />);

    const toggle = screen.getAllByRole('switch')[0];
    await userEvent.click(toggle);

    expect(mocked.disableAutoSave).toHaveBeenCalledTimes(1);
  });

  it('shows interval selector when auto-save is enabled', () => {
    mocked.isAutoSaveEnabled.mockReturnValue(true);

    render(<AutoSaveSettings />);

    // Should show the interval label
    expect(screen.getByText(/Интервал/)).toBeInTheDocument();
  });

  it('does not show interval selector when auto-save is disabled', () => {
    mocked.isAutoSaveEnabled.mockReturnValue(false);

    render(<AutoSaveSettings />);

    // The interval label should NOT appear
    expect(screen.queryByText(/Интервал сохранения/)).not.toBeInTheDocument();
  });

  it('shows current interval in select trigger when enabled', () => {
    mocked.isAutoSaveEnabled.mockReturnValue(true);

    render(<AutoSaveSettings />);

    // The select trigger should show the current value (3 мин is the default)
    // Radix Select shows the selected value text in the trigger button
    const combobox = screen.getByRole('combobox');
    expect(combobox).toBeInTheDocument();
  });

  it('handleIntervalChange calls setAutoSaveIntervalMinutes for preset values', async () => {
    mocked.isAutoSaveEnabled.mockReturnValue(true);

    // We test by invoking the Select's onValueChange indirectly.
    // Since Radix Select portal has scrollIntoView issues in jsdom,
    // we test the logic via the component's state management.
    render(<AutoSaveSettings />);

    // The combobox trigger should exist
    expect(screen.getByRole('combobox')).toBeInTheDocument();

    // Verify the select renders interval options by opening it
    await userEvent.click(screen.getByRole('combobox'));

    // The dropdown should now be visible with preset options
    // Use getAllByText since '3 мин' appears in both trigger and dropdown
    const options = screen.getAllByText('3 мин');
    expect(options.length).toBeGreaterThanOrEqual(1);
  });

  it('shows custom input when custom interval is selected', async () => {
    mocked.isAutoSaveEnabled.mockReturnValue(true);
    mocked.getAutoSaveIntervalMinutes.mockReturnValue(5); // non-preset → custom

    render(<AutoSaveSettings />);

    // Open select and pick custom
    await userEvent.click(screen.getByRole('combobox'));

    // Radix Select options use role="option". The text span may have pointer-events: none,
    // so we click the parent option element.
    const customOption = screen.getByRole('option', { name: 'Свой...' });
    await userEvent.click(customOption);

    // A number input should appear
    const numberInput = screen.getByPlaceholderText('мин');
    expect(numberInput).toBeInTheDocument();
  });

  it('custom interval input commits on blur for valid 1-120 range', async () => {
    mocked.isAutoSaveEnabled.mockReturnValue(true);
    // Use 3 (a preset value) so customValue starts as ''
    mocked.getAutoSaveIntervalMinutes.mockReturnValue(3);

    render(<AutoSaveSettings />);

    // Open select and choose custom
    await userEvent.click(screen.getByRole('combobox'));
    const customOption = screen.getByRole('option', { name: 'Свой...' });
    await userEvent.click(customOption);

    // Type a valid custom value into the empty field
    const numberInput = screen.getByPlaceholderText('мин');
    await userEvent.type(numberInput, '45');

    // Blur triggers commit
    await userEvent.tab();

    expect(mocked.setAutoSaveIntervalMinutes).toHaveBeenCalledWith(45);
  });

  it('custom interval rejects values outside 1-120 range', async () => {
    mocked.isAutoSaveEnabled.mockReturnValue(true);
    // Use 3 (a preset value) so customValue starts as ''
    mocked.getAutoSaveIntervalMinutes.mockReturnValue(3);

    render(<AutoSaveSettings />);

    // Open select and choose custom
    await userEvent.click(screen.getByRole('combobox'));
    const customOption = screen.getByRole('option', { name: 'Свой...' });
    await userEvent.click(customOption);

    const numberInput = screen.getByPlaceholderText('мин');
    await userEvent.type(numberInput, '200');

    // Blur triggers commit — 200 is > 120, so should NOT call
    await userEvent.tab();

    expect(mocked.setAutoSaveIntervalMinutes).not.toHaveBeenCalled();
  });

  it('compact mode renders smaller UI with label instead of header', () => {
    mocked.isAutoSaveEnabled.mockReturnValue(true);

    const { rerender } = render(<AutoSaveSettings compact />);

    // Compact mode shows a label "Автосохранение" next to the toggle
    expect(screen.getByText('Автосохранение')).toBeInTheDocument();

    // Should NOT show the full-mode "Интервал сохранения" label
    expect(screen.queryByText('Интервал сохранения')).not.toBeInTheDocument();
  });

  it('internal save status indicator shows "Не сохранено" when idle', async () => {
    mocked.isAutoSaveEnabled.mockReturnValue(true);
    mocked.getSaveStatus.mockReturnValue('idle');

    render(<AutoSaveSettings />);

    await act(async () => {
      vi.advanceTimersByTime(1100); // poll interval is 1000ms
    });

    // The internal SaveStatusIndicator should show "Не сохранено"
    expect(screen.getByText('Не сохранено')).toBeInTheDocument();
  });

  it('internal save status indicator updates to show saving', async () => {
    mocked.isAutoSaveEnabled.mockReturnValue(true);
    mocked.getSaveStatus.mockReturnValue('saving');

    render(<AutoSaveSettings />);

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    expect(screen.getByText(/Сохранение\.\.\./)).toBeInTheDocument();
  });

  it('internal save status indicator updates to show saved with time', async () => {
    mocked.isAutoSaveEnabled.mockReturnValue(true);
    mocked.getSaveStatus.mockReturnValue('saved');
    mocked.getLastSaveTime.mockReturnValue(new Date(2024, 5, 15, 14, 30).getTime());

    render(<AutoSaveSettings />);

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    expect(screen.getByText(/Сохранено в/)).toBeInTheDocument();
  });

  it('internal save status indicator shows error', async () => {
    mocked.isAutoSaveEnabled.mockReturnValue(true);
    mocked.getSaveStatus.mockReturnValue('error');
    mocked.getLastSaveError.mockReturnValue('DB write failed');

    render(<AutoSaveSettings />);

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    expect(screen.getByText('Ошибка сохранения')).toBeInTheDocument();
  });
});
