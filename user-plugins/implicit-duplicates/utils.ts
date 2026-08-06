// ============================================================
// Plugin: Implicit Duplicates — main entry for finding duplicates
// ============================================================

import {
  normalize, sortedKey, wordSet, computeSimilarity,
} from './similarity';
import { UnionFind } from './union-find';

export {
  normalize, tokenize, removeStopWords, wordSet, sortedWords,
  sortedKey, jaccardSimilarity, ngrams, diceCoefficient,
  levenshteinDistance, normalizedLevenshtein, computeSimilarity,
} from './similarity';

export interface ImplicitDuplicateGroup {
  groupId: string;
  phrases: Array<{
    id: string;
    text: string;
    frequency?: number;
  }>;
  mainPhrase: {
    id: string;
    text: string;
    frequency?: number;
  };
  avgSimilarity: number;
}

export interface FindDuplicatesOptions {
  threshold: number;
  ignoreStopWords: boolean;
  compareWordOrder: boolean;
  keepHigherFrequency: boolean;
}

export function findImplicitDuplicates(
  phrases: Array<{ id: string; text: string; frequency?: number }>,
  options: FindDuplicatesOptions,
): ImplicitDuplicateGroup[] {
  const thresholdFraction = options.threshold / 100;

  if (phrases.length === 0) return [];

  const normalizedData = phrases.map(p => ({
    id: p.id,
    text: p.text,
    frequency: p.frequency,
    normText: normalize(p.text),
    sortedKeyVal: sortedKey(p.text, options.ignoreStopWords),
    wordSetVal: wordSet(p.text, options.ignoreStopWords),
  }));

  const uf = new UnionFind();

  for (let i = 0; i < normalizedData.length; i++) {
    uf.find(normalizedData[i].id);

    for (let j = i + 1; j < normalizedData.length; j++) {
      const setA = normalizedData[i].wordSetVal;
      const setB = normalizedData[j].wordSetVal;
      let hasOverlap = false;
      for (const w of setA) {
        if (setB.has(w)) { hasOverlap = true; break; }
      }
      if (!hasOverlap) continue;

      const result = computeSimilarity(
        normalizedData[i].text,
        normalizedData[j].text,
        { ignoreStopWords: options.ignoreStopWords, compareWordOrder: options.compareWordOrder },
      );

      if (result.score >= thresholdFraction) {
        uf.union(normalizedData[i].id, normalizedData[j].id);
      }
    }
  }

  const ufGroups = uf.getGroups();
  const phraseById = new Map(phrases.map(p => [p.id, p]));
  const result: ImplicitDuplicateGroup[] = [];

  for (const [, memberIds] of ufGroups) {
    if (memberIds.length < 2) continue;

    const groupPhrases = memberIds.map(id => {
      const p = phraseById.get(id)!;
      return { id: p.id, text: p.text, frequency: p.frequency };
    });

    let mainPhrase: typeof groupPhrases[0];
    if (options.keepHigherFrequency) {
      mainPhrase = groupPhrases.reduce((best, p) =>
        (p.frequency ?? 0) > (best.frequency ?? 0) ? p : best
      , groupPhrases[0]);
    } else {
      mainPhrase = groupPhrases[0];
    }

    let totalSim = 0;
    let count = 0;
    for (const p of groupPhrases) {
      if (p.id === mainPhrase.id) continue;
      const sim = computeSimilarity(mainPhrase.text, p.text, {
        ignoreStopWords: options.ignoreStopWords,
        compareWordOrder: options.compareWordOrder,
      });
      totalSim += sim.score;
      count++;
    }
    const avgSimilarity = count > 0 ? totalSim / count : 1;

    result.push({
      groupId: mainPhrase.id,
      phrases: groupPhrases.sort((a, b) => (b.frequency ?? 0) - (a.frequency ?? 0)),
      mainPhrase,
      avgSimilarity,
    });
  }

  result.sort((a, b) => b.avgSimilarity - a.avgSimilarity);

  return result;
}
