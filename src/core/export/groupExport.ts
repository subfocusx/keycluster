// ============================================================
// Core: Export — helpers for exporting a group of phrases
//
// Pure functions only (no DOM, no store access) so they can be
// unit-tested in isolation:
//   • сбор фраз группы (+ потомков)  → collectGroupPhrases
//   • сбор строк CSV / TXT            → buildGroupCsv / buildGroupTxt
//
// The scope of a group (the group itself + all its descendants)
// is calculated the same way as in
// src/modules/phrases/useActiveGroupIds.ts
// ============================================================

export interface GroupExportGroup {
  id: string;
  name: string;
  parentId: string | null;
}

export interface GroupExportPhrase {
  id: string;
  text: string;
  groupId: string;
}

/** Разделитель CSV (Excel RU) */
export const CSV_DELIMITER = ';';

/** Заголовок CSV по умолчанию */
export const CSV_HEADERS = ['Текст', 'Группа'] as const;

export interface GroupCsvOptions {
  /** Разделитель (по умолчанию «;») */
  delimiter?: string;
  /** Добавлять строку заголовка (по умолчанию true) */
  includeHeader?: boolean;
  /** Добавлять колонку с названием группы (по умолчанию true) */
  includeGroupColumn?: boolean;
}

export interface GroupTxtOptions {
  /** Разделитель строк (по умолчанию «\n») */
  eol?: string;
}

// ---- Scope ----------------------------------------------------------------

/**
 * Идентификаторы группы и всех её потомков (в глубину).
 * Порядок: сначала сама группа, затем потомки в порядке дерева.
 */
export function collectDescendantGroupIds(
  groupId: string,
  groups: GroupExportGroup[],
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const walk = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    ids.push(id);
    groups
      .filter(g => g.parentId === id)
      .sort(compareGroupsByName)
      .forEach(child => walk(child.id));
  };
  walk(groupId);
  return ids;
}

/**
 * Все фразы группы и её потомков.
 * Результат отсортирован (см. sortGroupPhrases): сначала по порядку
 * групп в дереве, затем по тексту фразы.
 */
export function collectGroupPhrases(
  groupId: string,
  groups: GroupExportGroup[],
  phrases: GroupExportPhrase[],
): GroupExportPhrase[] {
  const scope = new Set(collectDescendantGroupIds(groupId, groups));
  const scoped = phrases.filter(p => scope.has(p.groupId));
  return sortGroupPhrases(scoped, groups);
}

// ---- Sorting --------------------------------------------------------------

function compareGroupsByName(a: GroupExportGroup, b: GroupExportGroup): number {
  const an = (a.name ?? '').toLocaleLowerCase();
  const bn = (b.name ?? '').toLocaleLowerCase();
  if (an < bn) return -1;
  if (an > bn) return 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function comparePhrasesByText(a: GroupExportPhrase, b: GroupExportPhrase): number {
  const at = (a.text ?? '').toLocaleLowerCase();
  const bt = (b.text ?? '').toLocaleLowerCase();
  if (at < bt) return -1;
  if (at > bt) return 1;
  if (a.text !== b.text) return a.text < b.text ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Порядок групп для экспорта: обход дерева от корней (группы с parentId = null),
 * внутри уровня — по названию. Группы-«сироты» (родитель не найден) — в конец.
 */
export function getGroupExportOrder(groups: GroupExportGroup[]): string[] {
  const known = new Set(groups.map(g => g.id));
  const childrenOf = new Map<string, GroupExportGroup[]>();
  const roots: GroupExportGroup[] = [];
  const orphans: GroupExportGroup[] = [];

  for (const g of groups) {
    if (g.parentId === null || g.parentId === undefined) {
      roots.push(g);
    } else if (known.has(g.parentId)) {
      const list = childrenOf.get(g.parentId) ?? [];
      list.push(g);
      childrenOf.set(g.parentId, list);
    } else {
      orphans.push(g);
    }
  }

  const order: string[] = [];
  const visited = new Set<string>();
  const walk = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    order.push(id);
    (childrenOf.get(id) ?? [])
      .slice()
      .sort(compareGroupsByName)
      .forEach(child => walk(child.id));
  };

  roots.slice().sort(compareGroupsByName).forEach(root => walk(root.id));
  orphans.slice().sort(compareGroupsByName).forEach(o => walk(o.id));
  // Группы, не достигнутые обходом (циклы в данных) — в конец, по имени
  groups
    .filter(g => !visited.has(g.id))
    .slice()
    .sort(compareGroupsByName)
    .forEach(g => walk(g.id));

  return order;
}

/**
 * Стабильная сортировка фраз: по порядку групп в дереве, затем по тексту.
 */
export function sortGroupPhrases(
  phrases: GroupExportPhrase[],
  groups: GroupExportGroup[],
): GroupExportPhrase[] {
  const order = getGroupExportOrder(groups);
  const index = new Map<string, number>();
  order.forEach((id, i) => index.set(id, i));

  return phrases
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const ai = index.get(a.p.groupId) ?? Number.MAX_SAFE_INTEGER;
      const bi = index.get(b.p.groupId) ?? Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      const byText = comparePhrasesByText(a.p, b.p);
      if (byText !== 0) return byText;
      return a.i - b.i;
    })
    .map(({ p }) => p);
}

// ---- CSV ------------------------------------------------------------------

/**
 * Экранирование значения CSV.
 * Значение оборачивается в кавычки, если содержит разделитель, запятую,
 * двойную кавычку, перевод строки или обрезающие пробелы.
 */
export function escapeCsvValue(value: string, delimiter: string = CSV_DELIMITER): string {
  const raw = value ?? '';
  const needsQuotes =
    raw.includes(delimiter) ||
    raw.includes(',') ||
    raw.includes('"') ||
    raw.includes('\n') ||
    raw.includes('\r') ||
    raw !== raw.trim();
  if (!needsQuotes) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
}

/** Сборка одной строки CSV */
export function buildCsvRow(values: string[], delimiter: string = CSV_DELIMITER): string {
  return values.map(v => escapeCsvValue(v ?? '', delimiter)).join(delimiter);
}

/**
 * CSV с заголовком. Разделитель «;», каждая фраза — строка,
 * колонка «Группа» содержит название группы (по умолчанию включена).
 */
export function buildGroupCsv(
  phrases: GroupExportPhrase[],
  groups: GroupExportGroup[] = [],
  options: GroupCsvOptions = {},
): string {
  const delimiter = options.delimiter ?? CSV_DELIMITER;
  const includeHeader = options.includeHeader !== false;
  const includeGroupColumn = options.includeGroupColumn !== false;

  const sorted = groups.length > 0 ? sortGroupPhrases(phrases, groups) : phrases;
  const groupName = (id: string) => groups.find(g => g.id === id)?.name ?? '';

  const rows: string[] = [];
  if (includeHeader) {
    rows.push(buildCsvRow(
      includeGroupColumn ? [CSV_HEADERS[0], CSV_HEADERS[1]] : [CSV_HEADERS[0]],
      delimiter,
    ));
  }
  for (const p of sorted) {
    const values = includeGroupColumn
      ? [p.text ?? '', groupName(p.groupId)]
      : [p.text ?? ''];
    rows.push(buildCsvRow(values, delimiter));
  }
  return rows.join('\n');
}

// ---- TXT ------------------------------------------------------------------

/** TXT — одна фраза на строку */
export function buildGroupTxt(
  phrases: GroupExportPhrase[],
  options: GroupTxtOptions = {},
): string {
  const eol = options.eol ?? '\n';
  return phrases.map(p => p.text ?? '').join(eol);
}

// ---- File name ------------------------------------------------------------

/** Безопасное имя файла для экспорта */
export function buildExportFileName(groupName: string, extension: string): string {
  const base = (groupName ?? '')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  const safeBase = base.length > 0 ? base : 'group';
  return `${safeBase}.${extension}`;
}
