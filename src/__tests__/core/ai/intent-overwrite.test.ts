import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/plugin-sdk';
import type { IntentType } from '@/core/types';

describe('Phrase intent store operations', () => {
  beforeEach(() => {
    useAppStore.getState().clearAll();
  });

  it('set intent via setPhraseIntent', () => {
    const groupId = useAppStore.getState().addGroup('Test Group');
    useAppStore.getState().addPhrases(['test keyword'], groupId);
    const phrase = useAppStore.getState().phrases[0];

    useAppStore.getState().setPhraseIntent(phrase.id, 'commercial');
    expect(useAppStore.getState().phrases[0].intent).toBe('commercial');
  });

  it('overwrite existing intent on second call', () => {
    const groupId = useAppStore.getState().addGroup('Test Group');
    useAppStore.getState().addPhrases(['test keyword'], groupId);
    const phrase = useAppStore.getState().phrases[0];

    useAppStore.getState().setPhraseIntent(phrase.id, 'commercial');
    expect(useAppStore.getState().phrases[0].intent).toBe('commercial');

    useAppStore.getState().setPhraseIntent(phrase.id, 'informational');
    expect(useAppStore.getState().phrases[0].intent).toBe('informational');
  });

  it('remove intent tags when setting intent', () => {
    const groupId = useAppStore.getState().addGroup('Test Group');
    useAppStore.getState().addPhrases(['test keyword'], groupId, [{ tags: ['commercial', 'some-tag'] }]);
    const phrase = useAppStore.getState().phrases[0];

    expect(phrase.tags).toContain('commercial');
    expect(phrase.tags).toContain('some-tag');

    useAppStore.getState().setPhraseIntent(phrase.id, 'informational');
    const updated = useAppStore.getState().phrases[0];
    expect(updated.intent).toBe('informational');
    expect(updated.tags).not.toContain('commercial');
    expect(updated.tags).toContain('some-tag');
  });

  it('clear intent via clearPhraseIntent', () => {
    const groupId = useAppStore.getState().addGroup('Test Group');
    useAppStore.getState().addPhrases(['test keyword'], groupId);
    const phrase = useAppStore.getState().phrases[0];

    useAppStore.getState().setPhraseIntent(phrase.id, 'transactional');
    expect(useAppStore.getState().phrases[0].intent).toBe('transactional');

    useAppStore.getState().clearPhraseIntent(phrase.id);
    expect(useAppStore.getState().phrases[0].intent).toBeUndefined();
  });

  it('handle all intent types', () => {
    const intents: IntentType[] = ['transactional', 'commercial', 'informational', 'navigational'];
    const groupId = useAppStore.getState().addGroup('Test Group');
    for (let i = 0; i < intents.length; i++) {
      useAppStore.getState().addPhrases(['keyword-' + i], groupId);
      const phrase = useAppStore.getState().phrases[useAppStore.getState().phrases.length - 1];
      useAppStore.getState().setPhraseIntent(phrase.id, intents[i]);
      const lastIdx = useAppStore.getState().phrases.length - 1;
      expect(useAppStore.getState().phrases[lastIdx].intent).toBe(intents[i]);
    }
  });

  it('support undo after setPhraseIntent', () => {
    const groupId = useAppStore.getState().addGroup('Test Group');
    useAppStore.getState().addPhrases(['test keyword'], groupId);
    const phrase = useAppStore.getState().phrases[0];
    expect(useAppStore.getState().phrases[0].intent).toBeUndefined();

    useAppStore.getState().setPhraseIntent(phrase.id, 'navigational');
    expect(useAppStore.getState().phrases[0].intent).toBe('navigational');

    useAppStore.getState().undo();
    expect(useAppStore.getState().phrases[0].intent).toBeUndefined();
  });

  it('not accumulate intents on batch rerun', () => {
    const groupId = useAppStore.getState().addGroup('Test Group');
    useAppStore.getState().addPhrases(['keyword-a', 'keyword-b'], groupId);

    useAppStore.getState().setPhraseIntent(useAppStore.getState().phrases[0].id, 'commercial');
    useAppStore.getState().setPhraseIntent(useAppStore.getState().phrases[1].id, 'informational');

    useAppStore.getState().setPhraseIntent(useAppStore.getState().phrases[0].id, 'informational');
    useAppStore.getState().setPhraseIntent(useAppStore.getState().phrases[1].id, 'transactional');

    expect(useAppStore.getState().phrases[0].intent).toBe('informational');
    expect(useAppStore.getState().phrases[1].intent).toBe('transactional');
    expect(useAppStore.getState().phrases[0].intent).not.toBe('commercial');
    expect(useAppStore.getState().phrases[1].intent).not.toBe('informational');
  });
});
