// ============================================================
// Tests: modules/import-export/components.tsx
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportExportRibbonButtons, ImportExportPanel } from '@user-plugins/import-export/components';
import { useAppStore, registerExportFormat } from '@/plugin-sdk';
import { BUILTIN_EXPORT_FORMATS } from '@user-plugins/import-export/formats';
import { createEventBus } from '@/core/event-bus';

function createMockCtx() {
  return {
    eventBus: { ...createEventBus(), on: vi.fn(() => vi.fn()), emit: vi.fn() },
    store: { dispatch: vi.fn(), getState: () => useAppStore.getState(), getStateSlice: (k: keyof ReturnType<typeof useAppStore.getState>) => useAppStore.getState()[k], subscribe: () => () => {} },
    registerUI: vi.fn(),
    registerCommand: vi.fn(),
  };
}

describe('ImportExportRibbonButtons', () => {
  it('should render import and export buttons', () => {
    const ctx = createMockCtx();
    render(<ImportExportRibbonButtons ctx={ctx as any} />);
    expect(screen.getByText('Импорт')).toBeInTheDocument();
    expect(screen.getByText('Экспорт')).toBeInTheDocument();
  });

  it('should open import dialog on click', async () => {
    const ctx = createMockCtx();
    render(<ImportExportRibbonButtons ctx={ctx as any} />);
    const importBtn = screen.getByText('Импорт');
    await userEvent.click(importBtn);
    expect(screen.getByText('Импорт данных')).toBeInTheDocument();
  });

  it('should open export dialog on click', async () => {
    const ctx = createMockCtx();
    render(<ImportExportRibbonButtons ctx={ctx as any} />);
    const exportBtn = screen.getByText('Экспорт');
    await userEvent.click(exportBtn);
    expect(screen.getByText('Экспорт данных')).toBeInTheDocument();
  });
});

describe('ImportExportPanel', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    ctx = createMockCtx();
  });

  it('should render panel action buttons', () => {
    render(<ImportExportPanel ctx={ctx as any} />);
    expect(screen.getByText('Импорт из файла')).toBeInTheDocument();
    expect(screen.getByText('Экспорт в файл')).toBeInTheDocument();
    // Demo button removed — users import their own data
    expect(screen.getByText('Сохранить проект')).toBeInTheDocument();
    expect(screen.getByText('Открыть проект')).toBeInTheDocument();
  });

  it('should NOT show demo button (demo data removed)', async () => {
    render(<ImportExportPanel ctx={ctx as any} />);
    expect(screen.queryByText('Загрузить демо')).not.toBeInTheDocument();
  });

  it('should open import dialog from panel', async () => {
    render(<ImportExportPanel ctx={ctx as any} />);
    const importBtn = screen.getByText('Импорт из файла');
    await userEvent.click(importBtn);
    expect(screen.getByText('Импорт данных')).toBeInTheDocument();
  });

  it('should open export dialog from panel', async () => {
    render(<ImportExportPanel ctx={ctx as any} />);
    const exportBtn = screen.getByText('Экспорт в файл');
    await userEvent.click(exportBtn);
    expect(screen.getByText('Экспорт данных')).toBeInTheDocument();
  });
});

describe('Import Dialog', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    ctx = createMockCtx();
  });

  it('should show file input and delimiter selector', async () => {
    render(<ImportExportRibbonButtons ctx={ctx as any} />);
    await userEvent.click(screen.getByText('Импорт'));

    expect(screen.getByText('Выберите файл')).toBeInTheDocument();
    expect(screen.getByText('Разделитель (для CSV/TXT)')).toBeInTheDocument();
    expect(screen.getByText('Целевая группа')).toBeInTheDocument();
  });

  it('should show supported formats note', async () => {
    render(<ImportExportRibbonButtons ctx={ctx as any} />);
    await userEvent.click(screen.getByText('Импорт'));

    expect(screen.getByText(/CSV, TSV, TXT, XLSX, XLS/)).toBeInTheDocument();
  });
});

describe('Export Dialog', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    ctx = createMockCtx();
    for (const fmt of BUILTIN_EXPORT_FORMATS) registerExportFormat(fmt);
  });

  it('should show format selector', async () => {
    render(<ImportExportRibbonButtons ctx={ctx as any} />);
    await userEvent.click(screen.getByText('Экспорт'));

    expect(screen.getByText('Формат')).toBeInTheDocument();
    // Radix Select рендерит опции только после открытия списка
    await userEvent.click(screen.getByRole('combobox', { name: 'Формат экспорта' }));
    expect(await screen.findByRole('option', { name: 'CSV' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'TSV' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'JSON' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'XLSX (Excel)' })).toBeInTheDocument();
  });

  it('should disable export button when no phrases', async () => {
    render(<ImportExportRibbonButtons ctx={ctx as any} />);
    await userEvent.click(screen.getByText('Экспорт'));

    // The export button in the dialog footer has a download icon
    const dialogFooter = screen.getByText('Экспорт данных').closest('[role="dialog"]');
    const disabledBtn = dialogFooter?.querySelector('button[disabled]');
    expect(disabledBtn).toBeTruthy();
  });
});
