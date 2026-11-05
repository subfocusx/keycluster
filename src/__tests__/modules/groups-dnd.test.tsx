// ============================================================
// Tests: Drag & drop фраз в группы и групп между группами (P0.1)
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { PhrasesTable } from '@/modules/phrases/components';
import { GroupsPanel } from '@/modules/groups/components';
import { useAppStore } from '@/plugin-sdk';
import { createEventBus } from '@/core/event-bus';
import {
  cancelDrag,
  endDrag,
  getDragPayload,
  getDropTargetId,
} from '@/core/dnd/groupDnd';

function createMockCtx() {
  return {
    eventBus: { ...createEventBus(), on: vi.fn(() => vi.fn()), emit: vi.fn() },
    store: {
      dispatch: vi.fn(),
      getState: () => useAppStore.getState(),
      getStateSlice: (k: keyof ReturnType<typeof useAppStore.getState>) => useAppStore.getState()[k],
      subscribe: () => () => { },
    },
    registerUI: vi.fn(),
    registerCommand: vi.fn(),
  };
}

/** Минимальный DataTransfer для jsdom (настоящего DataTransfer в jsdom нет). */
function createDataTransfer() {
  const store = new Map<string, string>();
  return {
    effectAllowed: 'all',
    dropEffect: 'move',
    types: [] as string[],
    setData(type: string, value: string) { store.set(type, value); },
    getData(type: string) { return store.get(type) ?? ''; },
    setDragImage() { /* нет в jsdom */ },
    clearData() { store.clear(); },
  };
}

function treeItem(name: string): HTMLElement {
  const el = screen.getByText(name).closest('.tree-item');
  if (!el) throw new Error(`Не найден элемент дерева «${name}»`);
  return el as HTMLElement;
}

function phraseRow(text: string): HTMLElement {
  const el = screen.getByText(text).closest('tr');
  if (!el) throw new Error(`Не найдена строка фразы «${text}»`);
  return el as HTMLElement;
}

describe('Drag & drop: фразы → группы, группы → группы', () => {
  let ctx: ReturnType<typeof createMockCtx>;
  let originalResizeObserver: typeof globalThis.ResizeObserver;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    cancelDrag();
    ctx = createMockCtx();

    // jsdom не умеет считать размеры — без этого виртуализатор не рисует строки.
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
      unobserve() { }
      disconnect() { }
    } as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    endDrag();
    vi.restoreAllMocks();
    global.ResizeObserver = originalResizeObserver;
  });

  // ---- Payload ----

  it('dragstart фразы формирует payload с id фразы', () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('Группа-источник');
    store.addPhrases(['купить'], groupId);

    render(<PhrasesTable ctx={ctx as any} />);

    const row = phraseRow('купить');
    const handle = within(row).getByTestId('phrase-drag-handle');
    const dt = createDataTransfer();

    fireEvent.mouseDown(handle);
    fireEvent.dragStart(row, { dataTransfer: dt });

    const payload = getDragPayload();
    expect(payload).not.toBeNull();
    expect(payload?.kind).toBe('phrase');
    if (payload?.kind === 'phrase') {
      const phraseId = useAppStore.getState().phrases.find(p => p.text === 'купить')!.id;
      expect(payload.phraseIds).toEqual([phraseId]);
      expect(payload.sourceId).toBe(phraseId);
    }
    // payload продублирован в dataTransfer — так он переживает перенос между окнами
    expect(JSON.parse(dt.getData('application/x-keycluster-dnd')).kind).toBe('phrase');
  });

  it('dragstart группы формирует payload с id группы', () => {
    const store = useAppStore.getState();
    store.addGroup('Переносимая');

    render(<GroupsPanel ctx={ctx as any} />);

    const dt = createDataTransfer();
    fireEvent.dragStart(treeItem('Переносимая'), { dataTransfer: dt });

    const payload = getDragPayload();
    expect(payload?.kind).toBe('group');
    if (payload?.kind === 'group') {
      expect(payload.groupId).toBe(useAppStore.getState().groups[0].id);
    }
  });

  // ---- Перенос фразы в группу ----

  it('drop фразы на группу переносит фразу в эту группу', () => {
    const store = useAppStore.getState();
    const sourceGroupId = store.addGroup('Исходная');
    const targetGroupId = store.addGroup('Целевая');
    store.addPhrases(['купить'], sourceGroupId);
    const phraseId = useAppStore.getState().phrases.find(p => p.text === 'купить')!.id;

    render(
      <>
        <PhrasesTable ctx={ctx as any} />
        <GroupsPanel ctx={ctx as any} />
      </>,
    );

    const dt = createDataTransfer();
    fireEvent.mouseDown(within(phraseRow('купить')).getByTestId('phrase-drag-handle'));
    fireEvent.dragStart(phraseRow('купить'), { dataTransfer: dt });

    const target = treeItem('Целевая');
    fireEvent.dragOver(target, { dataTransfer: dt });
    expect(getDropTargetId()).toBe(targetGroupId);

    fireEvent.drop(target, { dataTransfer: dt });

    const state = useAppStore.getState();
    expect(state.phrases.find(p => p.id === phraseId)?.groupId).toBe(targetGroupId);
    // перенос попадает в историю undo
    expect(state.undoStack.length).toBeGreaterThan(0);
  });

  it('drop фразы на группу не копирует фразу (фраза остаётся одна)', () => {
    const store = useAppStore.getState();
    const sourceGroupId = store.addGroup('Исходная');
    const targetGroupId = store.addGroup('Целевая');
    store.addPhrases(['купить'], sourceGroupId);

    render(
      <>
        <PhrasesTable ctx={ctx as any} />
        <GroupsPanel ctx={ctx as any} />
      </>,
    );

    const dt = createDataTransfer();
    fireEvent.mouseDown(within(phraseRow('купить')).getByTestId('phrase-drag-handle'));
    fireEvent.dragStart(phraseRow('купить'), { dataTransfer: dt });
    fireEvent.dragOver(treeItem('Целевая'), { dataTransfer: dt });
    fireEvent.drop(treeItem('Целевая'), { dataTransfer: dt });

    const state = useAppStore.getState();
    expect(state.phrases).toHaveLength(1);
    expect(state.phrases.filter(p => p.groupId === targetGroupId)).toHaveLength(1);
    expect(state.phrases.filter(p => p.groupId === sourceGroupId)).toHaveLength(0);
  });

  // ---- Перенос группы в другую группу ----

  it('drop группы на другую группу меняет родителя', () => {
    const store = useAppStore.getState();
    const sourceGroupId = store.addGroup('Переносимая');
    const targetGroupId = store.addGroup('Новая родительская');

    render(<GroupsPanel ctx={ctx as any} />);

    const dt = createDataTransfer();
    fireEvent.dragStart(treeItem('Переносимая'), { dataTransfer: dt });
    fireEvent.dragOver(treeItem('Новая родительская'), { dataTransfer: dt });
    fireEvent.drop(treeItem('Новая родительская'), { dataTransfer: dt });

    const state = useAppStore.getState();
    expect(state.groups.find(g => g.id === sourceGroupId)?.parentId).toBe(targetGroupId);
    expect(state.undoStack.length).toBeGreaterThan(0);
  });

  it('drop группы в себя игнорируется', () => {
    const store = useAppStore.getState();
    const sourceGroupId = store.addGroup('Переносимая');

    render(<GroupsPanel ctx={ctx as any} />);

    const dt = createDataTransfer();
    fireEvent.dragStart(treeItem('Переносимая'), { dataTransfer: dt });
    fireEvent.dragOver(treeItem('Переносимая'), { dataTransfer: dt });
    fireEvent.drop(treeItem('Переносимая'), { dataTransfer: dt });

    const state = useAppStore.getState();
    expect(state.groups.find(g => g.id === sourceGroupId)?.parentId).toBeNull();
  });

  it('drop группы в собственного потомка игнорируется', () => {
    const store = useAppStore.getState();
    const parentId = store.addGroup('Родитель');
    const childId = store.addGroup('Потомок', parentId);

    render(<GroupsPanel ctx={ctx as any} />);

    const dt = createDataTransfer();
    fireEvent.dragStart(treeItem('Родитель'), { dataTransfer: dt });
    fireEvent.dragOver(treeItem('Потомок'), { dataTransfer: dt });
    fireEvent.drop(treeItem('Потомок'), { dataTransfer: dt });

    const state = useAppStore.getState();
    expect(state.groups.find(g => g.id === parentId)?.parentId).toBeNull();
    expect(state.groups.find(g => g.id === childId)?.parentId).toBe(parentId);
  });

  // ---- Отмена и невалидные цели ----

  it('Esc отменяет перенос — drop после отмены ничего не делает', () => {
    const store = useAppStore.getState();
    const sourceGroupId = store.addGroup('Исходная');
    const targetGroupId = store.addGroup('Целевая');
    store.addPhrases(['купить'], sourceGroupId);
    const phraseId = useAppStore.getState().phrases.find(p => p.text === 'купить')!.id;

    render(
      <>
        <PhrasesTable ctx={ctx as any} />
        <GroupsPanel ctx={ctx as any} />
      </>,
    );

    const dt = createDataTransfer();
    fireEvent.mouseDown(within(phraseRow('купить')).getByTestId('phrase-drag-handle'));
    fireEvent.dragStart(phraseRow('купить'), { dataTransfer: dt });
    expect(getDragPayload()).not.toBeNull();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(getDragPayload()).toBeNull();

    fireEvent.dragOver(treeItem('Целевая'), { dataTransfer: dt });
    fireEvent.drop(treeItem('Целевая'), { dataTransfer: dt });

    const state = useAppStore.getState();
    expect(state.phrases.find(p => p.id === phraseId)?.groupId).toBe(sourceGroupId);
  });

  it('drop на невалидную цель ничего не делает', () => {
    const store = useAppStore.getState();
    const sourceGroupId = store.addGroup('Исходная');
    const targetGroupId = store.addGroup('Целевая');
    store.addPhrases(['купить'], sourceGroupId);
    const phraseId = useAppStore.getState().phrases.find(p => p.text === 'купить')!.id;

    render(
      <>
        <PhrasesTable ctx={ctx as any} />
        <GroupsPanel ctx={ctx as any} />
      </>,
    );

    // Перенос без dragstart — payload отсутствует, цель невалидна.
    const dt = createDataTransfer();
    fireEvent.dragOver(treeItem('Целевая'), { dataTransfer: dt });
    fireEvent.drop(treeItem('Целевая'), { dataTransfer: dt });

    const state = useAppStore.getState();
    expect(state.phrases.find(p => p.id === phraseId)?.groupId).toBe(sourceGroupId);
    expect(targetGroupId).toBeTruthy();
  });

  // ---- Существующее поведение не сломано ----

  it('клик по строке по-прежнему выделяет фразу', () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('Группа');
    store.addPhrases(['купить'], groupId);
    const phraseId = useAppStore.getState().phrases.find(p => p.text === 'купить')!.id;

    render(<PhrasesTable ctx={ctx as any} />);

    fireEvent.click(phraseRow('купить'));
    expect(useAppStore.getState().selectedPhraseIds.has(phraseId)).toBe(true);
  });

  it('клик по слову по-прежнему добавляет минус-фразу', () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('Группа');
    store.addPhrases(['купить'], groupId);

    render(<PhrasesTable ctx={ctx as any} />);

    fireEvent.click(screen.getByText('купить'));
    const state = useAppStore.getState();
    expect(state.minusWords.length).toBe(1);
    expect(state.minusWords[0].text).toBe('купить');
  });
});
