// ╔══════════════════════════════════════════════════════════╗
// ║  @core — ЯДРО KEYCLUSTER                                 ║
// ║  Плагины НЕ ДОЛЖНЫ импортировать этот файл напрямую.    ║
// ╚══════════════════════════════════════════════════════════╝
import { v4 as uuid } from 'uuid';
import type { MinusWord, MinusWordGroup, Phrase, KCID } from '../types';

export interface MinusWordSlice {
  minusWords: MinusWord[];
  minusWordGroups: MinusWordGroup[];
  addMinusWord: (text: string, isExact: boolean, groupId?: KCID | null, searchType?: MinusWord['searchType'], mwGroupId?: KCID | null) => void;
  removeMinusWord: (id: KCID) => void;
  setMinusWordMwGroup: (mwId: KCID, mwGroupId: KCID | null) => void;
  applyMinusWords: (scopeGroupIds?: Set<KCID> | null) => { removed: number; groups: KCID[] };
  createMinusWordGroup: (name: string) => KCID;
  renameMinusWordGroup: (id: KCID, name: string) => void;
  deleteMinusWordGroup: (id: KCID) => void;
  previewMinusWords: (scopeGroupIds?: Set<KCID> | null) => { removed: number; phrases: Phrase[] };
}

export function createMinusWordSlice(set: any, get: any) {
  return {
    minusWords: [] as MinusWord[],
    minusWordGroups: [] as MinusWordGroup[],
    addMinusWord: (text: string, isExact: boolean, groupId: KCID | null = null, searchType: MinusWord['searchType'] = 'broad', mwGroupId: KCID | null = null) => {
      get().pushUndo();
      set((s: any) => ({
        minusWords: [...s.minusWords, { id: uuid(), text, isExact, groupId, searchType, createdAt: Date.now(), mwGroupId }],
      }));
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
      const willBeRemoved: Phrase[] = [];
      const globalExact = new Set<string>();
      const globalBroad = new Set<string>();
      const globalWord = new Set<string>();
      const groupExact = new Map<KCID, Set<string>>();
      const groupBroad = new Map<KCID, Set<string>>();
      const groupWord = new Map<KCID, Set<string>>();

      for (const mw of minusWords) {
        const lower = mw.text.toLowerCase();
        if (mw.groupId === null) {
          if (mw.isExact) globalExact.add(lower);
          else if (mw.searchType === 'broad') globalBroad.add(lower);
          else globalWord.add(lower);
        } else {
          const eMap = mw.isExact ? groupExact : mw.searchType === 'broad' ? groupBroad : groupWord;
          if (!eMap.has(mw.groupId)) eMap.set(mw.groupId, new Set());
          eMap.get(mw.groupId)!.add(lower);
        }
      }

      const buildBroadMatcher = (patterns: string[]): ((text: string) => boolean) => {
        if (patterns.length === 0) return () => false;
        type ACNode = { next: Map<string, ACNode>; output: boolean; fail: ACNode | null };
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
      };
      const globalBroadMatcher = buildBroadMatcher(Array.from(globalBroad));
      const checkPhrase = (text: string, exactSet: Set<string>, broadMatcher: ((t: string) => boolean) | null, wordSet: Set<string>): boolean => {
        const lower = text.toLowerCase();
        if (exactSet.size > 0 && exactSet.has(lower)) return true;
        if (broadMatcher !== null && broadMatcher(lower)) return true;
        if (wordSet.size > 0) {
          const words = lower.split(/\s+/);
          for (const w of words) {
            if (wordSet.has(w)) return true;
          }
        }
        return false;
      };

      for (const phrase of activePhrases) {
        if (checkPhrase(phrase.text, globalExact, globalBroadMatcher, globalWord)) {
          willBeRemoved.push(phrase);
          continue;
        }
        const gExact = groupExact.get(phrase.groupId);
        const gBroad = groupBroad.get(phrase.groupId);
        const gWord = groupWord.get(phrase.groupId);
        if ((gExact?.size ?? 0) + (gBroad?.size ?? 0) + (gWord?.size ?? 0) > 0) {
          const gBroadMatcher = gBroad ? buildBroadMatcher(Array.from(gBroad)) : null;
          if (checkPhrase(phrase.text, gExact ?? new Set(), gBroadMatcher, gWord ?? new Set())) {
            willBeRemoved.push(phrase);
          }
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

      const globalExact = new Set<string>();
      const globalBroad = new Set<string>();
      const globalWord = new Set<string>();
      const groupExact = new Map<KCID, Set<string>>();
      const groupBroad = new Map<KCID, Set<string>>();
      const groupWord = new Map<KCID, Set<string>>();

      for (const mw of state.minusWords) {
        const lower = mw.text.toLowerCase();
        if (mw.groupId === null) {
          if (mw.isExact) globalExact.add(lower);
          else if (mw.searchType === 'broad') globalBroad.add(lower);
          else globalWord.add(lower);
        } else {
          const eMap = mw.isExact ? groupExact : mw.searchType === 'broad' ? groupBroad : groupWord;
          if (!eMap.has(mw.groupId)) eMap.set(mw.groupId, new Set());
          eMap.get(mw.groupId)!.add(lower);
        }
      }

      const buildBroadMatcher = (patterns: string[]): ((text: string) => boolean) => {
        if (patterns.length === 0) return () => false;
        type ACNode = { next: Map<string, ACNode>; output: boolean; fail: ACNode | null };
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
      };
      const globalBroadMatcher = buildBroadMatcher(Array.from(globalBroad));
      const groupBroadMatchers = new Map<KCID, (text: string) => boolean>();
      for (const [gid, set] of groupBroad) groupBroadMatchers.set(gid, buildBroadMatcher(Array.from(set)));

      const checkPhrase = (phraseText: string, exactSet: Set<string>, broadMatcher: ((t: string) => boolean) | null, wordSet: Set<string>): boolean => {
        const lower = phraseText.toLowerCase();
        if (exactSet.size > 0 && exactSet.has(lower)) return true;
        if (broadMatcher !== null && broadMatcher(lower)) return true;
        if (wordSet.size > 0) {
          const words = lower.split(/\s+/);
          for (const w of words) {
            if (wordSet.has(w)) return true;
          }
        }
        return false;
      };

      for (const phrase of state.phrases) {
        if (trashGroupId && phrase.groupId === trashGroupId) continue;
        if (scopeGroupIds && !scopeGroupIds.has(phrase.groupId)) continue;

        if (checkPhrase(phrase.text, globalExact, globalBroadMatcher, globalWord)) {
          matchedIds.push(phrase.id);
          affectedGroups.add(phrase.groupId);
          continue;
        }

        const gExact = groupExact.get(phrase.groupId);
        const gBroadMatcher = groupBroadMatchers.get(phrase.groupId) ?? null;
        const gWord = groupWord.get(phrase.groupId);
        if ((gExact?.size ?? 0) + (gBroadMatcher !== null ? 1 : 0) + (gWord?.size ?? 0) > 0) {
          if (checkPhrase(phrase.text, gExact ?? new Set(), gBroadMatcher, gWord ?? new Set())) {
            matchedIds.push(phrase.id);
            affectedGroups.add(phrase.groupId);
          }
        }
      }

      if (matchedIds.length > 0) {
        get().moveToTrash(matchedIds);
      }

      return { removed: matchedIds.length, groups: Array.from(affectedGroups) };
    },
  };
}
