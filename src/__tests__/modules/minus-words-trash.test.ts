// ============================================================
// Tests: minus-words → trash integration
// Covers all scenarios for applying minus words and ensuring
// phrases go to the trash (not permanently deleted),
// can be restored, and trash-only phrases are not double-moved.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/plugin-sdk';

function resetStore() {
  useAppStore.getState().clearAll();
}

function getTrashGroup() {
  return useAppStore.getState().groups.find(g => g.isTrash);
}

function getTrashPhrases() {
  const trash = getTrashGroup();
  return trash ? useAppStore.getState().phrases.filter(p => p.groupId === trash.id) : [];
}

function getPhrasesInGroup(groupId: string) {
  return useAppStore.getState().phrases.filter(p => p.groupId === groupId);
}

describe('use App Store', () => {
  beforeEach(() => {
    resetStore();
  });

  // ---- applyMinusWords moves to trash, not permanent delete ----

  describe('applyMinusWords: moves to trash instead of permanent delete', () => {
    it('should move matching phrases to trash (broad match)', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      useAppStore.getState().addPhrases(['купить ноутбук', 'ноутбук бесплатно', 'компьютер'], g1);
      useAppStore.getState().addMinusWord('бесплатно', false, null, 'broad');

      const result = useAppStore.getState().applyMinusWords();

      expect(result.removed).toBe(1);

      // Trash group should exist
      const trash = getTrashGroup();
      expect(trash).toBeDefined();
      expect(trash!.name).toBe('Корзина');
      expect(trash!.isTrash).toBe(true);

      // Phrase should be IN the trash, not permanently deleted
      const trashPhrases = getTrashPhrases();
      expect(trashPhrases).toHaveLength(1);
      expect(trashPhrases[0].text).toBe('ноутбук бесплатно');
      expect((trashPhrases[0] as any)._originalGroupId).toBe(g1);

      // Other phrases should still be in the original group
      const remaining = getPhrasesInGroup(g1);
      expect(remaining).toHaveLength(2);
      expect(remaining.map(p => p.text)).toContain('купить ноутбук');
      expect(remaining.map(p => p.text)).toContain('компьютер');
    });

    it('should move matching phrases to trash (exact match)', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      useAppStore.getState().addPhrases(['ноутбук', 'ноутбук купить', 'компьютер'], g1);
      useAppStore.getState().addMinusWord('ноутбук', true, null, 'exact');

      const result = useAppStore.getState().applyMinusWords();

      expect(result.removed).toBe(1);

      const trashPhrases = getTrashPhrases();
      expect(trashPhrases).toHaveLength(1);
      expect(trashPhrases[0].text).toBe('ноутбук');

      // Other phrases stay
      const remaining = getPhrasesInGroup(g1);
      expect(remaining).toHaveLength(2);
    });

    it('should move matching phrases to trash (broad_modified / word match)', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      useAppStore.getState().addPhrases(['бесплатный ноутбук', 'ноутбук бесплатно', 'платный ноутбук'], g1);
      useAppStore.getState().addMinusWord('бесплатно', false, null, 'broad_modified');

      const result = useAppStore.getState().applyMinusWords();

      expect(result.removed).toBe(1);

      const trashPhrases = getTrashPhrases();
      expect(trashPhrases).toHaveLength(1);
      expect(trashPhrases[0].text).toBe('ноутбук бесплатно');
    });

    it('should move multiple matching phrases to trash', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      useAppStore.getState().addPhrases([
        'ноутбук бесплатно',
        'скачать бесплатно',
        'купить ноутбук',
        'компьютер'
      ], g1);
      useAppStore.getState().addMinusWord('бесплатно', false, null, 'broad');

      const result = useAppStore.getState().applyMinusWords();

      expect(result.removed).toBe(2);

      const trashPhrases = getTrashPhrases();
      expect(trashPhrases).toHaveLength(2);
      expect(trashPhrases.map(p => p.text).sort()).toEqual(['ноутбук бесплатно', 'скачать бесплатно']);

      const remaining = getPhrasesInGroup(g1);
      expect(remaining).toHaveLength(2);
    });

    it('should move group-specific minus word phrases to trash only from that group', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      const g2 = useAppStore.getState().addGroup('Группа 2');
      useAppStore.getState().addPhrases(['ноутбук дешево'], g1);
      useAppStore.getState().addPhrases(['ноутбук дешево'], g2);
      useAppStore.getState().addMinusWord('дешево', false, g1, 'broad');

      const result = useAppStore.getState().applyMinusWords();

      expect(result.removed).toBe(1);

      // g2 phrase stays in g2
      expect(getPhrasesInGroup(g2)).toHaveLength(1);

      // g1 phrase is in trash
      const trashPhrases = getTrashPhrases();
      expect(trashPhrases).toHaveLength(1);
      expect((trashPhrases[0] as any)._originalGroupId).toBe(g1);
    });

    it('should NOT delete phrases permanently — total phrase count must be preserved', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      useAppStore.getState().addPhrases(['ноутбук бесплатно', 'купить ноутбук', 'компьютер'], g1);
      useAppStore.getState().addMinusWord('бесплатно', false, null, 'broad');

      const totalBefore = useAppStore.getState().phrases.length;

      useAppStore.getState().applyMinusWords();

      const totalAfter = useAppStore.getState().phrases.length;
      expect(totalAfter).toBe(totalBefore); // No phrases permanently deleted!
    });
  });

  // ---- Skip phrases already in trash ----

  describe('applyMinusWords: skips phrases already in trash', () => {
    it('should NOT move phrases that are already in the trash', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      useAppStore.getState().addPhrases(['ноутбук бесплатно', 'купить бесплатно'], g1);
      useAppStore.getState().addMinusWord('бесплатно', false, null, 'broad');

      // First apply: moves "ноутбук бесплатно" and "купить бесплатно" to trash
      const result1 = useAppStore.getState().applyMinusWords();
      expect(result1.removed).toBe(2);
      expect(getTrashPhrases()).toHaveLength(2);

      const trashPhraseIds = getTrashPhrases().map(p => p.id);

      // Second apply: minus word still exists, but phrases are already in trash
      // Should NOT match them again (they're already removed from active groups)
      const result2 = useAppStore.getState().applyMinusWords();
      expect(result2.removed).toBe(0);

      // Trash phrases should still have correct _originalGroupId (not overwritten)
      const trashPhrasesAfter = getTrashPhrases();
      expect(trashPhrasesAfter).toHaveLength(2);
      for (const p of trashPhrasesAfter) {
        expect((p as any)._originalGroupId).toBe(g1);
      }
    });

    it('should only move NEW matching phrases, not ones already in trash', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      useAppStore.getState().addPhrases(['ноутбук бесплатно'], g1);
      useAppStore.getState().addMinusWord('бесплатно', false, null, 'broad');

      // First apply
      useAppStore.getState().applyMinusWords();
      expect(getTrashPhrases()).toHaveLength(1);

      // Add more phrases that match
      useAppStore.getState().addPhrases(['скачать бесплатно'], g1);

      // Second apply — should only move the new one
      const result = useAppStore.getState().applyMinusWords();
      expect(result.removed).toBe(1);
      expect(getTrashPhrases()).toHaveLength(2);
    });
  });

  // ---- Restore from trash ----

  describe('Restore phrases from trash after applyMinusWords', () => {
    it('should restore phrases moved by applyMinusWords back to their original group', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      useAppStore.getState().addPhrases(['ноутбук бесплатно', 'купить ноутбук'], g1);
      useAppStore.getState().addMinusWord('бесплатно', false, null, 'broad');

      useAppStore.getState().applyMinusWords();

      // Phrase is in trash with _originalGroupId = g1
      const trashPhrases = getTrashPhrases();
      expect(trashPhrases).toHaveLength(1);
      expect((trashPhrases[0] as any)._originalGroupId).toBe(g1);

      // Restore
      useAppStore.getState().restoreFromTrash([trashPhrases[0].id]);

      // Phrase should be back in g1
      expect(getPhrasesInGroup(g1)).toHaveLength(2);
      expect(getPhrasesInGroup(g1).map(p => p.text)).toContain('ноутбук бесплатно');

      // Trash should be empty
      expect(getTrashPhrases()).toHaveLength(0);
    });

    it('should restore multiple phrases at once', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      useAppStore.getState().addPhrases(['ноутбук бесплатно', 'скачать бесплатно', 'купить ноутбук'], g1);
      useAppStore.getState().addMinusWord('бесплатно', false, null, 'broad');

      useAppStore.getState().applyMinusWords();
      expect(getTrashPhrases()).toHaveLength(2);

      const trashIds = getTrashPhrases().map(p => p.id);
      useAppStore.getState().restoreFromTrash(trashIds);

      // All restored
      expect(getPhrasesInGroup(g1)).toHaveLength(3);
      expect(getTrashPhrases()).toHaveLength(0);
    });

    it('should preserve phrase data (frequency, kei, cpc) after move to trash and restore', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      useAppStore.getState().addPhrases(['ноутбук бесплатно'], g1, [
        { frequency: 1200, kei: 5, cpc: 42.5 }
      ]);
      useAppStore.getState().addMinusWord('бесплатно', false, null, 'broad');

      useAppStore.getState().applyMinusWords();

      const trashPhrases = getTrashPhrases();
      expect(trashPhrases[0].frequency).toBe(1200);
      expect(trashPhrases[0].kei).toBe(5);
      expect(trashPhrases[0].cpc).toBe(42.5);

      // Restore
      useAppStore.getState().restoreFromTrash([trashPhrases[0].id]);

      const restored = getPhrasesInGroup(g1).find(p => p.text === 'ноутбук бесплатно')!;
      expect(restored.frequency).toBe(1200);
      expect(restored.kei).toBe(5);
      expect(restored.cpc).toBe(42.5);
    });
  });

  // ---- Clear trash permanently ----

  describe('Clear trash after applyMinusWords', () => {
    it('should permanently delete phrases only when clearing trash', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      useAppStore.getState().addPhrases(['ноутбук бесплатно', 'купить ноутбук'], g1);
      useAppStore.getState().addMinusWord('бесплатно', false, null, 'broad');

      useAppStore.getState().applyMinusWords();
      expect(getTrashPhrases()).toHaveLength(1);

      // Clear trash — now permanent delete
      useAppStore.getState().clearTrash();
      expect(getTrashPhrases()).toHaveLength(0);

      // Only the non-matching phrase remains
      expect(useAppStore.getState().phrases).toHaveLength(1);
      expect(useAppStore.getState().phrases[0].text).toBe('купить ноутбук');
    });
  });

  // ---- removeMinusWord: only removes the word, not phrases ----

  describe('removeMinusWord: only removes the minus word, does not affect phrases', () => {
    it('should only remove the minus word entry, not any phrases', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      useAppStore.getState().addPhrases(['ноутбук бесплатно', 'купить ноутбук'], g1);
      useAppStore.getState().addMinusWord('бесплатно', false, null, 'broad');

      const mwId = useAppStore.getState().minusWords[0].id;

      // Remove the minus word (not applying it)
      useAppStore.getState().removeMinusWord(mwId);

      // Phrases should be untouched
      expect(useAppStore.getState().phrases).toHaveLength(2);
      expect(useAppStore.getState().minusWords).toHaveLength(0);
      // No trash created
      expect(getTrashGroup()).toBeUndefined();
    });

    it('removing a minus word after applyMinusWords should not affect trash', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      useAppStore.getState().addPhrases(['ноутбук бесплатно', 'купить ноутбук'], g1);
      useAppStore.getState().addMinusWord('бесплатно', false, null, 'broad');

      // Apply first
      useAppStore.getState().applyMinusWords();
      expect(getTrashPhrases()).toHaveLength(1);

      // Now remove the minus word
      const mwId = useAppStore.getState().minusWords[0].id;
      useAppStore.getState().removeMinusWord(mwId);

      // Trash should still have the phrase (unchanged)
      expect(getTrashPhrases()).toHaveLength(1);
      expect(getTrashPhrases()[0].text).toBe('ноутбук бесплатно');
    });
  });

  // ---- Multiple groups ----

  describe('applyMinusWords with multiple groups', () => {
    it('should move phrases from multiple groups to the same trash', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      const g2 = useAppStore.getState().addGroup('Группа 2');
      useAppStore.getState().addPhrases(['ноутбук бесплатно'], g1);
      useAppStore.getState().addPhrases(['скачать бесплатно'], g2);
      useAppStore.getState().addMinusWord('бесплатно', false, null, 'broad');

      const result = useAppStore.getState().applyMinusWords();

      expect(result.removed).toBe(2);
      expect(result.groups).toHaveLength(2);

      // Both in the same trash
      const trashPhrases = getTrashPhrases();
      expect(trashPhrases).toHaveLength(2);
      expect((trashPhrases.find(p => p.text === 'ноутбук бесплатно') as any)?._originalGroupId).toBe(g1);
      expect((trashPhrases.find(p => p.text === 'скачать бесплатно') as any)?._originalGroupId).toBe(g2);
    });

    it('should restore phrases from different groups back to their original groups', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      const g2 = useAppStore.getState().addGroup('Группа 2');
      useAppStore.getState().addPhrases(['ноутбук бесплатно'], g1);
      useAppStore.getState().addPhrases(['скачать бесплатно'], g2);
      useAppStore.getState().addMinusWord('бесплатно', false, null, 'broad');

      useAppStore.getState().applyMinusWords();

      const trashIds = getTrashPhrases().map(p => p.id);
      useAppStore.getState().restoreFromTrash(trashIds);

      expect(getPhrasesInGroup(g1).map(p => p.text)).toContain('ноутбук бесплатно');
      expect(getPhrasesInGroup(g2).map(p => p.text)).toContain('скачать бесплатно');
      expect(getTrashPhrases()).toHaveLength(0);
    });
  });

  // ---- No matches ----

  describe('applyMinusWords with no matching phrases', () => {
    it('should return 0 removed and not create trash when nothing matches', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      useAppStore.getState().addPhrases(['купить ноутбук'], g1);
      useAppStore.getState().addMinusWord('бесплатно', false, null, 'broad');

      const result = useAppStore.getState().applyMinusWords();

      expect(result.removed).toBe(0);
      expect(result.groups).toHaveLength(0);
      expect(getTrashGroup()).toBeUndefined();
      expect(useAppStore.getState().phrases).toHaveLength(1);
    });
  });

  // ---- Sequential apply ----

  describe('Sequential applyMinusWords calls', () => {
    it('should accumulate phrases in trash across multiple applies', () => {
      const g1 = useAppStore.getState().addGroup('Группа 1');
      useAppStore.getState().addPhrases(['ноутбук бесплатно', 'купить ноутбук', 'компьютер бесплатно'], g1);

      // First apply with one minus word
      useAppStore.getState().addMinusWord('бесплатно', false, null, 'broad');
      const result1 = useAppStore.getState().applyMinusWords();
      expect(result1.removed).toBe(2);
      expect(getTrashPhrases()).toHaveLength(2);

      // Add another minus word
      useAppStore.getState().addMinusWord('купить', false, null, 'broad');

      // Second apply
      const result2 = useAppStore.getState().applyMinusWords();
      expect(result2.removed).toBe(1);
      expect(getTrashPhrases()).toHaveLength(3);

      // All 3 phrases in trash, none permanently deleted
      expect(useAppStore.getState().phrases).toHaveLength(3);
    });
  });
});
