// ============================================================
// Tests: Undo/Redo for new actions
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/plugin-sdk';

function resetStoreWithUndo() {
  useAppStore.getState().clearAll();
}

describe('use App Store', () => {
  beforeEach(() => {
    resetStoreWithUndo();
  });

  it('should undo/redo renameGroup', () => {
    const store = useAppStore.getState();
    const id = store.addGroup('A');
    store.renameGroup(id, 'B');
    expect(useAppStore.getState().groups.find(g => g.id === id)?.name).toBe('B');

    store.undo();
    expect(useAppStore.getState().groups.find(g => g.id === id)?.name).toBe('A');

    store.redo();
    expect(useAppStore.getState().groups.find(g => g.id === id)?.name).toBe('B');
  });

  it('should undo/redo togglePhraseStar', () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('G');
    store.addPhrases(['hello'], gid);
    const pid = useAppStore.getState().phrases[0].id;

    store.togglePhraseStar(pid);
    expect(useAppStore.getState().phrases.find(p => p.id === pid)?.starredAt).toBeDefined();

    store.undo();
    expect(useAppStore.getState().phrases.find(p => p.id === pid)?.starredAt).toBeUndefined();

    store.redo();
    expect(useAppStore.getState().phrases.find(p => p.id === pid)?.starredAt).toBeDefined();
  });

  it('should limit undo stack to 50 items', () => {
    const store = useAppStore.getState();
    for (let i = 0; i < 100; i++) {
      store.addGroup(`G${i}`);
    }
    expect(useAppStore.getState().undoStack.length).toBeLessThanOrEqual(50);
  });

  it('should snapshot phrases even when > 10k phrases (undo works for large projects)', () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('G');
    const texts = Array.from({ length: 10_001 }, (_, i) => `phrase ${i}`);
    store.addPhrases(texts, gid, undefined);

    store.renameGroup(gid, 'G renamed');
    const lastSnapshot = useAppStore.getState().undoStack[useAppStore.getState().undoStack.length - 1];
    expect(lastSnapshot).toBeDefined();
    expect(lastSnapshot.phrases).not.toBeNull();
    expect(lastSnapshot.phrases!.length).toBe(10_001);
  });

  it('should undo operation on large project with > 10k phrases', () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('G');
    const texts = Array.from({ length: 10_001 }, (_, i) => `phrase ${i}`);
    store.addPhrases(texts, gid, undefined);

    const originalName = useAppStore.getState().groups.find(g => g.id === gid)!.name;
    store.renameGroup(gid, 'New Name');

    expect(useAppStore.getState().groups.find(g => g.id === gid)!.name).toBe('New Name');

    store.undo();

    expect(useAppStore.getState().groups.find(g => g.id === gid)!.name).toBe(originalName);
    expect(useAppStore.getState().phrases.length).toBe(10_001);
  });

  it('should undo applyMinusWords (restore phrase group)', () => {
    const store = useAppStore.getState();
    const gid = store.addGroup('G1');
    store.addPhrases(['hello bad'], gid);
    const pid = useAppStore.getState().phrases[0].id;

    // Broad minus word should match substring and move phrase to trash
    store.addMinusWord('bad', false, null, 'broad');
    store.applyMinusWords();

    const trashGroup = useAppStore.getState().groups.find(g => g.isTrash);
    expect(trashGroup).toBeDefined();
    const sAfter = useAppStore.getState();
    const trashId = sAfter.groups.find(g => g.isTrash)!.id;
    expect(sAfter.phrases.find(p => p.id === pid)?.groupId).toBe(trashId);

    store.undo();
    const sUndo = useAppStore.getState();
    expect(sUndo.phrases.find(p => p.id === pid)?.groupId).toBe(gid);
  });
});

