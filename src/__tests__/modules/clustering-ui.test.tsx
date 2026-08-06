// ============================================================
// Tests: modules/clustering/components.tsx
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClusteringPanel } from '@user-plugins/clustering/components';
import { useAppStore } from '@/plugin-sdk';
import { createEventBus } from '@/core/event-bus';

function createMockCtx() {
  return {
    eventBus: { ...createEventBus(), emit: vi.fn() },
    store: { dispatch: vi.fn(), getState: () => useAppStore.getState(), getStateSlice: (k: keyof ReturnType<typeof useAppStore.getState>) => useAppStore.getState()[k], subscribe: () => () => {} },
    registerUI: vi.fn(),
    registerCommand: vi.fn(),
  };
}

describe('ClusteringPanel', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    ctx = createMockCtx();
  });

  it('should render clustering panel title', () => {
    render(<ClusteringPanel ctx={ctx as any} />);
    // Title is now rendered by the shell's LeftOverlayPanel, not inside ClusteringPanel
    // Check that the algorithm label is present instead
    expect(screen.getByText('Алгоритм')).toBeInTheDocument();
  });

  it('should render algorithm radio options', () => {
    render(<ClusteringPanel ctx={ctx as any} />);
    expect(screen.getByText('По словам')).toBeInTheDocument();
    expect(screen.getByText('По составу (Жаккар)')).toBeInTheDocument();
  });

  it('should render strength slider label', () => {
    render(<ClusteringPanel ctx={ctx as any} />);
    expect(screen.getByText('Сила кластеризации')).toBeInTheDocument();
  });

  it('should render min group size label', () => {
    render(<ClusteringPanel ctx={ctx as any} />);
    expect(screen.getByText('Мин. размер группы')).toBeInTheDocument();
  });

  it('should show phrase count in cluster button', () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('G1');
    store.addPhrases(['фраза 1', 'фраза 2', 'фраза 3'], groupId);

    render(<ClusteringPanel ctx={ctx as any} />);
    // Component renders abbreviated form: "Кластеризовать (3 фр.)"
    expect(screen.getByText(/Кластеризовать \(3/)).toBeInTheDocument();
  });

  it('should disable cluster button when no phrases', () => {
    render(<ClusteringPanel ctx={ctx as any} />);
    const button = screen.getByText(/Кластеризовать/);
    expect(button).toBeDisabled();
  });

  it('should run clustering and show results', async () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('G1');
    store.addPhrases([
      'купить ноутбук москва',
      'купить ноутбук спб',
      'аренда квартиры',
    ], groupId);

    render(<ClusteringPanel ctx={ctx as any} />);
    const clusterBtn = screen.getByText(/Кластеризовать/);
    await userEvent.click(clusterBtn);

    // Wait for async clustering to complete
    await new Promise(r => setTimeout(r, 300));

    // Component auto-applies results and shows success message
    expect(screen.getByText(/Создано \d+ групп/)).toBeInTheDocument();
  });

  it('should show success message after clustering', async () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('G1');
    store.addPhrases(['купить ноутбук', 'купить ноутбук дешево'], groupId);

    render(<ClusteringPanel ctx={ctx as any} />);
    const clusterBtn = screen.getByText(/Кластеризовать/);
    await userEvent.click(clusterBtn);
    await new Promise(r => setTimeout(r, 300));

    // Component auto-applies and shows confirmation message
    expect(screen.getByText(/Фразы распределены/)).toBeInTheDocument();
  });

  it('should auto-create groups after clustering', async () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('G1');
    store.addPhrases(['купить ноутбук', 'купить ноутбук дешево'], groupId);

    render(<ClusteringPanel ctx={ctx as any} />);
    const clusterBtn = screen.getByText(/Кластеризовать/);
    await userEvent.click(clusterBtn);
    await new Promise(r => setTimeout(r, 300));

    // Component auto-applies clustering results (no separate button)
    // Verify that eventBus.emit was called for GROUPS_CHANGED
    const emitCalls = (ctx.eventBus.emit as ReturnType<typeof vi.fn>).mock.calls;
    const eventTypes = emitCalls.map((call: Array<unknown>) => call[0]);
    expect(eventTypes).toContain('groups:changed');
  });
});
