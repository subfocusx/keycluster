// ============================================================
// Tests: предпросмотр перед применением в дедупликаторе и неявных дублях
//
// Проверяем, что разрушающие операции не применяются сразу,
// а сначала показывают предпросмотр (ApplyPreview).
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { mockUseAppStore, mockDeletePhrases, mockMoveToTrash, mockFindImplicitDuplicates } = vi.hoisted(() => {
  const mockDeletePhrases = vi.fn();
  const mockMoveToTrash = vi.fn();

  const storeState: any = {
    phrases: [] as any[],
    groups: [
      { id: 'g1', name: 'Main', isTrash: false },
      { id: 'trash', name: 'Trash', isTrash: true },
    ],
    deletePhrases: mockDeletePhrases,
    moveToTrash: mockMoveToTrash,
  };

  const useAppStore = Object.assign(
    vi.fn((selector?: any) => (selector ? selector(storeState) : storeState)),
    { getState: vi.fn(() => storeState) },
  );

  return {
    mockUseAppStore: useAppStore,
    mockDeletePhrases,
    mockMoveToTrash,
    mockFindImplicitDuplicates: vi.fn(() => [
      {
        groupId: 'dup1',
        mainPhrase: { id: '1', text: 'купить телефон', frequency: 100 },
        phrases: [
          { id: '1', text: 'купить телефон', frequency: 100 },
          { id: '2', text: 'телефон купить', frequency: 50 },
        ],
        avgSimilarity: 0.85,
      },
    ]),
  };
});

vi.mock('@/core/store', () => ({
  useAppStore: mockUseAppStore,
}));

vi.mock('@user-plugins/implicit-duplicates/worker-bridge', () => ({
  ImplicitDuplicatesWorkerBridge: class {
    findDuplicates() {
      return Promise.resolve({ groups: mockFindImplicitDuplicates(), duration: 0 });
    }
    terminate() {}
  },
}));

import { DeduplicatorPanel } from '@user-plugins/deduplicator/components';
import { ImplicitDuplicatesPanel } from '@user-plugins/implicit-duplicates/components';

function createMockCtx(settings: Record<string, any> = {}) {
  return {
    getSetting: (key: string) => settings[key],
    setSetting: vi.fn(),
    registerUI: vi.fn(),
    registerCommand: vi.fn(),
    registerLifecycleHook: vi.fn(),
    registerKeybinding: vi.fn(),
  } as any;
}

const store = () => (mockUseAppStore as any).getState();

describe('Дедупликатор — предпросмотр перед удалением', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store().phrases = [
      { id: '1', text: 'купить ноутбук', groupId: 'g1', createdAt: 1 },
      { id: '2', text: 'купить ноутбук', groupId: 'g1', createdAt: 2 },
      { id: '3', text: 'купить телефон', groupId: 'g1', createdAt: 3 },
    ];
  });

  it('открывает предпросмотр и НЕ удаляет дубли до нажатия «Применить»', async () => {
    render(<DeduplicatorPanel ctx={createMockCtx()} />);

    fireEvent.click(screen.getByText('Найти дубликаты'));

    await waitFor(() => {
      expect(screen.getByTestId('apply-preview')).toBeInTheDocument();
    });

    expect(screen.getByText('Предпросмотр дедупликации')).toBeInTheDocument();
    expect(screen.getByText(/Будет удалено 1 дубль/)).toBeInTheDocument();
    expect(screen.getAllByTestId('apply-preview-item')).toHaveLength(1);
    expect(mockDeletePhrases).not.toHaveBeenCalled();
  });

  it('удаляет дубли только после нажатия «Применить»', async () => {
    render(<DeduplicatorPanel ctx={createMockCtx()} />);

    fireEvent.click(screen.getByText('Найти дубликаты'));
    await waitFor(() => {
      expect(screen.getByTestId('apply-preview')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Применить' }));

    expect(mockDeletePhrases).toHaveBeenCalledTimes(1);
    expect(mockDeletePhrases).toHaveBeenCalledWith(['2']);
    await waitFor(() => {
      expect(screen.queryByTestId('apply-preview')).toBeNull();
    });
    expect(screen.getByText(/Удалено 1 дубль из 3 фраз/)).toBeInTheDocument();
  });

  it('«Отмена» закрывает предпросмотр без удаления', async () => {
    render(<DeduplicatorPanel ctx={createMockCtx()} />);

    fireEvent.click(screen.getByText('Найти дубликаты'));
    await waitFor(() => {
      expect(screen.getByTestId('apply-preview')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));

    await waitFor(() => {
      expect(screen.queryByTestId('apply-preview')).toBeNull();
    });
    expect(mockDeletePhrases).not.toHaveBeenCalled();
  });

  it('показывает сообщение «Дубликаты не найдены», если дублей нет', async () => {
    store().phrases = [{ id: '1', text: 'купить ноутбук', groupId: 'g1', createdAt: 1 }];
    render(<DeduplicatorPanel ctx={createMockCtx()} />);

    fireEvent.click(screen.getByText('Найти дубликаты'));

    await waitFor(() => {
      expect(screen.getByText('Дубликаты не найдены')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('apply-preview')).toBeNull();
    expect(mockDeletePhrases).not.toHaveBeenCalled();
  });
});

describe('Неявные дубли — предпросмотр перед удалением', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store().phrases = [
      { id: '1', text: 'купить телефон', groupId: 'g1', frequency: 100, createdAt: 1 },
      { id: '2', text: 'телефон купить', groupId: 'g1', frequency: 50, createdAt: 2 },
      { id: '3', text: 'ремонт квартир', groupId: 'g1', frequency: 30, createdAt: 3 },
    ];
  });

  async function searchAndSelectAll() {
    render(<ImplicitDuplicatesPanel />);
    fireEvent.click(screen.getByText('Найти дубли'));
    await waitFor(() => {
      expect(screen.getByText('Выделить все дубли')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Выделить все дубли'));
    await waitFor(() => {
      expect(screen.getByText('Удалить (1)')).toBeInTheDocument();
    });
  }

  it('открывает предпросмотр с примерами дублей и не удаляет сразу', async () => {
    await searchAndSelectAll();

    fireEvent.click(screen.getByText('Удалить (1)'));

    await waitFor(() => {
      expect(screen.getByTestId('apply-preview')).toBeInTheDocument();
    });
    expect(screen.getByText('Предпросмотр удаления неявных дублей')).toBeInTheDocument();
    expect(screen.getAllByTestId('apply-preview-item')).toHaveLength(1);
    expect(mockMoveToTrash).not.toHaveBeenCalled();
  });

  it('перемещает выбранные дубли в корзину только после «Применить»', async () => {
    await searchAndSelectAll();

    fireEvent.click(screen.getByText('Удалить (1)'));
    await waitFor(() => {
      expect(screen.getByTestId('apply-preview')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Применить' }));

    expect(mockMoveToTrash).toHaveBeenCalledTimes(1);
    expect(mockMoveToTrash).toHaveBeenCalledWith(['2']);
  });

  it('«Отмена» в предпросмотре не удаляет дубли', async () => {
    await searchAndSelectAll();

    fireEvent.click(screen.getByText('Удалить (1)'));
    await waitFor(() => {
      expect(screen.getByTestId('apply-preview')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));

    await waitFor(() => {
      expect(screen.queryByTestId('apply-preview')).toBeNull();
    });
    expect(mockMoveToTrash).not.toHaveBeenCalled();
  });
});
