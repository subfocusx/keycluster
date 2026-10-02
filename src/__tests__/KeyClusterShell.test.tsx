import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({ children }: any) => React.createElement('div', null, children),
  Sidebar: ({ children }: any) => React.createElement('div', null, children),
  SidebarTrigger: () => React.createElement('button'),
  SidebarContent: ({ children }: any) => React.createElement('div', null, children),
  SidebarHeader: ({ children }: any) => React.createElement('div', null, children),
  SidebarFooter: ({ children }: any) => React.createElement('div', null, children),
  SidebarGroup: ({ children }: any) => React.createElement('div', null, children),
  SidebarGroupLabel: ({ children }: any) => React.createElement('div', null, children),
  SidebarGroupContent: ({ children }: any) => React.createElement('div', null, children),
  SidebarMenu: ({ children }: any) => React.createElement('div', null, children),
  SidebarMenuItem: ({ children }: any) => React.createElement('div', null, children),
  SidebarMenuButton: ({ children }: any) => React.createElement('button', null, children),
  SidebarSeparator: () => React.createElement('hr'),
  SidebarRail: () => React.createElement('div'),
  SidebarInset: ({ children }: any) => React.createElement('div', null, children),
  SidebarInput: (props: any) => React.createElement('input', props),
  SidebarMenuSkeleton: () => React.createElement('div'),
}));

import KeyClusterShell from '@/shell/KeyClusterShell';

const {
  mockBootstrap,
  mockEventBusOn,
  mockEventBus,
  mockGetEventBusOn,
} = vi.hoisted(() => {
  const on = vi.fn(() => vi.fn());
  const gebOn = vi.fn(() => vi.fn());
  return {
    mockBootstrap: vi.fn(),
    mockEventBusOn: on,
    mockEventBus: { on },
    mockGetEventBusOn: gebOn,
  };
});

vi.mock('@/core/bootstrap', () => ({
  bootstrap: mockBootstrap,
  eventBus: mockEventBus,
}));

const {
  mockGetManifests,
  mockGetKeybindings,
  mockGetUIContributions,
  mockExecuteCommand,
  mockGetModuleStatuses,
  mockGetRuntime,
} = vi.hoisted(() => ({
  mockGetManifests: vi.fn(() => [] as any),
  mockGetKeybindings: vi.fn(() => [] as any),
  mockGetUIContributions: vi.fn(() => []),
  mockExecuteCommand: vi.fn(),
  mockGetModuleStatuses: vi.fn(() => []),
  mockGetRuntime: vi.fn((...args: unknown[]) => ({
    getManifests: mockGetManifests,
    getKeybindings: mockGetKeybindings,
    getUIContributions: mockGetUIContributions,
    executeCommand: mockExecuteCommand,
    getModuleStatuses: mockGetModuleStatuses,
    isModuleDisabled: vi.fn(() => false),
  })),
}));

vi.mock('@/core/event-bus', () => ({
  getEventBus: () => ({ on: mockGetEventBusOn }),
}));

vi.mock('@/core/module-runtime', () => ({
  getRuntime: mockGetRuntime,
}));

const {
  mockRegister,
  mockRegistryGetAll,
  mockGetCommandRegistry,
} = vi.hoisted(() => ({
  mockRegister: vi.fn(),
  mockRegistryGetAll: vi.fn(() => []),
  mockGetCommandRegistry: vi.fn(() => ({
    register: mockRegister,
    getAll: mockRegistryGetAll,
  })),
}));

vi.mock('@/core/command-registry', () => ({
  getCommandRegistry: mockGetCommandRegistry,
}));

const { mockHandleKeydown } = vi.hoisted(() => ({
  mockHandleKeydown: vi.fn(),
}));

vi.mock('@/core/keybinding-manager', () => ({
  keybindingManager: { handleKeydown: mockHandleKeydown },
}));

const { mockUseAppStore } = vi.hoisted(() => {
  type StoreState = {
    ui: { theme: string; modulesLoading: boolean };
    groups: unknown[];
    phrases: unknown[];
    devtools: { devtoolsOpen: boolean; devtoolsTab: string };
    undo: ReturnType<typeof vi.fn>;
    redo: ReturnType<typeof vi.fn>;
    selectAllPhrases: ReturnType<typeof vi.fn>;
    moveToTrash: ReturnType<typeof vi.fn>;
    selectedPhraseIds: Set<unknown>;
    setTheme: ReturnType<typeof vi.fn>;
    setRightPanelWidth: ReturnType<typeof vi.fn>;
    toggleDevtools: ReturnType<typeof vi.fn>;
  };

  const defaultStoreState: StoreState = {
    ui: { theme: 'light', modulesLoading: false },
    groups: [],
    phrases: [],
    devtools: { devtoolsOpen: false, devtoolsTab: 'modules' },
    undo: vi.fn(),
    redo: vi.fn(),
    selectAllPhrases: vi.fn(),
    moveToTrash: vi.fn(),
    selectedPhraseIds: new Set(),
    setTheme: vi.fn(),
    setRightPanelWidth: vi.fn(),
    toggleDevtools: vi.fn(),
  };

  let mockStoreState: StoreState = { ...defaultStoreState, ui: { ...defaultStoreState.ui } };

  const mockUseAppStore = Object.assign(
    vi.fn((selector?: (s: StoreState) => unknown) => {
      if (selector) return selector(mockStoreState);
      return mockStoreState;
    }),
    { getState: vi.fn(() => mockStoreState) },
  );

  return { mockUseAppStore, mockStoreState, defaultStoreState };
});

vi.mock('@/core/store', () => ({
  useAppStore: mockUseAppStore,
}));

const { mockSetNextTheme, mockUseTheme } = vi.hoisted(() => ({
  mockSetNextTheme: vi.fn(),
  mockUseTheme: vi.fn(() => ({ setTheme: mockSetNextTheme, theme: 'light' })),
}));

vi.mock('next-themes', () => ({
  useTheme: mockUseTheme,
}));

vi.mock('@/modules/phrases/components', () => ({
  PhrasesTable: () => React.createElement('div', { 'data-testid': 'phrases-table' }, 'PhrasesTable'),
  AddPhrasesDialog: ({ open, onOpenChange }: any) => open ? React.createElement('div', { 'data-testid': 'add-phrases-dialog' }, 'AddPhrasesDialog') : null,
}));

vi.mock('@/modules/groups/components', () => ({
  GroupsPanel: () => React.createElement('div', { 'data-testid': 'groups-panel' }, 'GroupsPanel'),
}));

vi.mock('@user-plugins/import-export/components', () => ({
  ImportDialog: ({ open, onOpenChange }: any) => open ? React.createElement('div', { 'data-testid': 'import-dialog' }, 'ImportDialog') : null,
}));

vi.mock('@/shell/ShellLayout', () => ({
  ShellLayout: ({ tabBar, mainContent, statusBar, overlays }: any) =>
    React.createElement('div', { 'data-testid': 'shell-layout' },
      React.createElement('div', { 'data-testid': 'tab-bar' }, tabBar),
      React.createElement('div', { 'data-testid': 'main-content' }, mainContent),
      React.createElement('div', { 'data-testid': 'status-bar' }, statusBar),
      React.createElement('div', { 'data-testid': 'overlays' }, overlays),
    ),
  ShellLoadingScreen: () => React.createElement('div', { 'data-testid': 'shell-loading' }, 'Loading...'),
}));

vi.mock('@/shell/TabRouter', () => ({
  TabRouter: () => React.createElement('div', { 'data-testid': 'tab-router' }, 'TabRouter'),
}));

vi.mock('@/shell/PanelManager', () => ({
  PanelManager: () => React.createElement('div', { 'data-testid': 'panel-manager' }, 'PanelManager'),
  ResizablePanel: ({ children }: any) =>
    React.createElement('div', { 'data-testid': 'resizable-panel' }, children),
  StatusBar: () => React.createElement('div', { 'data-testid': 'status-bar-el' }, 'StatusBar'),
}));

vi.mock('@/components/CommandPalette', () => ({
  default: ({ open }: any) =>
    React.createElement('div', { 'data-testid': 'command-palette', 'data-open': String(open) }, 'CommandPalette'),
}));

vi.mock('@/components/SettingsModal', () => ({
  default: ({ open }: any) =>
    React.createElement('div', { 'data-testid': 'settings-modal', 'data-open': String(open) }, 'SettingsModal'),
}));

vi.mock('@/components/ProjectManagerDialog', () => ({
  ProjectManagerDialog: ({ open }: any) =>
    React.createElement('div', { 'data-testid': 'project-manager', 'data-open': String(open) }, 'ProjectManager'),
}));

vi.mock('@/components/ModuleErrorBoundary', () => ({
  ModuleErrorBoundary: ({ moduleId, children }: any) =>
    React.createElement('div', { 'data-testid': 'error-boundary-' + moduleId }, children),
}));

vi.mock('@/shell/useModuleCtx', () => ({
  useModuleCtx: () => ({ eventBus: {}, store: {} }),
}));
vi.mock('@/components/KCDialog', () => ({
  useKCDialog: () => ({ confirm: () => Promise.resolve(true), prompt: () => Promise.resolve(null), alert: () => Promise.resolve() }),
}));


// ---- Helpers ----

function renderShell() {
  const state = mockUseAppStore.getState();
  return render(React.createElement('div', { id: 'shell-root' }, React.createElement(KeyClusterShell)));
}

// ---- Tests ----

describe('KeyClusterShell', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.documentElement.classList.remove('dark');
    localStorage.clear();
    mockBootstrap.mockClear();
    mockSetNextTheme.mockClear();
    mockRegister.mockClear();
    mockHandleKeydown.mockClear();
    mockGetManifests.mockReturnValue([]);
    mockGetKeybindings.mockReturnValue([]);
    mockGetUIContributions.mockReturnValue([]);
    mockEventBusOn.mockClear();
    mockEventBusOn.mockReturnValue(vi.fn());
    mockGetEventBusOn.mockClear();
    mockGetEventBusOn.mockReturnValue(vi.fn());
    mockGetRuntime.mockClear();
    const st = mockUseAppStore.getState();
    st.ui.modulesLoading = false;
    st.ui.theme = 'light';
    st.groups = [];
    st.phrases = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('loading state', () => {
    it('shows ShellLoadingScreen when modulesLoading is true', () => {
      const state = mockUseAppStore.getState();
      state.ui.modulesLoading = true;
      renderShell();
      expect(screen.getByTestId('shell-loading')).toBeDefined();
      expect(screen.queryByTestId('shell-layout')).toBeNull();
    });
  });

  describe('theme sync on mount', () => {
    it('sets dark theme and adds class when saved theme is dark', () => {
      const state = mockUseAppStore.getState();
      state.ui.theme = 'dark';
      renderShell();
      expect(mockSetNextTheme).toHaveBeenCalledWith('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('sets light theme and removes class when saved theme is light', () => {
      document.documentElement.classList.add('dark');
      const state = mockUseAppStore.getState();
      state.ui.theme = 'light';
      renderShell();
      expect(mockSetNextTheme).toHaveBeenCalledWith('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('keyboard shortcuts', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      const state = mockUseAppStore.getState();
      state.ui.modulesLoading = false;
      state.selectedPhraseIds = new Set();
    });

    it('Ctrl+Z forwards to keybindingManager', () => {
      renderShell();
      act(() => { vi.runAllTimers(); });

      act(() => { fireEvent.keyDown(window, { key: 'z', ctrlKey: true }); });
      expect(mockHandleKeydown).toHaveBeenCalledWith(expect.objectContaining({ key: 'z', ctrlKey: true }));
    });

    it('forwards non-palette keydowns to keybindingManager', () => {
      renderShell();
      act(() => { vi.runAllTimers(); });

      act(() => { fireEvent.keyDown(window, { key: 's', ctrlKey: true }); });
      expect(mockHandleKeydown).toHaveBeenCalledWith(expect.objectContaining({ key: 's', ctrlKey: true }));
    });

    it('does not forward Ctrl+K to keybindingManager', () => {
      renderShell();
      act(() => { vi.runAllTimers(); });

      act(() => { fireEvent.keyDown(window, { key: 'k', ctrlKey: true }); });
      expect(mockHandleKeydown).not.toHaveBeenCalled();
    });

    it('Ctrl+A calls selectAllPhrases', () => {
      renderShell();
      act(() => { vi.runAllTimers(); });
      const selectSpy = mockUseAppStore.getState().selectAllPhrases;

      act(() => { fireEvent.keyDown(window, { key: 'a', ctrlKey: true }); });
      expect(selectSpy).toHaveBeenCalled();
    });

    it('Delete calls moveToTrash for selected phrase', async () => {
      renderShell();
      act(() => { vi.runAllTimers(); });
      const state = mockUseAppStore.getState();
      state.selectedPhraseIds = new Set(['p1']);
      const trashSpy = state.moveToTrash;

      await act(async () => { fireEvent.keyDown(window, { key: 'Delete' }); });
      expect(trashSpy).toHaveBeenCalledWith(['p1']);
    });

    it('Delete does nothing when no phrases selected', () => {
      renderShell();
      act(() => { vi.runAllTimers(); });
      const state = mockUseAppStore.getState();
      state.selectedPhraseIds = new Set();
      const trashSpy = state.moveToTrash;

      act(() => { fireEvent.keyDown(window, { key: 'Delete' }); });
      expect(trashSpy).not.toHaveBeenCalled();
    });

    it('Delete does not fire when focus is in INPUT', () => {
      renderShell();
      act(() => { vi.runAllTimers(); });
      const state = mockUseAppStore.getState();
      state.selectedPhraseIds = new Set(['p1']);
      const trashSpy = state.moveToTrash;

      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      act(() => { fireEvent.keyDown(input, { key: 'Delete' }); });
      expect(trashSpy).not.toHaveBeenCalled();
      document.body.removeChild(input);
    });
  });

  describe('global event bus (tool:open)', () => {
    it('subscribes to tool:open event', () => {
      renderShell();
      act(() => { vi.runAllTimers(); });
      expect(mockGetEventBusOn).toHaveBeenCalledWith('tool:open', expect.any(Function));
    });

    it('unsubscribes on unmount', () => {
      const unsubscribe = vi.fn();
      mockGetEventBusOn.mockReturnValue(unsubscribe);
      const { unmount } = renderShell();
      act(() => { vi.runAllTimers(); });
      unmount();
      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe('full shell rendering', () => {
    it('renders main layout components when initialized', () => {
      renderShell();
      act(() => { vi.runAllTimers(); });
      expect(screen.getByTestId('shell-layout')).toBeDefined();
      expect(screen.getByTestId('tab-router')).toBeDefined();
      expect(screen.getByTestId('phrases-table')).toBeDefined();
      expect(screen.getByTestId('groups-panel')).toBeDefined();
      expect(screen.getByTestId('resizable-panel')).toBeDefined();
      expect(screen.getByTestId('status-bar-el')).toBeDefined();
    });

    it('renders overlays (devtools, command palette, settings, project manager, panel manager)', () => {
      renderShell();
      act(() => { vi.runAllTimers(); });
      expect(screen.getByTestId('command-palette')).toBeDefined();
      expect(screen.getByTestId('settings-modal')).toBeDefined();
      expect(screen.getByTestId('project-manager')).toBeDefined();
      expect(screen.getByTestId('panel-manager')).toBeDefined();
    });
  });

  describe('DevTools', () => {
    it('renders DevToolsPanel in overlays when devtoolsOpen is true', () => {
      const state = mockUseAppStore.getState();
      state.devtools.devtoolsOpen = true;
      renderShell();
      act(() => { vi.runAllTimers(); });
      expect(screen.getByTestId('devtools-panel')).toBeDefined();
    });
  });
});