// ============================================================
// Tests: modules/find-replace/components.tsx
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FindReplacePanel } from '@user-plugins/find-replace/components';
import { useAppStore } from '@/plugin-sdk';
import { createEventBus } from '@/core/event-bus';

function createMockCtx() {
  return {
    eventBus: { ...createEventBus(), emit: vi.fn() },
    store: { dispatch: vi.fn(), getState: () => useAppStore.getState(), getStateSlice: (k: keyof ReturnType<typeof useAppStore.getState>) => useAppStore.getState()[k], subscribe: () => () => {} },
    registerUI: vi.fn(),
    registerCommand: vi.fn(),
    registerLifecycleHook: vi.fn(),
    getSetting: vi.fn((_key: string) => undefined),
    setSetting: vi.fn(),
  };
}

describe('FindReplacePanel', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    ctx = createMockCtx();
  });

  it('should render panel content', () => {
    render(<FindReplacePanel ctx={ctx as any} />);
    // Title is rendered by the shell's LeftOverlayPanel; check inputs instead
    expect(screen.getByPlaceholderText('Текст или regex...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Новый текст...')).toBeInTheDocument();
  });

  it('should render find and replace inputs', () => {
    render(<FindReplacePanel ctx={ctx as any} />);
    expect(screen.getByPlaceholderText('Текст или regex...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Новый текст...')).toBeInTheDocument();
  });

  it('should render checkbox options', () => {
    render(<FindReplacePanel ctx={ctx as any} />);
    expect(screen.getByText('Regex')).toBeInTheDocument();
    expect(screen.getByText('С учётом регистра')).toBeInTheDocument();
    expect(screen.getByText('Целые слова')).toBeInTheDocument();
  });

  it('should find matching phrases', async () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('G1');
    store.addPhrases(['купить ноутбук', 'аренда квартиры'], groupId);

    render(<FindReplacePanel ctx={ctx as any} />);
    const findInput = screen.getByPlaceholderText('Текст или regex...');
    await userEvent.type(findInput, 'купить');

    // Use getByRole for the button since "Найти" appears as both label and button
    const findBtn = screen.getByRole('button', { name: /Найти/ });
    await userEvent.click(findBtn);

    expect(screen.getByText(/1 совпадений/)).toBeInTheDocument();
  });

  it('should show preview with before/after text', async () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('G1');
    store.addPhrases(['купить ноутбук'], groupId);

    render(<FindReplacePanel ctx={ctx as any} />);
    await userEvent.type(screen.getByPlaceholderText('Текст или regex...'), 'купить');
    await userEvent.type(screen.getByPlaceholderText('Новый текст...'), 'продать');

    const findBtn = screen.getByRole('button', { name: /Найти/ });
    await userEvent.click(findBtn);

    // Preview shows strikethrough old text and new text
    const strikethrough = screen.getByText('купить ноутбук');
    expect(strikethrough).toBeInTheDocument();
    expect(screen.getByText('продать ноутбук')).toBeInTheDocument();
  });

  it('should disable "Найти" button when find text is empty', () => {
    render(<FindReplacePanel ctx={ctx as any} />);
    const findBtn = screen.getByRole('button', { name: /Найти/ });
    expect(findBtn).toBeDisabled();
  });

  it('should disable "Заменить все" when no preview', () => {
    render(<FindReplacePanel ctx={ctx as any} />);
    const replaceBtn = screen.getByRole('button', { name: 'Заменить все' });
    expect(replaceBtn).toBeDisabled();
  });
});
