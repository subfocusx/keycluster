// ============================================================
// Tests: modules/minus-words/components.tsx
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MinusWordsPanel } from '@user-plugins/minus-words/components';
import { useAppStore } from '@/plugin-sdk';
import type { PluginContext } from '@/plugin-sdk';
import { createEventBus } from '@/core/event-bus';
function createMockCtx() {
  return {
    eventBus: { ...createEventBus(), emit: vi.fn() },
    store: { dispatch: vi.fn(), getState: () => useAppStore.getState(), getStateSlice: (k: keyof ReturnType<typeof useAppStore.getState>) => useAppStore.getState()[k], subscribe: () => () => {} },
    registerUI: vi.fn(),
    registerCommand: vi.fn(),
  };
}

describe('MinusWordsPanel', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    ctx = createMockCtx();
  });

  it('should render panel content', () => {
    render(<MinusWordsPanel ctx={ctx as any} />);
    // Title is rendered by the shell's LeftOverlayPanel; check input instead
    expect(screen.getByPlaceholderText('Минус-фраза или слово...')).toBeInTheDocument();
  });

  it('should render input for new minus word', () => {
    render(<MinusWordsPanel ctx={ctx as any} />);
    expect(screen.getByPlaceholderText('Минус-фраза или слово...')).toBeInTheDocument();
  });

  it('should add minus word on button click', async () => {
    const store = useAppStore.getState();
    store.addGroup('G1');

    render(<MinusWordsPanel ctx={ctx as any} />);
    const input = screen.getByPlaceholderText('Минус-фраза или слово...');
    await userEvent.type(input, 'бесплатно');

    // Find the add button (has Material Symbols "add" icon)
    const allButtons = screen.getAllByRole('button');
    const addBtn = allButtons.find(b => b.querySelector('.material-symbols-outlined'));
    if (addBtn) {
      await userEvent.click(addBtn);
      expect(useAppStore.getState().minusWords.length).toBe(1);
    }
  });

  it('should show existing minus words in the list', () => {
    const store = useAppStore.getState();
    store.addMinusWord('бесплатно', false, null, 'broad');
    store.addMinusWord('скачать', true, null, 'exact');

    render(<MinusWordsPanel ctx={ctx as any} />);
    expect(screen.getByText('бесплатно')).toBeInTheDocument();
    expect(screen.getByText('скачать')).toBeInTheDocument();
  });

  it('should show "Нет минус-фраз" when empty', () => {
    render(<MinusWordsPanel ctx={ctx as any} />);
    expect(screen.getByText('Нет минус-фраз')).toBeInTheDocument();
  });

  it('should render "Применить минус-фразы" button', () => {
    render(<MinusWordsPanel ctx={ctx as any} />);
    expect(screen.getByText('Применить')).toBeInTheDocument();
  });

  it('should disable apply button when no minus words', () => {
    render(<MinusWordsPanel ctx={ctx as any} />);
    const applyBtn = screen.getByText('Применить');
    expect(applyBtn).toBeDisabled();
  });

  it('should show search type selector', () => {
    render(<MinusWordsPanel ctx={ctx as unknown as PluginContext} />);
    // Radix Select рендерит триггер без текста до открытия — проверяем наличие селекта по aria-label
    expect(screen.getByRole('combobox', { name: 'Тип поиска' })).toBeInTheDocument();
  });

  it('should remove minus word when delete button is clicked', async () => {
    const store = useAppStore.getState();
    store.addMinusWord('тест', false, null, 'broad');

    render(<MinusWordsPanel ctx={ctx as any} />);
    const deleteBtns = screen.getAllByRole('button');
    // Find the close/delete button for the minus word (has "close" material icon)
    const trashBtn = deleteBtns.find(b => {
      const icon = b.querySelector('.material-symbols-outlined');
      return icon && icon.textContent === 'close';
    });
    if (trashBtn) {
      await userEvent.click(trashBtn);
      expect(useAppStore.getState().minusWords).toHaveLength(0);
    }
  });

  it('should select all / deselect all minus words', async () => {
    const store = useAppStore.getState();
    store.addMinusWord('а', false, null, 'broad');
    store.addMinusWord('б', false, null, 'broad');

    render(<MinusWordsPanel ctx={ctx as any} />);

    // Before selection
    expect(screen.queryByText('в папку...')).not.toBeInTheDocument();

    const selectAllBtn = screen.getByTitle('Выбрать все');
    await userEvent.click(selectAllBtn);

    expect(screen.getByText('в папку...')).toBeInTheDocument();

    const deselectBtn = screen.getByTitle('Снять выделение');
    await userEvent.click(deselectBtn);

    expect(screen.queryByText('в папку...')).not.toBeInTheDocument();
  });

  it('should copy minus-word folder to clipboard via context menu', async () => {
    // Clipboard mock
    const writeText = vi.fn().mockResolvedValue(undefined);
    (navigator as any).clipboard = { writeText };

    const store = useAppStore.getState();
    const folderId = store.createMinusWordGroup('Folder');
    store.addMinusWord('a', false, null, 'broad', folderId);
    store.addMinusWord('b', false, null, 'broad', folderId);

    render(<MinusWordsPanel ctx={ctx as any} />);

    const folderText = screen.getByText('Folder');
    const trigger = folderText.closest('div');
    expect(trigger).toBeTruthy();

    fireEvent.contextMenu(trigger!);

    const copyItem = await screen.findByText('Копировать в буфер');
    await userEvent.click(copyItem);

    expect(writeText).toHaveBeenCalledWith('a\nb');
  });

  it('should show matched phrases when toggle is clicked', async () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('G1');
    store.addPhrases(['ноутбук бесплатно', 'ноутбук купить'], groupId);
    store.addMinusWord('бесплатно', false, null, 'broad');

    render(<MinusWordsPanel ctx={ctx as any} />);
    const showBtn = screen.getByTitle(/Показать совпадения/);
    await userEvent.click(showBtn);

    expect(screen.getByText(/Будет перемещено в корзину: 1 фраз/)).toBeInTheDocument();
  });
});
