import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '@/plugin-sdk';
import { TabRouter } from '@/shell/TabRouter';

vi.mock('@user-plugins/import-export/components', () => ({
  ImportExportRibbonButtons: () => <span data-testid="import-export-buttons">Import/Export</span>,
}));

vi.mock('@/modules/phrases/components', () => ({
  PhrasesRibbonButtons: () => <span data-testid="phrases-buttons">Phrases</span>,
}));

vi.mock('@/core/module-runtime', () => ({
  getRuntime: () => null,
}));

vi.mock('@/components/KCDialog', () => ({
  useKCDialog: () => ({
    confirm: vi.fn(() => Promise.resolve(false)),
    alert: vi.fn(() => Promise.resolve()),
  }),
}));

function createMockCtx() {
  return {
    eventBus: { on: vi.fn(), emit: vi.fn() },
    store: {
      dispatch: vi.fn(),
      getState: () => useAppStore.getState(),
      getStateSlice: (k: string) => (useAppStore.getState() as any)[k],
      subscribe: () => () => {},
    },
    registerUI: vi.fn(),
    registerCommand: vi.fn(),
  };
}

const defaultProps = {
  ctx: createMockCtx(),
  activeTool: null,
  onToolOpen: vi.fn(),
  onSettingsOpen: vi.fn(),
  onProjectOpen: vi.fn(),
  onThemeChange: vi.fn(),
  onRefresh: vi.fn(),
};

describe('Undo/Redo ribbon buttons', () => {
  beforeEach(() => {
    useAppStore.getState().clearAll();
    vi.clearAllMocks();
  });

  it('should disable undo button when undoStack is empty', () => {
    render(<TabRouter {...defaultProps} />);
    const undoBtn = screen.getByTitle(/Отменить/);
    expect(undoBtn).toBeDisabled();
  });

  it('should enable undo button and show count after addGroup', () => {
    useAppStore.getState().addGroup('Test');
    render(<TabRouter {...defaultProps} />);
    const undoBtn = screen.getByTitle(/Отменить/);
    expect(undoBtn).not.toBeDisabled();
    expect(screen.getByText(/Отменить\s*\(1\)/)).toBeInTheDocument();
  });

  it('should call store.undo() when undo button clicked', async () => {
    const store = useAppStore.getState();
    const undoSpy = vi.spyOn(store, 'undo');
    store.addGroup('Test');
    render(<TabRouter {...defaultProps} />);
    await userEvent.click(screen.getByTitle(/Отменить/));
    expect(undoSpy).toHaveBeenCalled();
  });

  it('should show redo count after undo', async () => {
    const store = useAppStore.getState();
    store.addGroup('Test');
    render(<TabRouter {...defaultProps} />);
    await userEvent.click(screen.getByTitle(/Отменить/));
    const redoBtn = screen.getByTitle(/Повторить/);
    expect(redoBtn).not.toBeDisabled();
    expect(screen.getByText(/Повторить\s*\(1\)/)).toBeInTheDocument();
  });

  it('should limit undoStack to 50 items after 60 addGroup calls', () => {
    const store = useAppStore.getState();
    for (let i = 0; i < 60; i++) {
      store.addGroup(`G${i}`);
    }
    expect(useAppStore.getState().undoStack.length).toBeLessThanOrEqual(50);
  });

  it('should have empty undoStack after clearAll', () => {
    const store = useAppStore.getState();
    store.addGroup('Test');
    store.clearAll();
    expect(useAppStore.getState().undoStack).toEqual([]);
    expect(useAppStore.getState().redoStack).toEqual([]);
  });
});
