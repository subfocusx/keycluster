import type { KCID, MinusWord, Phrase, Group } from 'plugin-sdk';
import { matchPhrasesByMinusWords } from 'plugin-sdk';

// ============================================================
// Minus Words — matcher (thin wrapper over the core matcher)
// ============================================================
//
// The core (src/core/store/minusWordSlice.ts) owns the matching rules:
//   exact           — full text equality
//   broad           — substring match
//   broad_modified  — whole-word match
// A group-bound word applies to the group and all of its descendants.
// The panel preview and the actual apply use the same code, so the
// number of "совпадения" always equals the number of phrases removed.
// ============================================================

export function matchPhrases(
  phrases: Phrase[],
  minusWords: MinusWord[],
  scopeGroupIds: Set<KCID> | null = null,
  groups: Group[] = [],
): Phrase[] {
  return matchPhrasesByMinusWords(phrases, minusWords, groups, scopeGroupIds);
}
