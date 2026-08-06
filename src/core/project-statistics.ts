// ============================================================
// Project statistics — pure computation helpers
// ============================================================

import type { Group, Phrase, MinusWord, MinusWordGroup, KCID } from './types';

export interface GroupPhraseStat {
  groupId: KCID;
  name: string;
  count: number;
}

export interface ProjectStats {
  phraseCount: number;
  groupCount: number;
  minusWordCount: number;
  minusWordGroupCount: number;
  starredCount: number;
  trashCount: number;
  emptyGroupCount: number;
  avgPhraseLength: number;
  maxPhraseLength: number;
  minPhraseLength: number;
  totalChars: number;
  topGroups: GroupPhraseStat[];
  minusByType: { exact: number; broad: number; word: number };
  minusGlobal: number;
  minusScoped: number;
}

export interface PhraseStats {
  text: string;
  length: number;
  wordCount: number;
  frequency?: number;
  kei?: number;
  cpc?: number;
  starred: boolean;
  groupName: string;
}

export function computeProjectStats(
  groups: Group[],
  phrases: Phrase[],
  minusWords: MinusWord[],
  minusWordGroups: MinusWordGroup[],
): ProjectStats {
  const nonTrashGroups = groups.filter(g => !g.isTrash);
  const trashGroup = groups.find(g => g.isTrash);

  const countByGroup = new Map<KCID, number>();
  for (const p of phrases) {
    if (trashGroup && p.groupId === trashGroup.id) continue;
    countByGroup.set(p.groupId, (countByGroup.get(p.groupId) ?? 0) + 1);
  }

  const lengths = phrases
    .filter(p => !trashGroup || p.groupId !== trashGroup.id)
    .map(p => p.text.length);

  const topGroups: GroupPhraseStat[] = nonTrashGroups
    .map(g => ({ groupId: g.id, name: g.name, count: countByGroup.get(g.id) ?? 0 }))
    .filter(g => g.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const emptyGroupCount = nonTrashGroups.filter(g => (countByGroup.get(g.id) ?? 0) === 0).length;

  let exact = 0, broad = 0, word = 0, minusGlobal = 0, minusScoped = 0;
  for (const mw of minusWords) {
    if (mw.isExact) exact++;
    else if (mw.searchType === 'broad') broad++;
    else word++;
    if (mw.groupId === null) minusGlobal++;
    else minusScoped++;
  }

  const totalChars = lengths.reduce((a, b) => a + b, 0);
  const phraseCount = lengths.length;

  return {
    phraseCount,
    groupCount: nonTrashGroups.length,
    minusWordCount: minusWords.length,
    minusWordGroupCount: minusWordGroups.length,
    starredCount: phrases.filter(p => !!p.starredAt && (!trashGroup || p.groupId !== trashGroup.id)).length,
    trashCount: trashGroup ? phrases.filter(p => p.groupId === trashGroup.id).length : 0,
    emptyGroupCount,
    avgPhraseLength: phraseCount > 0 ? Math.round(totalChars / phraseCount) : 0,
    maxPhraseLength: phraseCount > 0 ? Math.max(...lengths) : 0,
    minPhraseLength: phraseCount > 0 ? Math.min(...lengths) : 0,
    totalChars,
    topGroups,
    minusByType: { exact, broad, word },
    minusGlobal,
    minusScoped,
  };
}

export function computePhraseStats(phrase: Phrase, groupName: string): PhraseStats {
  const words = phrase.text.trim().split(/\s+/).filter(Boolean);
  return {
    text: phrase.text,
    length: phrase.text.length,
    wordCount: words.length,
    frequency: phrase.frequency,
    kei: phrase.kei,
    cpc: phrase.cpc,
    starred: !!phrase.starredAt,
    groupName,
  };
}
