// ============================================================
// Tests: components/ProjectStatisticsDialog.tsx
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '@/plugin-sdk';
import type { Phrase } from '@/plugin-sdk';
import { ProjectStatisticsDialog } from '@/components/ProjectStatisticsDialog';

function resetStoreWithUndo() {
  useAppStore.getState().clearAll();
  const s = useAppStore.getState() as any;
  s.undoStack = [];
  s.redoStack = [];
}

describe('ProjectStatisticsDialog', () => {
  beforeEach(() => {
    resetStoreWithUndo();
  });

  it('should show phrase statistics when exactly one phrase is selected', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Main');
    store.addPhrases(['hello world'], g1, [{ frequency: 10, kei: 2, cpc: 3.5 }]);

    const phrase = useAppStore.getState().phrases[0] as Phrase;
    store.togglePhraseStar(phrase.id);
    const phraseAfter = useAppStore.getState().phrases.find(p => p.id === phrase.id)!;

    render(
      <ProjectStatisticsDialog
        open={true}
        onOpenChange={() => {}}
        selectedPhrases={[phraseAfter]}
      />,
    );

    expect(screen.getByText('Статистика фразы')).toBeInTheDocument();
    expect(screen.getByText('hello world')).toBeInTheDocument();
    expect(screen.getAllByText('Main').length).toBeGreaterThan(0);
    expect(screen.getByText('Избранное')).toBeInTheDocument();
    const favoriteRow = screen.getByText('Избранное').closest('div');
    expect(favoriteRow).toHaveTextContent(/Да|Нет/);

    // sanity: symbol count should be present
    const symbolsRow = screen.getByText('Символов').closest('div');
    expect(symbolsRow).toHaveTextContent(String('hello world'.length));
  });

  it('should show project statistics when no phrase is selected', () => {
    const store = useAppStore.getState();
    const g1 = store.addGroup('Main');
    store.addPhrases(['a', 'b'], g1);

    render(<ProjectStatisticsDialog open={true} onOpenChange={() => {}} />);

    expect(screen.getByText('Статистика проекта')).toBeInTheDocument();
    expect(screen.getByText('Общее')).toBeInTheDocument();
    const keyPhrasesRow = screen.getByText('Ключевых фраз').closest('div');
    expect(keyPhrasesRow).toHaveTextContent('2');
  });
});

