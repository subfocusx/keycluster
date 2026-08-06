import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhrasesTable } from '@/modules/phrases/components';
import { useAppStore } from '@/plugin-sdk';
import { createEventBus } from '@/core/event-bus';

function createMockCtx() {
  const bus = createEventBus();
  const origEmit = bus.emit.bind(bus);
  bus.emit = vi.fn(origEmit) as typeof bus.emit;
  return {
    eventBus: bus,
    store: { dispatch: vi.fn(), getState: () => useAppStore.getState(), getStateSlice: (k: string) => (useAppStore.getState() as any)[k], subscribe: () => () => {} },
    registerUI: vi.fn(),
    registerCommand: vi.fn(),
  };
}

describe('Inline edit — double click / F2', () => {
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

  it('should show input on double click', () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('G');
    store.addPhrases(['тестовая фраза'], gid);

    render(<PhrasesTable ctx={ctx as any} />);
    const row = screen.getByText('тестовая').closest('tr')!;
    fireEvent.doubleClick(row);

    expect(document.querySelector('td input')).toBeInTheDocument();
  });

  it('should call updatePhrase with new text on Enter', async () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('G');
    store.addPhrases(['старый текст'], gid);

    render(<PhrasesTable ctx={ctx as any} />);
    const row = screen.getByText('старый').closest('tr')!;
    fireEvent.doubleClick(row);

    const input = document.querySelector('td input')!;
    await userEvent.clear(input);
    await userEvent.type(input, 'новый текст');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByText('новый')).toBeInTheDocument();
    expect(screen.getByText('текст')).toBeInTheDocument();
    expect(document.querySelector('td input')).not.toBeInTheDocument();
  });

  it('should cancel edit on Escape', async () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('G');
    store.addPhrases(['оригинал'], gid);

    render(<PhrasesTable ctx={ctx as any} />);
    const row = screen.getByText('оригинал').closest('tr')!;
    fireEvent.doubleClick(row);

    const input = document.querySelector('td input')!;
    await userEvent.clear(input);
    await userEvent.type(input, 'изменено{Escape}');

    expect(screen.getByText('оригинал')).toBeInTheDocument();
    expect(document.querySelector('td input')).not.toBeInTheDocument();
  });

  it('should commit edit on blur', async () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('G');
    store.addPhrases(['blur edit'], gid);

    render(<PhrasesTable ctx={ctx as any} />);
    const row = screen.getByText('blur').closest('tr')!;
    fireEvent.doubleClick(row);

    const input = document.querySelector('td input')!;
    await userEvent.clear(input);
    await userEvent.type(input, 'blur saved');
    fireEvent.blur(input);

    expect(screen.getByText('blur')).toBeInTheDocument();
    expect(screen.getByText('saved')).toBeInTheDocument();
    expect(document.querySelector('td input')).not.toBeInTheDocument();
  });

  it('should not save empty text on Enter', async () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('G');
    store.addPhrases(['непусто'], gid);

    render(<PhrasesTable ctx={ctx as any} />);
    const row = screen.getByText('непусто').closest('tr')!;
    fireEvent.doubleClick(row);

    const input = document.querySelector('td input')!;
    await userEvent.clear(input);
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByText('непусто')).toBeInTheDocument();
    expect(document.querySelector('td input')).not.toBeInTheDocument();
  });
});
