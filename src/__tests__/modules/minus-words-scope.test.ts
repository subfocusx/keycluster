// ============================================================
// Tests: Minus Words Scope — list scoping helper
// ============================================================
//
// scopedMinusWords(minusWords, groupId):
//  - groupId == null -> all words (main folder / global view)
//  - groupId set     -> only that group's words + global words
// ============================================================

import { describe, it, expect } from 'vitest';
import { scopedMinusWords } from '@user-plugins/minus-words/minus-words-scope';
import type { MinusWord } from '@/plugin-sdk';

function makeMw(text: string, groupId: string | null): MinusWord {
  return {
    id: 'mw-' + text,
    text,
    isExact: false,
    searchType: 'broad' as const,
    groupId,
    createdAt: Date.now(),
  };
}

const globalA = makeMw('куплю', null);
const globalB = makeMw('дешево', null);
const groupA = makeMw('срочно', 'g1');
const groupB = makeMw('москва', 'g2');

describe('scopedMinusWords', () => {
  it('returns all words when no group is active (main folder)', () => {
    const result = scopedMinusWords([globalA, groupA, groupB], null);
    expect(result).toHaveLength(3);
  });

  it('returns only the group words plus global words when a group is active', () => {
    const result = scopedMinusWords([globalA, globalB, groupA, groupB], 'g1');
    expect(result.map(mw => mw.text)).toEqual(['куплю', 'дешево', 'срочно']);
  });

  it('excludes words bound to other groups', () => {
    const result = scopedMinusWords([groupA, groupB], 'g1');
    expect(result.map(mw => mw.text)).toEqual(['срочно']);
  });

  it('returns empty array when nothing matches the group', () => {
    const result = scopedMinusWords([groupB], 'g1');
    expect(result).toEqual([]);
  });
});
