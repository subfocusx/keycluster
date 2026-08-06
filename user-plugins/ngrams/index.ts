// ============================================================
// Module: N-grams — cluster phrases by N-gram overlap
// ============================================================
//
// v2: Pre-computed N-gram sets — O(N) preprocessing instead of O(N²)

import type { AppModule, PluginContext, Phrase, KCID } from 'plugin-sdk';
import { useAppStore, simpleLemmatize, DEFAULT_STOP_WORDS } from 'plugin-sdk';
import { NgramsPanel } from './components';

/** Module-level settings state */
export let ngramsSettings = {
  ngramSize: 2,
  threshold: 0.3,
  minGroupSize: 2,
};

const ngramsModule: AppModule = {
  manifest: {
    id: 'ngrams',
    name: 'N-граммы',
    version: '2.0.0',
    description: 'Группировка фраз по N-граммам (биграммам, триграммам)',
    category: 'algorithms',
    dependencies: ['groups', 'phrases'],
    slot: ['ribbon:tools'],
    settingsSchema: [
      { key: 'ngramSize', type: 'number', label: 'Размер N-граммы', default: 2 },
      { key: 'threshold', type: 'number', label: 'Порог схожести (0-1)', default: 0.3 },
      { key: 'minGroupSize', type: 'number', label: 'Мин. размер группы', default: 2 },
    ],
  },

  init(ctx: PluginContext) {
    const readSettings = () => {
      ngramsSettings = {
        ngramSize: ctx.getSetting('ngramSize') as number ?? 2,
        threshold: ctx.getSetting('threshold') as number ?? 0.3,
        minGroupSize: ctx.getSetting('minGroupSize') as number ?? 2,
      };
    };
    readSettings();

    ctx.registerLifecycleHook?.('onSettingsChange', (payload) => {
      if (payload?.moduleId === 'ngrams') {
        readSettings();
      }
    });

    ctx.registerUI({
      slot: 'ribbon:tools',
      label: 'N-граммы',
      component: () => NgramsPanel({ ctx }),
      order: 12,
    });

    ctx.registerCommand('run', () => {
      ctx.store.dispatch('setLeftPanel', { open: true, module: 'ngrams' });
    });
    ctx.registerKeybinding?.('ctrl+shift+n', 'run', { label: 'Запустить N-граммы' });
  },

  destroy() {},
};

export default ngramsModule;

// ---- Helper: generate cluster name from top N-grams ----

function generateNgramClusterName(
  clusterPhrases: Phrase[],
  existingNames: Set<string>,
): string {
  const wordCounts = new Map<string, number>();
  const stopWords = new Set([
    'в', 'на', 'с', 'и', 'по', 'из', 'за', 'к', 'у', 'о', 'от',
    'для', 'как', 'не', 'но', 'а', 'это', 'то', 'все', 'он', 'она',
  ]);

  for (const p of clusterPhrases) {
    for (const w of p.text.toLowerCase().split(/\s+/)) {
      if (w.length > 1 && !stopWords.has(w)) {
        wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1);
      }
    }
  }

  const sortedWords = [...wordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w);

  let name: string;
  if (sortedWords.length >= 2) {
    name = sortedWords.slice(0, 2).join(' ');
  } else if (sortedWords.length === 1) {
    name = sortedWords[0];
  } else {
    name = 'N-грамма';
  }

  existingNames.add(name);
  return name;
}

// ---- Algorithm: cluster by N-grams ----

export function clusterByNgrams(
  phrases: Phrase[],
  options: { ngramSize?: number; threshold?: number; minGroupSize?: number; stopWords?: string[]; ignoreNumbers?: boolean; lemmatize?: boolean }
): Map<string, Phrase[]> {
  const { ngramSize = 2, threshold = 0.3, minGroupSize = 2, stopWords = [], ignoreNumbers = false, lemmatize = false } = options;
  const stopSet = new Set(stopWords.map(w => w.toLowerCase().trim()));

  // Helper: extract n-grams from a phrase
  const getNgrams = (text: string): Set<string> => {
    let words = text.toLowerCase().split(/\s+/);
    if (ignoreNumbers) words = words.filter(w => !/^\d+$/.test(w));
    words = words.filter(w => w.length > 1 && !stopSet.has(w));
    if (lemmatize) words = words.map(w => simpleLemmatize(w));

    const ngrams = new Set<string>();
    if (words.length < ngramSize) {
      ngrams.add(words.join(' '));
      return ngrams;
    }
    for (let i = 0; i <= words.length - ngramSize; i++) {
      ngrams.add(words.slice(i, i + ngramSize).join(' '));
    }
    return ngrams;
  };

  // PRE-COMPUTE: extract N-grams for all phrases once — O(N) instead of O(N²)
  const ngramSets = new Map<KCID, Set<string>>();
  // Also build inverted index: ngram → Set of phrase IDs containing it
  const invertedIndex = new Map<string, Set<KCID>>();
  // Phrase lookup by ID
  const phraseById = new Map<KCID, Phrase>();
  for (const phrase of phrases) {
    const ngrams = getNgrams(phrase.text);
    ngramSets.set(phrase.id, ngrams);
    phraseById.set(phrase.id, phrase);
    for (const ngram of ngrams) {
      let bucket = invertedIndex.get(ngram);
      if (!bucket) {
        bucket = new Set<KCID>();
        invertedIndex.set(ngram, bucket);
      }
      bucket.add(phrase.id);
    }
  }

  const assigned = new Set<KCID>();
  const clusters = new Map<string, Phrase[]>();
  const existingNames = new Set<string>();

  for (const phrase of phrases) {
    if (assigned.has(phrase.id)) continue;
    const ngramsA = ngramSets.get(phrase.id)!;
    const clusterPhrases = [phrase];
    assigned.add(phrase.id);

    // Use inverted index to find candidate phrases (sharing at least 1 n-gram)
    const candidateIds = new Set<KCID>();
    for (const ngram of ngramsA) {
      const bucket = invertedIndex.get(ngram);
      if (bucket) {
        for (const id of bucket) {
          if (!assigned.has(id) && id !== phrase.id) {
            candidateIds.add(id);
          }
        }
      }
    }

    // Only compare against candidates, not all phrases
    for (const otherId of candidateIds) {
      if (assigned.has(otherId)) continue;
      const ngramsB = ngramSets.get(otherId)!;

      // Iterate over smaller set
      const [smaller, larger] = ngramsA.size <= ngramsB.size ? [ngramsA, ngramsB] : [ngramsB, ngramsA];
      const maxPossible = smaller.size / (ngramsA.size + ngramsB.size - smaller.size);
      if (maxPossible < threshold) continue;

      let intersectionSize = 0;
      for (const n of smaller) {
        if (larger.has(n)) intersectionSize++;
      }
      const unionSize = ngramsA.size + ngramsB.size - intersectionSize;
      const similarity = unionSize > 0 ? intersectionSize / unionSize : 0;

      if (similarity >= threshold) {
        const otherPhrase = phraseById.get(otherId);
        if (otherPhrase) {
          clusterPhrases.push(otherPhrase);
          assigned.add(otherId);
        }
      }
    }

    const name = generateNgramClusterName(clusterPhrases, existingNames);
    const existing = clusters.get(name);
    if (existing) clusters.set(name, [...existing, ...clusterPhrases]);
    else clusters.set(name, clusterPhrases);
  }

  // Filter by min group size
  const filtered = new Map<string, Phrase[]>();
  for (const [name, p] of clusters) {
    if (p.length >= minGroupSize) filtered.set(name, p);
  }
  return filtered;
}