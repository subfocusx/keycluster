import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/plugin-sdk';

describe('use App Store', () => {
  beforeEach(() => {
    useAppStore.getState().clearAll();
  });

  it('set notes via setGroupNotes', () => {
    useAppStore.getState().addGroup('Test Group');
    const id = useAppStore.getState().groups[0].id;
    useAppStore.getState().setGroupNotes(id, 'This is a test group description');
    expect(useAppStore.getState().groups.find(g => g.id === id)?.notes).toBe('This is a test group description');
  });

  it('update existing notes', () => {
    useAppStore.getState().addGroup('Test Group');
    const id = useAppStore.getState().groups[0].id;
    useAppStore.getState().setGroupNotes(id, 'First version');
    useAppStore.getState().setGroupNotes(id, 'Updated version');
    expect(useAppStore.getState().groups.find(g => g.id === id)?.notes).toBe('Updated version');
  });

  it('persist notes through undo/redo', () => {
    useAppStore.getState().addGroup('Test Group');
    const id = useAppStore.getState().groups[0].id;
    useAppStore.getState().setGroupNotes(id, 'Notes for undo test');
    expect(useAppStore.getState().groups.find(g => g.id === id)?.notes).toBe('Notes for undo test');
    useAppStore.getState().undo();
    expect(useAppStore.getState().groups.find(g => g.id === id)?.notes).toBeUndefined();
    useAppStore.getState().redo();
    expect(useAppStore.getState().groups.find(g => g.id === id)?.notes).toBe('Notes for undo test');
  });

  it('clear notes when setting to empty', () => {
    useAppStore.getState().addGroup('Test Group');
    const id = useAppStore.getState().groups[0].id;
    useAppStore.getState().setGroupNotes(id, 'Some notes');
    useAppStore.getState().setGroupNotes(id, '');
    expect(useAppStore.getState().groups.find(g => g.id === id)?.notes).toBe('');
  });

  it('handle notes for multiple groups independently', () => {
    useAppStore.getState().addGroup('Group 1');
    const id1 = useAppStore.getState().groups[useAppStore.getState().groups.length - 1].id;
    useAppStore.getState().addGroup('Group 2');
    const id2 = useAppStore.getState().groups[useAppStore.getState().groups.length - 1].id;

    useAppStore.getState().setGroupNotes(id1, 'Notes for group 1');
    useAppStore.getState().setGroupNotes(id2, 'Notes for group 2');

    expect(useAppStore.getState().groups.find(g => g.id === id1)?.notes).toBe('Notes for group 1');
    expect(useAppStore.getState().groups.find(g => g.id === id2)?.notes).toBe('Notes for group 2');
  });
});
