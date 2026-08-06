import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { AppModule } from 'plugin-sdk';
import { useAppStore, AppEvents, LogStore, Progress, useActiveGroupIds } from 'plugin-sdk';
import type { PluginContext, Phrase, KCID } from 'plugin-sdk';
import { ClusteringSettings } from './clustering-settings';
import { PreviewDialog } from './clustering-preview-dialog';
import { HistoryDialog } from './clustering-history-dialog';
import { loadHistory, saveHistory } from './clustering-history';
import type { ClusterHistoryEntry } from './clustering-history';
import { clusterByJaccard, clusterByWords, getClusteringSettings, generateClusterName } from './index';
import { getWorkerBridge, terminateWorker } from './worker-manager';

function MIcon({ name, className = '', style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}

// Worker bridge managed in ./worker-manager

const isWorkerAvailable = typeof window !== 'undefined' && typeof Worker !== 'undefined';

export function ClusteringPanel({ ctx }: { ctx: PluginContext }) {
  useEffect(() => {
    return () => {
      terminateWorker();
    };
  }, []);

  const [algorithm, setAlgorithm] = useState<'words' | 'jaccard'>('words');
  const [strength, setStrength] = useState(50);
  const [minGroupSize, setMinGroupSize] = useState(getClusteringSettings().minClusterSize);
  const [results, setResults] = useState<Map<string, any[]> | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [appliedCount, setAppliedCount] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewResults, setPreviewResults] = useState<Map<string, Phrase[]> | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [compareEntry, setCompareEntry] = useState<ClusterHistoryEntry | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [compareEntry2, setCompareEntry2] = useState<ClusterHistoryEntry | null>(null);

  const [lemmatize, setLemmatize] = useState(false);
  const [ignoreNumbers, setIgnoreNumbers] = useState(false);
  const [synonymsText, setSynonymsText] = useState('');
  const [stopWordsText, setStopWordsText] = useState('');
  const [scanMode, setScanMode] = useState<'narrow-to-wide' | 'wide-to-narrow'>('narrow-to-wide');
  const [splitByStrength, setSplitByStrength] = useState(false);

  const phrases = useAppStore(s => s.phrases);
  const activeGroupIds = useActiveGroupIds();

  const sourcePhrases = useMemo(
    () => activeGroupIds.size < phrases.length
      ? phrases.filter(p => activeGroupIds.has(p.groupId))
      : phrases,
    [phrases, activeGroupIds]
  );

  const parseSynonyms = useCallback((): Map<string, string> => {
    const map = new Map<string, string>();
    if (!synonymsText.trim()) return map;
    for (const line of synonymsText.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim().toLowerCase();
        const value = trimmed.slice(eqIndex + 1).trim().toLowerCase();
        if (key && value) map.set(key, value);
      }
    }
    return map;
  }, [synonymsText]);

  const parseStopWords = useCallback((): Set<string> => {
    const words = stopWordsText
      .split(',')
      .map(w => w.trim().toLowerCase())
      .filter(Boolean);
    return new Set(words.length > 0 ? words : []);
  }, [stopWordsText]);

  const handleCluster = useCallback(async () => {
    if (sourcePhrases.length === 0) return;
    setIsRunning(true);
    setProgress(0);
    setDuration(null);

    const synonyms = parseSynonyms();
    const stopWords = parseStopWords();
    const preprocessingOpts = { lemmatize, ignoreNumbers, synonyms, stopWords, scanMode, splitByStrength };

    try {
      let clusters: Map<string, any[]>;
      let localDuration: number | null = null;

      if (algorithm === 'words') {
        const minCommon = Math.max(1, Math.round(strength / 25));
        clusters = clusterByWords(sourcePhrases, minCommon, preprocessingOpts);
        setProgress(100);
      } else if (algorithm === 'jaccard' && isWorkerAvailable) {
        const threshold = getClusteringSettings().threshold;
        const phraseTexts = sourcePhrases.map(p => p.text);
        const bridge = getWorkerBridge();
        const result = await bridge.cluster(phraseTexts, threshold, (p) => { setProgress(p); });
        clusters = new Map();
        const phraseMap = new Map(sourcePhrases.map(p => [p.text, p]));
        const existingNames = new Set<string>();
        for (const group of result.clusters) {
          const clusterPhrases = group
            .map(text => phraseMap.get(text))
            .filter((p): p is any => p != null);
          if (clusterPhrases.length > 0) {
            const clusterKey = generateClusterName(clusterPhrases, existingNames);
            const existing = clusters.get(clusterKey);
            if (existing) {
              clusters.set(clusterKey, [...existing, ...clusterPhrases]);
            } else {
              clusters.set(clusterKey, clusterPhrases);
            }
          }
        }
        localDuration = result.duration;
        setDuration(localDuration);
      } else {
        const threshold = 0.2 + (strength / 100) * 0.6;
        clusters = clusterByJaccard(sourcePhrases, threshold, preprocessingOpts);
        setProgress(100);
      }

      const filtered = new Map<string, any[]>();
      for (const [key, val] of clusters) {
        if (val.length >= minGroupSize) {
          filtered.set(key, val);
        }
      }

      setResults(filtered);
      ctx.store.dispatch('setClusteringResults', filtered);
      if (filtered.size > 0) {
        ctx.store.dispatch('applyClusteringResults');
        ctx.eventBus.emit(AppEvents.GROUPS_CHANGED);
        ctx.eventBus.emit(AppEvents.PHRASES_CHANGED);
        setAppliedCount(filtered.size);
        LogStore._log('info', 'clustering', `Clustering complete: ${filtered.size} groups from ${sourcePhrases.length} phrases`, { algorithm, groups: filtered.size, totalPhrases: sourcePhrases.length });
      }

      const assignedMap = new Map<string, Phrase[]>();
      for (const [name, val] of filtered) {
        assignedMap.set(name, val);
      }
      const assignedPhrases = new Set<string>();
      const historyPhrases: Array<{ text: string; group: string }> = [];
      for (const [name, val] of assignedMap) {
        for (const p of val) {
          assignedPhrases.add(p.text);
          historyPhrases.push({ text: p.text, group: name });
        }
      }
      for (const p of sourcePhrases) {
        if (!assignedPhrases.has(p.text)) {
          historyPhrases.push({ text: p.text, group: '' });
        }
      }
      saveHistory({
        id: Date.now().toString(36),
        timestamp: Date.now(),
        algorithm,
        strength,
        minGroupSize,
        groupCount: filtered.size,
        totalPhrases: sourcePhrases.length,
        durationMs: localDuration ?? 0,
        groups: Array.from(assignedMap.entries()).map(([name, val]) => ({ name, count: val.length })),
        phrases: historyPhrases,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'Worker terminated') {
        LogStore._log('info', 'clustering', `Clustering cancelled (worker terminated)`, { algorithm });
        return;
      }
      LogStore._log('error', 'clustering', `Clustering failed, falling back to Jaccard: ${msg}`, { algorithm, error: msg });
      const threshold = getClusteringSettings().threshold;
      const synonyms2 = parseSynonyms();
      const stopWords2 = parseStopWords();
      const preprocessingOpts2 = { lemmatize, ignoreNumbers, synonyms: synonyms2, stopWords: stopWords2, scanMode, splitByStrength };
      const clusters2 = clusterByJaccard(sourcePhrases, threshold, preprocessingOpts2);
      const filtered2 = new Map<string, any[]>();
      for (const [key, val] of clusters2) {
        if (val.length >= minGroupSize) filtered2.set(key, val);
      }
      LogStore._log('warn', 'clustering', `Fallback Jaccard completed: ${filtered2.size} groups`, { algorithm: 'jaccard (fallback)', groups: filtered2.size });
      setResults(filtered2);
      ctx.store.dispatch('setClusteringResults', filtered2);
      if (filtered2.size > 0) {
        ctx.store.dispatch('applyClusteringResults');
        ctx.eventBus.emit(AppEvents.GROUPS_CHANGED);
        ctx.eventBus.emit(AppEvents.PHRASES_CHANGED);
        setAppliedCount(filtered2.size);
      }
      const fallbackPhrases: Array<{ text: string; group: string }> = [];
      for (const [name, val] of filtered2) {
        for (const p of val) fallbackPhrases.push({ text: p.text, group: name });
      }
      const assignedSet = new Set(fallbackPhrases.map(p => p.text));
      for (const p of sourcePhrases) {
        if (!assignedSet.has(p.text)) fallbackPhrases.push({ text: p.text, group: '' });
      }
      saveHistory({
        id: Date.now().toString(36),
        timestamp: Date.now(),
        algorithm,
        strength,
        minGroupSize,
        groupCount: filtered2.size,
        totalPhrases: sourcePhrases.length,
        durationMs: 0,
        groups: Array.from(filtered2.entries()).map(([name, val]) => ({ name, count: val.length })),
        phrases: fallbackPhrases,
      });
    } finally {
      setIsRunning(false);
    }
  }, [algorithm, strength, minGroupSize, sourcePhrases, lemmatize, ignoreNumbers, synonymsText, stopWordsText, scanMode, splitByStrength, parseSynonyms, parseStopWords]);

  const handlePreview = useCallback(async () => {
    if (sourcePhrases.length === 0) return;
    const previewPhrases = sourcePhrases.slice(0, 500);
    const synonyms = parseSynonyms();
    const stopWords = parseStopWords();
    const preprocessingOpts = { lemmatize, ignoreNumbers, synonyms, stopWords, scanMode, splitByStrength };
    let clusters: Map<string, any[]>;
    if (algorithm === 'words') {
      const minCommon = Math.max(1, Math.round(strength / 25));
      clusters = clusterByWords(previewPhrases, minCommon, preprocessingOpts);
    } else {
      const threshold = 0.2 + (strength / 100) * 0.6;
      clusters = clusterByJaccard(previewPhrases, threshold, preprocessingOpts);
    }
    const filtered = new Map<string, any[]>();
    for (const [key, val] of clusters) {
      if (val.length >= minGroupSize) filtered.set(key, val);
    }
    setPreviewResults(filtered);
    setShowPreview(true);
  }, [algorithm, strength, minGroupSize, sourcePhrases, lemmatize, ignoreNumbers, synonymsText, stopWordsText, scanMode, splitByStrength, parseSynonyms, parseStopWords]);

  const history = useMemo(() => loadHistory(), [historyOpen]);

  return (
    <div className="h-full flex flex-col" style={{ maxWidth: '100%', width: '100%' }}>
      <div className="flex-1 overflow-y-auto compact-scroll p-3 space-y-4" style={{ maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
        <ClusteringSettings
          algorithm={algorithm}
          onAlgorithmChange={setAlgorithm}
          strength={strength}
          onStrengthChange={setStrength}
          minGroupSize={minGroupSize}
          onMinGroupSizeChange={setMinGroupSize}
          lemmatize={lemmatize}
          onLemmatizeChange={setLemmatize}
          ignoreNumbers={ignoreNumbers}
          onIgnoreNumbersChange={setIgnoreNumbers}
          splitByStrength={splitByStrength}
          onSplitByStrengthChange={setSplitByStrength}
          scanMode={scanMode}
          onScanModeChange={setScanMode}
          synonymsText={synonymsText}
          onSynonymsTextChange={setSynonymsText}
          stopWordsText={stopWordsText}
          onStopWordsTextChange={setStopWordsText}
        />

        {isRunning && algorithm === 'jaccard' && (
          <div className="space-y-1">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-[10px] text-[var(--kc-text-secondary)]">
              <span>Обработка...</span>
              <span>{progress}%</span>
            </div>
          </div>
        )}

        {results && results.size === 0 && (
          <div className="flex items-start gap-2 text-[12px] text-[var(--kc-text-secondary)]">
            <MIcon name="info" className="!text-[16px] shrink-0 mt-0.5" style={{ color: 'var(--kc-orange)' }} />
            <span>Не удалось найти кластеры. Попробуйте уменьшить силу или мин. размер группы.</span>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-[var(--kc-border-light)] p-3 space-y-2" style={{ background: 'var(--kc-bg, var(--kc-surface))' }}>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={handleCluster}
            disabled={isRunning || sourcePhrases.length === 0}
            className="inline-flex items-center justify-center gap-1.5 h-8 px-5 rounded-[3px] text-[12px] font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            style={{ backgroundColor: 'var(--kc-blue)' }}
          >
            {isRunning ? (
              <>
                <MIcon name="progress_activity" className="!text-[14px] animate-spin" />
                Обработка...
              </>
            ) : (
              `Кластеризовать (${sourcePhrases.length} фр.)`
            )}
          </button>
          <button
            onClick={handlePreview}
            disabled={isRunning || sourcePhrases.length === 0}
            className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-[3px] text-[11px] font-medium border border-[var(--kc-border)] transition-colors disabled:opacity-50 shrink-0"
          >
            <MIcon name="visibility" className="!text-[14px]" />
            Preview
          </button>
          <button
            onClick={() => setHistoryOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-[3px] text-[11px] font-medium border border-[var(--kc-border)] transition-colors shrink-0"
            title="История кластеризации"
          >
            <MIcon name="history" className="!text-[14px]" />
            История
          </button>
        </div>

        {duration !== null && (
          <div className="text-[10px] text-[var(--kc-text-secondary)] text-center">
            Время: {(duration / 1000).toFixed(2)}с
          </div>
        )}

        {appliedCount !== null && !isRunning && (
          <div className="flex items-center gap-2 p-2 rounded-[3px] bg-[var(--kc-green-light)] border border-[var(--kc-green)] text-[12px] text-[var(--kc-green)] min-w-0 overflow-hidden">
            <MIcon name="check_circle" className="!text-[16px] shrink-0" />
            <span className="flex-1 min-w-0 truncate">Создано {appliedCount} групп. Фразы распределены.</span>
          </div>
        )}
      </div>

      <PreviewDialog open={showPreview} onOpenChange={setShowPreview} previewResults={previewResults} />
      <HistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        history={history}
        ctx={ctx}
        compareEntry={compareEntry}
        setCompareEntry={setCompareEntry}
        compareEntry2={compareEntry2}
        setCompareEntry2={setCompareEntry2}
        showCompare={showCompare}
        setShowCompare={setShowCompare}
      />
    </div>
  );
}