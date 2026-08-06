// Tool Registry — single source of truth for all tools
// Every tool (AI or algorithm) MUST be registered here.
// UI renders from this registry ONLY. No orphan buttons, no hidden services.

export type ToolEngine = 'algorithm' | 'llm' | 'hybrid';
export type ToolId =
  | 'minus-words'
  | 'clustering'
  | 'group-analysis'
  | 'ngrams'
  | 'tfidf'
  | 'cross-search'
  | 'find-replace'
  | 'duplicates'
  | 'implicit-duplicates'
  | 'deduplicator';

export type ToolTab = 'data' | 'algorithms' | 'ai';

export interface ToolConfig {
  id: ToolId;
  label: string;
  description: string;
  engine: ToolEngine;
  ui: {
    ribbon: boolean;
    panel: boolean;
    modal: boolean;
    tab: ToolTab;
    order: number;
  };
  enabled: boolean;
}

const ALL_TOOL_IDS = new Set<ToolId>([
  'minus-words', 'clustering', 'group-analysis', 'ngrams',
  'tfidf', 'cross-search', 'find-replace', 'duplicates',
  'implicit-duplicates', 'deduplicator',
]);

export function isToolId(id: string): id is ToolId {
  return ALL_TOOL_IDS.has(id as ToolId);
}

export const TOOL_REGISTRY: Record<ToolId, ToolConfig> = {
  'minus-words': {
    id: 'minus-words',
    label: 'Минус-фразы',
    description: 'Управление минус-фразами: добавление, импорт, применение',
    engine: 'algorithm',
    ui: { ribbon: true, panel: true, modal: false, tab: 'data', order: 10 },
    enabled: true,
  },
  'cross-search': {
    id: 'cross-search',
    label: 'Перекрёстный поиск',
    description: 'Поиск дублирующихся фраз между группами',
    engine: 'algorithm',
    ui: { ribbon: true, panel: true, modal: false, tab: 'data', order: 20 },
    enabled: true,
  },
  'find-replace': {
    id: 'find-replace',
    label: 'Найти/Заменить',
    description: 'Поиск и замена текста во фразах (поддерживает Regex)',
    engine: 'algorithm',
    ui: { ribbon: true, panel: true, modal: false, tab: 'data', order: 30 },
    enabled: true,
  },
  clustering: {
    id: 'clustering',
    label: 'Кластеризация',
    description: 'Автоматическая кластеризация ключевых фраз',
    engine: 'algorithm',
    ui: { ribbon: true, panel: true, modal: false, tab: 'algorithms', order: 10 },
    enabled: true,
  },
  'group-analysis': {
    id: 'group-analysis',
    label: 'Анализ групп',
    description: 'Статистический анализ групп ключевых фраз',
    engine: 'algorithm',
    ui: { ribbon: true, panel: true, modal: false, tab: 'algorithms', order: 20 },
    enabled: true,
  },
  ngrams: {
    id: 'ngrams',
    label: 'N-граммы',
    description: 'Анализ N-грамм в ключевых фразах',
    engine: 'algorithm',
    ui: { ribbon: true, panel: true, modal: false, tab: 'algorithms', order: 30 },
    enabled: true,
  },
  tfidf: {
    id: 'tfidf',
    label: 'TF-IDF',
    description: 'TF-IDF анализ ключевых фраз',
    engine: 'algorithm',
    ui: { ribbon: true, panel: true, modal: false, tab: 'algorithms', order: 40 },
    enabled: true,
  },
  duplicates: {
    id: 'duplicates',
    label: 'Дубликаты',
    description: 'Поиск дублирующихся фраз',
    engine: 'algorithm',
    ui: { ribbon: false, panel: true, modal: false, tab: 'data', order: 25 },
    enabled: true,
  },
  'implicit-duplicates': {
    id: 'implicit-duplicates',
    label: 'Неявные дубли',
    description: 'Поиск неявных дублей: перестановки слов, морфология, опечатки',
    engine: 'algorithm',
    ui: { ribbon: true, panel: true, modal: true, tab: 'data', order: 26 },
    enabled: true,
  },
  deduplicator: {
    id: 'deduplicator',
    label: 'Дедупликатор',
    description: 'Удаление дублирующихся фраз',
    engine: 'algorithm',
    ui: { ribbon: true, panel: true, modal: true, tab: 'data', order: 27 },
    enabled: true,
  },
};

export function getToolConfig(id: ToolId): ToolConfig | undefined {
  return TOOL_REGISTRY[id];
}

export function isToolEnabled(id: ToolId): boolean {
  return TOOL_REGISTRY[id]?.enabled ?? false;
}

let _loggedTabs = new Set<string>();

export function getToolsByTab(tab: ToolTab): ToolConfig[] {
  const result = Object.values(TOOL_REGISTRY)
    .filter(t => t.ui.tab === tab && t.enabled)
    .sort((a, b) => a.ui.order - b.ui.order);

  if (!_loggedTabs.has(tab)) {
    _loggedTabs.add(tab);
    console.debug(`[ToolRegistry] getToolsByTab("${tab}"): ${result.map(t => `${t.id}(enabled=${t.enabled},ribbon=${t.ui.ribbon})`).join(', ')}`);
  }

  return result;
}

export function getRibbonTools(): ToolConfig[] {
  return Object.values(TOOL_REGISTRY)
    .filter(t => t.ui.ribbon && t.enabled)
    .sort((a, b) => a.ui.order - b.ui.order);
}

export function getToolsByEngine(engine: ToolEngine): ToolConfig[] {
  return Object.values(TOOL_REGISTRY)
    .filter(t => t.engine === engine && t.enabled)
    .sort((a, b) => a.ui.order - b.ui.order);
}

export function setToolEnabled(id: ToolId, enabled: boolean): void {
  if (TOOL_REGISTRY[id]) {
    TOOL_REGISTRY[id].enabled = enabled;
  }
}
