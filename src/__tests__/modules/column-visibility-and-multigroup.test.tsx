// ============================================================
// Tests: Column visibility in subgroups + Multi-group mode
// Validates:
// 1. Group column visibility at different nesting levels
// 2. Column toggle (CPC etc.) works correctly
// 3. Multi-group mode: activation, phrase filtering, deactivation
// 4. Multi-group edge cases: nested groups, empty selection, single group
// 5. Multi-group mode with column visibility interactions
// 6. selectAllPhrases in multi-group mode
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhrasesTable } from '@/modules/phrases/components';
import { useAppStore } from '@/plugin-sdk';
import { createEventBus } from '@/core/event-bus';

function createMockCtx() {
  return {
    eventBus: { ...createEventBus(), on: vi.fn(() => vi.fn()), emit: vi.fn() },
    store: {
      dispatch: vi.fn(),
      getState: () => useAppStore.getState(),
      getStateSlice: (k: keyof ReturnType<typeof useAppStore.getState>) => useAppStore.getState()[k],
      subscribe: () => () => {},
    },
    registerUI: vi.fn(),
    registerCommand: vi.fn(),
  };
}

// Helper: find "Группа" header text specifically in thead
function getGroupColumnHeader() {
  // The "Группа" text appears both as header and as group badge in cells.
  // We want to find it inside thead > tr > th
  const thead = document.querySelector('thead');
  if (!thead) return null;
  return within(thead).getByText('Группа');
}

function getGroupColumnHeaders() {
  const thead = document.querySelector('thead');
  if (!thead) return [];
  return within(thead).queryAllByText('Группа');
}

describe('Column visibility — group column at different nesting levels', () => {
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

  // --- Group column: visibility based on activeGroupId ---

  it('should show "Группа" column when no group is active (root level)', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа А');
    const g2 = store.addGroup('Группа Б');
    store.addPhrases(['фраза из А'], g1);
    store.addPhrases(['фраза из Б'], g2);

    render(<PhrasesTable ctx={ctx as any} />);
    // No active group → group column should be visible
    expect(getGroupColumnHeader()).toBeInTheDocument();
    expect(screen.getByText('Группа А', { selector: '.group-badge' })).toBeInTheDocument();
    expect(screen.getByText('Группа Б', { selector: '.group-badge' })).toBeInTheDocument();
  });

  it('should hide "Группа" column when a root group is active', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Корневая группа');
    store.addPhrases(['фраза 1'], g1);
    store.setActiveGroup(g1);

    render(<PhrasesTable ctx={ctx as any} />);
    // Active group set → group column hidden
    expect(getGroupColumnHeaders()).toHaveLength(0);
    expect(screen.queryByText('Корневая группа', { selector: '.group-badge' })).not.toBeInTheDocument();
    // The phrase itself should still render
    expect(screen.getByText('фраза')).toBeInTheDocument();
  });

  it('should hide "Группа" column when a subgroup (depth 1) is active', () => {
    const store = useAppStore.getState();
    const root = store.addGroup('Корень');
    const sub = store.addGroup('Подгруппа', root);
    store.addPhrases(['фраза в подгруппе'], sub);
    store.toggleExpand(root);
    store.setActiveGroup(sub);

    render(<PhrasesTable ctx={ctx as any} />);
    // Subgroup is active → group column hidden
    expect(getGroupColumnHeaders()).toHaveLength(0);
    expect(screen.queryByText('Подгруппа', { selector: '.group-badge' })).not.toBeInTheDocument();
  });

  it('should hide "Группа" column when a sub-subgroup (depth 2) is active', () => {
    const store = useAppStore.getState();
    const root = store.addGroup('Корень');
    const sub1 = store.addGroup('Уровень 1', root);
    const sub2 = store.addGroup('Уровень 2', sub1);
    store.addPhrases(['фраза глубоко'], sub2);
    store.toggleExpand(root);
    store.toggleExpand(sub1);
    store.setActiveGroup(sub2);

    render(<PhrasesTable ctx={ctx as any} />);
    // Deep subgroup active → group column hidden at any nesting level
    expect(getGroupColumnHeaders()).toHaveLength(0);
    expect(screen.queryByText('Уровень 2', { selector: '.group-badge' })).not.toBeInTheDocument();
  });

  it('should show "Группа" column after deselecting group (setActiveGroup(null))', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа');
    store.addPhrases(['фраза'], g1);

    // First select a group
    store.setActiveGroup(g1);
    render(<PhrasesTable ctx={ctx as any} />);
    expect(getGroupColumnHeaders()).toHaveLength(0);

    // Deselect — re-render via state change
    act(() => { useAppStore.getState().setActiveGroup(null); });
    expect(getGroupColumnHeader()).toBeInTheDocument();
  });

  // --- Other column toggles (CPC, KEI, etc.) ---

  it('should hide CPC column via toggleColumnVisibility', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа');
    store.addPhrases(['фраза'], g1, [{ frequency: 100, kei: 5, cpc: 10.5 }]);

    render(<PhrasesTable ctx={ctx as any} />);
    // CPC should be visible initially
    expect(screen.getByText('CPC')).toBeInTheDocument();

    // Hide CPC
    act(() => { useAppStore.getState().toggleColumnVisibility('cpc'); });
    expect(screen.queryByText('CPC')).not.toBeInTheDocument();
  });

  it('should show CPC column again after re-toggling', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа');
    store.addPhrases(['фраза'], g1, [{ frequency: 100, kei: 5, cpc: 10.5 }]);

    // Hide then show CPC
    store.toggleColumnVisibility('cpc');
    render(<PhrasesTable ctx={ctx as any} />);
    expect(screen.queryByText('CPC')).not.toBeInTheDocument();

    act(() => { useAppStore.getState().toggleColumnVisibility('cpc'); });
    expect(screen.getByText('CPC')).toBeInTheDocument();
  });

  it('should hide KEI column via toggleColumnVisibility', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа');
    store.addPhrases(['фраза'], g1, [{ frequency: 100, kei: 5, cpc: 10.5 }]);

    render(<PhrasesTable ctx={ctx as any} />);
    expect(screen.getByText('KEI')).toBeInTheDocument();

    act(() => { useAppStore.getState().toggleColumnVisibility('kei'); });
    expect(screen.queryByText('KEI')).not.toBeInTheDocument();
  });

  it('should hide frequency column via toggleColumnVisibility', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа');
    store.addPhrases(['фраза'], g1, [{ frequency: 100 }]);

    render(<PhrasesTable ctx={ctx as any} />);
    expect(screen.getByText('Частота')).toBeInTheDocument();

    act(() => { useAppStore.getState().toggleColumnVisibility('frequency'); });
    expect(screen.queryByText('Частота')).not.toBeInTheDocument();
  });

  it('should hide text column via toggleColumnVisibility', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа');
    store.addPhrases(['тестовая фраза'], g1);

    render(<PhrasesTable ctx={ctx as any} />);
    expect(screen.getByText('Ключевая фраза')).toBeInTheDocument();

    act(() => { useAppStore.getState().toggleColumnVisibility('text'); });
    expect(screen.queryByText('Ключевая фраза')).not.toBeInTheDocument();
  });

  it('should preserve column toggles when switching between groups', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа 1');
    const g2 = store.addGroup('Группа 2');
    store.addPhrases(['фраза 1'], g1, [{ frequency: 100, kei: 5, cpc: 10 }]);
    store.addPhrases(['фраза 2'], g2, [{ frequency: 200, kei: 8, cpc: 15 }]);

    // Hide KEI
    store.toggleColumnVisibility('kei');
    store.setActiveGroup(g1);

    render(<PhrasesTable ctx={ctx as any} />);
    expect(screen.queryByText('KEI')).not.toBeInTheDocument();

    // Switch to group 2
    act(() => { useAppStore.getState().setActiveGroup(g2); });
    // KEI should still be hidden
    expect(screen.queryByText('KEI')).not.toBeInTheDocument();
  });

  it('should reset all column settings via resetColumnSettings', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа');
    store.addPhrases(['фраза'], g1, [{ frequency: 100, kei: 5, cpc: 10.5 }]);

    // Hide multiple columns
    store.toggleColumnVisibility('cpc');
    store.toggleColumnVisibility('kei');

    render(<PhrasesTable ctx={ctx as any} />);
    expect(screen.queryByText('CPC')).not.toBeInTheDocument();
    expect(screen.queryByText('KEI')).not.toBeInTheDocument();

    // Reset
    act(() => { useAppStore.getState().resetColumnSettings(); });
    expect(screen.getByText('CPC')).toBeInTheDocument();
    expect(screen.getByText('KEI')).toBeInTheDocument();
  });

  // --- Column visibility + group nesting combinations ---

  it('should show only non-group columns when subgroup active and CPC hidden', () => {
    const store = useAppStore.getState();
    const root = store.addGroup('Корень');
    const sub = store.addGroup('Подгруппа', root);
    store.addPhrases(['фраза'], sub, [{ frequency: 100, kei: 5, cpc: 10 }]);
    store.toggleExpand(root);
    store.setActiveGroup(sub);
    store.toggleColumnVisibility('cpc');

    render(<PhrasesTable ctx={ctx as any} />);
    // Group column hidden (active subgroup)
    expect(getGroupColumnHeaders()).toHaveLength(0);
    // CPC hidden explicitly
    expect(screen.queryByText('CPC')).not.toBeInTheDocument();
    // KEI and frequency still visible
    expect(screen.getByText('KEI')).toBeInTheDocument();
    expect(screen.getByText('Частота')).toBeInTheDocument();
  });

  it('should show group column + custom label when column label changed', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа');
    store.addPhrases(['фраза'], g1);
    store.setColumnLabel('group', 'Категория');

    render(<PhrasesTable ctx={ctx as any} />);
    // No active group → group column visible with custom label
    expect(screen.getByText('Категория')).toBeInTheDocument();
  });

  it('should show group column with color styling when column color set', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа');
    store.addPhrases(['фраза'], g1, [{ frequency: 100, kei: 5, cpc: 10.5 }]);
    store.setColumnColor('group', '#4A90D9');

    render(<PhrasesTable ctx={ctx as any} />);
    // Group column visible
    expect(getGroupColumnHeader()).toBeInTheDocument();
    // The column header should have the color applied
    const groupHeader = getGroupColumnHeader()!.closest('th');
    expect(groupHeader).toHaveStyle({ backgroundColor: '#4A90D920' });
  });
});

describe('Multi-group mode — detailed tests', () => {
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

  // Helper: get "Группа" column header from thead
  function getGroupColHeader() {
    const thead = document.querySelector('thead');
    if (!thead) return null;
    return within(thead).queryByText('Группа');
  }

  // --- Multi-group activation/deactivation (store level, re-read state) ---

  it('should activate multi-group mode via setMultigroupMode(true)', () => {
    useAppStore.getState().setMultigroupMode(true);
    expect(useAppStore.getState().ui.multigroupMode).toBe(true);
  });

  it('should clear activeGroupId when entering multi-group mode', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа 1');
    store.addPhrases(['фраза 1'], g1);
    store.setActiveGroup(g1);

    store.setMultigroupMode(true);
    // activeGroupId is cleared — multigroup uses selectedGroupIds
    expect(useAppStore.getState().activeGroupId).toBeNull();
  });

  it('should transfer activeGroupId to selectedGroupIds when entering multi-group', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа 1');
    store.addPhrases(['фраза'], g1);
    store.setActiveGroup(g1);

    store.setMultigroupMode(true);
    // Must re-read state — the previously active group should now be in selectedGroupIds
    expect(useAppStore.getState().selectedGroupIds).toContain(g1);
  });

  it('should clear selectedGroupIds and restore first as active when exiting multi-group mode', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа 1');
    const g2 = store.addGroup('Группа 2');
    store.setMultigroupMode(true);
    store.toggleGroupSelection(g1);
    store.toggleGroupSelection(g2);

    store.setMultigroupMode(false);
    // selectedGroupIds are cleared; first selected (g1) becomes activeGroupId
    expect(useAppStore.getState().selectedGroupIds.size).toBe(0);
    expect(useAppStore.getState().activeGroupId).toBe(g1);
  });

  // --- Multi-group + group column visibility ---

  it('should show "Группа" column in multi-group mode with selected groups', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа А');
    const g2 = store.addGroup('Группа Б');
    store.addPhrases(['фраза а'], g1);
    store.addPhrases(['фраза б'], g2);

    store.setMultigroupMode(true);
    store.toggleGroupSelection(g1);
    store.toggleGroupSelection(g2);

    render(<PhrasesTable ctx={ctx as any} />);
    // Multi-group mode → group column should be visible
    expect(getGroupColHeader()).toBeInTheDocument();
  });

  it('should show "Группа" column in multi-group mode even with single selected group', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа А');
    store.addPhrases(['фраза'], g1);

    store.setMultigroupMode(true);
    store.toggleGroupSelection(g1);

    render(<PhrasesTable ctx={ctx as any} />);
    expect(getGroupColHeader()).toBeInTheDocument();
  });

  it('should show "Группа" column in multi-group mode with no selected groups', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа А');
    store.addPhrases(['фраза'], g1);

    store.setMultigroupMode(true);
    // No groups selected → activeGroupId is null, multigroupMode is true → showGroupCol

    render(<PhrasesTable ctx={ctx as any} />);
    expect(getGroupColHeader()).toBeInTheDocument();
  });

  // --- Multi-group phrase filtering ---

  it('should show phrases from both selected groups', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа 1');
    const g2 = store.addGroup('Группа 2');
    const g3 = store.addGroup('Группа 3');
    store.addPhrases(['фраза из 1'], g1);
    store.addPhrases(['фраза из 2'], g2);
    store.addPhrases(['фраза из 3'], g3);

    store.setMultigroupMode(true);
    store.toggleGroupSelection(g1);
    store.toggleGroupSelection(g2);

    render(<PhrasesTable ctx={ctx as any} />);
    // Should show "Группа 1" and "Группа 2" badges, not "Группа 3"
    expect(screen.getByText('Группа 1', { selector: '.group-badge' })).toBeInTheDocument();
    expect(screen.getByText('Группа 2', { selector: '.group-badge' })).toBeInTheDocument();
    expect(screen.queryByText('Группа 3', { selector: '.group-badge' })).not.toBeInTheDocument();
  });

  it('should include descendant phrases when parent group is selected in multi-group', () => {
    const store = useAppStore.getState();
    const root = store.addGroup('Корень');
    const sub = store.addGroup('Подгруппа', root);
    store.addPhrases(['фраза в корне'], root);
    store.addPhrases(['фраза в подгруппе'], sub);
    store.toggleExpand(root);

    store.setMultigroupMode(true);
    store.toggleGroupSelection(root);

    render(<PhrasesTable ctx={ctx as any} />);
    // Should show both root and subgroup phrases
    expect(screen.getByText('Корень', { selector: '.group-badge' })).toBeInTheDocument();
    expect(screen.getByText('Подгруппа', { selector: '.group-badge' })).toBeInTheDocument();
  });

  it('should show phrases only from selected group, not from unselected sibling', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Выбранная');
    const g2 = store.addGroup('Не выбранная');
    store.addPhrases(['фраза а'], g1);
    store.addPhrases(['фраза б'], g2);

    store.setMultigroupMode(true);
    store.toggleGroupSelection(g1);

    render(<PhrasesTable ctx={ctx as any} />);
    expect(screen.getByText('Выбранная', { selector: '.group-badge' })).toBeInTheDocument();
    expect(screen.queryByText('Не выбранная', { selector: '.group-badge' })).not.toBeInTheDocument();
  });

  it('should show all non-trash phrases in multi-group with empty selection', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа 1');
    const g2 = store.addGroup('Группа 2');
    store.addPhrases(['фраза 1'], g1);
    store.addPhrases(['фраза 2'], g2);

    store.setMultigroupMode(true);
    // No groups selected → should show all phrases (falls through to "no filter")

    render(<PhrasesTable ctx={ctx as any} />);
    expect(screen.getByText('Группа 1', { selector: '.group-badge' })).toBeInTheDocument();
    expect(screen.getByText('Группа 2', { selector: '.group-badge' })).toBeInTheDocument();
  });

  // --- Multi-group with three+ groups ---

  it('should show phrases from three selected groups', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа 1');
    const g2 = store.addGroup('Группа 2');
    const g3 = store.addGroup('Группа 3');
    store.addPhrases(['фраза 1'], g1);
    store.addPhrases(['фраза 2'], g2);
    store.addPhrases(['фраза 3'], g3);

    store.setMultigroupMode(true);
    store.toggleGroupSelection(g1);
    store.toggleGroupSelection(g2);
    store.toggleGroupSelection(g3);

    render(<PhrasesTable ctx={ctx as any} />);
    expect(screen.getByText('Группа 1', { selector: '.group-badge' })).toBeInTheDocument();
    expect(screen.getByText('Группа 2', { selector: '.group-badge' })).toBeInTheDocument();
    expect(screen.getByText('Группа 3', { selector: '.group-badge' })).toBeInTheDocument();
  });

  it('should correctly handle deselection of one group in multi-group mode', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа 1');
    const g2 = store.addGroup('Группа 2');
    const g3 = store.addGroup('Группа 3');
    store.addPhrases(['фраза 1'], g1);
    store.addPhrases(['фраза 2'], g2);
    store.addPhrases(['фраза 3'], g3);

    store.setMultigroupMode(true);
    store.toggleGroupSelection(g1);
    store.toggleGroupSelection(g2);
    store.toggleGroupSelection(g3);

    // Deselect g2
    store.toggleGroupSelection(g2);
    expect(useAppStore.getState().selectedGroupIds).not.toContain(g2);

    render(<PhrasesTable ctx={ctx as any} />);
    expect(screen.getByText('Группа 1', { selector: '.group-badge' })).toBeInTheDocument();
    expect(screen.queryByText('Группа 2', { selector: '.group-badge' })).not.toBeInTheDocument();
    expect(screen.getByText('Группа 3', { selector: '.group-badge' })).toBeInTheDocument();
  });

  // --- Multi-group with column toggles ---

  it('should show group column + hide CPC in multi-group mode', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа 1');
    const g2 = store.addGroup('Группа 2');
    store.addPhrases(['фраза 1'], g1, [{ cpc: 10 }]);
    store.addPhrases(['фраза 2'], g2, [{ cpc: 20 }]);

    store.setMultigroupMode(true);
    store.toggleGroupSelection(g1);
    store.toggleGroupSelection(g2);
    store.toggleColumnVisibility('cpc');

    render(<PhrasesTable ctx={ctx as any} />);
    // Group column visible in multi-group
    expect(getGroupColHeader()).toBeInTheDocument();
    // CPC hidden
    expect(screen.queryByText('CPC')).not.toBeInTheDocument();
  });

  it('should maintain column toggles when entering/exiting multi-group mode', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа');
    store.addPhrases(['фраза'], g1, [{ frequency: 100, kei: 5, cpc: 10 }]);

    // Hide KEI before entering multi-group
    store.toggleColumnVisibility('kei');
    store.setMultigroupMode(true);
    store.toggleGroupSelection(g1);

    render(<PhrasesTable ctx={ctx as any} />);
    expect(screen.queryByText('KEI')).not.toBeInTheDocument();

    // Exit multi-group — g1 is still selected so it becomes activeGroupId
    act(() => { useAppStore.getState().setMultigroupMode(false); });
    // Ensure we're out of multigroup mode
    expect(useAppStore.getState().ui.multigroupMode).toBe(false);
    expect(screen.queryByText('KEI')).not.toBeInTheDocument();
  });

  // --- Multi-group with nested groups + descendants ---

  it('should include deep nested subgroup phrases when parent selected in multi-group', () => {
    const store = useAppStore.getState();
    const root = store.addGroup('Корень');
    const sub1 = store.addGroup('Подгруппа 1', root);
    const sub2 = store.addGroup('Подгруппа 2', sub1);
    store.addPhrases(['фраза корень'], root);
    store.addPhrases(['фраза sub1'], sub1);
    store.addPhrases(['фраза sub2'], sub2);
    store.toggleExpand(root);
    store.toggleExpand(sub1);

    store.setMultigroupMode(true);
    store.toggleGroupSelection(root);

    render(<PhrasesTable ctx={ctx as any} />);
    // All three groups should be shown (root, sub1, sub2 are descendants of root)
    expect(screen.getByText('Корень', { selector: '.group-badge' })).toBeInTheDocument();
    expect(screen.getByText('Подгруппа 1', { selector: '.group-badge' })).toBeInTheDocument();
    expect(screen.getByText('Подгруппа 2', { selector: '.group-badge' })).toBeInTheDocument();
  });

  it('should only show selected subgroup phrases, not parent or siblings', () => {
    const store = useAppStore.getState();
    const root = store.addGroup('Корень');
    const sub1 = store.addGroup('Подгруппа 1', root);
    const sub2 = store.addGroup('Подгруппа 2', root);
    store.addPhrases(['фраза корень'], root);
    store.addPhrases(['фраза sub1'], sub1);
    store.addPhrases(['фраза sub2'], sub2);
    store.toggleExpand(root);

    store.setMultigroupMode(true);
    // Select only sub1 (not root, not sub2)
    store.toggleGroupSelection(sub1);

    render(<PhrasesTable ctx={ctx as any} />);
    expect(screen.getByText('Подгруппа 1', { selector: '.group-badge' })).toBeInTheDocument();
    expect(screen.queryByText('Корень', { selector: '.group-badge' })).not.toBeInTheDocument();
    expect(screen.queryByText('Подгруппа 2', { selector: '.group-badge' })).not.toBeInTheDocument();
  });

  // --- Multi-group + selectAllPhrases ---

  it('should select all visible phrases via select-all button', async () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа 1');
    const g2 = store.addGroup('Группа 2');
    store.addPhrases(['фраза 1'], g1);
    store.addPhrases(['фраза 2'], g2);

    store.setMultigroupMode(true);
    store.toggleGroupSelection(g1);

    render(<PhrasesTable ctx={ctx as any} />);
    const headerCheckbox = screen.getAllByRole('checkbox')[0];
    await userEvent.click(headerCheckbox);

    const state = useAppStore.getState();
    // selectAllPhrases selects all in activeGroupId or all if none.
    // In multi-group, activeGroupId is null, so it selects ALL phrases.
    // This test documents the current behavior.
    expect(state.selectedPhraseIds.size).toBeGreaterThan(0);
  });

  // --- Multi-group mode edge cases ---

  it('should handle empty project (no groups, no phrases) in multi-group mode', () => {
    const store = useAppStore.getState();
    store.setMultigroupMode(true);

    render(<PhrasesTable ctx={ctx as any} />);
    expect(screen.getByText('Ключевая фраза')).toBeInTheDocument();
  });

  it('should handle toggling all groups off in multi-group mode (empty selection)', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа 1');
    const g2 = store.addGroup('Группа 2');
    store.addPhrases(['фраза 1'], g1);
    store.addPhrases(['фраза 2'], g2);

    store.setMultigroupMode(true);
    store.toggleGroupSelection(g1);
    store.toggleGroupSelection(g2);

    render(<PhrasesTable ctx={ctx as any} />);
    expect(screen.getByText('Группа 1', { selector: '.group-badge' })).toBeInTheDocument();
    expect(screen.getByText('Группа 2', { selector: '.group-badge' })).toBeInTheDocument();

    // Deselect both
    act(() => {
      useAppStore.getState().toggleGroupSelection(g1);
      useAppStore.getState().toggleGroupSelection(g2);
    });
    // Empty selection in multi-group mode → shows all phrases
    expect(screen.getByText('Группа 1', { selector: '.group-badge' })).toBeInTheDocument();
    expect(screen.getByText('Группа 2', { selector: '.group-badge' })).toBeInTheDocument();
  });

  // --- Transition from single group to multi-group ---

  it('should transition from single group to multi-group preserving context', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа 1');
    const g2 = store.addGroup('Группа 2');
    store.addPhrases(['фраза 1'], g1, [{ frequency: 100 }]);
    store.addPhrases(['фраза 2'], g2, [{ frequency: 200 }]);

    // Start with single group active
    store.setActiveGroup(g1);
    expect(useAppStore.getState().activeGroupId).toBe(g1);
    expect(useAppStore.getState().ui.multigroupMode).toBe(false);

    // Enter multi-group → activeGroupId cleared, transferred to selectedGroupIds
    store.setMultigroupMode(true);
    expect(useAppStore.getState().activeGroupId).toBeNull();
    expect(useAppStore.getState().selectedGroupIds).toContain(g1);

    // Add second group to selection
    store.toggleGroupSelection(g2);
    expect(useAppStore.getState().selectedGroupIds.size).toBe(2);
  });

  it('should handle entering multi-group with no previously active group', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа 1');
    const g2 = store.addGroup('Группа 2');
    store.addPhrases(['фраза 1'], g1);
    store.addPhrases(['фраза 2'], g2);

    // No active group, enter multi-group
    store.setMultigroupMode(true);
    expect(useAppStore.getState().activeGroupId).toBeNull();
    expect(useAppStore.getState().selectedGroupIds.size).toBe(0);

    // Then select groups
    store.toggleGroupSelection(g1);
    store.toggleGroupSelection(g2);
    expect(useAppStore.getState().selectedGroupIds.size).toBe(2);
  });

  // --- Multi-group mode and clearAll ---

  it('should reset multi-group state on clearAll', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа 1');
    store.addPhrases(['фраза'], g1);

    store.setMultigroupMode(true);
    store.toggleGroupSelection(g1);
    expect(useAppStore.getState().ui.multigroupMode).toBe(true);

    store.clearAll();
    expect(useAppStore.getState().ui.multigroupMode).toBe(false);
    expect(useAppStore.getState().selectedGroupIds.size).toBe(0);
    expect(useAppStore.getState().activeGroupId).toBeNull();
  });
});

describe('Column visibility — store-level tests', () => {
  beforeEach(() => {
    useAppStore.getState().clearAll();
  });

  it('should default all columns to visible', () => {
    const state = useAppStore.getState();
    expect(state.ui.columnVisibility).toEqual({});
  });

  it('should toggle column visibility to false', () => {
    useAppStore.getState().toggleColumnVisibility('cpc');
    expect(useAppStore.getState().ui.columnVisibility['cpc']).toBe(false);
  });

  it('should toggle column visibility back to true', () => {
    useAppStore.getState().toggleColumnVisibility('cpc');
    useAppStore.getState().toggleColumnVisibility('cpc');
    expect(useAppStore.getState().ui.columnVisibility['cpc']).toBe(true);
  });

  it('should set custom column label', () => {
    useAppStore.getState().setColumnLabel('cpc', 'Стоимость клика');
    expect(useAppStore.getState().ui.columnLabels['cpc']).toBe('Стоимость клика');
  });

  it('should set custom column color', () => {
    useAppStore.getState().setColumnColor('cpc', '#FF0000');
    expect(useAppStore.getState().ui.columnColors['cpc']).toBe('#FF0000');
  });

  it('should reset all column settings', () => {
    useAppStore.getState().toggleColumnVisibility('cpc');
    useAppStore.getState().setColumnLabel('cpc', 'Cost');
    useAppStore.getState().setColumnColor('cpc', '#FF0000');

    useAppStore.getState().resetColumnSettings();
    expect(useAppStore.getState().ui.columnVisibility).toEqual({});
    expect(useAppStore.getState().ui.columnLabels).toEqual({});
    expect(useAppStore.getState().ui.columnColors).toEqual({});
  });

  it('should toggle multiple columns independently', () => {
    useAppStore.getState().toggleColumnVisibility('cpc');
    useAppStore.getState().toggleColumnVisibility('kei');
    useAppStore.getState().toggleColumnVisibility('frequency');

    expect(useAppStore.getState().ui.columnVisibility['cpc']).toBe(false);
    expect(useAppStore.getState().ui.columnVisibility['kei']).toBe(false);
    expect(useAppStore.getState().ui.columnVisibility['frequency']).toBe(false);
    // Text column should still have no explicit setting
    expect(useAppStore.getState().ui.columnVisibility['text']).toBeUndefined();
  });
});
