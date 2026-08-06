// ============================================================
// Module: TF-IDF — cluster phrases by TF-IDF + cosine similarity
// ============================================================

import type { AppModule, PluginContext, Phrase, KCID } from 'plugin-sdk';
import { useAppStore, simpleLemmatize, DEFAULT_STOP_WORDS } from 'plugin-sdk';
import { TfIdfPanel } from './components';

/** Module-level settings state */
export let tfidfSettings = {
  threshold: 0.3,
  minGroupSize: 2,
};

const tfidfModule: AppModule = {
  manifest: {
    id: 'tfidf',
    name: 'TF-IDF',
    version: '1.0.0',
    description: 'Группировка по TF-IDF + косинусной мере',
    category: 'algorithms',
    dependencies: ['groups', 'phrases'],
    slot: ['ribbon:tools'],
    settingsSchema: [
      { key: 'threshold', type: 'number', label: 'Порог схожести (0-1)', default: 0.3 },
      { key: 'minGroupSize', type: 'number', label: 'Мин. размер группы', default: 2 },
    ],
  },

  init(ctx: PluginContext) {
    const readSettings = () => {
      tfidfSettings = {
        threshold: ctx.getSetting('threshold') as number ?? 0.3,
        minGroupSize: ctx.getSetting('minGroupSize') as number ?? 2,
      };
    };
    readSettings();

    ctx.registerLifecycleHook?.('onSettingsChange', (payload) => {
      if (payload?.moduleId === 'tfidf') {
        readSettings();
      }
    });

    ctx.registerUI({
      slot: 'ribbon:tools',
      label: 'TF-IDF',
      component: () => TfIdfPanel({ ctx }),
      order: 13,
    });

    ctx.registerCommand('run', () => {
      ctx.store.dispatch('setLeftPanel', { open: true, module: 'tfidf' });
    });
    ctx.registerKeybinding?.('ctrl+shift+t', 'run', { label: 'Запустить TF-IDF' });
  },

  destroy() {},
};

export default tfidfModule;

// ---- Helper: generate cluster name ----

function generateTFIDFClusterName(
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
    name = 'TF-IDF кластер';
  }

  existingNames.add(name);
  return name;
}

// ---- Algorithm: cluster by TF-IDF + cosine similarity ----

export function clusterByTFIDF(
  phrases: Phrase[],
  options: { threshold?: number; minGroupSize?: number; stopWords?: string[]; ignoreNumbers?: boolean; lemmatize?: boolean }
): Map<string, Phrase[]> {
  const { threshold = 0.3, minGroupSize = 2, stopWords = [], ignoreNumbers = false, lemmatize = false } = options;
  const stopSet = new Set(stopWords.map(w => w.toLowerCase().trim()));

  // Step 1: Tokenize all phrases
  const tokenize = (text: string): string[] => {
    let words = text.toLowerCase().split(/\s+/);
    if (ignoreNumbers) words = words.filter(w => !/^\d+$/.test(w));
    words = words.filter(w => w.length > 1 && !stopSet.has(w));
    if (lemmatize) words = words.map(w => simpleLemmatize(w));
    return words;
  };

  const docs = phrases.map(p => tokenize(p.text));
  const N = docs.length;

  // Step 2: Compute IDF for each word
  const df = new Map<string, number>(); // document frequency
  for (const doc of docs) {
    const unique = new Set(doc);
    for (const word of unique) {
      df.set(word, (df.get(word) ?? 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [word, freq] of df) {
    idf.set(word, Math.log((N + 1) / (freq + 1)) + 1); // smoothed IDF
  }

  // Step 3: Compute TF-IDF vectors and cosine similarity
  const tfidfOf = (doc: string[]): Map<string, number> => {
    const tf = new Map<string, number>();
    for (const word of doc) {
      tf.set(word, (tf.get(word) ?? 0) + 1);
    }
    const vec = new Map<string, number>();
    for (const [word, count] of tf) {
      vec.set(word, (count / doc.length) * (idf.get(word) ?? 1));
    }
    return vec;
  };

  const cosineSim = (a: Map<string, number>, b: Map<string, number>): number => {
    let dot = 0, normA = 0, normB = 0;
    for (const [key, val] of a) {
      dot += val * (b.get(key) ?? 0);
      normA += val * val;
    }
    for (const [, val] of b) normB += val * val;
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0;
  };

  const vectors = docs.map(d => tfidfOf(d));

  // Step 4: Build inverted index (word → document indices) — reduces O(N²) to O(N×avg_shared)
  const invertedIndex = new Map<string, Set<number>>();
  for (let i = 0; i < docs.length; i++) {
    const uniqueWords = new Set(docs[i]);
    if (uniqueWords.size === 0) continue;
    for (const word of uniqueWords) {
      if (!invertedIndex.has(word)) invertedIndex.set(word, new Set());
      invertedIndex.get(word)!.add(i);
    }
  }

  // Step 5: Cluster using greedy first-match with candidate filtering
  const assigned = new Set<KCID>();
  const clusters = new Map<string, Phrase[]>();
  const existingNames = new Set<string>();
  const MIN_CANDIDATES = Math.min(50, Math.max(10, Math.floor(phrases.length * 0.1)));

  for (let i = 0; i < phrases.length; i++) {
    if (assigned.has(phrases[i].id)) continue;
    const clusterPhrases = [phrases[i]];
    assigned.add(phrases[i].id);

    // Collect candidate indices from inverted index (docs sharing ≥1 word)
    const candidateSet = new Set<number>();
    const uniqueWords = new Set(docs[i]);
    for (const word of uniqueWords) {
      const idxSet = invertedIndex.get(word);
      if (idxSet) {
        for (const idx of idxSet) {
          if (!assigned.has(phrases[idx].id)) candidateSet.add(idx);
        }
      }
    }

    let candidates = Array.from(candidateSet);
    // Fallback: if too few candidates (short/unique phrase), sample unassigned pool
    if (candidates.length < MIN_CANDIDATES) {
      for (let k = 0; k < phrases.length && candidates.length < MIN_CANDIDATES; k++) {
        if (!assigned.has(phrases[k].id) && !candidateSet.has(k)) {
          candidates.push(k);
        }
      }
    }

    for (const j of candidates) {
      const sim = cosineSim(vectors[i], vectors[j]);
      if (sim >= threshold) {
        clusterPhrases.push(phrases[j]);
        assigned.add(phrases[j].id);
      }
    }

    const name = generateTFIDFClusterName(clusterPhrases, existingNames);
    const existing = clusters.get(name);
    if (existing) clusters.set(name, [...existing, ...clusterPhrases]);
    else clusters.set(name, clusterPhrases);
  }

  const filtered = new Map<string, Phrase[]>();
  for (const [name, p] of clusters) {
    if (p.length >= minGroupSize) filtered.set(name, p);
  }
  return filtered;
}