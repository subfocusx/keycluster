// ============================================================
// Tests: TrashModal, SettingsModal, ProjectManagerDialog
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrashModal } from '@/components/modals/TrashModal';
import SettingsModal from '@/components/SettingsModal';
import { ProjectManagerDialog } from '@/components/ProjectManagerDialog';
import { useAppStore } from '@/plugin-sdk';
import { createEventBus } from '@/core/event-bus';

// ---- Helpers ----

function createMockCtx() {
  return {
    eventBus: { ...createEventBus(), emit: vi.fn() },
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

function setupTrashData() {
  useAppStore.getState().clearAll();
  const store = useAppStore.getState();

  // Create a normal group
  const normalGroupId = store.addGroup('Group A');

  // Add phrases to normal group
  store.addPhrases(['купить ноутбук', 'аренда квартиры'], normalGroupId);

  // Move one phrase to trash
  const phrases = useAppStore.getState().phrases;
  store.moveToTrash([phrases[0].id]);

  return { normalGroupId, phrases: useAppStore.getState().phrases };
}

// ---- Mock project-service (used by ProjectManagerDialog) ----

const mockedProjectService = vi.hoisted(() => ({
  saveProjectAs: vi.fn(),
  saveCurrentProject: vi.fn(),
  loadProject: vi.fn(),
  listProjects: vi.fn(),
  deleteProject: vi.fn(),
  exportProject: vi.fn(),
  exportProjectWithDialog: vi.fn(),
  importProject: vi.fn(),
  getCurrentProjectId: vi.fn(() => null),
  getSaveStatus: vi.fn(() => 'idle' as const),
  getLastSaveTime: vi.fn(() => 0),
  getLastSaveError: vi.fn(() => null),
  getHasUnsavedChanges: vi.fn(() => false),
  enableAutoSave: vi.fn(),
  disableAutoSave: vi.fn(),
  isAutoSaveEnabled: vi.fn(() => false),
  getAutoSaveIntervalMinutes: vi.fn(() => 3),
  setAutoSaveIntervalMinutes: vi.fn(),
}));

vi.mock('@/core/project-service', () => mockedProjectService);

import {
  saveProjectAs,
  saveCurrentProject,
  loadProject,
  listProjects,
  deleteProject,
  exportProject,
  importProject,
  getCurrentProjectId,
} from '@/plugin-sdk';

vi.mock('@/core/module-runtime', () => ({
  getRuntime: vi.fn(() => null),
}));

// ---- Mock PluginManager section (heavy component) ----

vi.mock('@/components/PluginManager', () => ({
  PluginManagerSection: () => <div data-testid="plugin-manager">Plugin Manager Mock</div>,
}));

// ============================================================
// TrashModal
// ============================================================

describe('TrashModal', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    ctx = createMockCtx();
  });

  it('renders trashed phrases list', () => {
    const { phrases } = setupTrashData();
    const trashedPhrase = phrases.find(p => {
      const trashGroup = useAppStore.getState().groups.find(g => g.isTrash);
      return trashGroup && p.groupId === trashGroup.id;
    });
    expect(trashedPhrase).toBeDefined();

    render(<TrashModal open={true} onOpenChange={() => {}} ctx={ctx as any} />);

    expect(screen.getByText(trashedPhrase!.text)).toBeInTheDocument();
  });

  it('shows empty state when no trashed phrases', () => {
    useAppStore.getState().clearAll();

    render(<TrashModal open={true} onOpenChange={() => {}} ctx={ctx as any} />);

    expect(screen.getByText('Корзина пуста')).toBeInTheDocument();
  });

  it('shows phrase count in title when there are trashed phrases', () => {
    setupTrashData();

    render(<TrashModal open={true} onOpenChange={() => {}} ctx={ctx as any} />);

    expect(screen.getByText('(1 фраз)')).toBeInTheDocument();
  });

  it('select all / deselect all buttons work', async () => {
    setupTrashData();

    render(<TrashModal open={true} onOpenChange={() => {}} ctx={ctx as any} />);

    // "Выбрать все" button
    const selectAllBtn = screen.getByText('Выбрать все');
    await userEvent.click(selectAllBtn);

    // "Восстановить" should show count
    expect(screen.getByText(/Восстановить \(1\)/)).toBeInTheDocument();

    // "Снять выбор" button
    const deselectBtn = screen.getByText('Снять выбор');
    await userEvent.click(deselectBtn);

    // "Восстановить" should show no count
    expect(screen.getByText('Восстановить ()')).toBeInTheDocument();
  });

  it('restore button calls restoreFromTrash and emits event', async () => {
    const { phrases } = setupTrashData();
    const trashedPhrase = phrases.find(p => {
      const trashGroup = useAppStore.getState().groups.find(g => g.isTrash);
      return trashGroup && p.groupId === trashGroup.id;
    });

    render(<TrashModal open={true} onOpenChange={() => {}} ctx={ctx as any} />);

    // Click on the phrase to select it
    await userEvent.click(screen.getByText(trashedPhrase!.text));

    // Click restore
    const restoreBtn = screen.getByText(/Восстановить \(1\)/);
    await userEvent.click(restoreBtn);

    // restoreFromTrash should have been called
    const state = useAppStore.getState();
    // The phrase should no longer be in the trash group
    const trashGroup = state.groups.find(g => g.isTrash);
    if (trashGroup) {
      const stillTrashed = state.phrases.find(p => p.id === trashedPhrase!.id && p.groupId === trashGroup.id);
      expect(stillTrashed).toBeUndefined();
    }

    // eventBus.emit should have been called
    expect(ctx.eventBus.emit).toHaveBeenCalledWith('phrases:changed');
  });

  it('restore all button works', async () => {
    setupTrashData();

    render(<TrashModal open={true} onOpenChange={() => {}} ctx={ctx as any} />);

    const restoreAllBtn = screen.getByText('Восстановить все');
    await userEvent.click(restoreAllBtn);

    // Trash should be empty now
    const trashGroup = useAppStore.getState().groups.find(g => g.isTrash);
    if (trashGroup) {
      expect(useAppStore.getState().phrases.filter(p => p.groupId === trashGroup.id)).toHaveLength(0);
    }

    expect(ctx.eventBus.emit).toHaveBeenCalledWith('phrases:changed');
  });

  it('delete permanently button is disabled when nothing selected', () => {
    setupTrashData();

    render(<TrashModal open={true} onOpenChange={() => {}} ctx={ctx as any} />);

    const deleteBtn = screen.getByText('Удалить выбранные');
    expect(deleteBtn).toBeDisabled();
  });

  it('clear trash button is present', () => {
    setupTrashData();

    render(<TrashModal open={true} onOpenChange={() => {}} ctx={ctx as any} />);

    // The "Очистить корзину" button should exist
    expect(screen.getByText('Очистить корзину')).toBeInTheDocument();
  });

  it('renders the dialog title with trash icon', () => {
    setupTrashData();

    render(<TrashModal open={true} onOpenChange={() => {}} ctx={ctx as any} />);

    expect(screen.getByText('Корзина')).toBeInTheDocument();
  });
});

// ============================================================
// SettingsModal
// ============================================================

describe('SettingsModal', () => {
  it('renders nothing when open is false', () => {
    const { container } = render(<SettingsModal open={false} onClose={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders all 3 section tabs when open', () => {
    render(<SettingsModal open={true} onClose={() => {}} />);

    expect(screen.getAllByText('Основное').length).toBe(2);
    expect(screen.getByText('Модули и плагины')).toBeInTheDocument();
    expect(screen.getByText('Справка')).toBeInTheDocument();
  });

  it('renders header with settings icon and title', () => {
    render(<SettingsModal open={true} onClose={() => {}} />);

    expect(screen.getByText('Настройки')).toBeInTheDocument();
  });

  it('closes on backdrop click', async () => {
    const onClose = vi.fn();

    // The SettingsModal renders a fixed overlay with a backdrop div
    // The backdrop is the first child div with class bg-black/40
    render(<SettingsModal open={true} onClose={onClose} />);

    // Find the backdrop — it's a fixed div covering the screen
    const container = document.querySelector('.fixed.inset-0');
    expect(container).not.toBeNull();

    // The backdrop is the first child of the container
    const backdrop = container?.children[0] as HTMLElement;
    expect(backdrop).not.toBeNull();
    await userEvent.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on close button click', async () => {
    const onClose = vi.fn();

    render(<SettingsModal open={true} onClose={onClose} />);

    // Find the close button (has a "close" icon)
    const closeButtons = document.querySelectorAll('.tool-btn');
    // Find one that contains the "close" material icon
    let closeButton: HTMLElement | null = null;
    for (const btn of closeButtons) {
      const icon = btn.querySelector('.material-symbols-outlined');
      if (icon && icon.textContent === 'close') {
        closeButton = btn as HTMLElement;
        break;
      }
    }

    expect(closeButton).not.toBeNull();
    if (closeButton) {
      await userEvent.click(closeButton);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });

  it('shows general section by default', () => {
    render(<SettingsModal open={true} onClose={() => {}} />);

    expect(screen.getByText('Тема оформления')).toBeInTheDocument();
  });

  it('switches to plugins section on tab click', async () => {
    render(<SettingsModal open={true} onClose={() => {}} />);

    const pluginsTab = screen.getByText('Модули и плагины');
    await userEvent.click(pluginsTab);

    // Should show the PluginManagerSection mock
    expect(screen.getByTestId('plugin-manager')).toBeInTheDocument();
  });

  it('switches to help section on tab click', async () => {
    render(<SettingsModal open={true} onClose={() => {}} />);

    const helpTab = screen.getByText('Справка');
    await userEvent.click(helpTab);

    // Should show help content
    expect(screen.getByText('Что такое плагины?')).toBeInTheDocument();
    expect(screen.getByText('Встроенные плагины')).toBeInTheDocument();
    expect(screen.getByText('Локальные плагины')).toBeInTheDocument();
    expect(screen.getByText('Как добавить плагин')).toBeInTheDocument();
  });

  it('highlighted section tab changes on click', async () => {
    render(<SettingsModal open={true} onClose={() => {}} />);

    const generalTabs = screen.getAllByText('Основное');
    expect(generalTabs.length).toBeGreaterThanOrEqual(1);

    await userEvent.click(screen.getByText('Справка'));

    expect(screen.getByText('Что такое плагины?')).toBeInTheDocument();
  });
});

// ============================================================
// ProjectManagerDialog
// ============================================================

describe('ProjectManagerDialog', () => {
  beforeEach(() => {
    useAppStore.getState().clearAll();
    vi.clearAllMocks();

    // Default project-service mocks
    mockedProjectService.listProjects.mockResolvedValue({ success: true, projects: [] });
    mockedProjectService.getCurrentProjectId.mockReturnValue(null);
    mockedProjectService.saveProjectAs.mockResolvedValue({ success: true, projectId: 'new-id' });
    mockedProjectService.saveCurrentProject.mockResolvedValue({ success: true, projectId: 'existing-id' });
    mockedProjectService.loadProject.mockResolvedValue({ success: true, project: { id: 'p1', name: 'Test' } as any });
    mockedProjectService.deleteProject.mockResolvedValue({ success: true });
    mockedProjectService.exportProject.mockReturnValue({ success: true, data: {} as any });
    mockedProjectService.importProject.mockResolvedValue({ success: true, projectId: 'import-id' });
  });

  it('renders project list with empty state', async () => {
    render(
      <ProjectManagerDialog open={true} onOpenChange={() => {}} />
    );

    // Wait for listProjects to resolve
    await waitFor(() => {
      expect(screen.getByText('Нет сохранённых проектов')).toBeInTheDocument();
    });
  });

  it('renders project list with projects', async () => {
    mockedProjectService.listProjects.mockResolvedValue({
      success: true,
      projects: [
        {
          id: 'p1',
          name: 'Project Alpha',
          phraseCount: 10,
          groupCount: 3,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'p2',
          name: 'Project Beta',
          phraseCount: 5,
          groupCount: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    });

    render(
      <ProjectManagerDialog open={true} onOpenChange={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    });
    expect(screen.getByText('Project Beta')).toBeInTheDocument();
  });

  it('renders action buttons', async () => {
    render(
      <ProjectManagerDialog open={true} onOpenChange={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Новый проект')).toBeInTheDocument();
    });
    expect(screen.getByText('Сохранить')).toBeInTheDocument();
    expect(screen.getByText('Открыть')).toBeInTheDocument();
    expect(screen.getByText('Удалить')).toBeInTheDocument();
    expect(screen.getByText('Экспорт .kcproj')).toBeInTheDocument();
    expect(screen.getByText('Импорт .kcproj')).toBeInTheDocument();
  });

  it('shows new project input when clicking new project button', async () => {
    render(
      <ProjectManagerDialog open={true} onOpenChange={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Новый проект')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Новый проект'));

    // Should show input field
    expect(screen.getByPlaceholderText('Название проекта...')).toBeInTheDocument();
    // Should show create button
    expect(screen.getByText('Создать')).toBeInTheDocument();
  });

  it('creates new project and shows success message', async () => {
    render(
      <ProjectManagerDialog open={true} onOpenChange={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Новый проект')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Новый проект'));

    const input = screen.getByPlaceholderText('Название проекта...');
    await userEvent.type(input, 'My New Project');
    await userEvent.click(screen.getByText('Создать'));

    await waitFor(() => {
      expect(mockedProjectService.saveProjectAs).toHaveBeenCalledWith('My New Project');
    });

    // Success message should appear
    await waitFor(() => {
      expect(screen.getByText(/My New Project/)).toBeInTheDocument();
    });
  });

  it('save button calls saveCurrentProject', async () => {
    render(
      <ProjectManagerDialog open={true} onOpenChange={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Сохранить')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Сохранить'));

    await waitFor(() => {
      expect(mockedProjectService.saveCurrentProject).toHaveBeenCalledTimes(1);
    });
  });

  it('load button is disabled when no project selected', async () => {
    render(
      <ProjectManagerDialog open={true} onOpenChange={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Открыть')).toBeInTheDocument();
    });

    expect(screen.getByText('Открыть')).toBeDisabled();
  });

  it('load button is enabled when project is selected', async () => {
    mockedProjectService.listProjects.mockResolvedValue({
      success: true,
      projects: [
        {
          id: 'p1',
          name: 'Test Project',
          phraseCount: 5,
          groupCount: 2,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    });

    render(
      <ProjectManagerDialog open={true} onOpenChange={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    // Click on the project to select it
    await userEvent.click(screen.getByText('Test Project'));

    // Load button should now be enabled
    expect(screen.getByText('Открыть')).not.toBeDisabled();
  });

  it('delete button is disabled when no project selected', async () => {
    render(
      <ProjectManagerDialog open={true} onOpenChange={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Удалить')).toBeInTheDocument();
    });

    expect(screen.getByText('Удалить')).toBeDisabled();
  });

  it('status message appears after successful save', async () => {
    render(
      <ProjectManagerDialog open={true} onOpenChange={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Сохранить')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Сохранить'));

    // Wait for the async operation and message to appear
    await waitFor(() => {
      expect(screen.getByText('Проект сохранён')).toBeInTheDocument();
    });
  });

  it('error message appears on failed save', async () => {
    mockedProjectService.saveCurrentProject.mockResolvedValue({
      success: false,
      projectId: '',
      error: 'DB connection lost',
    });

    render(
      <ProjectManagerDialog open={true} onOpenChange={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Сохранить')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Сохранить'));

    await waitFor(() => {
      expect(screen.getByText('DB connection lost')).toBeInTheDocument();
    });
  });

  it('renders dialog title', async () => {
    render(
      <ProjectManagerDialog open={true} onOpenChange={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Управление проектами')).toBeInTheDocument();
    });
  });

  it('renders close button', async () => {
    render(
      <ProjectManagerDialog open={true} onOpenChange={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Закрыть')).toBeInTheDocument();
    });
  });

  it('renders AutoSaveSettings integration', async () => {
    render(
      <ProjectManagerDialog open={true} onOpenChange={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Новый проект')).toBeInTheDocument();
    });

    // AutoSaveSettings is rendered in compact mode
    expect(screen.getByText('Автосохранение')).toBeInTheDocument();
  });

  it('shows current project status in status bar', async () => {
    mockedProjectService.getCurrentProjectId.mockReturnValue('p1' as any);
    mockedProjectService.listProjects.mockResolvedValue({
      success: true,
      projects: [
        {
          id: 'p1',
          name: 'Current Project',
          phraseCount: 42,
          groupCount: 5,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    });

    render(
      <ProjectManagerDialog open={true} onOpenChange={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Current Project')).toBeInTheDocument();
    });
  });

  it('export button calls exportProject', async () => {
    mockedProjectService.exportProjectWithDialog.mockResolvedValue({ success: true } as any);

    render(
      <ProjectManagerDialog open={true} onOpenChange={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText('Экспорт .kcproj')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Экспорт .kcproj'));

    expect(mockedProjectService.exportProjectWithDialog).toHaveBeenCalledTimes(1);
  });
});
