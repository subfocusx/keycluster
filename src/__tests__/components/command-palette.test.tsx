// ============================================================
// Command Palette UI Tests
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CommandPalette from '@/components/CommandPalette';
import { createCommandRegistry } from '@/core/command-registry';

describe('create Command Registry', () => {
  let registry: ReturnType<typeof createCommandRegistry>;

  beforeEach(() => {
    registry = createCommandRegistry();
    registry.register({ id: 'clustering:run', label: 'Запустить кластеризацию', category: 'Кластеризация', handler: vi.fn() });
    registry.register({ id: 'groups:add', label: 'Добавить группу', category: 'Группы', handler: vi.fn() });
    registry.register({ id: 'phrases:delete', label: 'Удалить фразы', category: 'Фразы', handler: vi.fn() });
  });

  it('should render when open', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText('Введите команду...')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(<CommandPalette open={false} onClose={vi.fn()} />);
    expect(screen.queryByPlaceholderText('Введите команду...')).not.toBeInTheDocument();
  });

  it('should display all commands when opened', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);
    expect(screen.getByText('Запустить кластеризацию')).toBeInTheDocument();
    expect(screen.getByText('Добавить группу')).toBeInTheDocument();
    expect(screen.getByText('Удалить фразы')).toBeInTheDocument();
  });

  it('should filter commands by query', async () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText('Введите команду...');

    await userEvent.type(input, 'кластер');

    // Text is split by <mark>, use partial match
    expect(screen.getByText('кластер', { selector: 'mark' })).toBeInTheDocument();
    expect(screen.queryByText('Добавить группу')).not.toBeInTheDocument();
  });

  it('should show "no commands" message for non-matching query', async () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText('Введите команду...');

    await userEvent.type(input, 'xyz123');

    expect(screen.getByText('Команды не найдены')).toBeInTheDocument();
  });

  it('should highlight matching text with <mark>', async () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText('Введите команду...');

    await userEvent.type(input, 'кластер');

    const mark = screen.getByText('кластер', { selector: 'mark' });
    expect(mark).toBeInTheDocument();
  });

  it('should show category badges', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);
    // Category badges appear next to commands
    expect(screen.getByText('Кластеризация')).toBeInTheDocument();
    expect(screen.getByText('Группы')).toBeInTheDocument();
  });

  it('should execute command on click and call onClose', async () => {
    const handler = vi.fn();
    const onClose = vi.fn();
    registry.register({ id: 'test:click', label: 'Click Me', category: 'Test', handler });

    render(<CommandPalette open={true} onClose={onClose} />);
    await userEvent.click(screen.getByText('Click Me'));

    expect(handler).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should close on Escape key', () => {
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} />);

    const input = screen.getByPlaceholderText('Введите команду...');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should close on backdrop click', () => {
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} />);

    const backdrop = document.querySelector('.bg-black\\/40');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('should navigate with arrow keys without crashing', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText('Введите команду...');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });

    expect(input).toBeInTheDocument();
  });

  it('should execute selected command on Enter', async () => {
    const handler = vi.fn();
    const onClose = vi.fn();
    registry.register({ id: 'test:enter', label: 'Enter Test', category: 'Test', handler });

    render(<CommandPalette open={true} onClose={onClose} />);

    const input = screen.getByPlaceholderText('Введите команду...');
    await userEvent.type(input, 'Enter Test');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(handler).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should show keybinding if present', () => {
    registry.register({
      id: 'test:kb',
      label: 'Keybinding Test',
      category: 'Test',
      keybinding: 'Ctrl+F',
      handler: vi.fn(),
    });

    render(<CommandPalette open={true} onClose={vi.fn()} />);
    expect(screen.getByText('Ctrl+F')).toBeInTheDocument();
  });

  it('should display footer hints', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} />);
    expect(screen.getByText('навигация')).toBeInTheDocument();
    expect(screen.getByText('выполнить')).toBeInTheDocument();
    expect(screen.getByText('закрыть')).toBeInTheDocument();
  });
});
