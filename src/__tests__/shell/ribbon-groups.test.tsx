import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TabRouter } from '@/shell/TabRouter';

// Mock useAppStore
vi.mock('@/core/store', () => ({
  useAppStore: (selector: any) => {
    const state = {
      groups: [],
      phrases: [],
      minusWords: [],
      plusWords: [],
      activeGroupId: null,
      activePhraseId: null,
      selectedGroupIds: new Set(),
      selectedPhraseIds: new Set(),
      clearAll: vi.fn(),
      undoStack: [],
      redoStack: [],
      undo: vi.fn(),
      redo: vi.fn(),
      pushUndo: vi.fn(),
      ui: { theme: 'light', columnVisibility: {}, columnLabels: {}, columnColors: {}, multigroupMode: false, modulesLoading: false, failedModules: [], dbPersistenceEnabled: false, columnAutoResizeTrigger: 0 },
      triggerColumnAutoResize: vi.fn(),
      projectId: null,
      projectName: null,
      setProject: vi.fn(),
      loadProject: vi.fn(),
      addPhrases: vi.fn(),
      addGroup: vi.fn(),
      addMinusWord: vi.fn(),
      removeMinusWord: vi.fn(),
      addTagToPhrase: vi.fn(),
      removeTagFromPhrase: vi.fn(),
      previewMinusWords: vi.fn(),
      applyMinusWords: vi.fn(),
    };
    return selector ? selector(state) : state;
  },
}));

// Mock module-runtime
vi.mock('@/core/module-runtime', () => ({
  getRuntime: vi.fn().mockReturnValue(null),
}));

// Mock KCDialog
vi.mock('@/components/KCDialog', () => ({
  useKCDialog: () => ({
    confirm: vi.fn().mockResolvedValue(true),
  }),
}));



function renderTabRouter() {
  return render(
    <TabRouter
      ctx={{ eventBus: { on: vi.fn(() => vi.fn()), emit: vi.fn() } }}
      activeTool={null}
      onToolOpen={vi.fn()}
      onSettingsOpen={vi.fn()}
      onProjectOpen={vi.fn()}
      onThemeChange={vi.fn()}
      onRefresh={vi.fn()}
    />
  );
}

describe('Ribbon groups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders ribbon button elements', () => {
    renderTabRouter();
    // Hardcoded + tool registry buttons should still render
    const buttons = document.querySelectorAll('.ribbon-btn');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('data tab contains hardcoded and registry buttons', () => {
    renderTabRouter();
    // Hardcoded buttons
    expect(screen.getByText('Проекты')).toBeTruthy();
    expect(screen.getByText('Создать')).toBeTruthy();
    expect(screen.getByText('Отменить')).toBeTruthy();
    expect(screen.getByText('Повторить')).toBeTruthy();
    // Tool registry buttons (from getToolsByTab('data'))
    expect(screen.getByText('Минус-фразы')).toBeTruthy();
  });

  it('algorithms tab contains registry buttons', async () => {
    renderTabRouter();
    fireEvent.click(screen.getByText('Алгоритмы'));
    await waitFor(() => {
      // Tool registry buttons with tab='algorithms'
      expect(screen.getByText('Кластеризация')).toBeTruthy();
    });
    expect(screen.getByText('Анализ групп')).toBeTruthy();
    expect(screen.getByText('N-граммы')).toBeTruthy();
    expect(screen.getByText('TF-IDF')).toBeTruthy();
  });

  it('existing ribbon buttons still render (regression)', () => {
    renderTabRouter();
    expect(screen.getByText('Проекты')).toBeTruthy();
    expect(screen.getByText('Создать')).toBeTruthy();
    expect(screen.getByText('Отменить')).toBeTruthy();
    expect(screen.getByText('Минус-фразы')).toBeTruthy();
    expect(screen.getByText('Найти/Заменить')).toBeTruthy();
  });
});
