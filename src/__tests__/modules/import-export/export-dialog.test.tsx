import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ExportDialog } from '@user-plugins/import-export/export-dialog';
import { useAppStore, registerExportFormat, getAllExportFormats, clearExportFormats } from 'plugin-sdk';
import type { PluginContext } from 'plugin-sdk';
import { BUILTIN_EXPORT_FORMATS } from '@user-plugins/import-export/formats';
import { importExportSettings } from '@user-plugins/import-export/index';

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(() => '/mock/path/file.csv'),
}));
vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(() => Promise.resolve()),
  writeFile: vi.fn(() => Promise.resolve()),
}));

function createMockCtx(): PluginContext {
  return {
    eventBus: { on: vi.fn(() => vi.fn()), emit: vi.fn() },
  } as unknown as PluginContext;
}

function renderDialog(ctx: any, open = true) {
  return render(
    <ExportDialog open={open} onOpenChange={vi.fn()} ctx={ctx} />,
  );
}

describe('ExportDialog', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    clearExportFormats();
    for (const fmt of BUILTIN_EXPORT_FORMATS) registerExportFormat(fmt);
    useAppStore.setState({
      groups: [
        { id: 'g1', name: 'Group 1', parentId: null, isExpanded: false, isTrash: false, createdAt: Date.now() },
        { id: 'g2', name: 'Group 2', parentId: null, isExpanded: false, isTrash: false, createdAt: Date.now() },
      ],
      phrases: [
        { id: 'p1', text: 'phrase one', groupId: 'g1', frequency: 100, kei: 10, cpc: 5, createdAt: Date.now() },
        { id: 'p2', text: 'phrase two', groupId: 'g1', frequency: 50, kei: 5, cpc: 2, createdAt: Date.now() },
        { id: 'p3', text: 'phrase three', groupId: 'g2', frequency: 30, kei: 3, cpc: 1, createdAt: Date.now() },
      ],
      minusWords: [
        { id: 'mw1', text: 'minus one', isExact: false, groupId: null, searchType: 'broad', createdAt: Date.now() },
      ],
      activeGroupId: 'g1',
    });
    importExportSettings.defaultFormat = 'csv';
    ctx = createMockCtx();
  });

  it('should render dialog with title', () => {
    renderDialog(ctx);
    expect(screen.getByText('Экспорт данных')).toBeInTheDocument();
  });

  it('should show template selector', () => {
    renderDialog(ctx);
    expect(screen.getByText('Шаблон')).toBeInTheDocument();
    expect(screen.getByText('Только фразы')).toBeInTheDocument();
    expect(screen.getByText('Полный экспорт')).toBeInTheDocument();
  });

  it('should show format selector', () => {
    renderDialog(ctx);
    expect(screen.getByText('Формат')).toBeInTheDocument();
    expect(screen.getByText('CSV')).toBeInTheDocument();
    expect(screen.getByText('TSV')).toBeInTheDocument();
    expect(screen.getByText('JSON')).toBeInTheDocument();
  });

  it('should show group selector for non-minus-words template', () => {
    renderDialog(ctx);
    expect(screen.getByText('Группа')).toBeInTheDocument();
    expect(screen.getByText('— Все группы —')).toBeInTheDocument();
    expect(screen.getByText('Group 1')).toBeInTheDocument();
    expect(screen.getByText('Group 2')).toBeInTheDocument();
  });

  it('should disable export button when phrase count is 0', () => {
    useAppStore.setState({ phrases: [] });
    renderDialog(ctx);
    const exportBtn = screen.getByText('Экспорт');
    expect(exportBtn.closest('button')).toBeDisabled();
  });

  it('should enable export button when phrases exist', () => {
    renderDialog(ctx);
    const exportBtn = screen.getByText('Экспорт');
    expect(exportBtn.closest('button')).not.toBeDisabled();
  });

  it('should show phrase count for all groups', () => {
    renderDialog(ctx);
    expect(screen.getByText(/Экспорт все группы: 3 фраз/)).toBeInTheDocument();
  });

  it('should show minus words count for minus-words template', async () => {
    renderDialog(ctx);
    await userEvent.selectOptions(
      screen.getByDisplayValue('Только фразы'),
      'Минус-фразы',
    );
    expect(screen.getByText(/Экспорт минус-фраз: 1/)).toBeInTheDocument();
  });

  it('should call onOpenChange(false) on cancel', async () => {
    const onOpenChange = vi.fn();
    render(<ExportDialog open={true} onOpenChange={onOpenChange} ctx={ctx} />);
    await userEvent.click(screen.getByText('Отмена'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should hide group selector for minus-words template', async () => {
    renderDialog(ctx);
    await userEvent.selectOptions(
      screen.getByDisplayValue('Только фразы'),
      'Минус-фразы',
    );
    expect(screen.queryByText('Группа')).not.toBeInTheDocument();
  });

  it('should show export button text', () => {
    renderDialog(ctx);
    expect(screen.getByText('Экспорт')).toBeInTheDocument();
  });
});
