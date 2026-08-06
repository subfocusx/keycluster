import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PhrasesTable } from '@/modules/phrases/components';
import { useAppStore } from '@/plugin-sdk';
import { createEventBus } from '@/core/event-bus';

function createMockCtx() {
  const bus = createEventBus();
  return {
    eventBus: bus,
    store: { dispatch: vi.fn(), getState: () => useAppStore.getState(), getStateSlice: (k: string) => (useAppStore.getState() as any)[k], subscribe: () => () => {} },
    registerUI: vi.fn(),
    registerCommand: vi.fn(),
  };
}

describe('Phrases group filter', () => {
  let ctx: ReturnType<typeof createMockCtx>;
  let originalResizeObserver: typeof globalThis.ResizeObserver;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    ctx = createMockCtx();

    const mockRect = {
      height: 600, width: 1200,
      top: 0, left: 0, bottom: 600, right: 1200,
      x: 0, y: 0, toJSON: () => '{}',
    };
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(mockRect as DOMRect);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1200);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1200);

    originalResizeObserver = global.ResizeObserver;
    global.ResizeObserver = class ResizeObserverMock {
      cb: ResizeObserverCallback;
      constructor(cb: ResizeObserverCallback) { this.cb = cb; }
      observe() {
        this.cb([{ contentRect: { width: 1200, height: 600, x: 0, y: 0, top: 0, left: 0, bottom: 600, right: 1200 } } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.ResizeObserver = originalResizeObserver;
  });

  // TODO: group filter not implemented in PhrasesTable
  it.skip('should render select with all non-trash groups', () => {
    const store = useAppStore.getState();
    store.addGroup('Группа А');
    store.addGroup('Группа Б');

    render(<PhrasesTable ctx={ctx as any} />);

    const select = document.querySelector('select')!;
    expect(select).toBeInTheDocument();
    const options = Array.from(select.querySelectorAll('option'));
    expect(options).toHaveLength(3);
    expect(options[0].textContent).toBe('Все группы');
    expect(options[1].textContent).toBe('Группа А');
    expect(options[2].textContent).toBe('Группа Б');
  });

  it.skip('should filter by selected group (no active group)', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа 1');
    const g2 = store.addGroup('Группа 2');
    store.addPhrases(['фраза из группы 1'], g1);
    store.addPhrases(['фраза из группы 2'], g2);

    render(<PhrasesTable ctx={ctx as any} />);

    const select = document.querySelector('select')!;
    fireEvent.change(select, { target: { value: g2 } });

    expect(screen.getByText('группы')).toBeInTheDocument();
    expect(screen.getByText('2', { selector: '[data-word]' })).toBeInTheDocument();
    expect(screen.queryByText('1', { selector: '[data-word]' })).not.toBeInTheDocument();
  });

  it.skip('should work within active group context', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа 1');
    const g2 = store.addGroup('Группа 2');
    store.addPhrases(['фраза один'], g1);
    store.addPhrases(['фраза два'], g2);
    store.setActiveGroup(g1);

    render(<PhrasesTable ctx={ctx as any} />);

    expect(screen.getByText('один')).toBeInTheDocument();
    expect(screen.getByText('фраза')).toBeInTheDocument();

    const select = document.querySelector('select')!;
    fireEvent.change(select, { target: { value: g2 } });
    expect(screen.queryByText('один')).not.toBeInTheDocument();
    expect(screen.queryByText('два')).not.toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'all' } });
    expect(screen.getByText('один')).toBeInTheDocument();
  });

  it.skip('should reset groupFilter to "all" when activeGroupId changes', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа 1');
    const g2 = store.addGroup('Группа 2');
    store.addPhrases(['фраза один'], g1);
    store.addPhrases(['фраза два'], g2);
    store.setActiveGroup(g1);

    render(<PhrasesTable ctx={ctx as any} />);

    const select = document.querySelector('select')! as HTMLSelectElement;
    fireEvent.change(select, { target: { value: g2 } });
    expect(select.value).toBe(g2);

    act(() => { store.setActiveGroup(g2); });
    expect(select.value).toBe('all');
  });

  it.skip('should combine groupFilter and searchQuery (AND)', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа 1');
    const g2 = store.addGroup('Группа 2');
    store.addPhrases(['уникальный текст'], g1);
    store.addPhrases(['другой текст'], g2);

    render(<PhrasesTable ctx={ctx as any} />);

    const select = document.querySelector('select')!;
    fireEvent.change(select, { target: { value: g1 } });

    const searchInput = document.querySelector('input[placeholder="Фильтр фраз..."]')!;
    fireEvent.input(searchInput, { target: { value: 'уникальный' } });

    expect(screen.getByText('уникальный')).toBeInTheDocument();
    expect(screen.queryByText('другой')).not.toBeInTheDocument();
  });
});
