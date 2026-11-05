// ============================================================
// Tests: Панель групп — сворачивание, режим «дерево слева»,
// экспорт группы (CSV/TXT) и копирование в буфер.
//
//  • src/core/export/groupExport.ts — чистые функции (без DOM)
//  • WorkspaceArea (src/shell/KeyClusterShell.tsx) — порядок DOM
//  • GroupsPanel (src/modules/groups/GroupsPanel.tsx) — кнопки
// ============================================================

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore } from '@/plugin-sdk';
import { createEventBus } from '@/core/event-bus';
import {
  buildExportFileName,
  buildGroupCsv,
  buildGroupTxt,
  collectDescendantGroupIds,
  collectGroupPhrases,
  escapeCsvValue,
  sortGroupPhrases,
} from '@/core/export/groupExport';

// ---- Тяжёлые модули оболочки замоканы (нужна только раскладка) ----

vi.mock('@/modules/phrases/components', () => ({
  PhrasesTable: () => React.createElement('div', { 'data-testid': 'phrases-table' }, 'Фразы'),
}));

vi.mock('@/modules/groups/components', () => ({
  GroupsPanel: () => React.createElement('div', { 'data-testid': 'groups-panel' }, 'Группы'),
}));

vi.mock('@/shell/ShellLayout', () => ({
  ShellLayout: ({ mainContent }: any) => React.createElement('div', null, mainContent),
  ShellLoadingScreen: () => React.createElement('div', null, 'Загрузка...'),
}));

vi.mock('@/shell/TabRouter', () => ({
  TabRouter: () => React.createElement('div', null, 'Tabs'),
}));

vi.mock('@/shell/PanelManager', () => ({
  PanelManager: () => null,
  ResizablePanel: ({ children }: any) =>
    React.createElement('div', { 'data-testid': 'resizable-panel' }, children),
  StatusBar: () => null,
}));

vi.mock('@/components/CommandPalette', () => ({ default: () => null }));
vi.mock('@/components/SettingsModal', () => ({ default: () => null }));
vi.mock('@/components/ProjectManagerDialog', () => ({ default: () => null }));
vi.mock('@/modules/devtools/DevToolsPanel', () => ({ DevToolsPanel: () => null }));
vi.mock('@user-plugins/import-export/import-dialog', () => ({ ImportDialog: () => null }));

import { WorkspaceArea } from '@/shell/KeyClusterShell';
import { GroupsPanel } from '@/modules/groups/GroupsPanel';

// ---- Хелперы ----

function createMockCtx() {
  return {
    eventBus: { ...createEventBus(), emit: vi.fn() },
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

const GROUPS = [
  { id: 'g1', name: 'Альфа', parentId: null },
  { id: 'g2', name: 'Бета', parentId: 'g1' },
  { id: 'g3', name: 'Гамма', parentId: 'g2' },
  { id: 'g4', name: 'Дельта', parentId: null },
];

const PHRASES = [
  { id: 'p1', text: 'купить телефон', groupId: 'g1' },
  { id: 'p2', text: 'Альфа 汽车', groupId: 'g1' },
  { id: 'p3', text: 'купить, кредит', groupId: 'g1' },
  { id: 'p4', text: 'строка "кавычки"', groupId: 'g2' },
  { id: 'p5', text: 'две\nстроки', groupId: 'g3' },
  { id: 'p6', text: 'чужая фраза', groupId: 'g4' },
];

// ============================================================
// groupExport — чистые функции
// ============================================================

describe('groupExport: сбор фраз группы', () => {
  it('включает фразы самой группы и всех потомков', () => {
    const ids = collectDescendantGroupIds('g1', GROUPS);
    expect(ids).toEqual(['g1', 'g2', 'g3']);
  });

  it('не включает фразы соседних групп', () => {
    const scoped = collectGroupPhrases('g1', GROUPS, PHRASES);
    expect(scoped.map(p => p.id)).not.toContain('p6');
    expect(scoped.map(p => p.id)).toEqual(expect.arrayContaining(['p1', 'p2', 'p3', 'p4', 'p5']));
  });

  it('сортирует фразы: сначала по порядку групп в дереве, затем по тексту', () => {
    const scoped = collectGroupPhrases('g1', GROUPS, PHRASES);
    // g1: «Альфа 汽车», затем «купить телефон» и «купить, кредит» (по алфавиту,
    // регистронезависимо), затем g2, затем g3
    expect(scoped.map(p => p.text)).toEqual([
      'Альфа 汽车',
      'купить телефон',
      'купить, кредит',
      'строка "кавычки"',
      'две\nстроки',
    ]);
  });

  it('sortGroupPhrases сохраняет стабильность при одинаковом тексте', () => {
    const phrases = [
      { id: 'b', text: 'одно и то же', groupId: 'g1' },
      { id: 'a', text: 'одно и то же', groupId: 'g1' },
    ];
    const sorted = sortGroupPhrases(phrases, GROUPS);
    expect(sorted.map(p => p.id)).toEqual(['a', 'b']);
  });
});

// ============================================================
// groupExport — CSV / TXT
// ============================================================

describe('groupExport: CSV', () => {
  it('строит CSV с заголовком и разделителем «;»', () => {
    const csv = buildGroupCsv(
      [{ id: 'p1', text: 'фраза', groupId: 'g1' }],
      GROUPS,
    );
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Текст;Группа');
    expect(lines[1]).toBe('фраза;Альфа');
  });

  it('экранирует запятые, кавычки и переводы строк', () => {
    expect(escapeCsvValue('обычная фраза')).toBe('обычная фраза');
    expect(escapeCsvValue('есть, запятая')).toBe('"есть, запятая"');
    expect(escapeCsvValue('есть "кавычки"')).toBe('"есть ""кавычки"""');
    expect(escapeCsvValue('две\nстроки')).toBe('"две\nстроки"');
    expect(escapeCsvValue('точка; запятая')).toBe('"точка; запятая"');
  });

  it('экранирует значения в собранном CSV', () => {
    const csv = buildGroupCsv(PHRASES.slice(0, 5), GROUPS);
    expect(csv).toContain('"купить, кредит";Альфа');
    expect(csv).toContain('"строка ""кавычки""";Бета');
    expect(csv).toContain('"две\nстроки";Гамма');
    // каждая фраза — отдельная запись (кроме фразы с переводом строки)
    expect(csv.split('\n').filter(l => l.startsWith('купить телефон'))).toHaveLength(1);
  });

  it('без заголовка — только строки данных', () => {
    const csv = buildGroupCsv([{ id: 'p1', text: 'фраза', groupId: 'g1' }], GROUPS, { includeHeader: false });
    expect(csv).toBe('фраза;Альфа');
  });

  it('без колонки группы — только текст', () => {
    const csv = buildGroupCsv([{ id: 'p1', text: 'фраза', groupId: 'g1' }], GROUPS, { includeGroupColumn: false });
    expect(csv).toBe('Текст\nфраза');
  });
});

describe('groupExport: TXT и имя файла', () => {
  it('TXT — одна фраза на строку', () => {
    const txt = buildGroupTxt([
      { id: 'p1', text: 'первая', groupId: 'g1' },
      { id: 'p2', text: 'вторая', groupId: 'g1' },
    ]);
    expect(txt).toBe('первая\nвторая');
  });

  it('TXT для пустой группы — пустая строка', () => {
    expect(buildGroupTxt([])).toBe('');
  });

  it('имя файла очищается от недопустимых символов', () => {
    expect(buildExportFileName('Группа / Тест', 'csv')).toBe('Группа _ Тест.csv');
    expect(buildExportFileName('', 'txt')).toBe('group.txt');
    expect(buildExportFileName('A:B*C?', 'txt')).toBe('A_B_C_.txt');
  });
});

// ============================================================
// WorkspaceArea — режим «дерево слева»
// ============================================================

describe('WorkspaceArea: режим «дерево слева»', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    useAppStore.setState((s: any) => ({
      ui: { ...s.ui, groupsPanelCollapsed: false, groupsTreeOnLeft: false, groupsPanelWidth: 280 },
    }));
    ctx = createMockCtx();
  });

  function renderWorkspace() {
    return render(
      <WorkspaceArea
        ctx={ctx as any}
        panelContribs={[]}
        groupsPanel={<div data-testid="groups-panel">Группы</div>}
        table={<div data-testid="phrases-table">Фразы</div>}
      />,
    );
  }

  it('по умолчанию панель групп справа от таблицы', () => {
    const { container } = renderWorkspace();
    const nodes = Array.from(container.querySelectorAll('[data-testid]'));
    const groupsIdx = nodes.findIndex(n => n.getAttribute('data-testid') === 'groups-panel');
    const tableIdx = nodes.findIndex(n => n.getAttribute('data-testid') === 'phrases-table');
    expect(groupsIdx).toBeGreaterThan(tableIdx);
  });

  it('в режиме «дерево слева» панель групп идёт перед таблицей', () => {
    useAppStore.getState().setGroupsTreeOnLeft(true);
    const { container } = renderWorkspace();
    const nodes = Array.from(container.querySelectorAll('[data-testid]'));
    const groupsIdx = nodes.findIndex(n => n.getAttribute('data-testid') === 'groups-panel');
    const tableIdx = nodes.findIndex(n => n.getAttribute('data-testid') === 'phrases-table');
    expect(groupsIdx).toBeGreaterThanOrEqual(0);
    expect(groupsIdx).toBeLessThan(tableIdx);
  });

  it('в свёрнутом состоянии панель групп остаётся на своей стороне', () => {
    useAppStore.getState().setGroupsPanelCollapsed(true);
    const { container } = renderWorkspace();
    const nodes = Array.from(container.querySelectorAll('[data-testid]'));
    const groupsIdx = nodes.findIndex(n => n.getAttribute('data-testid') === 'groups-panel');
    const tableIdx = nodes.findIndex(n => n.getAttribute('data-testid') === 'phrases-table');
    expect(groupsIdx).toBeGreaterThan(tableIdx);
    expect(container.querySelector('[data-testid="groups-panel-slot"]')).toBeTruthy();
  });
});

// ============================================================
// GroupsPanel — кнопки сворачивания и «дерево слева»
// ============================================================

describe('GroupsPanel: сворачивание и «дерево слева»', () => {
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    useAppStore.getState().clearAll();
    useAppStore.setState((s: any) => ({
      ui: { ...s.ui, groupsPanelCollapsed: false, groupsTreeOnLeft: false, groupsPanelWidth: 280 },
    }));
    ctx = createMockCtx();
  });

  it('по умолчанию панель развёрнута', () => {
    render(<GroupsPanel ctx={ctx as any} />);
    expect(screen.getByText('Управление группами')).toBeInTheDocument();
    expect(screen.queryByTestId('groups-panel-collapsed')).toBeNull();
  });

  it('кнопка сворачивания сворачивает панель и сохраняет состояние в uiSlice', () => {
    render(<GroupsPanel ctx={ctx as any} />);
    fireEvent.click(screen.getByTestId('groups-collapse-button'));
    expect(useAppStore.getState().ui.groupsPanelCollapsed).toBe(true);
    expect(screen.getByTestId('groups-panel-collapsed')).toBeInTheDocument();
    expect(screen.queryByText('Управление группами')).toBeNull();
  });

  it('кнопка разворачивания возвращает панель', () => {
    render(<GroupsPanel ctx={ctx as any} />);
    fireEvent.click(screen.getByTestId('groups-collapse-button'));
    fireEvent.click(screen.getByTestId('groups-expand-button'));
    expect(useAppStore.getState().ui.groupsPanelCollapsed).toBe(false);
    expect(screen.getByText('Управление группами')).toBeInTheDocument();
  });

  it('переключатель «дерево слева» меняет состояние в uiSlice', () => {
    render(<GroupsPanel ctx={ctx as any} />);
    fireEvent.click(screen.getByTestId('groups-tree-left-button'));
    expect(useAppStore.getState().ui.groupsTreeOnLeft).toBe(true);
    fireEvent.click(screen.getByTestId('groups-tree-left-button'));
    expect(useAppStore.getState().ui.groupsTreeOnLeft).toBe(false);
  });
});
