import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '@/plugin-sdk';
import type { ModuleContext, EventBus, StoreAccess } from '@/plugin-sdk';
import { MinusWordsPanel } from '@user-plugins/minus-words/components';

function setupStore() {
  const groups = useAppStore.getState().groups;
  const g1 = groups.length > 0 ? groups[0].id : useAppStore.getState().addGroup('Default');
  useAppStore.getState().addPhrases(['купить машину', 'продать машину', 'аренда квартиры'], g1);
  useAppStore.getState().addMinusWord('машину', false, null, 'broad_modified');
  useAppStore.getState().setActiveGroup(g1);
}

function createMockCtx() {
  const eventBus = createEventBusMock();
  const store = createStoreAccessMock();
  return {
    eventBus,
    store,
    registerUI: vi.fn(),
    registerCommand: vi.fn(),
    getSetting: vi.fn(),
    setSetting: vi.fn(),
    registerLifecycleHook: vi.fn(),
    registerKeybinding: vi.fn(),
    declareSlot: vi.fn(),
    apiVersion: '1.0' as const,
  } as any;
}

function createEventBusMock(): EventBus {
  return {
    on: vi.fn().mockReturnValue(() => {}),
    onScoped: vi.fn().mockReturnValue(() => {}),
    off: vi.fn(),
    emit: vi.fn(),
    once: vi.fn().mockReturnValue(() => {}),
    clear: vi.fn(),
    offAll: vi.fn(),
  };
}

function createStoreAccessMock(): StoreAccess {
  return {
    getState: vi.fn(),
    getStateSlice: vi.fn(),
    dispatch: (action: string, payload: any) => {
      const store = useAppStore.getState();
      switch (action) {
        case 'moveToTrash': store.moveToTrash(payload); break;
        default: break;
      }
    },
    subscribe: vi.fn().mockReturnValue(() => {}),
    getModuleSetting: vi.fn(),
  };
}

describe('Minus words preview', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.getState().clearAll();
    ctx = createMockCtx();
  });

  it('previewMinusWords() returns correct phrase list WITHOUT deleting them', () => {
    setupStore();
    const result = useAppStore.getState().previewMinusWords();
    expect(result.removed).toBe(2);
    expect(result.phrases).toHaveLength(2);
    expect(result.phrases.map(p => p.text).sort()).toEqual(['купить машину', 'продать машину']);
    expect(useAppStore.getState().phrases).toHaveLength(3);
  });

  it('after previewMinusWords phrases in store did not change', () => {
    setupStore();
    const before = useAppStore.getState().phrases.map(p => ({ id: p.id, text: p.text }));
    useAppStore.getState().previewMinusWords();
    const after = useAppStore.getState().phrases.map(p => ({ id: p.id, text: p.text }));
    expect(after).toEqual(before);
  });

  it('click "Применить" shows inline preview with phrase list', async () => {
    setupStore();
    render(<MinusWordsPanel ctx={ctx} />);
    const applyBtn = screen.getByText('Применить');
    fireEvent.click(applyBtn);
    await waitFor(() => {
      expect(screen.getByText(/Будет перемещено в корзину/)).toBeTruthy();
    });
    expect(screen.getByText('купить машину')).toBeTruthy();
    expect(screen.getByText('продать машину')).toBeTruthy();
  });

  it('inline preview shows correct number of phrases to remove', async () => {
    setupStore();
    render(<MinusWordsPanel ctx={ctx} />);
    fireEvent.click(screen.getByText('Применить'));
    await waitFor(() => {
      expect(screen.getByText(/Будет перемещено в корзину/)).toBeTruthy();
    });
    expect(screen.getByText('купить машину')).toBeTruthy();
    expect(screen.getByText('продать машину')).toBeTruthy();
    expect(screen.queryByText('аренда квартиры')).toBeNull();
  });

  it('click "Отмена" closes preview without changes', async () => {
    setupStore();
    render(<MinusWordsPanel ctx={ctx} />);
    fireEvent.click(screen.getByText('Применить'));
    await waitFor(() => {
      expect(screen.getByText(/Будет перемещено в корзину/)).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Отмена'));
    await waitFor(() => {
      expect(screen.queryByText(/Будет перемещено в корзину/)).toBeNull();
    });
    expect(useAppStore.getState().phrases).toHaveLength(3);
  });

  it('click "Переместить N фраз" confirms and executes', async () => {
    setupStore();
    render(<MinusWordsPanel ctx={ctx} />);
    fireEvent.click(screen.getByText('Применить'));
    await waitFor(() => {
      expect(screen.getByText('Переместить 2 фраз')).toBeTruthy();
    });
    const previewHeader = screen.queryByText(/Будет перемещено в корзину/);
    expect(previewHeader).not.toBeNull();
    fireEvent.click(screen.getByText('Переместить 2 фраз'));
    await waitFor(() => {
      expect(screen.queryByText(/Будет перемещено в корзину/)).toBeNull();
    });
    const remaining = useAppStore.getState().phrases.filter(p => p.groupId !== useAppStore.getState().groups.find(g => g.isTrash)?.id);
    expect(remaining).toHaveLength(1);
  });

  it('when 0 matching phrases "Переместить" button is disabled', async () => {
    setupStore();
    useAppStore.getState().addMinusWord('несуществующееслово', false, null, 'broad_modified');
    useAppStore.getState().removeMinusWord(useAppStore.getState().minusWords[0].id);
    render(<MinusWordsPanel ctx={ctx} />);
    fireEvent.click(screen.getByText('Применить'));
    await waitFor(() => {
      expect(screen.getByText('Нет фраз, подходящих под минус-слова')).toBeTruthy();
    });
    const moveBtn = screen.getByText(/^Переместить 0 фраз$/);
    expect(moveBtn).toBeDisabled();
  });

  it('preview renders inline, no nested Dialog', () => {
    setupStore();
    const { container } = render(<MinusWordsPanel ctx={ctx} />);
    fireEvent.click(screen.getByText('Применить'));
    const allDialogs = container.querySelectorAll('[role="dialog"]');
    expect(allDialogs.length).toBe(0);
  });
});
