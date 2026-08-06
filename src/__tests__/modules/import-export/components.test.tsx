import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { useAppStore } from '@/plugin-sdk';

vi.mock('@/components/KCDialog', () => ({
  kcAlert: vi.fn(),
}));

vi.mock('xlsx', () => ({
  default: {},
  read: vi.fn(),
  utils: {
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
    json_to_sheet: vi.fn(() => ({})),
    sheet_to_json: vi.fn(() => []),
    aoa_to_sheet: vi.fn(() => ({})),
    write: vi.fn(() => new ArrayBuffer(0)),
  },
}));

type ComponentsModule = typeof import('@user-plugins/import-export/components');

let mod: ComponentsModule;

beforeEach(async () => {
  vi.resetModules();
  useAppStore.setState({
    groups: [{ id: 'g1', name: 'Test Group', parentId: null, isExpanded: true, isTrash: false, createdAt: Date.now() }],
    phrases: [],
    minusWords: [],
    activeGroupId: 'g1',
  });
  mod = await import('@user-plugins/import-export/components');
});

describe('ImportExportRibbonButtons', () => {
  it('should render import and export buttons', () => {
    const ctx = { eventBus: { on: vi.fn(() => vi.fn()), emit: vi.fn() } } as any;
    render(React.createElement(mod.ImportExportRibbonButtons, { ctx }));

    expect(screen.getByText('Импорт')).toBeDefined();
    expect(screen.getByText('Экспорт')).toBeDefined();
  });
});

describe('ImportExportPanel', () => {
  it('should render panel buttons', () => {
    const ctx = { eventBus: { on: vi.fn(() => vi.fn()), emit: vi.fn() } } as any;
    render(React.createElement(mod.ImportExportPanel, { ctx }));

    expect(screen.getByText('Импорт из файла')).toBeDefined();
    expect(screen.getByText('Экспорт в файл')).toBeDefined();
    expect(screen.getByText('Сохранить проект')).toBeDefined();
    expect(screen.getByText('Открыть проект')).toBeDefined();
  });
});
