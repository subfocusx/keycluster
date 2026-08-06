// ============================================================
// ClusteringWorkerBridge — async/await обёртка для Web Worker
// ============================================================
//
// Создаёт Worker из clustering.worker.ts через new URL + import.meta.url
// Предоставляет Promise-based интерфейс:
//   cluster(phrases, threshold, onProgress?) → Promise<string[][]>
//   terminate() — остановить Worker
//
// Использует MessageChannel для корректной маршрутизации ответов
// ============================================================

interface ClusterResult {
  clusters: string[][];
  duration: number;
}

export class ClusteringWorkerBridge {
  private worker: Worker | null = null;
  private pendingResolve: ((result: ClusterResult) => void) | null = null;
  private pendingReject: ((error: Error) => void) | null = null;
  private onProgressCallback: ((percent: number) => void) | null = null;

  constructor() {
    // Next.js 14+ + webpack 5 поддерживают Worker через new URL
    this.worker = new Worker(
      new URL('./clustering.worker.ts', import.meta.url),
      { type: 'module' },
    );

    this.worker.onmessage = (e: MessageEvent) => {
      const data = e.data;

      if (data.type === 'CLUSTER_RESULT') {
        if (this.pendingResolve) {
          this.pendingResolve({
            clusters: data.clusters,
            duration: data.duration,
          });
          this.pendingResolve = null;
          this.pendingReject = null;
        }
      } else if (data.type === 'CLUSTER_PROGRESS') {
        if (this.onProgressCallback) {
          this.onProgressCallback(data.percent);
        }
      }
    };

    this.worker.onerror = (e: ErrorEvent) => {
      if (this.pendingReject) {
        this.pendingReject(new Error(`Worker error: ${e.message}`));
        this.pendingResolve = null;
        this.pendingReject = null;
      }
    };
  }

  /**
   * Запустить кластеризацию в Worker.
   * Возвращает Promise с результатом.
   *
   * @param phrases — массив текстов фраз для кластеризации
   * @param threshold — порог Жаккара (0..1)
   * @param onProgress — колбэк прогресса (0..100%)
   */
  async cluster(
    phrases: string[],
    threshold: number,
    onProgress?: (percent: number) => void,
  ): Promise<ClusterResult> {
    if (!this.worker) {
      throw new Error('Worker is terminated');
    }
    if (this.pendingResolve) {
      throw new Error('Worker is busy. Call terminate() or wait for completion first.');
    }

    this.onProgressCallback = onProgress ?? null;

    return new Promise<ClusterResult>((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;

      this.worker!.postMessage({
        type: 'CLUSTER',
        phrases,
        threshold,
      });
    });
  }

  /**
   * Остановить Worker и освободить ресурсы.
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    if (this.pendingReject) {
      this.pendingReject(new Error('Worker terminated'));
      this.pendingResolve = null;
      this.pendingReject = null;
    }
  }
}
