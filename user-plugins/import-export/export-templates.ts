// ============================================================
// Export templates — predefined column layouts
// ============================================================

export type ExportColumnKey = 'text' | 'group' | 'frequency' | 'kei' | 'cpc' | 'notes' | 'tags';

export interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  columns: ExportColumnKey[];
  includeHeader: boolean;
  /** Export minus-words instead of phrases */
  exportMinusWords?: boolean;
}

export const EXPORT_TEMPLATES: ExportTemplate[] = [
  {
    id: 'keywords_only',
    name: 'Только фразы',
    description: 'Одна колонка — текст ключевой фразы',
    columns: ['text'],
    includeHeader: false,
  },
  {
    id: 'keywords_groups',
    name: 'Фразы + группа',
    description: 'Текст фразы и название группы',
    columns: ['text', 'group'],
    includeHeader: true,
  },
  {
    id: 'full',
    name: 'Полный экспорт',
    description: 'Все доступные столбцы',
    columns: ['text', 'group', 'frequency', 'kei', 'cpc', 'notes'],
    includeHeader: true,
  },
  {
    id: 'metrics',
    name: 'Метрики',
    description: 'Фраза, частота, KEI, CPC',
    columns: ['text', 'frequency', 'kei', 'cpc'],
    includeHeader: true,
  },
  {
    id: 'minus_words',
    name: 'Минус-фразы',
    description: 'Список минус-фраз (по одной на строку)',
    columns: ['text'],
    includeHeader: false,
    exportMinusWords: true,
  },
];

export const COLUMN_LABELS: Record<ExportColumnKey, string> = {
  text: 'Фраза',
  group: 'Группа',
  frequency: 'Частота',
  kei: 'KEI',
  cpc: 'CPC',
  notes: 'Заметки',
  tags: 'Теги',
};
