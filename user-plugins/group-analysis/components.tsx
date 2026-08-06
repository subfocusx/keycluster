// ============================================================
// Module: Group Analysis — UI Panel (Key Collector style)
// v2: Preprocessing options (lemmatize, ignoreNumbers, synonyms, stopWords)
// ============================================================

import type { PluginContext } from 'plugin-sdk';
import React, { useState, useCallback, useMemo } from 'react';
import { useAppStore, AppEvents, useActiveGroupIds, Label, Checkbox, Slider } from 'plugin-sdk';
import type { WordGroup } from './index';
import { DEFAULT_STOP_WORDS_LIST, groupAnalysisSettings, groupByWords } from './index';


// ---- Icon helper ----

function MIcon({ name, className = '', style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}

export function GroupAnalysisPanel({ ctx }: { ctx: PluginContext }) {
  const [minGroupSize, setMinGroupSize] = useState(groupAnalysisSettings.minGroupSize);
  const [stopWordsText, setStopWordsText] = useState(groupAnalysisSettings.stopWords);
  const [lemmatize, setLemmatize] = useState(false);
  const [ignoreNumbers, setIgnoreNumbers] = useState(false);
  const [synonymsText, setSynonymsText] = useState('');
  const [results, setResults] = useState<WordGroup[] | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const phrases = useAppStore(s => s.phrases);
  const activeGroupIds = useActiveGroupIds();

  const sourcePhrases = useMemo(
    () => activeGroupIds.size < phrases.length
      ? phrases.filter(p => activeGroupIds.has(p.groupId))
      : phrases,
    [phrases, activeGroupIds]
  );

  // Parse synonyms from text: "word=replacement" per line
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

  const handleAnalyze = useCallback(() => {
    if (sourcePhrases.length === 0) return;
    setIsRunning(true);

    try {
      const stopWords = stopWordsText
        .split(',')
        .map(w => w.trim().toLowerCase())
        .filter(Boolean);

      const synonyms = parseSynonyms();

      const groups = groupByWords(sourcePhrases, {
        minGroupSize,
        stopWords: stopWords.length > 0 ? stopWords : DEFAULT_STOP_WORDS_LIST,
        lemmatize,
        ignoreNumbers,
        synonyms,
      });

      setResults(groups);
    } finally {
      setIsRunning(false);
    }
  }, [sourcePhrases, minGroupSize, stopWordsText, lemmatize, ignoreNumbers, synonymsText, parseSynonyms]);

  const handleCreateStructure = useCallback(() => {
    if (!results || results.length === 0) return;

    ctx.store.dispatch('batchOperation', () => {
      const store = useAppStore.getState();
      const rootId = store.addGroup('Анализ групп', null);
      ctx.store.dispatch('toggleExpand', rootId);
      for (const group of results) {
        const groupId = store.addGroup(group.word, rootId);
        ctx.store.dispatch('addPhrases', {
          texts: group.phrases.map(p => p.text),
          groupId,
          extra: group.phrases.map(p => ({ frequency: p.frequency, kei: p.kei, cpc: p.cpc }))
        });
      }
      ctx.store.dispatch('setActiveGroup', rootId);
    });
    ctx.eventBus.emit(AppEvents.GROUPS_CHANGED);
    ctx.eventBus.emit(AppEvents.PHRASES_CHANGED);
    setResults(null);
  }, [results, ctx]);

  const totalPhrasesInResults = results
    ? results.reduce((sum, g) => sum + g.phrases.length, 0)
    : 0;

  return (
    <div className="h-full flex flex-col" style={{ maxWidth: '100%', width: '100%' }}>
        <div className="flex-1 overflow-y-auto compact-scroll p-3 space-y-4" style={{ maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>

          {/* Description */}
          <div className="text-[11px] text-[var(--kc-text-secondary)] leading-relaxed">
            Группирует фразы по отдельным словам. Каждая группа — все фразы, содержащие данное слово. Одна фраза может быть в нескольких группах.
          </div>

          <div className="h-px bg-[var(--kc-border-light)]" />

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
              max={20}
              step={1}
              className="mt-1"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-[var(--kc-text-secondary)]">2</span>
              <span className="text-[10px] text-[var(--kc-text-secondary)]">20</span>
            </div>
          </div>

          <div className="h-px bg-[var(--kc-border-light)]" />

          {/* Preprocessing options */}
          <div style={{ maxWidth: '100%' }}>
            <Label className="text-[12px] font-semibold text-[var(--kc-text)]">Предобработка</Label>
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="ga-lemmatize"
                  checked={lemmatize}
                  onCheckedChange={(v) => setLemmatize(v === true)}
                />
                <Label htmlFor="ga-lemmatize" className="text-[12px] font-normal cursor-pointer">Лемматизация</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="ga-ignore-numbers"
                  checked={ignoreNumbers}
                  onCheckedChange={(v) => setIgnoreNumbers(v === true)}
                />
                <Label htmlFor="ga-ignore-numbers" className="text-[12px] font-normal cursor-pointer">Игнорировать числа</Label>
              </div>
            </div>
          </div>

          {/* Synonyms */}
          <div style={{ maxWidth: '100%' }}>
            <Label className="text-[12px] font-medium mb-1 block">Синонимы (слово=замена, по строке)</Label>
            <textarea
              className="w-full min-h-[48px] rounded-[3px] border border-[var(--kc-border)] bg-[var(--kc-surface)] px-2 py-1 text-[11px] resize-y focus:outline-none focus:ring-1 focus:ring-[var(--kc-blue)] focus:border-[var(--kc-blue)]"
              value={synonymsText}
              onChange={e => setSynonymsText(e.target.value)}
              placeholder={"мрт=магнитно резонансная томография\nseo=поисковая оптимизация"}
            />
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
            <p className="text-[10px] text-[var(--kc-text-secondary)] mt-1">
              Эти слова исключаются из группировки (предлоги, союзы, частицы)
            </p>
          </div>

          {/* Results */}
          {results && results.length > 0 && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="flex items-center gap-2 p-2 rounded-[3px] bg-[var(--kc-blue-light)] border border-[var(--kc-blue)] text-[12px] text-[var(--kc-blue)] min-w-0 overflow-hidden">
                <MIcon name="check_circle" className="!text-[16px] shrink-0" />
                <span className="flex-1 min-w-0 truncate">
                  Найдено {results.length} групп ({totalPhrasesInResults} фраз в группах)
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
                  Создать структуру
                </button>
              </div>

              {/* Results table */}
              <div className="border border-[var(--kc-border)] rounded-[3px] overflow-hidden">
                <div className="bg-[var(--kc-table-header)] flex items-center px-2 py-1 text-[11px] font-semibold text-[var(--kc-text-secondary)]">
                  <span className="flex-1">Слово (группа)</span>
                  <span className="w-12 text-right shrink-0">Фраз</span>
                </div>
                <div>
                  {results.map(group => (
                    <div
                      key={group.word}
                      className="flex items-center px-2 py-1 border-b border-[var(--kc-border-light)] last:border-0 hover:bg-[var(--kc-table-row-hover)] transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-[12px] font-medium text-[var(--kc-text)]">{group.word}</span>
                        <p className="text-[10px] text-[var(--kc-text-secondary)] truncate mt-0.5">
                          {group.phrases.slice(0, 3).map(p => p.text).join(', ')}
                          {group.phrases.length > 3 && `...`}
                        </p>
                      </div>
                      <span className="w-12 text-right text-[11px] text-[var(--kc-text-secondary)] font-mono shrink-0">
                        {group.phrases.length}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {results && results.length === 0 && (
            <div className="flex items-start gap-2 text-[12px] text-[var(--kc-text-secondary)]">
              <MIcon name="info" className="!text-[16px] shrink-0 mt-0.5" style={{ color: 'var(--kc-orange)' }} />
              <span>Не найдено групп с {minGroupSize}+ фразами. Попробуйте уменьшить мин. размер или убрать стоп-слова.</span>
            </div>
          )}
        </div>

      {/* Footer: pinned to bottom */}
      <div className="shrink-0 border-t border-[var(--kc-border-light)] p-3" style={{ background: 'var(--kc-bg, var(--kc-surface))' }}>
        <div className="flex justify-center">
          <button
            onClick={handleAnalyze}
            disabled={isRunning || sourcePhrases.length === 0}
            className="inline-flex items-center justify-center gap-1.5 h-8 px-5 rounded-[3px] text-[12px] font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            style={{ backgroundColor: 'var(--kc-blue)' }}
          >
            {isRunning ? (
              <>
                <MIcon name="progress_activity" className="!text-[14px] animate-spin" />
                Анализ...
              </>
            ) : (
              <>
                <MIcon name="analytics" className="!text-[14px]" />
                Анализировать ({sourcePhrases.length} фр.)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}