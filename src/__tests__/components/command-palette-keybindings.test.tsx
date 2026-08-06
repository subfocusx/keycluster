import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CommandPalette from '@/components/CommandPalette';
import { createCommandRegistry } from '@/core/command-registry';

describe('create Command Registry', () => {
  let registry: ReturnType<typeof createCommandRegistry>;

  beforeEach(() => {
    registry = createCommandRegistry();
  });

  it('shows <kbd> for commands with keybinding', () => {
    registry.register({ id: 'test:kb', label: 'Has Keybinding', category: 'Test', keybinding: 'Ctrl+X', handler: vi.fn() });
    registry.register({ id: 'test:nokb', label: 'No Keybinding', category: 'Test', handler: vi.fn() });

    render(<CommandPalette open={true} onClose={vi.fn()} />);

    expect(screen.getByText('Ctrl+X')).toBeInTheDocument();
    expect(screen.getByText('Has Keybinding')).toBeInTheDocument();
  });

  it('does not show <kbd> for commands without keybinding', () => {
    registry.register({ id: 'test:nokb', label: 'No Keybinding', category: 'Test', handler: vi.fn() });

    render(<CommandPalette open={true} onClose={vi.fn()} />);

    expect(screen.getByText('No Keybinding')).toBeInTheDocument();
    // Built-in kbd elements: search bar "Esc" + footer hints (↑↓, ↵, Esc) = 4
    const kbds = document.querySelectorAll('kbd');
    expect(kbds.length).toBe(4);
    expect(screen.queryByText('Ctrl+X')).not.toBeInTheDocument();
  });

  it('stores keybinding in command entry', () => {
    registry.register({ id: 'test:kb', label: 'Test', category: 'T', keybinding: 'Ctrl+Z', handler: vi.fn() });

    expect(registry.get('test:kb')?.keybinding).toBe('Ctrl+Z');
  });

  it('core.undo has keybinding Ctrl+Z', () => {
    registry.register({
      id: 'core.undo',
      label: 'Отменить последнее действие',
      category: 'Правка',
      keybinding: 'Ctrl+Z',
      handler: () => {},
    });

    const entry = registry.get('core.undo');
    expect(entry?.keybinding).toBe('Ctrl+Z');
    expect(entry?.label).toBe('Отменить последнее действие');
  });
});
