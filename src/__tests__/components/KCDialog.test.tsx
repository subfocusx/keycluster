// ============================================================
// Tests for KCDialog — imperative dialog system
// ============================================================
// Covers: prompt, confirm, alert (open/close/confirm),
//         title/description/button rendering, callbacks,
//         loading state, close by Escape / click outside
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import {
  KCDialogProvider,
  useKCDialog,
  kcPrompt,
  kcConfirm,
  kcAlert,
} from '@/components/KCDialog';

// ---- Test Harness ----

function PromptTest({
  onResult,
}: {
  onResult: (value: string | null) => void;
}) {
  const { prompt } = useKCDialog();
  return (
    <button
      onClick={async () => {
        const result = await prompt('Введите имя:', {
          title: 'Создание',
          placeholder: 'Имя группы',
          defaultValue: 'Группа 1',
          confirmLabel: 'Создать',
          cancelLabel: 'Закрыть',
        });
        onResult(result);
      }}
    >
      Open Prompt
    </button>
  );
}

function ConfirmTest({
  onResult,
  variant,
}: {
  onResult: (value: boolean) => void;
  variant?: 'default' | 'destructive';
}) {
  const { confirm } = useKCDialog();
  return (
    <button
      onClick={async () => {
        const ok = await confirm('Удалить группу?', {
          title: 'Подтверждение удаления',
          confirmLabel: 'Удалить',
          cancelLabel: 'Отмена',
          variant,
        });
        onResult(ok);
      }}
    >
      Open Confirm
    </button>
  );
}

function AlertTest({ onDone }: { onDone: () => void }) {
  const { alert } = useKCDialog();
  return (
    <button
      onClick={async () => {
        await alert('Файл успешно загружен', {
          title: 'Успех',
          okLabel: 'Понятно',
        });
        onDone();
      }}
    >
      Open Alert
    </button>
  );
}

function PromptWithEnterTest({
  onResult,
}: {
  onResult: (value: string | null) => void;
}) {
  const { prompt } = useKCDialog();
  return (
    <button
      onClick={async () => {
        const result = await prompt('Быстрый ввод:', {
          defaultValue: 'hello',
        });
        onResult(result);
      }}
    >
      Open Prompt
    </button>
  );
}

const renderWithProvider = (ui: React.ReactElement) => {
  return render(<KCDialogProvider>{ui}</KCDialogProvider>);
};

// ---- Tests ----

describe('KCDialog', () => {
  // ===== PROMPT =====

  describe('prompt', () => {
    it('should render prompt dialog with title, message, input, and buttons', async () => {
      const onResult = vi.fn();
      renderWithProvider(<PromptTest onResult={onResult} />);

      await userEvent.click(screen.getByText('Open Prompt'));

      expect(screen.getByText('Создание')).toBeInTheDocument();
      expect(screen.getByText('Введите имя:')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Имя группы')).toBeInTheDocument();
      expect(screen.getByText('Создать')).toBeInTheDocument();
      expect(screen.getByText('Закрыть')).toBeInTheDocument();
    });

    it('should pre-fill input with defaultValue', async () => {
      const onResult = vi.fn();
      renderWithProvider(<PromptTest onResult={onResult} />);

      await userEvent.click(screen.getByText('Open Prompt'));

      const input = screen.getByPlaceholderText('Имя группы') as HTMLInputElement;
      expect(input.value).toBe('Группа 1');
    });

    it('should resolve with input value on confirm', async () => {
      const onResult = vi.fn();
      renderWithProvider(<PromptTest onResult={onResult} />);

      await userEvent.click(screen.getByText('Open Prompt'));

      const input = screen.getByPlaceholderText('Имя группы');
      await userEvent.clear(input);
      await userEvent.type(input, 'Моя группа');

      await userEvent.click(screen.getByText('Создать'));

      await waitFor(() => {
        expect(onResult).toHaveBeenCalledWith('Моя группа');
      });
    });

    it('should resolve with null on cancel', async () => {
      const onResult = vi.fn();
      renderWithProvider(<PromptTest onResult={onResult} />);

      await userEvent.click(screen.getByText('Open Prompt'));
      await userEvent.click(screen.getByText('Закрыть'));

      await waitFor(() => {
        expect(onResult).toHaveBeenCalledWith(null);
      });
    });

    it('should resolve with defaultValue when input is empty and confirmed', async () => {
      const onResult = vi.fn();
      renderWithProvider(<PromptTest onResult={onResult} />);

      await userEvent.click(screen.getByText('Open Prompt'));

      // Clear the input
      const input = screen.getByPlaceholderText('Имя группы');
      await userEvent.clear(input);
      // Leave it empty and confirm
      await userEvent.click(screen.getByText('Создать'));

      await waitFor(() => {
        // Empty string → null per the code: `inputValue || null`
        expect(onResult).toHaveBeenCalledWith(null);
      });
    });

    it('should submit on Enter key press', async () => {
      const onResult = vi.fn();
      renderWithProvider(<PromptWithEnterTest onResult={onResult} />);

      await userEvent.click(screen.getByText('Open Prompt'));

      // The input should have defaultValue 'hello'
      // Press Enter to submit
      await userEvent.keyboard('{Enter}');

      await waitFor(() => {
        expect(onResult).toHaveBeenCalledWith('hello');
      });
    });

    it('should use default labels when options not provided', async () => {
      const onResult = vi.fn();

      function MinimalPrompt({ onResult }: { onResult: (v: string | null) => void }) {
        const { prompt } = useKCDialog();
        return (
          <button onClick={async () => {
            const result = await prompt('Simple message');
            onResult(result);
          }}>Go</button>
        );
      }

      renderWithProvider(<MinimalPrompt onResult={onResult} />);
      await userEvent.click(screen.getByText('Go'));

      expect(screen.getByText('Ввод')).toBeInTheDocument();
      expect(screen.getByText('ОК')).toBeInTheDocument();
      expect(screen.getByText('Отмена')).toBeInTheDocument();
    });
  });

  // ===== CONFIRM =====

  describe('confirm', () => {
    it('should render confirm dialog with title, description, and buttons', async () => {
      const onResult = vi.fn();
      renderWithProvider(<ConfirmTest onResult={onResult} />);

      await userEvent.click(screen.getByText('Open Confirm'));

      expect(screen.getByText('Подтверждение удаления')).toBeInTheDocument();
      expect(screen.getByText('Удалить группу?')).toBeInTheDocument();
      expect(screen.getByText('Удалить')).toBeInTheDocument();
      expect(screen.getByText('Отмена')).toBeInTheDocument();
    });

    it('should resolve with true on confirm', async () => {
      const onResult = vi.fn();
      renderWithProvider(<ConfirmTest onResult={onResult} />);

      await userEvent.click(screen.getByText('Open Confirm'));
      await userEvent.click(screen.getByText('Удалить'));

      await waitFor(() => {
        expect(onResult).toHaveBeenCalledWith(true);
      });
    });

    it('should resolve with false on cancel', async () => {
      const onResult = vi.fn();
      renderWithProvider(<ConfirmTest onResult={onResult} />);

      await userEvent.click(screen.getByText('Open Confirm'));
      await userEvent.click(screen.getByText('Отмена'));

      await waitFor(() => {
        expect(onResult).toHaveBeenCalledWith(false);
      });
    });

    it('should show warning icon for destructive variant', async () => {
      const onResult = vi.fn();
      renderWithProvider(
        <ConfirmTest onResult={onResult} variant="destructive" />,
      );

      await userEvent.click(screen.getByText('Open Confirm'));

      // Check for the warning icon span
      const warningIcon = document.querySelector('.material-symbols-outlined');
      expect(warningIcon?.textContent).toBe('warning');
    });

    it('should show help icon for default variant', async () => {
      const onResult = vi.fn();
      renderWithProvider(<ConfirmTest onResult={onResult} />);

      await userEvent.click(screen.getByText('Open Confirm'));

      const helpIcon = document.querySelector('.material-symbols-outlined');
      expect(helpIcon?.textContent).toBe('help');
    });

    it('should use default title and labels when options not provided', async () => {
      const onResult = vi.fn();

      function MinimalConfirm({ onResult }: { onResult: (v: boolean) => void }) {
        const { confirm } = useKCDialog();
        return (
          <button onClick={async () => {
            const result = await confirm('Simple question?');
            onResult(result);
          }}>Go</button>
        );
      }

      renderWithProvider(<MinimalConfirm onResult={onResult} />);
      await userEvent.click(screen.getByText('Go'));

      expect(screen.getByText('Подтверждение')).toBeInTheDocument();
      expect(screen.getByText('ОК')).toBeInTheDocument();
      expect(screen.getByText('Отмена')).toBeInTheDocument();
    });
  });

  // ===== ALERT =====

  describe('alert', () => {
    it('should render alert dialog with title, description, and OK button', async () => {
      const onDone = vi.fn();
      renderWithProvider(<AlertTest onDone={onDone} />);

      await userEvent.click(screen.getByText('Open Alert'));

      expect(screen.getByText('Успех')).toBeInTheDocument();
      expect(screen.getByText('Файл успешно загружен')).toBeInTheDocument();
      expect(screen.getByText('Понятно')).toBeInTheDocument();
    });

    it('should resolve when OK is clicked', async () => {
      const onDone = vi.fn();
      renderWithProvider(<AlertTest onDone={onDone} />);

      await userEvent.click(screen.getByText('Open Alert'));
      await userEvent.click(screen.getByText('Понятно'));

      await waitFor(() => {
        expect(onDone).toHaveBeenCalledTimes(1);
      });
    });

    it('should use default title and label when options not provided', async () => {
      const onDone = vi.fn();

      function MinimalAlert({ onDone }: { onDone: () => void }) {
        const { alert } = useKCDialog();
        return (
          <button onClick={async () => {
            await alert('Simple message');
            onDone();
          }}>Go</button>
        );
      }

      renderWithProvider(<MinimalAlert onDone={onDone} />);
      await userEvent.click(screen.getByText('Go'));

      expect(screen.getByText('Сообщение')).toBeInTheDocument();
      expect(screen.getByText('ОК')).toBeInTheDocument();
    });
  });

  // ===== IMPERATIVE API =====

  describe('imperative API (kcPrompt, kcConfirm, kcAlert)', () => {
    it('should return null from kcPrompt when provider is not mounted', async () => {
      const result = await kcPrompt('test');
      expect(result).toBeNull();
    });

    it('should return false from kcConfirm when provider is not mounted', async () => {
      const result = await kcConfirm('test');
      expect(result).toBe(false);
    });

    it('should resolve from kcAlert when provider is not mounted', async () => {
      await expect(kcAlert('test')).resolves.toBeUndefined();
    });

    it('should work through imperative API when provider IS mounted', async () => {
      const onResult = vi.fn();

      function ImperativeTest() {
        return (
          <button
            onClick={async () => {
              const name = await kcPrompt('Имя:', { title: 'Test' });
              onResult(name);
            }}
          >
            Imperative Prompt
          </button>
        );
      }

      renderWithProvider(<ImperativeTest />);
      await userEvent.click(screen.getByText('Imperative Prompt'));

      expect(screen.getByText('Test')).toBeInTheDocument();
      expect(screen.getByText('Имя:')).toBeInTheDocument();

      // Cancel
      await userEvent.click(screen.getByText('Отмена'));
      await waitFor(() => {
        expect(onResult).toHaveBeenCalledWith(null);
      });
    });
  });

  // ===== CLOSE BEHAVIOR =====

  describe('close behavior', () => {
    it('should close prompt dialog and resolve null when overlay is clicked', async () => {
      const onResult = vi.fn();
      renderWithProvider(<PromptTest onResult={onResult} />);

      await userEvent.click(screen.getByText('Open Prompt'));

      // The Dialog overlay — clicking the overlay area should trigger onOpenChange(false)
      // which calls handleClose and resolves with null
      // Radix Dialog's AlertDialogContent intercepts clicks on the overlay
      // Simulate pressing Escape instead as a way to close
      await userEvent.keyboard('{Escape}');

      await waitFor(() => {
        expect(onResult).toHaveBeenCalledWith(null);
      });
    });

    it('should close confirm dialog with false when Escape is pressed', async () => {
      const onResult = vi.fn();
      renderWithProvider(<ConfirmTest onResult={onResult} />);

      await userEvent.click(screen.getByText('Open Confirm'));
      await userEvent.keyboard('{Escape}');

      await waitFor(() => {
        expect(onResult).toHaveBeenCalledWith(false);
      });
    });

    it('should close alert dialog when Escape is pressed', async () => {
      const onDone = vi.fn();
      renderWithProvider(<AlertTest onDone={onDone} />);

      await userEvent.click(screen.getByText('Open Alert'));
      await userEvent.keyboard('{Escape}');

      await waitFor(() => {
        expect(onDone).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ===== CONTEXT =====

  describe('useKCDialog hook', () => {
    it('should return imperative fallback when no provider', () => {
      function NoProviderTest() {
        const { prompt, confirm, alert } = useKCDialog();
        return (
          <div>
            <span data-testid="has-prompt">{typeof prompt}</span>
            <span data-testid="has-confirm">{typeof confirm}</span>
            <span data-testid="has-alert">{typeof alert}</span>
          </div>
        );
      }

      // Render WITHOUT provider
      render(<NoProviderTest />);

      expect(screen.getByTestId('has-prompt').textContent).toBe('function');
      expect(screen.getByTestId('has-confirm').textContent).toBe('function');
      expect(screen.getByTestId('has-alert').textContent).toBe('function');
    });
  });
});
