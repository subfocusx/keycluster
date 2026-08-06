import type { Group, Phrase, MinusWord, MinusWordGroup, UIState, KCID } from '../types';
import { rebuildPhraseMap } from './phraseSlice';

export interface ProjectSlice {
  loadProject: (data: { groups: Group[]; phrases: Phrase[]; minusWords: MinusWord[]; minusWordGroups: MinusWordGroup[]; ui?: Partial<UIState> }) => void;
  clearAll: () => void;
}

export function createProjectSlice(set: any, get: any) {
  return {
    loadProject: (data: { groups: Group[]; phrases: Phrase[]; minusWords: MinusWord[]; minusWordGroups: MinusWordGroup[]; ui?: Partial<UIState> }) => {
      const phraseMap = rebuildPhraseMap(data.phrases);
      set({
        groups: data.groups,
        phrases: data.phrases,
        phraseMap,
        minusWords: data.minusWords,
        minusWordGroups: data.minusWordGroups ?? [],
        selectedGroupIds: new Set(),
        selectedPhraseIds: new Set(),
        activeGroupId: null,
      });
    },
    clearAll: () => set((draft: any) => {
      draft.groups = [];
      draft.phrases = [];
      draft.phraseMap = new Map<KCID, number>();
      draft.minusWords = [];
      draft.minusWordGroups = [];
      draft.selectedGroupIds = new Set();
      draft.selectedPhraseIds = new Set();
      draft.activeGroupId = null;
      draft.undoStack = [];
      draft.redoStack = [];
      draft.ui = { ...draft.ui, columnVisibility: {}, columnLabels: {}, columnColors: {}, multigroupMode: false };
    }),
  };
}
