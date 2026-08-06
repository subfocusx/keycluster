import type { KCID, MinusWord, Phrase } from 'plugin-sdk';

function buildBroadMatcher(words: string[]): (text: string) => boolean {
  return (text: string) => words.some(w => text.toLowerCase().includes(w));
}

function checkPhrase(text: string, exact: Set<string>, broadMatcher: ((text: string) => boolean) | null, word: Set<string>): boolean {
  const lower = text.toLowerCase();
  if (exact.size > 0 && exact.has(lower)) return true;
  if (broadMatcher && broadMatcher(text)) return true;
  if (word.size > 0 && word.has(lower)) return true;
  return false;
}

export function matchPhrases(phrases: Phrase[], minusWords: MinusWord[], scopeGroupIds: Set<KCID> | null = null): Phrase[] {
  const globalExact = new Set<string>();
  const globalBroad = new Set<string>();
  const globalWord = new Set<string>();
  const groupExact = new Map<KCID, Set<string>>();
  const groupBroad = new Map<KCID, Set<string>>();
  const groupWord = new Map<KCID, Set<string>>();

  for (const mw of minusWords) {
    const lower = mw.text.toLowerCase();
    if (mw.groupId === null) {
      if (mw.isExact) {
        globalExact.add(lower);
      } else if (mw.searchType === 'broad') {
        globalBroad.add(lower);
      } else {
        globalWord.add(lower);
      }
    } else {
      const eMap = mw.isExact ? groupExact : mw.searchType === 'broad' ? groupBroad : groupWord;
      if (!eMap.has(mw.groupId)) eMap.set(mw.groupId, new Set());
      eMap.get(mw.groupId)!.add(lower);
    }
  }

  const globalBroadMatcher = buildBroadMatcher(Array.from(globalBroad));
  const groupBroadMatchers = new Map<KCID, (text: string) => boolean>();
  for (const [gid, set] of groupBroad) groupBroadMatchers.set(gid, buildBroadMatcher(Array.from(set)));

  return phrases.filter(phrase => {
    if (scopeGroupIds && !scopeGroupIds.has(phrase.groupId)) return false;
    if (checkPhrase(phrase.text, globalExact, globalBroadMatcher, globalWord)) return true;
    const gExact = groupExact.get(phrase.groupId);
    const gBroadMatcher = groupBroadMatchers.get(phrase.groupId) ?? null;
    const gWord = groupWord.get(phrase.groupId);
    if ((gExact?.size ?? 0) + (gBroadMatcher !== null ? 1 : 0) + (gWord?.size ?? 0) > 0) {
      return checkPhrase(phrase.text, gExact ?? new Set(), gBroadMatcher, gWord ?? new Set());
    }
    return false;
  });
}