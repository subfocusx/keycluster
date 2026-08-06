import type { Phrase, Group } from '@/core/types';

export interface ClusterQualityScore {
  score: number;
  reason: string;
  details: {
    avgWordOverlap: number;
    sizeScore: number;
    keywordDiversity: number;
    nameRelevance: number;
  };
}

function extractWords(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^\wа-яё\s-]/gi, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function evaluateCluster(
  phrases: Phrase[],
  clusterName: string,
  allGroups?: Group[],
  allPhrases?: Phrase[],
): ClusterQualityScore {
  if (phrases.length === 0) {
    return { score: 1, reason: 'Пустой кластер', details: { avgWordOverlap: 0, sizeScore: 0, keywordDiversity: 0, nameRelevance: 0 } };
  }

  const wordSets = phrases.map(p => new Set(extractWords(p.text)));
  const nameWords = new Set(extractWords(clusterName));

  let totalSimilarity = 0;
  let comparisons = 0;

  for (let i = 0; i < wordSets.length; i++) {
    for (let j = i + 1; j < wordSets.length; j++) {
      totalSimilarity += jaccardSimilarity(wordSets[i], wordSets[j]);
      comparisons++;
    }
  }

  const avgWordOverlap = comparisons > 0 ? totalSimilarity / comparisons : 0;

  const allClusterWords = new Set<string>();
  for (const ws of wordSets) {
    for (const w of ws) allClusterWords.add(w);
  }
  const keywordDiversity = allClusterWords.size > 0
    ? allClusterWords.size / phrases.length
    : 0;

  let nameRelevance = 0;
  if (nameWords.size > 0) {
    let nameMatches = 0;
    for (const ws of wordSets) {
      for (const nw of nameWords) {
        if (ws.has(nw)) nameMatches++;
      }
    }
    nameRelevance = wordSets.length > 0 ? nameMatches / (nameWords.size * wordSets.length) : 0;
  }

  const sizeScore = Math.min(1, phrases.length / 20);

  const overlapScore = Math.min(1, avgWordOverlap * 3);
  const diversityScore = keywordDiversity < 0.5 ? 1 : Math.max(0, 1 - (keywordDiversity - 0.5) * 2);
  const relevanceScore = nameRelevance;
  const sizeWeight = Math.min(1, phrases.length / 10);

  const rawScore = (
    overlapScore * 0.35 +
    sizeScore * 0.20 +
    diversityScore * 0.25 +
    relevanceScore * 0.20
  );

  const score = Math.max(1, Math.min(5, Math.round(rawScore * 5)));

  const parts: string[] = [];
  if (overlapScore > 0.6) parts.push('связный');
  else if (overlapScore > 0.3) parts.push('умеренно связный');
  else parts.push('низкая связность');

  if (sizeScore > 0.8) parts.push('достаточно фраз');
  else if (phrases.length === 1) parts.push('всего 1 фраза');
  else parts.push('мало фраз');

  if (relevanceScore > 0.3) parts.push('название соответствует');
  else if (nameWords.size > 0) parts.push('название не отражает тематику');

  const reason = score >= 4
    ? `Хороший кластер: ${parts.join(', ')}`
    : score >= 3
      ? `Средний кластер: ${parts.join(', ')}`
      : `Слабый кластер: ${parts.join(', ')}`;

  return {
    score,
    reason,
    details: {
      avgWordOverlap,
      sizeScore,
      keywordDiversity,
      nameRelevance,
    },
  };
}

export function evaluateAllClusters(
  groups: Group[],
  phrases: Phrase[],
): Map<string, ClusterQualityScore> {
  const results = new Map<string, ClusterQualityScore>();
  for (const group of groups) {
    if (group.isTrash) continue;
    const groupPhrases = phrases.filter(p => p.groupId === group.id);
    const quality = evaluateCluster(groupPhrases, group.name, groups, phrases);
    results.set(group.id, quality);
  }
  return results;
}
