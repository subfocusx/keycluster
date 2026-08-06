import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import React from 'react';

const { mockUseAppStore, mockFindImplicitDuplicates } = vi.hoisted(() => {
  const mockMoveToTrash = vi.fn();
  const mockSetLeftPanel = vi.fn();
  const storeState = {
    phrases: [
      { id: '1', text: 'купить телефон', groupId: 'g1', frequency: 100 },
      { id: '2', text: 'телефон купить', groupId: 'g1', frequency: 50 },
      { id: '3', text: 'ремонт квартир', groupId: 'g1', frequency: 30 },
    ],
    moveToTrash: mockMoveToTrash,
    groups: [
      { id: 'g1', name: 'Main', isTrash: false },
      { id: 'trash', name: 'Trash', isTrash: true },
    ],
    setLeftPanel: mockSetLeftPanel,
  };

  const useAppStore = Object.assign(
    vi.fn((selector?: any) => selector ? selector(storeState) : storeState),
    { getState: vi.fn(() => storeState) },
  );

  return {
    mockUseAppStore: useAppStore,
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
    mockMoveToTrash,
    mockSetLeftPanel,
  };
});

vi.mock('@/core/store', () => ({
  useAppStore: mockUseAppStore,
}));

vi.mock('@user-plugins/implicit-duplicates/utils', () => ({
  findImplicitDuplicates: mockFindImplicitDuplicates,
}));

vi.mock('@user-plugins/implicit-duplicates/worker-bridge', () => ({
  ImplicitDuplicatesWorkerBridge: class {
    findDuplicates() {
      return Promise.resolve({ groups: mockFindImplicitDuplicates(), duration: 0 });
    }
    terminate() {}
  },
  getWorkerBridge: () => ({
    findDuplicates: (_data: unknown, _opts: unknown, _progress: unknown) =>
      Promise.resolve({ groups: mockFindImplicitDuplicates(), duration: 0 }),
    terminate: () => {},
  }),
}));

import { ImplicitDuplicatesPanel } from '@user-plugins/implicit-duplicates/components';

describe('ImplicitDuplicatesPanel', () => {
  beforeEach(() => {
  });

  afterEach(() => {
  });

  it('renders empty state before search', () => {
    render(<ImplicitDuplicatesPanel />);
    expect(screen.getByText('Неявные дубликаты')).toBeInTheDocument();
    expect(screen.getByText('Настройте параметры и нажмите «Найти дубли»')).toBeInTheDocument();
  });

  it('renders search button', () => {
    render(<ImplicitDuplicatesPanel />);
    expect(screen.getByText('Найти дубли')).toBeInTheDocument();
  });

  it('renders settings controls', () => {
    render(<ImplicitDuplicatesPanel />);
    expect(screen.getByText('Игнорировать стоп-слова')).toBeInTheDocument();
    expect(screen.getByText('Учитывать порядок слов')).toBeInTheDocument();
    expect(screen.getByText('Оставлять с большей частотностью')).toBeInTheDocument();
  });

  it('performs search when button is clicked', async () => {
    render(<ImplicitDuplicatesPanel />);

    fireEvent.click(screen.getByText('Найти дубли'));

    await waitFor(() => {
      expect(document.body.textContent).toContain('Найдено');
    });
  });

  it('shows duplicate groups after search', async () => {
    render(<ImplicitDuplicatesPanel />);

    fireEvent.click(screen.getByText('Найти дубли'));

    await waitFor(() => {
      expect(screen.getAllByText('купить телефон').length).toBeGreaterThan(0);
    });
    expect(screen.getByText('телефон купить')).toBeInTheDocument();
  });

  it('shows select all duplicates button after search', async () => {
    render(<ImplicitDuplicatesPanel />);
    fireEvent.click(screen.getByText('Найти дубли'));

    await waitFor(() => {
      expect(screen.getByText('Выделить все дубли')).toBeInTheDocument();
    });
  });

  it('shows delete selected button', () => {
    render(<ImplicitDuplicatesPanel />);
    expect(screen.getByText('Удалить (0)')).toBeInTheDocument();
  });
});
