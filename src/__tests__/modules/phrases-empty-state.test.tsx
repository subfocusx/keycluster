import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PhrasesTable } from '@/modules/phrases/components';
import { useAppStore } from '@/plugin-sdk';
import { createEventBus } from '@/core/event-bus';

function createMockCtx() {
  return {
    eventBus: { ...createEventBus(), emit: vi.fn(), on: vi.fn(() => vi.fn()) },
    store: { dispatch: vi.fn(), getState: () => useAppStore.getState(), getStateSlice: (k: keyof ReturnType<typeof useAppStore.getState>) => useAppStore.getState()[k], subscribe: () => () => {} },
    registerUI: vi.fn(),
    registerCommand: vi.fn(),
  } as any;
}

function setupStore(opts?: { withGroup?: boolean; withPhrases?: boolean; searchQuery?: string }) {
  useAppStore.getState().clearAll();
  if (opts?.withGroup) {
    useAppStore.getState().addGroup('Test Group');
    const gid = useAppStore.getState().groups[0].id;
    useAppStore.getState().setActiveGroup(gid);
    if (opts?.withPhrases) {
      useAppStore.getState().addPhrases(['фраза один', 'фраза два'], gid);
    }
  }
}

describe('Phrases empty state', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.getState().clearAll();
    ctx = createMockCtx();
  });

  it('without activeGroupId shows "Выберите группу слева"', () => {
    setupStore();
    render(<PhrasesTable ctx={ctx} />);
    expect(screen.getByText('Выберите группу слева')).toBeTruthy();
  });

  it('with activeGroupId but no phrases shows "Группа пуста" and 2 buttons', () => {
    setupStore({ withGroup: true });
    render(<PhrasesTable ctx={ctx} />);
    expect(screen.getByText('В этой группе пока нет фраз')).toBeTruthy();
    expect(screen.getByText('Добавить фразы')).toBeTruthy();
    expect(screen.getByText('Импорт')).toBeTruthy();
  });

  it('click "Добавить фразы" emits phrases:open-add event', () => {
    setupStore({ withGroup: true });
    render(<PhrasesTable ctx={ctx} />);
    fireEvent.click(screen.getByText('Добавить фразы'));
    expect(ctx.eventBus.emit).toHaveBeenCalledWith('phrases:open-add-dialog');
  });

  it('with phrases present empty state is not rendered', () => {
    setupStore({ withGroup: true, withPhrases: true });
    render(<PhrasesTable ctx={ctx} />);
    expect(screen.queryByText('В этой группе пока нет фраз')).toBeNull();
    expect(screen.queryByText('Выберите группу слева')).toBeNull();
  });
});
