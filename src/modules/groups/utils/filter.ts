import type { KCID, Group, Phrase } from '@/plugin-sdk';
import { buildChildrenMap, collectWithDescendants } from '@/plugin-sdk';
export type MacroName = 'kw' | 'rkwp' | 'rkwc' | 'kwc' | 'children';

export interface MacroCondition {
  type: 'macro';
  macro: MacroName;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=';
  value: number;
}

export interface TextCondition {
  type: 'text';
  text: string;
}

export type GroupFilterCondition = MacroCondition | TextCondition;

const MACRO_RE = /^(kw|rkwp|rkwc|kwc|children)(!=|>=|<=|=|>|<)(-?\d+)$/;

export function parseGroupFilter(query: string): GroupFilterCondition[] {
  if (!query.trim()) return [];
  const conditions: GroupFilterCondition[] = [];
  const tokens = query.trim().split(/\s+/);

  for (const token of tokens) {
    const m = token.match(MACRO_RE);
    if (m) {
      conditions.push({
        type: 'macro',
        macro: m[1] as MacroName,
        operator: m[2] as MacroCondition['operator'],
        value: parseInt(m[3], 10),
      });
    } else {
      const lastText = conditions.length > 0 && conditions[conditions.length - 1].type === 'text'
        ? conditions[conditions.length - 1] as TextCondition
        : null;
      if (lastText) {
        lastText.text += ' ' + token;
      } else {
        conditions.push({ type: 'text', text: token });
      }
    }
  }
  return conditions;
}

export function evaluateMacro(
  macro: MacroName,
  groupId: KCID,
  groups: Group[],
  phrases: Phrase[],
  selectedPhraseIds: Set<KCID>,
  phraseCountMap?: Map<KCID, number>,
): number {
  const getCount = (gid: KCID) => phraseCountMap?.get(gid) ?? phrases.filter(p => p.groupId === gid).length;

  switch (macro) {
    case 'kw':
      return getCount(groupId);

    case 'rkwp': {
      let total = 0;
      let currentId: KCID | null = groupId;
      const visited = new Set<string>();
      while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        total += getCount(currentId);
        const g = groups.find(gr => gr.id === currentId);
        currentId = g?.parentId ?? null;
      }
      return total;
    }

    case 'rkwc': {
      const childrenMap = buildChildrenMap(groups);
      const ids = collectWithDescendants(groupId, childrenMap);
      let total = 0;
      for (const id of ids) {
        total += getCount(id);
      }
      return total;
    }

    case 'kwc':
      return phrases.filter(p => p.groupId === groupId && selectedPhraseIds.has(p.id)).length;

    case 'children':
      return groups.filter(g => g.parentId === groupId).length;

    default:
      return 0;
  }
}

export function compareNumbers(actual: number, operator: string, target: number): boolean {
  switch (operator) {
    case '=':  return actual === target;
    case '!=': return actual !== target;
    case '>':  return actual > target;
    case '<':  return actual < target;
    case '>=': return actual >= target;
    case '<=': return actual <= target;
    default:   return false;
  }
}

export function matchesFilter(
  group: Group,
  conditions: GroupFilterCondition[],
  groups: Group[],
  phrases: Phrase[],
  selectedPhraseIds: Set<KCID>,
  phraseCountMap?: Map<KCID, number>,
): boolean {
  if (conditions.length === 0) return true;
  return conditions.every(cond => {
    if (cond.type === 'text') {
      return group.name.toLowerCase().includes(cond.text.toLowerCase());
    } else {
      const val = evaluateMacro(cond.macro, group.id, groups, phrases, selectedPhraseIds, phraseCountMap);
      return compareNumbers(val, cond.operator, cond.value);
    }
  });
}

export function subtreeMatchesFilter(
  group: Group,
  conditions: GroupFilterCondition[],
  groups: Group[],
  phrases: Phrase[],
  selectedPhraseIds: Set<KCID>,
  phraseCountMap?: Map<KCID, number>,
): boolean {
  if (matchesFilter(group, conditions, groups, phrases, selectedPhraseIds, phraseCountMap)) return true;
  const children = groups.filter(g => g.parentId === group.id);
  return children.some(child => subtreeMatchesFilter(child, conditions, groups, phrases, selectedPhraseIds, phraseCountMap));
}
