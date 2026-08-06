// ============================================================
// Module: N-grams — UI Panel (Key Collector style)
// ============================================================

import type { PluginContext } from 'plugin-sdk';
import React, { useState, useCallback, useMemo } from 'react';
import { useAppStore, AppEvents, DEFAULT_STOP_WORDS, useActiveGroupIds, Label, Checkbox, Slider } from 'plugin-sdk';
import { ngramsSettings } from './index';
import { clusterByNgrams } from './index';


// ---- Icon helper ----

function MIcon({ name, className = '', style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}

export function NgramsPanel({ ctx }: { ctx: PluginContext }) {
  const [ngramSize, setNgramSize] = useState(ngramsSettings.ngramSize);
  const [threshold, setThreshold] = useState(ngramsSettings.threshold);
  const [minGroupSize, setMinGroupSize] = useState(ngramsSettings.minGroupSize);
  const [ignoreNumbers, setIgnoreNumbers] = useState(false);
  const [lemmatize, setLemmatize] = useState(false);
  const [stopWordsText, setStopWordsText] = useState([...DEFAULT_STOP_WORDS].join(', '));
  const [results, setResults] = useState<Map<string, any[]> | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const phrases = useAppStore(s => s.phrases);
  const activeGroupIds = useActiveGroupIds();

  const sourcePhrases = useMemo(
    () => activeGroupIds.size < phrases.length
      ? phrases.filter(p => activeGroupIds.has(p.groupId))
      : phrases,
    [phrases, activeGroupIds]
  );

  const handleCluster = useCallback(async () => {
    if (sourcePhrases.length === 0) return;
    setIsRunning(true);
    await new Promise(r => setTimeout(r, 16));

    try {
      const stopWords = stopWordsText
        .split(',')
        .map(w => w.trim().toLowerCase())
        .filter(Boolean);

      const clusters = clusterByNgrams(sourcePhrases, {
        ngramSize,
        threshold,
        minGroupSize,
        stopWords,
        ignoreNumbers,
        lemmatize,
      });

      setResults(clusters);
    } finally {
      setIsRunning(false);
    }
  }, [sourcePhrases, ngramSize, threshold, minGroupSize, stopWordsText, ignoreNumbers, lemmatize]);

  const handleCreateStructure = useCallback(() => {
    if (!results || results.size === 0) return;

    ctx.store.dispatch('batchOperation', () => {
      const store = useAppStore.getState();
      const rootId = store.addGroup('N-граммы', null);
      ctx.store.dispatch('toggleExpand', rootId);
      for (const [name, clusterPhrases] of results) {
        const groupId = store.addGroup(name, rootId);
        const ids = clusterPhrases.map((p: any) => p.id);
        ctx.store.dispatch('movePhrases', { ids, targetGroupId: groupId });
      }
      ctx.store.dispatch('setActiveGroup', rootId);
    });
    ctx.eventBus.emit(AppEvents.GROUPS_CHANGED);
    ctx.eventBus.emit(AppEvents.PHRASES_CHANGED);
    setResults(null);
  }, [results, ctx]);

  const totalPhrasesInResults = results
    ? [...results.values()].reduce((sum, p) => sum + p.length, 0)
    : 0;

  return (
    <div className="h-full flex flex-col" style={{ maxWidth: '100%', width: '100%' }}>
        <div className="flex-1 overflow-y-auto compact-scroll p-3 space-y-4" style={{ maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>

          {/* Description */}
          <div className="text-[11px] text-[var(--kc-text-secondary)] leading-relaxed">
            Группировка фраз по N-граммам (биграммам, триграммам). Фразы с одинаковыми последовательностями слов объединяются. Учитывает порядок слов.
          </div>

          <div className="h-px bg-[var(--kc-border-light)]" />

          {/* N-gram size */}
          <div style={{ maxWidth: '100%' }}>
            <div className="flex justify-between items-center mb-1">
              <Label className="text-[12px] font-medium">Размер N-граммы</Label>
              <span className="text-[12px] text-[var(--kc-text-secondary)] font-mono shrink-0">{ngramSize}</span>
            </div>
            <Slider
              value={[ngramSize]}
              onValueChange={([v]) => setNgramSize(v)}
              min={2}
              max={4}
              step={1}
              className="mt-1"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-[var(--kc-text-secondary)]">2 (биграммы)</span>
              <span className="text-[10px] text-[var(--kc-text-secondary)]">4</span>
            </div>
          </div>

          {/* Threshold */}
          <div style={{ maxWidth: '100%' }}>
            <div className="flex justify-between items-center mb-1">
              <Label className="text-[12px] font-medium">Порог схожести</Label>
              <span className="text-[12px] text-[var(--kc-text-secondary)] font-mono shrink-0">{threshold.toFixed(2)}</span>
            </div>
            <Slider
              value={[threshold * 100]}
              onValueChange={([v]) => setThreshold(v / 100)}
              min={10}
              max={100}
              step={5}
              className="mt-1"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-[var(--kc-text-secondary)]">0.1</span>
              <span className="text-[10px] text-[var(--kc-text-secondary)]">1.0</span>
            </div>
          </div>

          {/* Min Group Size */}
          <div style={{ maxWidth: '100%' }}>
            <div className="flex justify-between items-center mb-1">
              <Label className="text-[12px] font-medium">Мин. размер группы</Label>
              <span className="text-[12px] text-[var(--kc-text-secondary)] font-mono shrink-0">{minGroupSize}</span>
            </div>
            <Slider
              value={[minGroupSize]}
              onValueChange={([v]) => setMinGroupSize(v)}
              min={2}
              max={10}
              step={1}
              className="mt-1"
            />
          </div>

          <div className="h-px bg-[var(--kc-border-light)]" />

          {/* Preprocessing options */}
          <div style={{ maxWidth: '100%' }}>
            <Label className="text-[12px] font-semibold text-[var(--kc-text)]">Предобработка</Label>
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="ngrams-lemmatize"
                  checked={lemmatize}
                  onCheckedChange={(v) => setLemmatize(v === true)}
                />
                <Label htmlFor="ngrams-lemmatize" className="text-[12px] font-normal cursor-pointer">Лемматизация</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="ngrams-ignore-numbers"
                  checked={ignoreNumbers}
                  onCheckedChange={(v) => setIgnoreNumbers(v === true)}
                />
                <Label htmlFor="ngrams-ignore-numbers" className="text-[12px] font-normal cursor-pointer">Игнорировать числа</Label>
              </div>
            </div>
          </div>

          {/* Stop words */}
          <div style={{ maxWidth: '100%' }}>
            <Label className="text-[12px] font-medium mb-1 block">Стоп-слова (через запятую)</Label>
            <textarea
              className="w-full min-h-[60px] rounded-[3px] border border-[var(--kc-border)] bg-[var(--kc-surface)] px-2 py-1 text-[11px] resize-y focus:outline-none focus:ring-1 focus:ring-[var(--kc-blue)] focus:border-[var(--kc-blue)]"
              value={stopWordsText}
              onChange={e => setStopWordsText(e.target.value)}
              placeholder="в, на, с, и, по, из..."
            />
          </div>

          {/* Results */}
          {results && results.size > 0 && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="flex items-center gap-2 p-2 rounded-[3px] bg-[var(--kc-blue-light)] border border-[var(--kc-blue)] text-[12px] text-[var(--kc-blue)] min-w-0 overflow-hidden">
                <MIcon name="check_circle" className="!text-[16px] shrink-0" />
                <span className="flex-1 min-w-0 truncate">
                  Найдено {results.size} кластеров ({totalPhrasesInResults} фраз)
                </span>
              </div>

              {/* Create structure button */}
              <div className="flex justify-center">
                <button
                  onClick={handleCreateStructure}
                  className="inline-flex items-center justify-center gap-1.5 h-8 px-5 rounded-[3px] text-[12px] font-medium text-white transition-colors shrink-0"
                  style={{ backgroundColor: 'var(--kc-green)' }}
                >
                  <MIcon name="create_new_folder" className="!text-[14px]" />
                  Создать группы
                </button>
              </div>

              {/* Results table */}
              <div className="border border-[var(--kc-border)] rounded-[3px] overflow-hidden">
                <div className="bg-[var(--kc-table-header)] flex items-center px-2 py-1 text-[11px] font-semibold text-[var(--kc-text-secondary)]">
                  <span className="flex-1">Кластер</span>
                  <span className="w-12 text-right shrink-0">Фраз</span>
                </div>
                <div>
                  {[...results.entries()].map(([name, clusterPhrases]) => (
                    <div
                      key={name}
                      className="flex items-center px-2 py-1 border-b border-[var(--kc-border-light)] last:border-0 hover:bg-[var(--kc-table-row-hover)] transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-[12px] font-medium text-[var(--kc-text)]">{name}</span>
                        <p className="text-[10px] text-[var(--kc-text-secondary)] truncate mt-0.5">
                          {clusterPhrases.slice(0, 3).map(p => p.text).join(', ')}
                          {clusterPhrases.length > 3 && `...`}
                        </p>
                      </div>
                      <span className="w-12 text-right text-[11px] text-[var(--kc-text-secondary)] font-mono shrink-0">
                        {clusterPhrases.length}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {results && results.size === 0 && (
            <div className="flex items-start gap-2 text-[12px] text-[var(--kc-text-secondary)]">
              <MIcon name="info" className="!text-[16px] shrink-0 mt-0.5" style={{ color: 'var(--kc-orange)' }} />
              <span>Не удалось найти кластеры. Попробуйте уменьшить порог или мин. размер группы.</span>
            </div>
          )}
        </div>

      {/* Footer: pinned to bottom */}
      <div className="shrink-0 border-t border-[var(--kc-border-light)] p-3" style={{ background: 'var(--kc-bg, var(--kc-surface))' }}>
        <div className="flex justify-center">
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
        </div>
      </div>
    </div>
  );
}