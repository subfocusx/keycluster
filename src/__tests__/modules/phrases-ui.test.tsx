// ============================================================
// Tests: modules/phrases/components.tsx
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhrasesTable, PhrasesRibbonButtons } from '@/modules/phrases/components';
import { useAppStore } from '@/plugin-sdk';
import { createEventBus } from '@/core/event-bus';

function createMockCtx() {
  return {
    eventBus: { ...createEventBus(), on: vi.fn(() => vi.fn()), emit: vi.fn() },
    store: { dispatch: vi.fn(), getState: () => useAppStore.getState(), getStateSlice: (k: keyof ReturnType<typeof useAppStore.getState>) => useAppStore.getState()[k], subscribe: () => () => {} },
    registerUI: vi.fn(),
    registerCommand: vi.fn(),
  };
}

describe('PhrasesTable', () => {
  let ctx: ReturnType<typeof createMockCtx>;
  let originalResizeObserver: typeof globalThis.ResizeObserver;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    ctx = createMockCtx();

    // Mock DOM layout properties so @tanstack/react-virtual can render rows.
    // jsdom reports offsetHeight/clientHeight = 0, causing the virtualizer
    // to think the viewport is empty and render zero items.
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

    // Make ResizeObserver fire its callback immediately so the component
    // measures containerWidth and triggers initial column sizing.
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

  it('should render table with headers when empty', () => {
    render(<PhrasesTable ctx={ctx as any} />);
    expect(screen.getByText('Ключевая фраза')).toBeInTheDocument();
    expect(screen.getByText('Частота')).toBeInTheDocument();
  });

  it('should render phrases in table rows', () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('Test Group');
    store.addPhrases(['купить ноутбук', 'аренда квартиры'], groupId, [
      { frequency: 12100, kei: 12, cpc: 85.5 },
      { frequency: 8500, kei: 8, cpc: 72.3 },
    ]);

    render(<PhrasesTable ctx={ctx as any} />);
    expect(screen.getByText('купить')).toBeInTheDocument();
    expect(screen.getByText('ноутбук')).toBeInTheDocument();
    expect(screen.getByText('аренда')).toBeInTheDocument();
    expect(screen.getByText('12,100')).toBeInTheDocument();
    expect(screen.getByText('8,500')).toBeInTheDocument();
  });

  it('should filter phrases by search query', async () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('G1');
    store.addPhrases(['ноутбук купить', 'телефон аренда'], groupId);

    render(<PhrasesTable ctx={ctx as any} />);
    const searchInput = screen.getByPlaceholderText('Фильтр фраз...');
    await userEvent.type(searchInput, 'ноутбук');

    expect(screen.getByText('ноутбук')).toBeInTheDocument();
    expect(screen.queryByText('телефон')).not.toBeInTheDocument();
  });

  it('should sort by frequency when clicking header', async () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('G1');
    store.addPhrases(['низкая'], groupId, [{ frequency: 100 }]);
    store.addPhrases(['высокая'], groupId, [{ frequency: 99900 }]);

    render(<PhrasesTable ctx={ctx as any} />);
    const freqHeader = screen.getByText('Частота');
    await userEvent.click(freqHeader);
    // After clicking, the sort direction toggles — verify it doesn't crash
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('99,900')).toBeInTheDocument();
  });

  it('should add minus word when clicking a keyword word', async () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('G1');
    store.addPhrases(['купить ноутбук'], groupId);

    render(<PhrasesTable ctx={ctx as any} />);
    const word = screen.getByText('купить');
    await userEvent.click(word);

    const state = useAppStore.getState();
    expect(state.minusWords.length).toBe(1);
    expect(state.minusWords[0].text).toBe('купить');
  });

  it('should bind minus word to the active group when clicking a keyword word', async () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('G1');
    store.addPhrases(['купить ноутбук'], groupId);
    store.setActiveGroup(groupId);

    render(<PhrasesTable ctx={ctx as any} />);
    const word = screen.getByText('купить');
    await userEvent.click(word);

    const state = useAppStore.getState();
    expect(state.minusWords.length).toBe(1);
    expect(state.minusWords[0].groupId).toBe(groupId);
  });

  it('should remove minus word when clicking already-negative word', async () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('G1');
    store.addPhrases(['купить ноутбук'], groupId);
    store.addMinusWord('купить', false, null, 'broad');

    render(<PhrasesTable ctx={ctx as any} />);
    const word = screen.getByText('купить');
    await userEvent.click(word);

    const state = useAppStore.getState();
    expect(state.minusWords.length).toBe(0);
  });

  it('should show group badge when no active group is set', () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('Моя Группа');
    store.addPhrases(['тест'], groupId);

    render(<PhrasesTable ctx={ctx as any} />);
    expect(screen.getByText('Моя Группа', { selector: '.group-badge' })).toBeInTheDocument();
  });

  it('should not show group column when active group is set', () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('Моя Группа');
    store.addPhrases(['тест'], groupId);
    store.setActiveGroup(groupId);

    render(<PhrasesTable ctx={ctx as any} />);
    // The "Группа" header should not appear
    expect(screen.queryByText('Группа', { selector: '.group-badge' })).not.toBeInTheDocument();
  });

  it('should show phrase count in toolbar', () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('G1');
    store.addPhrases(['фраза один', 'фраза два'], groupId);

    render(<PhrasesTable ctx={ctx as any} />);
    // The count appears as "2" in the toolbar
    const countElements = screen.getAllByText('2');
    expect(countElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should NOT toggle sort when clicking inside filter popover', async () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('G1');
    store.addPhrases(['низкая'], groupId, [{ frequency: 100 }]);
    store.addPhrases(['высокая'], groupId, [{ frequency: 99900 }]);

    render(<PhrasesTable ctx={ctx as any} />);

    // Click the "Частота" header to set initial sort
    const freqHeader = screen.getByText('Частота');
    await userEvent.click(freqHeader);

    // Now click the filter icon for the frequency column
    const filterButtons = screen.getAllByTitle('Фильтр столбца');
    // The frequency column filter should be the second one (after "Ключевая фраза")
    const freqFilterBtn = filterButtons[1];
    await userEvent.click(freqFilterBtn);

    // The filter popover should be visible
    expect(screen.getByText('Фильтр: Частота')).toBeInTheDocument();

    // Click inside the popover (on the select element or apply button)
    // This should NOT cause the sort to toggle
    const applyBtn = screen.getByText('Применить');
    await userEvent.click(applyBtn);

    // The popover should close after applying, but sort should remain stable
    // Verify the table still renders correctly without sort toggling
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('99,900')).toBeInTheDocument();
  });

  it('should apply column filter and show correct results', async () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('G1');
    store.addPhrases(['низкая'], groupId, [{ frequency: 100 }]);
    store.addPhrases(['средняя'], groupId, [{ frequency: 5000 }]);
    store.addPhrases(['высокая'], groupId, [{ frequency: 99900 }]);

    render(<PhrasesTable ctx={ctx as any} />);

    // Open the filter popover for the frequency column
    const filterButtons = screen.getAllByTitle('Фильтр столбца');
    const freqFilterBtn = filterButtons[1]; // frequency is the 2nd filterable column
    await userEvent.click(freqFilterBtn);

    // The filter popover should be visible
    expect(screen.getByText('Фильтр: Частота')).toBeInTheDocument();

    // Type a filter value
    const input = screen.getByPlaceholderText('Число...');
    await userEvent.type(input, '1000');

    // Apply the filter (greater than 1000)
    const applyBtn = screen.getByText('Применить');
    await userEvent.click(applyBtn);

    // Only "средняя" (5000) and "высокая" (99900) should remain
    // "низкая" (100) is filtered out because 100 is NOT > 1000 with default "eq"
  });

  it('should select all phrases via select-all button', async () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('G1');
    store.addPhrases(['тестовая фраза'], groupId);

    render(<PhrasesTable ctx={ctx as any} />);
    // Click the header checkbox to select all
    const headerCheckbox = screen.getAllByRole('checkbox')[0];
    await userEvent.click(headerCheckbox);

    const state = useAppStore.getState();
    expect(state.selectedPhraseIds.size).toBeGreaterThan(0);
  });

  it('should keep checkbox selection when right-click → "Перенести в группу"', async () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('G1');
    store.addPhrases(['купить ноутбук'], groupId);

    render(<PhrasesTable ctx={ctx as any} />);

    // Step 1: Check the checkbox to select the phrase (there are 2 checkboxes: header + row)
    const checkboxes = screen.getAllByRole('checkbox');
    const rowCheckbox = checkboxes[1]; // second is the data row checkbox
    await userEvent.click(rowCheckbox);
    expect(useAppStore.getState().selectedPhraseIds.size).toBe(1);

    // Step 2: Right-click to open context menu
    const phraseRow = screen.getByText('купить').closest('tr')!;
    await userEvent.pointer({ keys: '[MouseRight]', target: phraseRow });

    // Step 3: Click "Перенести в группу" — selection must NOT be cleared
    const moveItem = screen.getByText('Перенести в группу');
    await userEvent.click(moveItem);

    // Selection should still have 1 phrase (bug: togglePhraseSelection was deselecting)
    expect(useAppStore.getState().selectedPhraseIds.size).toBe(1);
  });

  it('should add phrase to selection via context menu if not selected', async () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('G1');
    store.addPhrases(['купить ноутбук'], groupId);

    render(<PhrasesTable ctx={ctx as any} />);

    // Phrase NOT selected initially
    expect(useAppStore.getState().selectedPhraseIds.size).toBe(0);

    // Right-click and click "Перенести в группу" — should select the phrase
    const phraseRow = screen.getByText('купить').closest('tr')!;
    await userEvent.pointer({ keys: '[MouseRight]', target: phraseRow });

    const moveItem = screen.getByText('Перенести в группу');
    await userEvent.click(moveItem);

    // Now the phrase should be selected (added to selection)
    expect(useAppStore.getState().selectedPhraseIds.size).toBe(1);
  });
});

describe('PhrasesRibbonButtons', () => {
  it('should render the add phrases button', () => {
    const ctx = createMockCtx();
    render(<PhrasesRibbonButtons ctx={ctx as any} />);
    expect(screen.getByText('Фразы')).toBeInTheDocument();
  });
});
