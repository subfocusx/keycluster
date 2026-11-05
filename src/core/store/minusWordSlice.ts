// ╔══════════════════════════════════════════════════════════╗
// ║  @core — ЯДРО KEYCLUSTER                                 ║
// ║  Плагины НЕ ДОЛЖНЫ импортировать этот файл напрямую.    ║
// ╚══════════════════════════════════════════════════════════╝
import { v4 as uuid } from 'uuid';
import type { MinusWord, MinusWordGroup, Phrase, KCID, Group } from '../types';

export interface MinusWordSlice {
  minusWords: MinusWord[];
  minusWordGroups: MinusWordGroup[];
  addMinusWord: (text: string, isExact: boolean, groupId?: KCID | null, searchType?: MinusWord['searchType'], mwGroupId?: KCID | null) => boolean;
  removeMinusWord: (id: KCID) => void;
  setMinusWordMwGroup: (mwId: KCID, mwGroupId: KCID | null) => void;
  applyMinusWords: (scopeGroupIds?: Set<KCID> | null) => { removed: number; groups: KCID[] };
  createMinusWordGroup: (name: string) => KCID;
  renameMinusWordGroup: (id: KCID, name: string) => void;
  deleteMinusWordGroup: (id: KCID) => void;
  previewMinusWords: (scopeGroupIds?: Set<KCID> | null) => { removed: number; phrases: Phrase[] };
}

// ---- Helpers (pure) ----

/** Normalized key for duplicate detection: lowercase + collapsed spaces */
export function normalizeMinusText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Duplicate key of a minus word: same text + same target group scope.
 * `exact`/`searchType` do not take part in the key — one text per scope is enough,
 * otherwise the list accumulates visually identical rows and deleting one of them
 * looks like "the word is still in the list".
 */
export function minusWordKey(mw: { text: string; groupId?: KCID | null }): string {
  return `${normalizeMinusText(mw.text)}::${mw.groupId ?? 'global'}`;
}

/**
 * Drop duplicate rows (same text + same scope), keeping the first occurrence.
 * Applied on rehydrate/load so that lists saved by older versions
 * do not keep visually identical duplicates.
 */
export function dedupeMinusWords(minusWords: MinusWord[]): MinusWord[] {
  const seen = new Set<string>();
  const out: MinusWord[] = [];
  for (const mw of minusWords) {
    const key = minusWordKey(mw);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(mw);
  }
  return out;
}

/** Collect the group itself and all its descendants. */
export function collectDescendantGroupIds(gid: KCID, groups: Group[]): Set<KCID> {
  const ids = new Set<KCID>();
  const walk = (id: KCID) => {
    if (ids.has(id)) return;
    ids.add(id);
    for (const g of groups.filter(g => g.parentId === id)) walk(g.id);
  };
  walk(gid);
  return ids;
}

// ---- Aho-Corasick ----

type ACNode = { next: Map<string, ACNode>; output: boolean; fail: ACNode | null };

function buildBroadMatcher(patterns: string[]): ((text: string) => boolean) {
  if (patterns.length === 0) return () => false;
  const root: ACNode = { next: new Map(), output: false, fail: null };
  for (const p of patterns) {
    let node = root;
    for (const ch of p) {
      if (!node.next.has(ch)) node.next.set(ch, { next: new Map(), output: false, fail: null });
      node = node.next.get(ch)!;
    }
    node.output = true;
  }
  const queue: ACNode[] = [];
  for (const child of root.next.values()) { child.fail = root; queue.push(child); }
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const [ch, child] of cur.next) {
      let f = cur.fail;
      while (f !== null && !f.next.has(ch)) f = f.fail;
      child.fail = f !== null ? f.next.get(ch)! : root;
      if (child.fail.output) child.output = true;
      queue.push(child);
    }
  }
  return (text: string): boolean => {
    let node = root;
    for (const ch of text) {
      while (node !== root && !node.next.has(ch)) node = node.fail!;
      if (node.next.has(ch)) node = node.next.get(ch)!;
      if (node.output) return true;
    }
    return false;
  };
}

// ---- Matcher model ----

interface GroupMatchers {
  exact: Set<string>;
  broadMatcher: ((t: string) => boolean) | null;
  word: Set<string>;
}

interface MinusMatcherModel {
  global: GroupMatchers;
  byGroup: Map<KCID, GroupMatchers>;
}

function emptyGroupMatchers(): GroupMatchers {
  return { exact: new Set(), broadMatcher: null, word: new Set() };
}

function checkPhrase(text: string, m: GroupMatchers): boolean {
  const lower = text.toLowerCase();
  if (m.exact.size > 0 && m.exact.has(lower)) return true;
  if (m.broadMatcher !== null && m.broadMatcher(lower)) return true;
  if (m.word.size > 0) {
    for (const w of lower.split(/\s+/)) {
      if (m.word.has(w)) return true;
    }
  }
  return false;
}

/**
 * Build the matcher model.
 *
 * A minus word assigned to a group applies to that group **and all of its
 * descendant groups** — the same rule the UI uses for the scope hint and for
 * the per-group minus-word counter in the groups panel.
 */
export function buildMinusMatcherModel(minusWords: MinusWord[], groups: Group[]): MinusMatcherModel {
  const global = emptyGroupMatchers();
  const byGroup = new Map<KCID, GroupMatchers>();
  const globalBroad: string[] = [];
  const groupBroad = new Map<KCID, string[]>();

  const targetsFor = (groupId: KCID): KCID[] => Array.from(collectDescendantGroupIds(groupId, groups));

  for (const mw of minusWords) {
    const lower = normalizeMinusText(mw.text);
    if (!lower) continue;
    const isExact = mw.isExact || mw.searchType === 'exact';
    if (mw.groupId === null || mw.groupId === undefined) {
      if (isExact) global.exact.add(lower);
      else if (mw.searchType === 'broad') globalBroad.push(lower);
      else global.word.add(lower);
    } else {
      for (const gid of targetsFor(mw.groupId)) {
        let m = byGroup.get(gid);
        if (!m) { m = emptyGroupMatchers(); byGroup.set(gid, m); }
        if (isExact) m.exact.add(lower);
        else if (mw.searchType === 'broad') {
          let arr = groupBroad.get(gid);
          if (!arr) { arr = []; groupBroad.set(gid, arr); }
          arr.push(lower);
        } else m.word.add(lower);
      }
    }
  }

  global.broadMatcher = buildBroadMatcher(globalBroad);
  for (const [gid, arr] of groupBroad) {
    const m = byGroup.get(gid);
    if (m) m.broadMatcher = buildBroadMatcher(arr);
  }
  return { global, byGroup };
}

/**
 * Return the phrases that must be excluded by the given minus words.
 * Single source of truth for matching — the minus-words panel preview and
 * the store's preview/apply use exactly the same rules.
 */
export function matchPhrasesByMinusWords(
  phrases: Phrase[],
  minusWords: MinusWord[],
  groups: Group[] = [],
  scopeGroupIds: Set<KCID> | null = null,
): Phrase[] {
  const model = buildMinusMatcherModel(minusWords, groups);
  const trashGroupId = groups.find(g => g.isTrash)?.id;
  return phrases.filter(phrase => {
    if (trashGroupId && phrase.groupId === trashGroupId) return false;
    if (scopeGroupIds && !scopeGroupIds.has(phrase.groupId)) return false;
    if (checkPhrase(phrase.text, model.global)) return true;
    const gm = model.byGroup.get(phrase.groupId);
    return !!gm && checkPhrase(phrase.text, gm);
  });
}

export function createMinusWordSlice(set: any, get: any) {
  return {
    minusWords: [] as MinusWord[],
    minusWordGroups: [] as MinusWordGroup[],
    addMinusWord: (text: string, isExact: boolean, groupId: KCID | null = null, searchType: MinusWord['searchType'] = 'broad', mwGroupId: KCID | null = null): boolean => {
      const trimmed = text.trim().replace(/\s+/g, ' ');
      if (!trimmed) return false;
      const key = minusWordKey({ text: trimmed, groupId });
      const existing = (get().minusWords as MinusWord[]).find(mw => minusWordKey(mw) === key);
      if (existing) return false; // duplicate — keep the list free of identical rows
      get().pushUndo();
      set((s: any) => ({
        minusWords: [...s.minusWords, { id: uuid(), text: trimmed, isExact, groupId, searchType, createdAt: Date.now(), mwGroupId }],
      }));
      return true;
    },
    removeMinusWord: (id: KCID) => {
      get().pushUndo();
      set((s: any) => ({ minusWords: s.minusWords.filter((mw: MinusWord) => mw.id !== id) }));
    },
    setMinusWordMwGroup: (mwId: KCID, mwGroupId: KCID | null) => {
      get().pushUndo();
      set((s: any) => ({
        minusWords: s.minusWords.map((mw: MinusWord) => mw.id === mwId ? { ...mw, mwGroupId } : mw),
      }));
    },
    createMinusWordGroup: (name: string) => {
      get().pushUndo();
      const id = uuid();
      set((s: any) => ({ minusWordGroups: [...s.minusWordGroups, { id, name, createdAt: Date.now() }] }));
      return id;
    },
    renameMinusWordGroup: (id: KCID, name: string) => {
      get().pushUndo();
      set((s: any) => ({
        minusWordGroups: s.minusWordGroups.map((g: MinusWordGroup) => g.id === id ? { ...g, name } : g),
      }));
    },
    deleteMinusWordGroup: (id: KCID) => {
      get().pushUndo();
      set((s: any) => ({
        minusWordGroups: s.minusWordGroups.filter((g: MinusWordGroup) => g.id !== id),
        minusWords: s.minusWords.map((mw: MinusWord) => mw.mwGroupId === id ? { ...mw, mwGroupId: null } : mw),
      }));
    },
    previewMinusWords: (scopeGroupIds: Set<KCID> | null = null) => {
      const { phrases, minusWords, groups } = get();
      const trashGroup = groups.find((g: any) => g.isTrash);
      const activePhrases = phrases.filter((p: Phrase) => {
        if (trashGroup && p.groupId === trashGroup.id) return false;
        if (scopeGroupIds && !scopeGroupIds.has(p.groupId)) return false;
        return true;
      });

      const model = buildMinusMatcherModel(minusWords, groups);
      const willBeRemoved: Phrase[] = [];
      for (const phrase of activePhrases) {
        if (checkPhrase(phrase.text, model.global)) {
          willBeRemoved.push(phrase);
          continue;
        }
        const gm = model.byGroup.get(phrase.groupId);
        if (gm && checkPhrase(phrase.text, gm)) {
          willBeRemoved.push(phrase);
        }
      }
      return { removed: willBeRemoved.length, phrases: willBeRemoved };
    },
    applyMinusWords: (scopeGroupIds: Set<KCID> | null = null) => {
      const state = get();
      const trashGroup = state.groups.find((g: any) => g.isTrash);
      const trashGroupId = trashGroup?.id ?? null;
      const matchedIds: KCID[] = [];
      const affectedGroups = new Set<KCID>();

      const model = buildMinusMatcherModel(state.minusWords, state.groups);

      for (const phrase of state.phrases) {
        if (trashGroupId && phrase.groupId === trashGroupId) continue;
        if (scopeGroupIds && !scopeGroupIds.has(phrase.groupId)) continue;

        const gm = model.byGroup.get(phrase.groupId);
        if (checkPhrase(phrase.text, model.global) || (gm && checkPhrase(phrase.text, gm))) {
          matchedIds.push(phrase.id);
          affectedGroups.add(phrase.groupId);
        }
      }

      if (matchedIds.length > 0) {
        get().moveToTrash(matchedIds);
      }

      return { removed: matchedIds.length, groups: Array.from(affectedGroups) };
    },
  };
}
