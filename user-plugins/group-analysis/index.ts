// ============================================================
// Module: Group Analysis — Key Collector style
// ============================================================
//
// v2: Preprocessing options (lemmatize, ignoreNumbers, synonyms, stopWords)
// ============================================================

import type { AppModule, PluginContext, Phrase, KCID } from 'plugin-sdk';
import { GroupAnalysisPanel } from './components';
import { useAppStore, preprocessPhrase, simpleLemmatize, DEFAULT_STOP_WORDS } from 'plugin-sdk';

/** Default stop-words (Russian) — prepositions, conjunctions, particles */
export const DEFAULT_STOP_WORDS_LIST = [
  'в', 'на', 'с', 'и', 'по', 'из', 'за', 'к', 'у', 'о', 'от',
  'для', 'как', 'не', 'но', 'а', 'это', 'то', 'все', 'он', 'она',
  'они', 'мы', 'вы', 'тут', 'где', 'там', 'что', 'кто', 'чем',
  'при', 'через', 'между', 'над', 'под', 'без', 'до', 'со', 'об',
  'ей', 'его', 'её', 'их', 'им', 'ей', 'нас', 'вам', 'вас', 'нас',
];

/** Module-level settings */
export let groupAnalysisSettings = {
  minGroupSize: 2,
  stopWords: DEFAULT_STOP_WORDS_LIST.join(', '),
};

const groupAnalysisModule: AppModule = {
  manifest: {
    id: 'group-analysis',
    name: 'Анализ групп',
    version: '2.0.0',
    description: 'Группировка фраз по отдельным словам (как в Key Collector) с предобработкой',
    category: 'algorithms',
    dependencies: ['groups', 'phrases'],
    slot: ['ribbon:tools', 'left-panel'],
    settingsSchema: [
      { key: 'minGroupSize', type: 'number', label: 'Мин. размер группы', default: 2 },
      { key: 'stopWords', type: 'string', label: 'Стоп-слова (через запятую)', default: DEFAULT_STOP_WORDS_LIST.join(', ') },
    ],
  },

  init(ctx: PluginContext) {
    const readSettings = () => {
      groupAnalysisSettings = {
        minGroupSize: ctx.getSetting('minGroupSize') as number ?? 2,
        stopWords: ctx.getSetting('stopWords') as string ?? DEFAULT_STOP_WORDS_LIST.join(', '),
      };
    };
    readSettings();

    ctx.registerLifecycleHook?.('onSettingsChange', (payload) => {
      if (payload?.moduleId === 'group-analysis') {
        readSettings();
      }
    });

    ctx.registerUI({
      slot: 'ribbon:tools',
      label: 'Анализ групп',
      component: () => GroupAnalysisPanel({ ctx }),
      order: 11,
    });

    ctx.registerCommand('run', () => {
      ctx.store.dispatch('setLeftPanel', { open: true, module: 'group-analysis' });
    });
    ctx.registerKeybinding?.('ctrl+shift+g', 'run', { label: 'Запустить анализ групп' });
  },

  destroy() {
    groupAnalysisSettings = { minGroupSize: 2, stopWords: '' };
  },
};

export default groupAnalysisModule;

// ---- Algorithm: Group by individual words (Key Collector style) ----

export interface WordGroup {
  word: string;          // The key word (group name)
  phrases: Phrase[];     // All phrases containing this word
}

/**
 * Group phrases by individual significant words (Key Collector algorithm).
 *
 * For each significant word found across all phrases, creates a group
 * containing ALL phrases that include this word.
 * A single phrase can appear in multiple groups.
 */
export function groupByWords(
  phrases: Phrase[],
  options: {
    minGroupSize?: number;
    stopWords?: string[];
    lemmatize?: boolean;
    ignoreNumbers?: boolean;
    synonyms?: Map<string, string>;
  } = {}
): WordGroup[] {
  const { minGroupSize = 2, stopWords = DEFAULT_STOP_WORDS_LIST, lemmatize = false, ignoreNumbers = false, synonyms } = options;
  const stopSet = new Set(stopWords.map(w => w.toLowerCase().trim()).filter(Boolean));

  // Step 1: Build word → phrases index
  const wordIndex = new Map<string, Phrase[]>();

  for (const phrase of phrases) {
    // Use preprocessing
    const processedWords = preprocessPhrase(phrase.text, {
      lemmatize,
      ignoreNumbers,
      synonyms,
      stopWords: stopSet,
    });

    // We also need original words for naming, but for grouping use processed words
    // Map each processed word back to the phrase
    const uniqueProcessed = new Set(processedWords);
    for (const word of uniqueProcessed) {
      // Skip stop words and single-char words (already handled by preprocessPhrase)
      const existing = wordIndex.get(word);
      if (existing) {
        existing.push(phrase);
      } else {
        wordIndex.set(word, [phrase]);
      }
    }
  }

  // Step 2: Filter by min group size, sort by size (largest first)
  const groups: WordGroup[] = [];
  for (const [word, groupPhrases] of wordIndex) {
    if (groupPhrases.length >= minGroupSize) {
      groups.push({ word, phrases: groupPhrases });
    }
  }

  // Sort by phrase count descending, then alphabetically
  groups.sort((a, b) => b.phrases.length - a.phrases.length || a.word.localeCompare(b.word));

  return groups;
}
