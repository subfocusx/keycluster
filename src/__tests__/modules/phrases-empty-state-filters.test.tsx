import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyPhrasesState } from '@/modules/phrases/EmptyPhrasesState';
import { createEventBus } from '@/core/event-bus';

function createMockCtx() {
  return {
    eventBus: { ...createEventBus(), emit: vi.fn(), on: vi.fn(() => vi.fn()) },
    store: { dispatch: vi.fn(), getState: () => ({} as any), getStateSlice: () => ({} as any), subscribe: () => () => {} },
    registerUI: vi.fn(),
    registerCommand: vi.fn(),
  } as any;
}

describe('EmptyPhrasesState — режим фильтров', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createMockCtx();
  });

  it('без активных фильтров показывает состояние «группа пуста»', () => {
    render(<EmptyPhrasesState ctx={ctx} activeGroupId="g1" numVisibleCols={4} />);
    expect(screen.getByText('В этой группе пока нет фраз')).toBeInTheDocument();
    expect(screen.queryByText('Нет фраз, подходящих под текущие фильтры')).toBeNull();
  });

  it('при активных фильтрах показывает подсказку про фильтры и кнопку сброса', () => {
    const onReset = vi.fn();
    render(
      <EmptyPhrasesState
        ctx={ctx}
        activeGroupId="g1"
        numVisibleCols={4}
        hasActiveFilters
        onResetFilters={onReset}
      />
    );
    expect(screen.getByText('Нет фраз, подходящих под текущие фильтры')).toBeInTheDocument();
    expect(screen.queryByText('В этой группе пока нет фраз')).toBeNull();

    fireEvent.click(screen.getByText('Сбросить фильтры'));
    expect(onReset).toHaveBeenCalled();
  });

  it('без активной группы предлагает выбрать группу', () => {
    render(<EmptyPhrasesState ctx={ctx} activeGroupId={null} numVisibleCols={4} />);
    expect(screen.getByText('Выберите группу слева')).toBeInTheDocument();
  });
});
