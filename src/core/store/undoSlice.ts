import type { Group, Phrase, MinusWord, MinusWordGroup, KCID } from '../types';
import { rebuildPhraseMap } from './phraseSlice';

const UNDO_LIMIT = 50;

export interface UndoSnapshot {
  groups: Group[];
  phrases: Phrase[] | null;
  phraseGroupPatch: Array<{ id: KCID; groupId: KCID }> | null;
  minusWords: MinusWord[];
  minusWordGroups: MinusWordGroup[];
  activeGroupId: KCID | null;
  selectedGroupIds: KCID[];
  selectedPhraseIds: KCID[];
}

export interface UndoSlice {
  undoStack: UndoSnapshot[];
  redoStack: UndoSnapshot[];
  _batchMode: boolean;
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
  batchOperation: (fn: () => void) => void;
}

export function createUndoSlice(set: any, get: any) {
  return {
    undoStack: [] as UndoSnapshot[],
    redoStack: [] as UndoSnapshot[],
    _batchMode: false,
    pushUndo: () => {
      if (get()._batchMode) return;
      const s = get();
      const snapshot: UndoSnapshot = {
        groups: structuredClone(s.groups),
        phrases: structuredClone(s.phrases),
        phraseGroupPatch: null,
        minusWords: structuredClone(s.minusWords),
        minusWordGroups: structuredClone(s.minusWordGroups),
        activeGroupId: s.activeGroupId,
        selectedGroupIds: [...s.selectedGroupIds],
        selectedPhraseIds: [...s.selectedPhraseIds],
      };
      set((state: any) => {
        const next = [...state.undoStack, snapshot];
        if (next.length > UNDO_LIMIT) next.shift();
        return { undoStack: next, redoStack: [] };
      });
    },
    undo: () => {
      const s = get();
      set((draft: any) => {
        const snapshot = draft.undoStack.pop();
        if (!snapshot) return;
        const redoSnapshot: UndoSnapshot = {
          groups: structuredClone(s.groups),
          phrases: structuredClone(s.phrases),
          phraseGroupPatch: null,
          minusWords: structuredClone(s.minusWords),
          minusWordGroups: structuredClone(s.minusWordGroups),
          activeGroupId: s.activeGroupId,
          selectedGroupIds: [...s.selectedGroupIds],
          selectedPhraseIds: [...s.selectedPhraseIds],
        };
        draft.redoStack.push(redoSnapshot);
        draft.groups = snapshot.groups;
        draft.phrases = snapshot.phrases;
        draft.phraseMap = rebuildPhraseMap(draft.phrases);
        draft.minusWords = snapshot.minusWords;
        draft.minusWordGroups = snapshot.minusWordGroups;
        draft.activeGroupId = snapshot.activeGroupId;
        draft.selectedGroupIds = new Set(snapshot.selectedGroupIds);
        draft.selectedPhraseIds = new Set(snapshot.selectedPhraseIds);
      });
    },
    redo: () => {
      const s = get();
      set((draft: any) => {
        const snapshot = draft.redoStack.pop();
        if (!snapshot) return;
        const undoSnapshot: UndoSnapshot = {
          groups: structuredClone(s.groups),
          phrases: structuredClone(s.phrases),
          phraseGroupPatch: null,
          minusWords: structuredClone(s.minusWords),
          minusWordGroups: structuredClone(s.minusWordGroups),
          activeGroupId: s.activeGroupId,
          selectedGroupIds: [...s.selectedGroupIds],
          selectedPhraseIds: [...s.selectedPhraseIds],
        };
        draft.undoStack.push(undoSnapshot);
        draft.groups = snapshot.groups;
        draft.phrases = snapshot.phrases;
        draft.phraseMap = rebuildPhraseMap(draft.phrases);
        draft.minusWords = snapshot.minusWords;
        draft.minusWordGroups = snapshot.minusWordGroups;
        draft.activeGroupId = snapshot.activeGroupId;
        draft.selectedGroupIds = new Set(snapshot.selectedGroupIds);
        draft.selectedPhraseIds = new Set(snapshot.selectedPhraseIds);
      });
    },
    batchOperation: (fn: () => void) => {
      get().pushUndo();
      set((draft: any) => { draft._batchMode = true; });
      try {
        fn();
      } finally {
        set((draft: any) => { draft._batchMode = false; });
      }
    },
  };
}
