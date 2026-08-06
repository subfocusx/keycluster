import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ProjectButtons } from '@user-plugins/import-export/project-buttons';
import { useAppStore } from 'plugin-sdk';
import type { PluginContext } from 'plugin-sdk';

vi.mock('@/components/KCDialog', () => ({
  kcAlert: vi.fn(),
}));

function createMockCtx(): PluginContext {
  return {
    eventBus: { on: vi.fn(() => vi.fn()), emit: vi.fn() },
  } as unknown as PluginContext;
}

describe('ProjectButtons', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.setState({
      groups: [],
      phrases: [],
      minusWords: [],
    });
    ctx = createMockCtx();
  });

  it('should render save and load buttons', () => {
    render(<ProjectButtons ctx={ctx} />);
    expect(screen.getByText('Сохранить проект')).toBeInTheDocument();
    expect(screen.getByText('Открыть проект')).toBeInTheDocument();
  });

  it('should call URL.createObjectURL on save click', async () => {
    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    render(<ProjectButtons ctx={ctx} />);
    await userEvent.click(screen.getByText('Сохранить проект'));

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect((createObjectURL.mock.calls as unknown[][])[0]?.[0]).toBeInstanceOf(Blob);
  });

  it('should read JSON file on load click', async () => {
    const fileContent = JSON.stringify({
      groups: [{ id: 'g1', name: 'Imported', parentId: null, isExpanded: false, isTrash: false, createdAt: Date.now() }],
      phrases: [],
      minusWords: [],
      version: 1,
    });
    const file = new File([fileContent], 'project.json', { type: 'application/json' });

    const originalCreateElement = document.createElement.bind(document);
    const createElement = vi.spyOn(document, 'createElement');
    createElement.mockImplementation((tag: string) => {
      if (tag === 'input') {
        const el = originalCreateElement('input');
        setTimeout(() => {
          Object.defineProperty(el, 'files', { value: [file] });
          el.dispatchEvent(new Event('change'));
        }, 0);
        return el;
      }
      return originalCreateElement(tag);
    });

    const loadProject = vi.fn();
    useAppStore.setState({ loadProject });

    render(<ProjectButtons ctx={ctx} />);
    await userEvent.click(screen.getByText('Открыть проект'));

    await vi.waitFor(() => {
      expect(loadProject).toHaveBeenCalled();
    });

    createElement.mockRestore();
  });
});
