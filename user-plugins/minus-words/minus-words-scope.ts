// ============================================================
// Minus Words — list scoping helper
// ============================================================
// 
// The minus-words list is scoped by the "target"/active group:
//  - when a group is active -> show that group's own words + global words,
//  - when nothing is active (global/main folder) -> show every word.
//
// Pure helper, separated for unit-testing.

import type { MinusWord, KCID } from 'plugin-sdk';

export function scopedMinusWords(minusWords: MinusWord[], groupId: KCID | null): MinusWord[] {
  if (groupId == null) return minusWords;
  return minusWords.filter(mw => mw.groupId === groupId || mw.groupId == null);
}