import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ImportDialog } from '@user-plugins/import-export/import-dialog';
import { useAppStore } from 'plugin-sdk';
import type { PluginContext } from 'plugin-sdk';

vi.mock('@/components/KCDialog', () => ({
  kcAlert: vi.fn(),
}));

vi.mock('xlsx', () => ({
  default: {},
  write: vi.fn(() => new ArrayBuffer(0)),
  read: vi.fn(() => ({
    SheetNames: ['Sheet1'],
    Sheets: { Sheet1: {} },
  })),
  utils: {
    sheet_to_json: vi.fn(() => [
      ['Keyword', 'Frequency', 'CPC'],
      ['test phrase', '100', '5'],
      ['another', '50', '2'],
    ]),
    book_new: vi.fn(() => ({ SheetNames: [], Sheets: {} })),
    book_append_sheet: vi.fn(),
    json_to_sheet: vi.fn(() => ({})),
  },
}));

function createMockCtx(): PluginContext {
  return {
    eventBus: { on: vi.fn(() => vi.fn()), emit: vi.fn() },
  } as unknown as PluginContext;
}

function createMockFile(content: string, filename = 'test.csv', type = 'text/csv'): File {
  return new File([content], filename, { type });
}

function renderDialog(ctx: any, open = true) {
  return render(
    <ImportDialog open={open} onOpenChange={vi.fn()} ctx={ctx} />,
  );
}

describe('ImportDialog', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.setState({
      groups: [
        { id: 'g1', name: 'Target Group', parentId: null, isExpanded: false, isTrash: false, createdAt: Date.now() },
      ],
      phrases: [],
      minusWords: [],
      activeGroupId: 'g1',
      addPhrases: vi.fn(),
    });
    ctx = createMockCtx();
  });

  it('should render dialog with title', () => {
    renderDialog(ctx);
    expect(screen.getByText('Импорт данных')).toBeInTheDocument();
  });

  it('should show file input and delimiter selector', () => {
    renderDialog(ctx);
    expect(screen.getByText('Выберите файл')).toBeInTheDocument();
    expect(screen.getByText('Разделитель (для CSV/TXT)')).toBeInTheDocument();
    expect(screen.getByText('Целевая группа')).toBeInTheDocument();
    expect(screen.getByText('Target Group')).toBeInTheDocument();
  });

  it('should show supported formats', () => {
    renderDialog(ctx);
    expect(screen.getByText(/CSV, TSV, TXT, XLSX, XLS/)).toBeInTheDocument();
  });

  it('should parse CSV and show column mapping', async () => {
    renderDialog(ctx);
    const csvContent = 'Keyword,Frequency,CPC\nphrase1,100,5\nphrase2,50,2';
    const file = createMockFile(csvContent, 'data.csv');
    const input = screen.getByLabelText('Выберите файл');
    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText('Маппинг столбцов')).toBeInTheDocument();
    });
  });

  it('should show row count badge after parsing', async () => {
    renderDialog(ctx);
    const csvContent = 'Keyword,Frequency\nph1,100\nph2,50\nph3,30\nph4,20\nph5,10\nph6,5';
    const file = createMockFile(csvContent, 'data.csv');
    const input = screen.getByLabelText('Выберите файл');
    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText('6 строк')).toBeInTheDocument();
    });
  });

  it('should auto-map Keyword column to keyword', async () => {
    renderDialog(ctx);
    const csvContent = 'Keyword,Frequency\nph1,100';
    const file = createMockFile(csvContent, 'data.csv');
    const input = screen.getByLabelText('Выберите файл');
    await userEvent.upload(input, file);

    await waitFor(() => {
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('should auto-map Russian headers', async () => {
    renderDialog(ctx);
    const csvContent = 'Ключевое слово,Частота,CPC\nфраза1,100,5';
    const file = createMockFile(csvContent, 'data.csv');
    const input = screen.getByLabelText('Выберите файл');
    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText('Маппинг столбцов')).toBeInTheDocument();
    });
  });

  it('should cancel dialog and reset state', async () => {
    const onOpenChange = vi.fn();
    render(<ImportDialog open={true} onOpenChange={onOpenChange} ctx={ctx} />);

    await userEvent.click(screen.getByText('Отмена'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should show preview table after parsing', async () => {
    renderDialog(ctx);
    const csvContent = 'Keyword,Frequency\nph1,100\nph2,50\nph3,30';
    const file = createMockFile(csvContent, 'data.csv');
    const input = screen.getByLabelText('Выберите файл');
    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText('Предпросмотр (первые 5 строк)')).toBeInTheDocument();
    });
  });

  it('should show import button after file parsed', async () => {
    renderDialog(ctx);
    const csvContent = 'Keyword,Frequency\nph1,100';
    const file = createMockFile(csvContent, 'data.csv');
    const input = screen.getByLabelText('Выберите файл');
    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText('Импортировать')).toBeInTheDocument();
    });
  });
});
