// ============================================================
// Tests: store — failedModules (addFailedModule, removeFailedModule)
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/plugin-sdk';

describe('use App Store', () => {
  beforeEach(() => {
    useAppStore.setState({
        ui: {
          leftPanel: { open: false, width: 300, module: null },
          rightPanel: { open: true, width: 280 },
          ribbon: { activeTab: 'file' },
          theme: 'light',
          modulesLoading: false,
          failedModules: [],
          dbPersistenceEnabled: false,
          columnAutoResizeTrigger: 0,
          columnVisibility: {},
          columnLabels: {},
          columnColors: {},
          multigroupMode: false,
        },
    });
  });

  it('should add a failed module', () => {
    const store = useAppStore.getState();
    store.addFailedModule('clustering');

    expect(useAppStore.getState().ui.failedModules).toContain('clustering');
  });

  it('should not add duplicate failed modules', () => {
    const store = useAppStore.getState();
    store.addFailedModule('clustering');
    store.addFailedModule('clustering');

    expect(useAppStore.getState().ui.failedModules.filter(id => id === 'clustering')).toHaveLength(1);
  });

  it('should remove a failed module', () => {
    const store = useAppStore.getState();
    store.addFailedModule('clustering');
    store.removeFailedModule('clustering');

    expect(useAppStore.getState().ui.failedModules).not.toContain('clustering');
  });

  it('should handle removing non-existent module', () => {
    const store = useAppStore.getState();
    store.removeFailedModule('nonexistent');

    expect(useAppStore.getState().ui.failedModules).toHaveLength(0);
  });

  it('should track multiple failed modules', () => {
    const store = useAppStore.getState();
    store.addFailedModule('clustering');
    store.addFailedModule('import-export');

    expect(useAppStore.getState().ui.failedModules).toEqual(
      expect.arrayContaining(['clustering', 'import-export']),
    );
  });
});
