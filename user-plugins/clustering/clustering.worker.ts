// ============================================================
// Clustering Web Worker — Jaccard similarity в отдельном потоке
// ============================================================
//
// v2: Pre-computed word sets — O(N) preprocessing instead of O(N²)
//     + Optimized Jaccard with direct intersection counting
//
// Принимает сообщение: { type: 'CLUSTER', phrases: string[], threshold: number }
// Выполняет алгоритм Жаккара
// Возвращает: { type: 'CLUSTER_RESULT', clusters: string[][], duration: number }
// Возвращает прогресс: { type: 'CLUSTER_PROGRESS', percent: number } каждые 100 итераций
// ============================================================

interface ClusterMessage {
  type: 'CLUSTER';
  phrases: string[];
  threshold: number;
}

interface ClusterResultMessage {
  type: 'CLUSTER_RESULT';
  clusters: string[][];
  duration: number;
}

interface ClusterProgressMessage {
  type: 'CLUSTER_PROGRESS';
  percent: number;
}

// ---- Jaccard Algorithm (в worker) ----

function clusterByJaccardWorker(
  phrases: string[],
  threshold: number,
  onProgress: (percent: number) => void,
): string[][] {
  const clusters: string[][] = [];
  const assigned = new Set<number>();
  const total = phrases.length;
  let iteration = 0;

  // PRE-COMPUTE: split all phrases into word sets once — O(N) instead of O(N²)
  const wordSets: Set<string>[] = new Array(total);
  for (let i = 0; i < total; i++) {
    wordSets[i] = new Set(phrases[i].toLowerCase().split(/\s+/));
  }

  for (let i = 0; i < total; i++) {
    if (assigned.has(i)) continue;

    const wordsA = wordSets[i];
    const clusterPhrases: string[] = [phrases[i]];
    assigned.add(i);

    for (let j = 0; j < total; j++) {
      if (assigned.has(j)) continue;

      const wordsB = wordSets[j];

      // Optimized Jaccard: count intersection directly without creating intermediate arrays
      let intersectionSize = 0;
      for (const w of wordsA) {
        if (wordsB.has(w)) intersectionSize++;
      }
      const unionSize = wordsA.size + wordsB.size - intersectionSize;
      const jaccard = unionSize === 0 ? 0 : intersectionSize / unionSize;

      if (jaccard >= threshold) {
        clusterPhrases.push(phrases[j]);
        assigned.add(j);
      }

      iteration++;
      if (iteration % 100 === 0) {
        onProgress(Math.min(99, Math.round((iteration / (total * total)) * 100)));
      }
    }

    clusters.push(clusterPhrases);
  }

  onProgress(100);
  return clusters;
}

// ---- Worker Message Handler ----

self.onmessage = function (e: MessageEvent<ClusterMessage>) {
  const data = e.data;

  if (data.type === 'CLUSTER') {
    const { phrases, threshold } = data;
    const startTime = performance.now();

    const clusters = clusterByJaccardWorker(phrases, threshold, (percent) => {
      const progressMsg: ClusterProgressMessage = { type: 'CLUSTER_PROGRESS', percent };
      self.postMessage(progressMsg);
    });

    const duration = performance.now() - startTime;

    const resultMsg: ClusterResultMessage = {
      type: 'CLUSTER_RESULT',
      clusters,
      duration,
    };

    self.postMessage(resultMsg);
  } else {
    console.warn('[ClusteringWorker] Unknown message type:', (data as any).type);
  }
};
