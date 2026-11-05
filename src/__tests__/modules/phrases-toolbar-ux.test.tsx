import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PhrasesToolbar } from '@/modules/phrases/PhrasesToolbar';

function baseProps(overrides: Partial<React.ComponentProps<typeof PhrasesToolbar>> = {}) {
  return {
    groupPath: [],
    onSelectGroup: vi.fn(),
    totalCount: 10,
    searchQuery: '',
    setSearchQuery: vi.fn(),
    labelFilter: null,
    setLabelFilter: vi.fn(),
    tagFilter: null,
    setTagFilter: vi.fn(),
    allTags: [],
    sortedPhrasesLength: 10,
    activeFilterCount: 0,
    colManagerOpen: false,
    setColManagerOpen: vi.fn(),
    baseCols: [],
    columnVisibility: {},
    toggleColumnVisibility: vi.fn(),
    resetColumnSettings: vi.fn(),
    setShowStatsDialog: vi.fn(),
    showStarredOnly: false,
    onToggleStarred: vi.fn(),
    clearAllFilters: vi.fn(),
    ...overrides,
  } as React.ComponentProps<typeof PhrasesToolbar>;
}

describe('PhrasesToolbar — навигация и фильтры', () => {
  beforeEach(() => vi.clearAllMocks());

  it('показывает хлебные крошки пути активной группы', () => {
    render(<PhrasesToolbar {...baseProps({
      groupPath: [{ id: 'g1', name: 'Кластеры' }, { id: 'g2', name: 'купить автобус' }],
    })} />);
    const nav = screen.getByLabelText('Путь активной группы');
    expect(nav.textContent).toContain('Кластеры');
    expect(nav.textContent).toContain('купить автобус');
  });

  it('клик по крошке переключает группу', () => {
    const onSelectGroup = vi.fn();
    render(<PhrasesToolbar {...baseProps({
      groupPath: [{ id: 'g1', name: 'Кластеры' }, { id: 'g2', name: 'купить автобус' }],
      onSelectGroup,
    })} />);
    fireEvent.click(screen.getByText('Кластеры'));
    expect(onSelectGroup).toHaveBeenCalledWith('g1');
  });

  it('без пути группы крошек не рисует', () => {
    render(<PhrasesToolbar {...baseProps()} />);
    expect(screen.queryByLabelText('Путь активной группы')).toBeNull();
  });

  it('показывает чип активного поиска и сбрасывает его по клику', () => {
    const setSearchQuery = vi.fn();
    render(<PhrasesToolbar {...baseProps({ searchQuery: 'автобус', setSearchQuery })} />);
    expect(screen.getByText(/Поиск: «автобус»/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Сбросить фильтр Поиск/));
    expect(setSearchQuery).toHaveBeenCalledWith('');
  });

  it('показывает чипы метки, тега и избранного', () => {
    const setLabelFilter = vi.fn();
    const setTagFilter = vi.fn();
    const onToggleStarred = vi.fn();
    render(<PhrasesToolbar {...baseProps({
      labelFilter: 'Красная',
      setLabelFilter,
      tagFilter: 'важное',
      setTagFilter,
      showStarredOnly: true,
      onToggleStarred,
    })} />);
    expect(screen.getByText(/Метка: /)).toBeInTheDocument();
    expect(screen.getByText(/Тег: важное/)).toBeInTheDocument();
    expect(screen.getByText('Только избранное')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Сбросить фильтр Метка/));
    expect(setLabelFilter).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByLabelText(/Сбросить фильтр Тег/));
    expect(setTagFilter).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByLabelText(/Сбросить фильтр Только избранное/));
    expect(onToggleStarred).toHaveBeenCalled();
  });

  it('показывает «N из M», когда часть фраз отфильтрована', () => {
    render(<PhrasesToolbar {...baseProps({ sortedPhrasesLength: 3, totalCount: 10 })} />);
    expect(screen.getByText(/3/)).toBeInTheDocument();
    expect(screen.getByText(/из 10/)).toBeInTheDocument();
  });

  it('при полном совпадении не показывает «из M»', () => {
    render(<PhrasesToolbar {...baseProps({ sortedPhrasesLength: 10, totalCount: 10 })} />);
    expect(screen.queryByText(/из 10/)).toBeNull();
  });
});
