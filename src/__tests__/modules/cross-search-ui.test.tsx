// ============================================================
// Tests: modules/cross-search/components.tsx
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CrossSearchPanel } from '@user-plugins/cross-search/components';
import { useAppStore } from '@/plugin-sdk';
import { createEventBus } from '@/core/event-bus';

// Кнопка удаления дублей теперь требует подтверждения через kcDialog.
vi.mock('@/components/KCDialog', () => ({
  useKCDialog: () => ({ confirm: vi.fn().mockResolvedValue(true), prompt: vi.fn() }),
  kcAlert: vi.fn(),
}));

function createMockCtx() {
  return {
    eventBus: { ...createEventBus(), emit: vi.fn() },
    store: { dispatch: vi.fn(), getState: () => useAppStore.getState(), getStateSlice: (k: keyof ReturnType<typeof useAppStore.getState>) => useAppStore.getState()[k], subscribe: () => () => {} },
    registerUI: vi.fn(),
    registerCommand: vi.fn(),
  };
}

describe('CrossSearchPanel', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    ctx = createMockCtx();
  });

  it('should render panel content', () => {
    render(<CrossSearchPanel ctx={ctx as any} />);
    // Title is rendered by the shell's LeftOverlayPanel; check search button instead
    expect(screen.getByText('Найти дубликаты')).toBeInTheDocument();
  });

  it('should render search button', () => {
    render(<CrossSearchPanel ctx={ctx as any} />);
    expect(screen.getByText('Найти дубликаты')).toBeInTheDocument();
  });

  it('should find duplicates when search is clicked', async () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('G1');
    const g2 = store.addGroup('G2');
    store.addPhrases(['купить ноутбук'], g1);
    store.addPhrases(['купить ноутбук'], g2);

    render(<CrossSearchPanel ctx={ctx as any} />);
    const searchBtn = screen.getByText('Найти дубликаты');
    await userEvent.click(searchBtn);

    expect(screen.getByText(/Найдено дубликатов: 1/)).toBeInTheDocument();
    expect(screen.getByText('купить ноутбук')).toBeInTheDocument();
  });

  it('should show "Дубликатов не найдено" when none exist', async () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('G1');
    store.addPhrases(['уникальная фраза'], g1);

    render(<CrossSearchPanel ctx={ctx as any} />);
    const searchBtn = screen.getByText('Найти дубликаты');
    await userEvent.click(searchBtn);

    expect(screen.getByText('Дубликатов не найдено.')).toBeInTheDocument();
  });

  it('should remove duplicates when delete button is clicked', async () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('G1');
    const g2 = store.addGroup('G2');
    store.addPhrases(['дубль'], g1);
    store.addPhrases(['дубль'], g2);

    render(<CrossSearchPanel ctx={ctx as any} />);
    const searchBtn = screen.getByText('Найти дубликаты');
    await userEvent.click(searchBtn);

    const deleteBtn = screen.getByText('Удалить дубликаты');
    await userEvent.click(deleteBtn);

    // One duplicate should remain, one deleted
    expect(useAppStore.getState().phrases).toHaveLength(1);
  });
});
