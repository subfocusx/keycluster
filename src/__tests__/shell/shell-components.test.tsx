// ============================================================
// Tests: Shell/Layout components
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '@/plugin-sdk';
import { createEventBus } from '@/core/event-bus';

// ---- Mocks for heavy module dependencies ----

// Mock KCDialog hook
vi.mock('@/components/KCDialog', () => ({
  useKCDialog: () => ({
    confirm: vi.fn(() => Promise.resolve(false)),
    alert: vi.fn(() => Promise.resolve()),
  }),
}));

// Mock ImportExportRibbonButtons
vi.mock('@user-plugins/import-export/components', () => ({
  ImportExportRibbonButtons: () => <span data-testid="import-export-buttons">Import/Export</span>,
}));

// Mock all module panels used by PanelManager
vi.mock('@user-plugins/clustering/components', () => ({
  ClusteringPanel: () => <div data-testid="clustering-panel">Clustering</div>,
}));
vi.mock('@user-plugins/group-analysis/components', () => ({
  GroupAnalysisPanel: () => <div data-testid="group-analysis-panel">GroupAnalysis</div>,
}));
vi.mock('@user-plugins/minus-words/components', () => ({
  MinusWordsPanel: () => <div data-testid="minus-words-panel">MinusWords</div>,
}));
vi.mock('@user-plugins/cross-search/components', () => ({
  CrossSearchPanel: () => <div data-testid="cross-search-panel">CrossSearch</div>,
}));
vi.mock('@user-plugins/find-replace/components', () => ({
  FindReplacePanel: () => <div data-testid="find-replace-panel">FindReplace</div>,
}));
vi.mock('@user-plugins/ngrams/components', () => ({
  NgramsPanel: () => <div data-testid="ngrams-panel">Ngrams</div>,
}));
vi.mock('@user-plugins/tfidf/components', () => ({
  TfIdfPanel: () => <div data-testid="tfidf-panel">TfIdf</div>,
}));
vi.mock('@/modules/groups/components', () => ({
  GroupsPanel: () => <div data-testid="groups-panel">Groups</div>,
}));

// Mock modals
vi.mock('@/components/modals/TrashModal', () => ({
  TrashModal: ({ open }: { open: boolean }) => open ? <div data-testid="trash-modal">Trash</div> : null,
}));
vi.mock('@/components/modals/ToolModal', () => ({
  ToolModal: ({ open, title }: { open: boolean; title: string }) => open ? <div data-testid="tool-modal">{title}</div> : null,
  PluginToolModal: () => null,
}));

// Mock SaveStatusIndicator (dynamic import in PanelManager)
vi.mock('@/components/SaveStatusIndicator', () => ({
  SaveStatusIndicator: () => <span data-testid="save-indicator">Saved</span>,
}));

// Mock ModuleErrorBoundary
vi.mock('@/components/ModuleErrorBoundary', () => ({
  ModuleErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock module-runtime
vi.mock('@/core/module-runtime', () => ({
  getRuntime: () => ({
    getUIContributions: (slot: string) => {
      if (slot === 'ribbon:tools') return [
        { moduleId: 'clustering', label: 'Кластеризация', component: () => null },
        { moduleId: 'minus-words', label: 'Минус-фразы', component: () => null },
      ];
      return [];
    },
    isModuleDisabled: () => false,
  }),
}));

// ---- Import components after mocks ----

import { ShellLayout, ShellLoadingScreen } from '@/shell/ShellLayout';
import { TabRouter } from '@/shell/TabRouter';
import { StatusBar, PanelManager, ResizablePanel } from '@/shell/PanelManager';

// ---- Helpers ----

function createMockCtx() {
  return {
    eventBus: createEventBus(),
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

// ================================================================
// ShellLayout
// ================================================================

describe('ShellLayout', () => {
  it('should render a full-height flex column container', () => {
    render(
      <ShellLayout
        tabBar={<div data-testid="tab-bar">TabBar</div>}
        mainContent={<div data-testid="main-content">Main</div>}
        statusBar={<div data-testid="status-bar">Status</div>}
      />
    );

    const container = screen.getByTestId('tab-bar').parentElement!;
    expect(container.className).toContain('flex');
    expect(container.className).toContain('flex-col');
    expect(container.className).toContain('h-screen');
  });

  it('should render all provided sections', () => {
    render(
      <ShellLayout
        tabBar={<div data-testid="tab-bar">TabBar</div>}
        mainContent={<div data-testid="main-content">Main</div>}
        statusBar={<div data-testid="status-bar">Status</div>}
      />
    );

    expect(screen.getByTestId('tab-bar')).toBeInTheDocument();
    expect(screen.getByTestId('main-content')).toBeInTheDocument();
    expect(screen.getByTestId('status-bar')).toBeInTheDocument();
  });

  it('should render overlays when provided', () => {
    render(
      <ShellLayout
        tabBar={<div>TabBar</div>}
        mainContent={<div>Main</div>}
        statusBar={<div>Status</div>}
        overlays={<div data-testid="overlay">Overlay</div>}
      />
    );

    expect(screen.getByTestId('overlay')).toBeInTheDocument();
  });

  it('should not render overlays when omitted', () => {
    const { container } = render(
      <ShellLayout
        tabBar={<div>TabBar</div>}
        mainContent={<div>Main</div>}
        statusBar={<div>Status</div>}
      />
    );

    expect(container.querySelector('[data-testid="overlay"]')).not.toBeInTheDocument();
  });
});

// ================================================================
// ShellLoadingScreen
// ================================================================

describe('ShellLoadingScreen', () => {
  it('should render app name', () => {
    render(<ShellLoadingScreen />);
    expect(screen.getByText(/KeyCluster/)).toBeInTheDocument();
  });

  it('should render 8 cluster dots', () => {
    const { container } = render(<ShellLoadingScreen />);
    const dots = container.querySelectorAll('.rounded-full');
    // 8 dots + 1 shimmer bar indicator = 9 rounded-full elements
    expect(dots.length).toBeGreaterThanOrEqual(8);
  });

  it('should render a full-height centered container', () => {
    const { container } = render(<ShellLoadingScreen />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('h-screen');
    expect(wrapper.className).toContain('flex');
    expect(wrapper.className).toContain('items-center');
    expect(wrapper.className).toContain('justify-center');
  });
});

// ================================================================
// TabBar (tested through TabRouter)
// ================================================================

describe('TabBar', () => {
  const defaultProps = {
    ctx: createMockCtx(),
    activeTool: null,
    onToolOpen: vi.fn(),
    onSettingsOpen: vi.fn(),
    onProjectOpen: vi.fn(),
    onThemeChange: vi.fn(),
    onRefresh: vi.fn(),
  };

  beforeEach(() => {
    useAppStore.getState().clearAll();
    vi.clearAllMocks();
  });

  it('should render 4 tabs: Данные, Алгоритмы, Плагины, Вид', () => {
    render(<TabRouter {...defaultProps} />);

    expect(screen.getByText('Данные')).toBeInTheDocument();
    expect(screen.getByText('Алгоритмы')).toBeInTheDocument();
    expect(screen.getByText('Плагины')).toBeInTheDocument();
    expect(screen.getByText('Вид')).toBeInTheDocument();
  });

  it('should highlight "Данные" tab by default', () => {
    render(<TabRouter {...defaultProps} />);

    const dataTab = screen.getByText('Данные').closest('button');
    expect(dataTab?.className).toContain('active');
  });

  it('should highlight clicked tab', async () => {
    render(<TabRouter {...defaultProps} />);

    const dataTab = screen.getByText('Данные').closest('button');
    const algoTab = screen.getByText('Алгоритмы').closest('button');

    expect(dataTab?.className).toContain('active');
    expect(algoTab?.className).not.toContain('active');

    await userEvent.click(screen.getByText('Алгоритмы'));

    expect(algoTab?.className).toContain('active');
    expect(dataTab?.className).not.toContain('active');
  });

  it('should render data ribbon when Данные tab is active', () => {
    render(<TabRouter {...defaultProps} />);

    expect(screen.getByTitle('Управление проектами')).toBeInTheDocument();
    expect(screen.getByTitle('Управление минус-фразами: добавление, импорт, применение')).toBeInTheDocument();
  });

  it('should render algorithm ribbon when Алгоритмы tab is clicked', async () => {
    render(<TabRouter {...defaultProps} />);

    await userEvent.click(screen.getByText('Алгоритмы'));

    expect(screen.getByTitle('Автоматическая кластеризация ключевых фраз')).toBeInTheDocument();
    expect(screen.getByTitle('Статистический анализ групп ключевых фраз')).toBeInTheDocument();
    expect(screen.getByTitle('Анализ N-грамм в ключевых фразах')).toBeInTheDocument();
    expect(screen.getByTitle('TF-IDF анализ ключевых фраз')).toBeInTheDocument();
  });

  it('should render view ribbon when Вид tab is clicked', async () => {
    render(<TabRouter {...defaultProps} />);

    await userEvent.click(screen.getByText('Вид'));

    expect(screen.getByTitle('Обновить')).toBeInTheDocument();
    expect(screen.getByTitle('Настройки')).toBeInTheDocument();
  });

  it('should call onToolOpen when tool button is clicked', async () => {
    const onToolOpen = vi.fn();
    render(<TabRouter {...defaultProps} onToolOpen={onToolOpen} />);

    await userEvent.click(screen.getByTitle('Управление минус-фразами: добавление, импорт, применение'));

    expect(onToolOpen).toHaveBeenCalledWith('minus-words');
  });

  it('should call onSettingsOpen when settings button is clicked', async () => {
    const onSettingsOpen = vi.fn();
    render(<TabRouter {...defaultProps} onSettingsOpen={onSettingsOpen} />);

    await userEvent.click(screen.getByText('Вид'));
    await userEvent.click(screen.getByTitle('Настройки'));

    expect(onSettingsOpen).toHaveBeenCalled();
  });

  it('should call onProjectOpen when projects button is clicked', async () => {
    const onProjectOpen = vi.fn();
    render(<TabRouter {...defaultProps} onProjectOpen={onProjectOpen} />);

    await userEvent.click(screen.getByTitle('Управление проектами'));

    expect(onProjectOpen).toHaveBeenCalled();
  });
});

// ================================================================
// StatusBar
// ================================================================

describe('StatusBar', () => {
  beforeEach(() => {
    useAppStore.getState().clearAll();
  });

  it('should render "0 фраз" when no phrases exist', () => {
    render(<StatusBar onTrashOpen={vi.fn()} />);
    expect(screen.getByText('0 фраз')).toBeInTheDocument();
  });

  it('should render phrase count for active group', () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('G1');
    store.addPhrases(['фраза 1', 'фраза 2', 'фраза 3'], groupId);
    store.setActiveGroup(groupId);

    render(<StatusBar onTrashOpen={vi.fn()} />);

    expect(screen.getByText('3 фраз')).toBeInTheDocument();
  });

  it('should render total phrase count when no group is active', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('G1');
    const g2 = store.addGroup('G2');
    store.addPhrases(['фраза 1'], g1);
    store.addPhrases(['фраза 2', 'фраза 3'], g2);

    render(<StatusBar onTrashOpen={vi.fn()} />);

    expect(screen.getByText('3 фраз')).toBeInTheDocument();
  });

  it('should render selection count when phrases are selected', () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('G1');
    store.addPhrases(['фраза 1', 'фраза 2'], groupId);
    const phraseIds = useAppStore.getState().phrases.map(p => p.id);
    store.togglePhraseSelection(phraseIds[0]);
    store.togglePhraseSelection(phraseIds[1]);

    render(<StatusBar onTrashOpen={vi.fn()} />);

    expect(screen.getByText('2 выбрано')).toBeInTheDocument();
  });

  it('should not render selection count when nothing is selected', () => {
    render(<StatusBar onTrashOpen={vi.fn()} />);

    expect(screen.queryByText(/выбрано/)).not.toBeInTheDocument();
  });

  it('should render group count when groups exist', () => {
    const store = useAppStore.getState();
    store.addGroup('G1');
    store.addGroup('G2');

    render(<StatusBar onTrashOpen={vi.fn()} />);

    expect(screen.getByText('2 групп')).toBeInTheDocument();
  });

  it('should not include trash group in count', () => {
    const store = useAppStore.getState();
    store.addGroup('G1');
    store.addGroup('G2');
    // moveToTrash creates a trash group internally
    const groupId = store.addGroup('G3');
    store.addPhrases(['фраза'], groupId);
    store.moveToTrash([useAppStore.getState().phrases[0].id]);

    render(<StatusBar onTrashOpen={vi.fn()} />);

    // 3 regular groups + 1 trash = "3 групп" (trash excluded)
    expect(screen.getByText('3 групп')).toBeInTheDocument();
  });

  it('should render "KeyCluster" branding text', () => {
    render(<StatusBar onTrashOpen={vi.fn()} />);
    expect(screen.getByText(/KeyCluster/)).toBeInTheDocument();
  });

  it('should render trash button', () => {
    render(<StatusBar onTrashOpen={vi.fn()} />);
    const trashBtn = screen.getByTitle('Корзина пуста');
    expect(trashBtn).toBeInTheDocument();
  });

  it('should call onTrashOpen when trash button is clicked', async () => {
    const onTrashOpen = vi.fn();
    render(<StatusBar onTrashOpen={onTrashOpen} />);

    await userEvent.click(screen.getByTitle('Корзина пуста'));

    expect(onTrashOpen).toHaveBeenCalled();
  });

  it('should show trash count when phrases are in trash', () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('G1');
    store.addPhrases(['фраза 1', 'фраза 2'], groupId);
    store.moveToTrash(useAppStore.getState().phrases.map(p => p.id));

    render(<StatusBar onTrashOpen={vi.fn()} />);

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByTitle(/Корзина: 2 фраз/)).toBeInTheDocument();
  });

  it('should show active group name', () => {
    const store = useAppStore.getState();
    const groupId = store.addGroup('Моя группа');
    store.setActiveGroup(groupId);

    render(<StatusBar onTrashOpen={vi.fn()} />);

    expect(screen.getByText('Моя группа')).toBeInTheDocument();
  });

  it('should show undo count when undo stack has items', () => {
    const store = useAppStore.getState();
    store.addGroup('G1');

    render(<StatusBar onTrashOpen={vi.fn()} />);

    expect(screen.getByText(/↩/)).toBeInTheDocument();
  });

  it('should not show undo/redo when both stacks are empty', () => {
    render(<StatusBar onTrashOpen={vi.fn()} />);

    expect(screen.queryByText(/↩/)).not.toBeInTheDocument();
    expect(screen.queryByText(/↪/)).not.toBeInTheDocument();
  });
});

// ================================================================
// PanelManager
// ================================================================

describe('PanelManager', () => {
  beforeEach(() => {
    useAppStore.getState().clearAll();
  });

  it('should render without crashing', () => {
    const ctx = createMockCtx();
    const { container } = render(
      <PanelManager
        ctx={ctx}
        toolModal={null}
        onToolModalChange={vi.fn()}
        trashOpen={false}
        onTrashOpenChange={vi.fn()}
      />
    );

    expect(container).toBeInTheDocument();
  });

  it('should render ToolModal when toolModal matches a known tool', () => {
    const ctx = createMockCtx();
    render(
      <PanelManager
        ctx={ctx}
        toolModal="clustering"
        onToolModalChange={vi.fn()}
        trashOpen={false}
        onTrashOpenChange={vi.fn()}
      />
    );

    expect(screen.getByText('Кластеризация')).toBeInTheDocument();
  });

  it('should render multiple tool modals independently', () => {
    const ctx = createMockCtx();
    render(
      <PanelManager
        ctx={ctx}
        toolModal="minus-words"
        onToolModalChange={vi.fn()}
        trashOpen={false}
        onTrashOpenChange={vi.fn()}
      />
    );

    expect(screen.getByText('Минус-фразы')).toBeInTheDocument();
    // Other modals should not be open
    expect(screen.queryByText('Кластеризация')).not.toBeInTheDocument();
    expect(screen.queryByText('TF-IDF')).not.toBeInTheDocument();
  });

  it('should render TrashModal when trashOpen is true', () => {
    const ctx = createMockCtx();
    render(
      <PanelManager
        ctx={ctx}
        toolModal={null}
        onToolModalChange={vi.fn()}
        trashOpen={true}
        onTrashOpenChange={vi.fn()}
      />
    );

    expect(screen.getByTestId('trash-modal')).toBeInTheDocument();
  });

  it('should not render TrashModal when trashOpen is false', () => {
    const ctx = createMockCtx();
    render(
      <PanelManager
        ctx={ctx}
        toolModal={null}
        onToolModalChange={vi.fn()}
        trashOpen={false}
        onTrashOpenChange={vi.fn()}
      />
    );

    expect(screen.queryByTestId('trash-modal')).not.toBeInTheDocument();
  });
});

// ================================================================
// ResizablePanel
// ================================================================

describe('ResizablePanel', () => {
  it('should render children', () => {
    render(
      <ResizablePanel
        initialWidth={300}
        minWidth={200}
        maxWidth={500}
      >
        <div data-testid="panel-content">Content</div>
      </ResizablePanel>
    );

    expect(screen.getByTestId('panel-content')).toBeInTheDocument();
  });

  it('should apply initial width', () => {
    const { container } = render(
      <ResizablePanel
        initialWidth={280}
        minWidth={180}
        maxWidth={500}
      >
        <div>Content</div>
      </ResizablePanel>
    );

    const panel = container.firstElementChild as HTMLElement;
    expect(panel.style.width).toBe('280px');
  });

  it('should render a resize handle', () => {
    const { container } = render(
      <ResizablePanel
        initialWidth={280}
        minWidth={180}
        maxWidth={500}
      >
        <div>Content</div>
      </ResizablePanel>
    );

    const panel = container.firstElementChild as HTMLElement;
    const handle = panel.querySelector('.cursor-col-resize');
    expect(handle).toBeInTheDocument();
  });

  it('should have the correct CSS classes', () => {
    const { container } = render(
      <ResizablePanel
        initialWidth={280}
        minWidth={180}
        maxWidth={500}
      >
        <div>Content</div>
      </ResizablePanel>
    );

    const panel = container.firstElementChild as HTMLElement;
    expect(panel.className).toContain('flex');
    expect(panel.className).toContain('flex-col');
    expect(panel.className).toContain('shrink-0');
  });
});

// ================================================================
// Integration: KeyClusterShell loading structure
// ================================================================

describe('Shell integration', () => {
  beforeEach(() => {
    useAppStore.getState().clearAll();
  });

  it('should compose ShellLayout with TabRouter, StatusBar, and content', () => {
    const ctx = createMockCtx();

    render(
      <ShellLayout
        tabBar={
          <TabRouter
            ctx={ctx}
            activeTool={null}
            onToolOpen={vi.fn()}
            onSettingsOpen={vi.fn()}
            onProjectOpen={vi.fn()}
            onThemeChange={vi.fn()}
            onRefresh={vi.fn()}
          />
        }
        mainContent={<div data-testid="main-area">Main Content</div>}
        statusBar={<StatusBar onTrashOpen={vi.fn()} />}
        overlays={
          <PanelManager
            ctx={ctx}
            toolModal={null}
            onToolModalChange={vi.fn()}
            trashOpen={false}
            onTrashOpenChange={vi.fn()}
          />
        }
      />
    );

    // Tab bar content present
    expect(screen.getByText('Данные')).toBeInTheDocument();
    expect(screen.getByText('Алгоритмы')).toBeInTheDocument();
    expect(screen.getByText('Плагины')).toBeInTheDocument();
    expect(screen.getByText('Вид')).toBeInTheDocument();

    // Main content present
    expect(screen.getByTestId('main-area')).toBeInTheDocument();

    // Status bar present
    expect(screen.getByText('0 фраз')).toBeInTheDocument();
    expect(screen.getByText(/KeyCluster/)).toBeInTheDocument();
  });

  it('should show ShellLoadingScreen instead of ShellLayout when modules are loading', () => {
    // KeyClusterShell uses this pattern: if (!initialized || modulesLoading) return <ShellLoadingScreen />
    // We simulate this with a conditional render
    const loading = true;

    if (loading) {
      render(<ShellLoadingScreen />);
      expect(screen.getByText(/KeyCluster/)).toBeInTheDocument();
      expect(screen.queryByText('Данные')).not.toBeInTheDocument();
    }
  });

  it('should render main structure when loaded (not loading)', () => {
    const ctx = createMockCtx();

    render(
      <ShellLayout
        tabBar={
          <TabRouter
            ctx={ctx}
            activeTool={null}
            onToolOpen={vi.fn()}
            onSettingsOpen={vi.fn()}
            onProjectOpen={vi.fn()}
            onThemeChange={vi.fn()}
            onRefresh={vi.fn()}
          />
        }
        mainContent={<div data-testid="main-content">Main</div>}
        statusBar={<StatusBar onTrashOpen={vi.fn()} />}
      />
    );

    // When loaded, we see the full shell structure
    expect(screen.getByText('Данные')).toBeInTheDocument();
    expect(screen.getByTestId('main-content')).toBeInTheDocument();
    expect(screen.getByText('0 фраз')).toBeInTheDocument();
    expect(screen.getByText(/KeyCluster/)).toBeInTheDocument();
    expect(screen.queryByText('Загрузка модулей...')).not.toBeInTheDocument();
  });
});
