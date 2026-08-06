// ============================================================
// Module: Clustering — by words + Jaccard similarity (Web Worker)
// ============================================================
//
// v4: Pre-computed preprocessing (O(N) instead of O(N²))
//     + Optimized Jaccard with early exit
// ============================================================

import type { AppModule, PluginContext, Phrase, KCID } from 'plugin-sdk';
import { ClusteringPanel } from './components';
import { useAppStore, preprocessPhrase, simpleLemmatize, DEFAULT_STOP_WORDS } from 'plugin-sdk';
import { terminateWorker } from './worker-manager';

/** Module-level settings state — updated on init and onSettingsChange */
let _clusteringSettings = {
  threshold: 0.3,
  minClusterSize: 2,
};

export const getClusteringSettings = () => ({ ..._clusteringSettings });

const clusteringModule: AppModule = {
  manifest: {
    id: 'clustering',
    name: 'Кластеризация',
    version: '4.0.0',
    description: 'Группировка фраз по словам и по составу (Jaccard в Web Worker) с предобработкой',
    category: 'algorithms',
    dependencies: ['groups', 'phrases'],
    slot: ['ribbon:tools', 'left-panel'],
    settingsSchema: [
      { key: 'threshold', type: 'number', label: 'Порог схожести (0-1)', default: 0.3 },
      { key: 'minClusterSize', type: 'number', label: 'Мин. размер кластера', default: 2 },
    ],
  },

  init(ctx: PluginContext) {
    // Read initial settings
    const readSettings = () => {
      _clusteringSettings = {
        threshold: ctx.getSetting('threshold') as number ?? 0.3,
        minClusterSize: ctx.getSetting('minClusterSize') as number ?? 2,
      };
    };
    readSettings();

    // Subscribe to settings changes
    ctx.registerLifecycleHook?.('onSettingsChange', (payload) => {
      if (payload?.moduleId === 'clustering') {
        readSettings();
      }
    });

    ctx.registerUI({
      slot: 'ribbon:tools',
      label: 'Кластеризация',
      component: () => ClusteringPanel({ ctx }),
      order: 10,
    });

    // Register commands + keybindings
    ctx.registerCommand('run', () => {
      ctx.store.dispatch('setLeftPanel', { open: true, module: 'clustering' });
    });
    ctx.registerKeybinding?.('ctrl+shift+c', 'run', { label: 'Запустить кластеризацию' });
  },

  destroy() {
    terminateWorker();
  },
};

export default clusteringModule;

// ---- Clustering Algorithms ----

/**
 * Generate a descriptive name for a cluster.
 * Uses the top 2 most frequent meaningful words in the cluster.
 */
export function generateClusterName(
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
    name = 'Кластер';
  }

  existingNames.add(name);
  return name;
}

/** Extended options for clusterByWords */
export interface ClusterByWordsOptions {
  lemmatize?: boolean;
  ignoreNumbers?: boolean;
  synonyms?: Map<string, string>;
  stopWords?: Set<string>;
  scanMode?: 'narrow-to-wide' | 'wide-to-narrow';
  splitByStrength?: boolean;
}

export function clusterByWords(
  phrases: Phrase[],
  minCommonWords: number,
  preprocessingOptions: ClusterByWordsOptions = {},
): Map<string, Phrase[]> {
  const {
    lemmatize = false,
    ignoreNumbers = false,
    synonyms,
    stopWords,
    scanMode = 'narrow-to-wide',
    splitByStrength = false,
  } = preprocessingOptions;

  const clusters = new Map<string, Phrase[]>();
  const assigned = new Set<KCID>();
  const existingNames = new Set<string>();

  // PRE-COMPUTE: process all phrases once — O(N) instead of O(N²)
  const opts = { lemmatize, ignoreNumbers, synonyms, stopWords };
  const processedMap = new Map<KCID, Set<string>>();
  for (const phrase of phrases) {
    processedMap.set(phrase.id, new Set(preprocessPhrase(phrase.text, opts)));
  }

  // Sort phrases based on scan mode
  let sortedPhrases = [...phrases];
  if (scanMode === 'wide-to-narrow') {
    sortedPhrases.sort((a, b) => a.text.split(/\s+/).length - b.text.split(/\s+/).length);
  }

  // Strong threshold for split-by-strength
  const strongThreshold = splitByStrength ? minCommonWords * 2 : minCommonWords;

  for (const phrase of sortedPhrases) {
    if (assigned.has(phrase.id)) continue;

    const words = processedMap.get(phrase.id)!;
    const clusterPhrases = [phrase];
    assigned.add(phrase.id);

    for (const other of sortedPhrases) {
      if (assigned.has(other.id)) continue;
      const otherWords = processedMap.get(other.id)!;
      let commonCount = 0;
      for (const w of words) {
        if (otherWords.has(w)) commonCount++;
      }

      if (splitByStrength) {
        if (commonCount >= strongThreshold) {
          clusterPhrases.push(other);
          assigned.add(other.id);
        }
      } else {
        if (commonCount >= minCommonWords) {
          clusterPhrases.push(other);
          assigned.add(other.id);
        }
      }
    }

    const clusterKey = generateClusterName(clusterPhrases, existingNames);
    let uniqueKey = clusterKey;
    let suffix = 2;
    while (clusters.has(uniqueKey)) {
      uniqueKey = `${clusterKey} (${suffix})`;
      suffix++;
    }
    clusters.set(uniqueKey, clusterPhrases);
  }

  return clusters;
}

/** Extended options for clusterByJaccard */
export interface ClusterByJaccardOptions {
  lemmatize?: boolean;
  ignoreNumbers?: boolean;
  synonyms?: Map<string, string>;
  stopWords?: Set<string>;
  scanMode?: 'narrow-to-wide' | 'wide-to-narrow';
  splitByStrength?: boolean;
}

export function clusterByJaccard(
  phrases: Phrase[],
  threshold: number,
  preprocessingOptions: ClusterByJaccardOptions = {},
): Map<string, Phrase[]> {
  const {
    lemmatize = false,
    ignoreNumbers = false,
    synonyms,
    stopWords,
    scanMode = 'narrow-to-wide',
    splitByStrength = false,
  } = preprocessingOptions;

  const clusters = new Map<string, Phrase[]>();
  const assigned = new Set<KCID>();
  const existingNames = new Set<string>();

  // PRE-COMPUTE: process all phrases once — O(N) instead of O(N²)
  const opts = { lemmatize, ignoreNumbers, synonyms, stopWords };
  const processedSets = new Map<KCID, Set<string>>();
  for (const phrase of phrases) {
    processedSets.set(phrase.id, new Set(preprocessPhrase(phrase.text, opts)));
  }

  // Sort phrases based on scan mode
  let sortedPhrases = [...phrases];
  if (scanMode === 'wide-to-narrow') {
    sortedPhrases.sort((a, b) => a.text.split(/\s+/).length - b.text.split(/\s+/).length);
  }

  // Strong threshold for split-by-strength
  const effectiveThreshold = splitByStrength ? Math.min(1, threshold * 2) : threshold;

  for (const phrase of sortedPhrases) {
    if (assigned.has(phrase.id)) continue;

    const wordsA = processedSets.get(phrase.id)!;
    const clusterPhrases = [phrase];
    assigned.add(phrase.id);

    for (const other of sortedPhrases) {
      if (assigned.has(other.id)) continue;
      const wordsB = processedSets.get(other.id)!;

      // Optimized Jaccard: iterate over smaller set + early exit
      const [smaller, larger] = wordsA.size <= wordsB.size ? [wordsA, wordsB] : [wordsB, wordsA];
      const maxPossible = smaller.size / (wordsA.size + wordsB.size - smaller.size);
      if (maxPossible < effectiveThreshold) continue;

      let intersectionSize = 0;
      for (const w of smaller) {
        if (larger.has(w)) intersectionSize++;
      }
      const unionSize = wordsA.size + wordsB.size - intersectionSize;
      const jaccard = unionSize > 0 ? intersectionSize / unionSize : 0;

      if (jaccard >= effectiveThreshold) {
        clusterPhrases.push(other);
        assigned.add(other.id);
      }
    }

    const clusterKey = generateClusterName(clusterPhrases, existingNames);
    let uniqueKey = clusterKey;
    let suffix = 2;
    while (clusters.has(uniqueKey)) {
      uniqueKey = `${clusterKey} (${suffix})`;
      suffix++;
    }
    clusters.set(uniqueKey, clusterPhrases);
  }

  return clusters;
}
