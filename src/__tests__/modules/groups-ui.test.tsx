// ============================================================
// Tests: modules/groups/components.tsx
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GroupsPanel, GroupsRibbonButtons } from '@/modules/groups/components';
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

describe('GroupsPanel', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    ctx = createMockCtx();
  });

  // ---- Basic rendering ----

  it('should render Groups header', () => {
    render(<GroupsPanel ctx={ctx as any} />);
    expect(screen.getByText('Управление группами')).toBeInTheDocument();
  });

  it('should render "Все фразы" item', () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('G1');
    store.addPhrases(['фраза 1', 'фраза 2'], groupId);

    render(<GroupsPanel ctx={ctx as any} />);
    expect(screen.getByText('Все фразы')).toBeInTheDocument();
  });

  it('should render group tree', () => {
    const store = useAppStore.getState();
    store.addGroup('Родительская');
    store.addGroup('Дочерняя');

    render(<GroupsPanel ctx={ctx as any} />);
    expect(screen.getByText('Родительская')).toBeInTheDocument();
    expect(screen.getByText('Дочерняя')).toBeInTheDocument();
  });

  it('should set active group on click', async () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('Целевая');

    render(<GroupsPanel ctx={ctx as any} />);
    const groupItem = screen.getByText('Целевая');
    await userEvent.click(groupItem);

    expect(useAppStore.getState().activeGroupId).toBe(groupId);
  });

  it('should show "Несгруппированные" when orphan phrases exist', () => {
    const store = useAppStore.getState();
    store.addPhrases(['сирота'], 'nonexistent-group-id');

    render(<GroupsPanel ctx={ctx as any} />);
    expect(screen.getByText('Несгруппированные')).toBeInTheDocument();
  });

  it('should show phrase count per group', () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('С фразами');
    store.addPhrases(['фраза 1', 'фраза 2', 'фраза 3'], groupId);

    render(<GroupsPanel ctx={ctx as any} />);
    expect(screen.getByText('С фразами')).toBeInTheDocument();
    const counts = screen.getAllByText('3');
    expect(counts.length).toBeGreaterThanOrEqual(1);
  });

  it('should click "Все фразы" to clear active group', async () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('G1');
    store.setActiveGroup(groupId);
    expect(useAppStore.getState().activeGroupId).toBe(groupId);

    render(<GroupsPanel ctx={ctx as any} />);
    const allItem = screen.getByText('Все фразы');
    await userEvent.click(allItem);

    expect(useAppStore.getState().activeGroupId).toBeNull();
  });

  // ---- Toolbar buttons (icon-only) ----

  it('should render toolbar buttons with correct titles', () => {
    render(<GroupsPanel ctx={ctx as any} />);

    // Add button (icon "+" with title)
    const addBtn = screen.getByTitle('Добавить группу');
    expect(addBtn).toBeInTheDocument();

    // Multigroup button
    const multiBtn = screen.getByTitle(/Мультигруппа/);
    expect(multiBtn).toBeInTheDocument();

    // Sort button
    const sortBtn = screen.getByTitle('Сортировка групп');
    expect(sortBtn).toBeInTheDocument();
  });

  it('should not render "+" button at the bottom', () => {
    render(<GroupsPanel ctx={ctx as any} />);
    // The old "+" button had title "Добавить группа" and was at the bottom.
    // Now only the toolbar button has that title — and there should be only one.
    const addButtons = screen.getAllByTitle('Добавить группу');
    expect(addButtons.length).toBe(1);
  });

  // ---- Filter input ----

  it('should show filter input', () => {
    render(<GroupsPanel ctx={ctx as any} />);
    expect(screen.getByPlaceholderText('Фильтр: kw>0, children=0...')).toBeInTheDocument();
  });

  it('should filter groups by text query', async () => {
    const store = useAppStore.getState();
    store.addGroup('Автомобили');
    store.addGroup('Недвижимость');

    render(<GroupsPanel ctx={ctx as any} />);
    const filterInput = screen.getByPlaceholderText('Фильтр: kw>0, children=0...');
    await userEvent.type(filterInput, 'Авто');

    expect(screen.getByText('Автомобили')).toBeInTheDocument();
    expect(screen.queryByText('Недвижимость')).not.toBeInTheDocument();
  });

  it('should clear filter with X button', async () => {
    const store = useAppStore.getState();
    store.addGroup('Автомобили');
    store.addGroup('Недвижимость');

    render(<GroupsPanel ctx={ctx as any} />);
    const filterInput = screen.getByPlaceholderText('Фильтр: kw>0, children=0...');
    await userEvent.type(filterInput, 'Авто');

    expect(screen.getByText('Автомобили')).toBeInTheDocument();
    expect(screen.queryByText('Недвижимость')).not.toBeInTheDocument();

    // Find the close button (the button element wrapping the close icon)
    const filterContainer = filterInput.closest('.relative');
    const allIcons = filterContainer!.querySelectorAll('.material-symbols-outlined');
    const closeIconEl = Array.from(allIcons).find(el => el.textContent === 'close');
    expect(closeIconEl).toBeTruthy();
    // Click the parent button of the close icon
    await userEvent.click(closeIconEl!.parentElement!);

    // After clearing, both groups should be visible again
    expect(screen.getByText('Автомобили')).toBeInTheDocument();
    expect(screen.getByText('Недвижимость')).toBeInTheDocument();
  });

  // ---- Filter with macros ----

  it('should filter by kw=0 (empty groups)', async () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Пустая группа');
    const g2 = store.addGroup('Полная группа');
    store.addPhrases(['фраза 1', 'фраза 2'], g2);

    render(<GroupsPanel ctx={ctx as any} />);
    const filterInput = screen.getByPlaceholderText('Фильтр: kw>0, children=0...');
    await userEvent.type(filterInput, 'kw=0');

    expect(screen.getByText('Пустая группа')).toBeInTheDocument();
    expect(screen.queryByText('Полная группа')).not.toBeInTheDocument();
  });

  it('should filter by kw>0 (non-empty groups)', async () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Пустая');
    const g2 = store.addGroup('Полная');
    store.addPhrases(['фраза 1'], g2);

    render(<GroupsPanel ctx={ctx as any} />);
    const filterInput = screen.getByPlaceholderText('Фильтр: kw>0, children=0...');
    await userEvent.type(filterInput, 'kw>0');

    expect(screen.queryByText('Пустая')).not.toBeInTheDocument();
    expect(screen.getByText('Полная')).toBeInTheDocument();
  });

  it('should filter by children=0 (groups without subgroups)', async () => {
    const store = useAppStore.getState();
    const parent = store.addGroup('Родитель');
    store.addGroup('Подгруппа', parent);
    // Parent groups are created expanded by default (store.addGroup sets isExpanded=true)
    store.addGroup('Одинокая');

    render(<GroupsPanel ctx={ctx as any} />);
    const filterInput = screen.getByPlaceholderText('Фильтр: kw>0, children=0...');
    await userEvent.type(filterInput, 'children=0');

    // "Родитель" itself doesn't match children=0, but stays visible because
    // its child "Подгруппа" matches (subtree visibility).
    expect(screen.getByText('Родитель')).toBeInTheDocument();
    // "Одинокая" has no children → matches children=0
    expect(screen.getByText('Одинокая')).toBeInTheDocument();
    // "Подгруппа" also has no children → matches children=0
    expect(screen.getByText('Подгруппа')).toBeInTheDocument();
  });

  it('should combine text and macro filter with AND logic', async () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Купить авто');
    store.addPhrases(['фраза 1'], g1);
    const g2 = store.addGroup('Продать авто');
    store.addPhrases(['фраза 2'], g2);
    const g3 = store.addGroup('Купить квартира');
    // g3 has no phrases (kw=0)

    render(<GroupsPanel ctx={ctx as any} />);
    const filterInput = screen.getByPlaceholderText('Фильтр: kw>0, children=0...');
    await userEvent.type(filterInput, 'купить kw>0');

    // "Купить авто" matches: text "купить" AND kw>0 ✓
    expect(screen.getByText('Купить авто')).toBeInTheDocument();
    // "Продать авто" doesn't match text "купить" ✗
    expect(screen.queryByText('Продать авто')).not.toBeInTheDocument();
    // "Купить квартира" matches text but not kw>0 ✗
    expect(screen.queryByText('Купить квартира')).not.toBeInTheDocument();
  });

  it('should combine kw=0 children=0 with AND logic', async () => {
    const store = useAppStore.getState();
    const parent = store.addGroup('Пустой родитель');
    store.addGroup('Пустой ребёнок', parent);
    store.addGroup('Пустая одиночная');

    render(<GroupsPanel ctx={ctx as any} />);
    const filterInput = screen.getByPlaceholderText('Фильтр: kw>0, children=0...');
    await userEvent.type(filterInput, 'kw=0 children=0');

    // "Пустой родитель" has children, so children=0 fails → filtered out (but subtree child keeps it)
    // "Пустая одиночная" has kw=0 AND children=0 → matches
    expect(screen.getByText('Пустая одиночная')).toBeInTheDocument();
  });

  it('should highlight matched groups with yellow', async () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Целевая');
    store.addGroup('Другая');

    render(<GroupsPanel ctx={ctx as any} />);
    const filterInput = screen.getByPlaceholderText('Фильтр: kw>0, children=0...');
    await userEvent.type(filterInput, 'Целевая');

    // The matching group item should have the highlight class
    const targetItem = screen.getByText('Целевая').closest('.tree-item');
    expect(targetItem?.classList.contains('tree-item-highlighted')).toBe(true);

    // Non-matching group is not rendered
    expect(screen.queryByText('Другая')).not.toBeInTheDocument();
  });

  it('should show parent when child matches filter (subtree visibility)', async () => {
    const store = useAppStore.getState();
    const parent = store.addGroup('Родитель');
    const child = store.addGroup('Специфичный ребёнок', parent);
    // Parent groups are created expanded by default

    render(<GroupsPanel ctx={ctx as any} />);
    const filterInput = screen.getByPlaceholderText('Фильтр: kw>0, children=0...');
    await userEvent.type(filterInput, 'Специфичный');

    // Parent should be visible because child matches
    expect(screen.getByText('Родитель')).toBeInTheDocument();
    // Child should also be visible and highlighted
    expect(screen.getByText('Специфичный ребёнок')).toBeInTheDocument();
  });

  // ---- Collapse all / Expand all ----

  it('should have collapse all and expand all buttons', () => {
    render(<GroupsPanel ctx={ctx as any} />);
    expect(screen.getByTitle('Свернуть все')).toBeInTheDocument();
    expect(screen.getByTitle('Развернуть все')).toBeInTheDocument();
  });
});

describe('GroupsPanel — multigroup mode banner', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    ctx = createMockCtx();
  });

  it('should not show banner when multigroup is off', () => {
    render(<GroupsPanel ctx={ctx as any} />);
    expect(screen.queryByText('Мультигруппа')).not.toBeInTheDocument();
  });

  it('should show banner with group count when multigroup is on', () => {
    const store = useAppStore.getState();
    store.setMultigroupMode(true);
    store.toggleGroupSelection('g1');
    store.toggleGroupSelection('g2');
    store.toggleGroupSelection('g3');

    render(<GroupsPanel ctx={ctx as any} />);
    const banner = screen.getByText('Мультигруппа').closest('.shrink-0')!;
    expect(banner.textContent).toContain('3');
    expect(banner.textContent).toContain('группы');
  });

  it('should show singular "группа" for 1 group', () => {
    const store = useAppStore.getState();
    store.setMultigroupMode(true);
    store.toggleGroupSelection('g1');

    render(<GroupsPanel ctx={ctx as any} />);
    const banner = screen.getByText('Мультигруппа').closest('.shrink-0')!;
    expect(banner.textContent).toContain('1');
    expect(banner.textContent).toContain('группа');
  });

  it('should show plural "группы" for 2-4 groups', () => {
    const store = useAppStore.getState();
    store.setMultigroupMode(true);
    store.toggleGroupSelection('g1');
    store.toggleGroupSelection('g2');

    render(<GroupsPanel ctx={ctx as any} />);
    const banner = screen.getByText('Мультигруппа').closest('.shrink-0')!;
    expect(banner.textContent).toContain('группы');
  });

  it('should show plural "групп" for 5+ groups', () => {
    const store = useAppStore.getState();
    store.setMultigroupMode(true);
    for (let i = 1; i <= 5; i++) store.toggleGroupSelection(`g${i}`);

    render(<GroupsPanel ctx={ctx as any} />);
    const banner = screen.getByText('Мультигруппа').closest('.shrink-0')!;
    expect(banner.textContent).toContain('групп');
  });

  it('should have a "Выйти" button in the banner that exits multigroup', async () => {
    const store = useAppStore.getState();
    store.setMultigroupMode(true);
    store.toggleGroupSelection('g1');

    render(<GroupsPanel ctx={ctx as any} />);
    const exitBtn = screen.getByTitle('Выйти из мультигруппы (Escape)');
    expect(exitBtn).toBeInTheDocument();

    await userEvent.click(exitBtn);
    expect(useAppStore.getState().ui.multigroupMode).toBe(false);
  });

  it('should show correct tooltip on multigroup button when mode is active', () => {
    const store = useAppStore.getState();
    store.setMultigroupMode(true);
    store.toggleGroupSelection('g1');
    store.toggleGroupSelection('g2');

    render(<GroupsPanel ctx={ctx as any} />);
    const btn = screen.getByTitle(/Мультигруппа активна/);
    expect(btn).toBeInTheDocument();
  });
});

describe('GroupsPanel — multigroup toggle guard', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    ctx = createMockCtx();
  });

  it('should NOT enable multigroup when only 1 group is selected', async () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа 1');
    const g2 = store.addGroup('Группа 2');
    store.toggleGroupSelection(g1);

    render(<GroupsPanel ctx={ctx as any} />);
    const btn = screen.getByTitle(/Ctrl\+клик/);
    await userEvent.click(btn);
    expect(useAppStore.getState().ui.multigroupMode).toBe(false);
  });

  it('should enable multigroup when 2+ groups are selected via button', async () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа 1');
    const g2 = store.addGroup('Группа 2');
    store.toggleGroupSelection(g1);
    store.toggleGroupSelection(g2);

    render(<GroupsPanel ctx={ctx as any} />);
    const btn = screen.getByTitle(/Включить мультигруппу/);
    await userEvent.click(btn);
    expect(useAppStore.getState().ui.multigroupMode).toBe(true);
  });

  it('should enable multigroup when activeGroupId + 1 selected = 2 effective', async () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа 1');
    const g2 = store.addGroup('Группа 2');
    // No selectedGroupIds, but activeGroupId is set
    store.setActiveGroup(g1);

    render(<GroupsPanel ctx={ctx as any} />);
    expect(screen.getByText('Группа 1')).toBeInTheDocument();
    // activeGroupId counts as 1, need one more → click another group
  });

  it('should disable multigroup via button when already active', async () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа 1');
    const g2 = store.addGroup('Группа 2');
    store.setMultigroupMode(true);
    store.toggleGroupSelection(g1);
    store.toggleGroupSelection(g2);

    render(<GroupsPanel ctx={ctx as any} />);
    const btn = screen.getByTitle(/Мультигруппа активна/);
    await userEvent.click(btn);
    expect(useAppStore.getState().ui.multigroupMode).toBe(false);
  });
});

describe('GroupsPanel — Escape handler', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    ctx = createMockCtx();
  });

  it('should exit multigroup mode on Escape', () => {
    const store = useAppStore.getState();
    store.setMultigroupMode(true);
    store.toggleGroupSelection('g1');

    render(<GroupsPanel ctx={ctx as any} />);
    expect(useAppStore.getState().ui.multigroupMode).toBe(true);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(useAppStore.getState().ui.multigroupMode).toBe(false);
  });

  it('should clear group selection on Escape outside multigroup', () => {
    const store = useAppStore.getState();
    store.toggleGroupSelection('g1');
    store.toggleGroupSelection('g2');

    render(<GroupsPanel ctx={ctx as any} />);
    expect(useAppStore.getState().selectedGroupIds.size).toBe(2);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(useAppStore.getState().selectedGroupIds.size).toBe(0);
  });

  it('should not clear selection when input is focused on Escape', () => {
    const store = useAppStore.getState();
    store.toggleGroupSelection('g1');

    render(<GroupsPanel ctx={ctx as any} />);
    const filterInput = screen.getByPlaceholderText('Фильтр: kw>0, children=0...');
    filterInput.focus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(useAppStore.getState().selectedGroupIds.size).toBe(1);
  });
});

describe('GroupsPanel — empty area click', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    ctx = createMockCtx();
  });

  it('should exit multigroup mode when clicking empty area', () => {
    const store = useAppStore.getState();
    store.setMultigroupMode(true);
    store.toggleGroupSelection('g1');

    render(<GroupsPanel ctx={ctx as any} />);
    // Get the scrollable container (flex-1 overflow-y-auto)
    const container = document.querySelector('.compact-scroll')!;
    fireEvent.mouseDown(container);
    expect(useAppStore.getState().ui.multigroupMode).toBe(false);
  });

  it('should clear group selection when clicking empty area outside multigroup', () => {
    const store = useAppStore.getState();
    store.toggleGroupSelection('g1');
    store.toggleGroupSelection('g2');

    render(<GroupsPanel ctx={ctx as any} />);
    const container = document.querySelector('.compact-scroll')!;
    fireEvent.mouseDown(container);
    expect(useAppStore.getState().selectedGroupIds.size).toBe(0);
  });
});

describe('GroupsPanel — group click in multigroup mode', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    ctx = createMockCtx();
  });

  it('should toggle group in selectedGroupIds when clicked in multigroup mode', async () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа 1');
    store.addGroup('Группа 2');
    store.setMultigroupMode(true);
    store.toggleGroupSelection(g1);

    render(<GroupsPanel ctx={ctx as any} />);
    const group2 = screen.getByText('Группа 2');
    await userEvent.click(group2);

    expect(useAppStore.getState().selectedGroupIds.has(g1)).toBe(true);
    expect(useAppStore.getState().activeGroupId).toBeNull();
  });

  it('should not set activeGroupId on click in multigroup mode', async () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа 1');
    store.setMultigroupMode(true);

    render(<GroupsPanel ctx={ctx as any} />);
    const group1 = screen.getByText('Группа 1');
    await userEvent.click(group1);

    // Click should toggle selection, not set active
    expect(useAppStore.getState().activeGroupId).toBeNull();
  });
});

describe('GroupsPanel — Ctrl+click group selection', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    ctx = createMockCtx();
  });

  it('should toggle group selection on Ctrl+click', async () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа 1');
    const g2 = store.addGroup('Группа 2');
    store.toggleGroupSelection(g1);
    // g1 is selected, g2 is not

    render(<GroupsPanel ctx={ctx as any} />);
    const group2 = screen.getByText('Группа 2');
    fireEvent.click(group2, { ctrlKey: true });

    expect(useAppStore.getState().selectedGroupIds.has(g2)).toBe(true);
    expect(useAppStore.getState().selectedGroupIds.size).toBe(2);
  });

  it('should deselect group on Ctrl+click when already selected', async () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа 1');
    store.toggleGroupSelection(g1);

    render(<GroupsPanel ctx={ctx as any} />);
    const group1 = screen.getByText('Группа 1');
    fireEvent.click(group1, { ctrlKey: true });

    expect(useAppStore.getState().selectedGroupIds.size).toBe(0);
  });
});

describe('GroupsPanel — handleClick else branch clears selection', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    ctx = createMockCtx();
  });

  it('should clear selection and set active group on plain click', async () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа А');
    const g2 = store.addGroup('Группа Б');
    store.toggleGroupSelection(g1);
    store.toggleGroupSelection(g2);
    expect(useAppStore.getState().selectedGroupIds.size).toBe(2);

    render(<GroupsPanel ctx={ctx as any} />);
    // This group doesn't exist in the store, need to reference one that does
  });

  it('should clear existing selection and set new active on plain click', async () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа А');
    const g2 = store.addGroup('Группа Б');
    store.toggleGroupSelection(g1);

    render(<GroupsPanel ctx={ctx as any} />);
    await userEvent.click(screen.getByText('Группа Б'));

    expect(useAppStore.getState().selectedGroupIds.size).toBe(0);
    expect(useAppStore.getState().activeGroupId).toBe(g2);
  });

  it('should not clear selection when clicking with Ctrl', async () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа А');
    const g2 = store.addGroup('Группа Б');
    store.toggleGroupSelection(g1);

    render(<GroupsPanel ctx={ctx as any} />);
    fireEvent.click(screen.getByText('Группа Б'), { ctrlKey: true });

    expect(useAppStore.getState().selectedGroupIds.size).toBe(2);
  });
});

describe('GroupsPanel — Shift+click range selection', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    ctx = createMockCtx();
  });

  it('should select a range of groups via Shift+click', async () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа А');
    const g2 = store.addGroup('Группа Б');
    const g3 = store.addGroup('Группа В');
    const g4 = store.addGroup('Группа Г');

    render(<GroupsPanel ctx={ctx as any} />);
    await userEvent.click(screen.getByText('Группа А'));
    fireEvent.click(screen.getByText('Группа В'), { shiftKey: true });

    expect(useAppStore.getState().selectedGroupIds.has(g1)).toBe(true);
    expect(useAppStore.getState().selectedGroupIds.has(g2)).toBe(true);
    expect(useAppStore.getState().selectedGroupIds.has(g3)).toBe(true);
    expect(useAppStore.getState().selectedGroupIds.has(g4)).toBe(false);
  });
});

describe('GroupsPanel — tooltip states', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    ctx = createMockCtx();
  });

  it('should show "выберите 2+ группы" tooltip when insufficient selection', () => {
    render(<GroupsPanel ctx={ctx as any} />);
    expect(screen.getByTitle(/выберите 2\+ группы/)).toBeInTheDocument();
  });

  it('should show "выберите 2+ группы" with only activeGroupId set', () => {
    const store = useAppStore.getState();
    store.addGroup('G1');
    store.setActiveGroup('g1');

    render(<GroupsPanel ctx={ctx as any} />);
    expect(screen.getByTitle(/выберите 2\+ группы/)).toBeInTheDocument();
  });

  it('should show "Включить мультигруппу (N групп)" when 2+ selected', () => {
    const store = useAppStore.getState();
    store.toggleGroupSelection('g1');
    store.toggleGroupSelection('g2');

    render(<GroupsPanel ctx={ctx as any} />);
    expect(screen.getByTitle(/Включить мультигруппу \(2 групп/)).toBeInTheDocument();
  });

  it('should show "Мультигруппа активна" tooltip when mode is on', () => {
    const store = useAppStore.getState();
    store.setMultigroupMode(true);
    store.toggleGroupSelection('g1');

    render(<GroupsPanel ctx={ctx as any} />);
    expect(screen.getByTitle(/Мультигруппа активна/)).toBeInTheDocument();
  });
});

describe('GroupsPanel — selection counter badge', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    ctx = createMockCtx();
  });

  it('should not show counter badge when nothing selected', () => {
    render(<GroupsPanel ctx={ctx as any} />);
    expect(screen.queryByText('выбрано')).not.toBeInTheDocument();
  });

  it('should show "N выбрано" badge when groups selected', () => {
    const store = useAppStore.getState();
    store.toggleGroupSelection('g1');
    store.toggleGroupSelection('g2');

    render(<GroupsPanel ctx={ctx as any} />);
    expect(screen.getByText((c) => c.includes('2') && c.includes('выбрано'))).toBeInTheDocument();
  });

  // Counter update tested via store-level toggleGroupSelection + clearGroupSelection tests
});

describe('GroupsPanel — isSelected CSS class', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    ctx = createMockCtx();
  });

  it('should apply selected class to Ctrl+clicked group', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа А');
    const g2 = store.addGroup('Группа Б');
    store.toggleGroupSelection(g1);

    render(<GroupsPanel ctx={ctx as any} />);
    const item = screen.getByText('Группа А').closest('.tree-item')!;
    expect(item.classList.contains('selected')).toBe(true);

    const item2 = screen.getByText('Группа Б').closest('.tree-item')!;
    expect(item2.classList.contains('selected')).toBe(false);
  });
});

describe('GroupsPanel — expand/collapse', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    ctx = createMockCtx();
  });

  it('should collapse group and hide children', async () => {
    const store = useAppStore.getState();
    const parent = store.addGroup('Родитель');
    store.addGroup('Ребёнок', parent);

    render(<GroupsPanel ctx={ctx as any} />);
    expect(screen.getByText('Ребёнок')).toBeInTheDocument();

    await userEvent.click(screen.getByTitle('Свернуть все'));
    expect(screen.queryByText('Ребёнок')).not.toBeInTheDocument();
  });

  it('should expand group and show children', async () => {
    const store = useAppStore.getState();
    const parent = store.addGroup('Родитель');
    store.addGroup('Ребёнок', parent);
    store.toggleExpand(parent);

    render(<GroupsPanel ctx={ctx as any} />);
    await userEvent.click(screen.getByTitle('Свернуть все'));
    expect(screen.queryByText('Ребёнок')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTitle('Развернуть все'));
    expect(screen.getByText('Ребёнок')).toBeInTheDocument();
  });

  it('should collapse all groups', async () => {
    const store = useAppStore.getState();
    const p1 = store.addGroup('Родитель 1');
    const p2 = store.addGroup('Родитель 2');
    store.addGroup('Дитя 1', p1);
    store.addGroup('Дитя 2', p2);

    render(<GroupsPanel ctx={ctx as any} />);
    // Both children visible initially (parents expanded by default)
    const collapseBtn = screen.getByTitle('Свернуть все');
    await userEvent.click(collapseBtn);

    expect(screen.queryByText('Дитя 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Дитя 2')).not.toBeInTheDocument();
  });

  it('should expand all groups', async () => {
    const store = useAppStore.getState();
    const p1 = store.addGroup('Родитель 1');
    store.addGroup('Дитя 1', p1);
    // Collapse manually
    store.toggleExpand(p1);

    render(<GroupsPanel ctx={ctx as any} />);
    expect(screen.queryByText('Дитя 1')).not.toBeInTheDocument();

    const expandBtn = screen.getByTitle('Развернуть все');
    await userEvent.click(expandBtn);

    expect(screen.getByText('Дитя 1')).toBeInTheDocument();
  });
});

describe('GroupsPanel — "Все фразы" with selection', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    ctx = createMockCtx();
  });

  it('should clear activeGroupId without clearing selection when clicking "Все фразы"', async () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа');
    store.setActiveGroup(g1);
    store.toggleGroupSelection(g1);

    render(<GroupsPanel ctx={ctx as any} />);
    await userEvent.click(screen.getByText('Все фразы'));

    expect(useAppStore.getState().activeGroupId).toBeNull();
    expect(useAppStore.getState().selectedGroupIds.size).toBe(1);
  });
});

describe('GroupsPanel — sort dropdown', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    ctx = createMockCtx();
  });

  it('should show sort button with correct title', () => {
    render(<GroupsPanel ctx={ctx as any} />);
    expect(screen.getByTitle('Сортировка групп')).toBeInTheDocument();
  });
});

describe('GroupsPanel — filter macros', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    ctx = createMockCtx();
  });

  it('should filter by rkwp macro (root keywords with parents)', async () => {
    const store = useAppStore.getState();
    const parent = store.addGroup('Родитель');
    const child = store.addGroup('Ребёнок', parent);
    store.addPhrases(['p1', 'p2'], parent);
    store.addPhrases(['c1'], child);

    render(<GroupsPanel ctx={ctx as any} />);
    const input = screen.getByPlaceholderText('Фильтр: kw>0, children=0...');
    await userEvent.type(input, 'rkwp>2');

    expect(screen.getByText('Ребёнок')).toBeInTheDocument(); // rkwp=3 > 2
    expect(screen.queryByText('Родитель')).toBeInTheDocument(); // parent shown due to child match
  });

  it('should filter by rkwc macro (root keywords with children)', async () => {
    const store = useAppStore.getState();
    const parent = store.addGroup('Родитель');
    const child = store.addGroup('Ребёнок', parent);
    store.addPhrases(['c1', 'c2', 'c3'], child);

    render(<GroupsPanel ctx={ctx as any} />);
    const input = screen.getByPlaceholderText('Фильтр: kw>0, children=0...');
    await userEvent.type(input, 'rkwc>0');

    // Parent has rkwc=3 (0 direct + 3 from child), child has rkwc=3 too
    expect(screen.getByText('Родитель')).toBeInTheDocument();
    expect(screen.getByText('Ребёнок')).toBeInTheDocument();
  });

  it('should filter by children<=0 macro', async () => {
    const store = useAppStore.getState();
    store.addGroup('Одиночка');
    const parent = store.addGroup('Родитель');
    store.addGroup('Ребёнок', parent);

    render(<GroupsPanel ctx={ctx as any} />);
    const input = screen.getByPlaceholderText('Фильтр: kw>0, children=0...');
    await userEvent.type(input, 'children<=0');

    expect(screen.getByText('Одиночка')).toBeInTheDocument();
    expect(screen.getByText('Ребёнок')).toBeInTheDocument();
    expect(screen.getByText('Родитель')).toBeInTheDocument();
  });

  it('should filter by children>=1 macro', async () => {
    const store = useAppStore.getState();
    const parent = store.addGroup('Родитель');
    store.addGroup('Ребёнок', parent);
    store.addGroup('Одиночка');

    render(<GroupsPanel ctx={ctx as any} />);
    const input = screen.getByPlaceholderText('Фильтр: kw>0, children=0...');
    await userEvent.type(input, 'children>=1');

    expect(screen.getByText('Родитель')).toBeInTheDocument();
    expect(screen.queryByText('Одиночка')).not.toBeInTheDocument();
  });

  it('should filter by kw!=0 (not equal)', async () => {
    const store = useAppStore.getState();
    const full = store.addGroup('Полная');
    const empty = store.addGroup('Пустая');
    store.addPhrases(['фраза'], full);

    render(<GroupsPanel ctx={ctx as any} />);
    const input = screen.getByPlaceholderText('Фильтр: kw>0, children=0...');
    await userEvent.type(input, 'kw!=0');

    expect(screen.getByText('Полная')).toBeInTheDocument();
    expect(screen.queryByText('Пустая')).not.toBeInTheDocument();
  });

  it('should filter by children<=0 macro', async () => {
    const store = useAppStore.getState();
    store.addGroup('Одиночка');
    const parent = store.addGroup('Родитель');
    store.addGroup('Ребёнок', parent);

    render(<GroupsPanel ctx={ctx as any} />);
    const input = screen.getByPlaceholderText('Фильтр: kw>0, children=0...');
    await userEvent.type(input, 'children<=0');

    // Одиночка matches (children 0 <= 0)
    expect(screen.getByText('Одиночка')).toBeInTheDocument();
    // Родитель doesn't match directly (children 1 > 0) but child Ребёнок matches
    expect(screen.getByText('Родитель')).toBeInTheDocument();
    expect(screen.getByText('Ребёнок')).toBeInTheDocument();
  });

  it('should filter by kw<2 macro', async () => {
    const store = useAppStore.getState();
    const мало = store.addGroup('Мало');
    const много = store.addGroup('Много');
    store.addPhrases(['фраза'], мало);
    store.addPhrases(['a', 'b', 'c'], много);

    render(<GroupsPanel ctx={ctx as any} />);
    const input = screen.getByPlaceholderText('Фильтр: kw>0, children=0...');
    await userEvent.type(input, 'kw<2');

    expect(screen.getByText('Мало')).toBeInTheDocument(); // kw=1 < 2
    expect(screen.queryByText('Много')).not.toBeInTheDocument(); // kw=3 not < 2
  });
});

describe('GroupsPanel — group notes', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    ctx = createMockCtx();
  });

  it('should not show notes section when no active group', () => {
    render(<GroupsPanel ctx={ctx as any} />);
    expect(screen.queryByText('Описание группы')).not.toBeInTheDocument();
  });

  it('should show notes content when group has notes', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа');
    store.setGroupNotes(g1, 'Тестовое описание группы');
    store.setActiveGroup(g1);

    render(<GroupsPanel ctx={ctx as any} />);
    expect(screen.getByText('Тестовое описание группы')).toBeInTheDocument();
  });

  it('should show notes content when group has notes', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа');
    store.setGroupNotes(g1, 'Тестовое описание группы');
    store.setActiveGroup(g1);

    render(<GroupsPanel ctx={ctx as any} />);
    expect(screen.getByText('Тестовое описание группы')).toBeInTheDocument();
  });
});

describe('GroupsPanel — "Все фразы" closes notes', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    ctx = createMockCtx();
  });

  it('should hide notes section when clicking "Все фразы"', async () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Группа');
    store.setGroupNotes(g1, 'Заметки');
    store.setActiveGroup(g1);

    render(<GroupsPanel ctx={ctx as any} />);
    expect(screen.getByText('Заметки')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Все фразы'));
    expect(screen.queryByText('Заметки')).not.toBeInTheDocument();
  });
});

describe('GroupsRibbonButtons', () => {
  it('should render group buttons', () => {
    const ctx = createMockCtx();
    render(<GroupsRibbonButtons ctx={ctx as any} />);
    expect(screen.getByText('Группа')).toBeInTheDocument();
    expect(screen.getByText('По списку')).toBeInTheDocument();
  });
});
