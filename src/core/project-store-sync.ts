// ============================================================
// KeyCluster Project System — Store Synchronization
// ============================================================
//
// Pure functions for serializing/deserializing project state.
// NO side-effects, NO DB access, NO EventBus, NO UI access.
//
// extract(state) → ProjectState
// restore(state) → partial AppState (to be spread into Zustand)
//
// The caller (project-service) is responsible for:
//   - calling useAppStore.getState() to get state
//   - calling useAppStore.setState() to apply restored state
//   - firing EventBus events
//   - updating DOM (theme, etc.)
// ============================================================

import type { ProjectState } from './project-types';
import type { Group, Phrase, MinusWord, AppState } from './types';
import { rebuildPhraseMap } from './store/phraseSlice';

// ---- Extract ----

/** Extract project state from an AppState object (pure function) */
export function extractProjectState(state: {
  groups: Group[];
  phrases: Phrase[];
  minusWords: MinusWord[];
  settings: Record<string, Record<string, unknown>>;
  ui: {
    theme: string;
    rightPanel: { width: number; open: boolean };
    leftPanel: { width: number; open: boolean; module: string | null };
  };
}): ProjectState {
  return {
    groups: serializeGroups(state.groups),
    phrases: serializePhrases(state.phrases),
    minusWords: serializeMinusWords(state.minusWords),
    settings: { ...state.settings },
    uiState: {
      theme: state.ui.theme as any,
      rightPanel: { ...state.ui.rightPanel },
      leftPanel: { ...state.ui.leftPanel },
    },
  };
}

// ---- Restore ----

/** Produce a partial AppState from ProjectState for Zustand setState (pure function) */
export function restoreToPartialState(state: ProjectState): Partial<AppState> {
  return {
    groups: state.groups,
    phrases: state.phrases,
    minusWords: state.minusWords,
    selectedGroupIds: new Set(),
    selectedPhraseIds: new Set(),
    activeGroupId: null,
  };
}

// ---- Serialization Helpers ----

/** Clean groups for serialization (remove transient fields) */
function serializeGroups(groups: Group[]): Group[] {
  return groups.map(g => ({
    id: g.id,
    name: g.name,
    parentId: g.parentId,
    color: g.color,
    notes: g.notes,
    isExpanded: g.isExpanded,
    isTrash: g.isTrash,
    createdAt: g.createdAt,
  }));
}

/** Clean phrases for serialization (remove internal fields like _originalGroupId) */
function serializePhrases(phrases: Phrase[]): Phrase[] {
  return phrases.map(p => {
    const clean: Record<string, unknown> = {
      id: p.id,
      text: p.text,
      groupId: p.groupId,
      frequency: p.frequency,
      kei: p.kei,
      cpc: p.cpc,
      competition: p.competition,
      notes: p.notes,
      tags: p.tags,
      createdAt: p.createdAt,
    };
    // Remove undefined values for cleaner JSON
    Object.keys(clean).forEach(key => clean[key] === undefined && delete clean[key]);
    return clean as unknown as Phrase;
  });
}

/** Clean minus-words for serialization */
function serializeMinusWords(minusWords: MinusWord[]): MinusWord[] {
  return minusWords.map(mw => ({
    id: mw.id,
    text: mw.text,
    isExact: mw.isExact,
    groupId: mw.groupId,
    searchType: mw.searchType,
    createdAt: mw.createdAt,
  }));
}

// ---- Snapshot for Rollback ----

/** Create a deep-cloned snapshot of the current app state for rollback */
export function createSnapshot(state: {
  groups: Group[];
  phrases: Phrase[];
  minusWords: MinusWord[];
  activeGroupId: string | null;
  selectedGroupIds: Set<string>;
  selectedPhraseIds: Set<string>;
}): {
  groups: Group[];
  phrases: Phrase[];
  minusWords: MinusWord[];
  activeGroupId: string | null;
  selectedGroupIds: Set<string>;
  selectedPhraseIds: Set<string>;
} {
  return structuredClone(state);
}
