import { describe, it, expect, beforeEach } from 'vitest';
import { pluginRegistry } from '@/plugin-sdk';

describe('plugin Registry', () => {
  beforeEach(() => {
    pluginRegistry.clear();
  });

  it('updates name for existing record', () => {
    pluginRegistry.install('phrases', 'builtin');
    expect(pluginRegistry.get('phrases')!.name).toBeUndefined();

    pluginRegistry.updateName('phrases', 'Phrases Module');
    expect(pluginRegistry.get('phrases')!.name).toBe('Phrases Module');
  });

  it('does nothing for non-existent record', () => {
    pluginRegistry.updateName('nonexistent', 'Test');
    expect(pluginRegistry.isInstalled('nonexistent')).toBe(false);
  });
});
