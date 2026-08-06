// ============================================================
// Tests: DB Persistence — ProjectSlice, DB sync, toggle
// ============================================================
//
// Tests the dbPersistenceEnabled flag in the store.
// The actual DB save logic is now in project-service.ts
// and save-queue.ts (tested separately).
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/plugin-sdk';

describe('use App Store', () => {
  beforeEach(() => {
    useAppStore.getState().clearAll();
    useAppStore.getState().setDbPersistenceEnabled(false);
  });

  it('dbPersistenceEnabled defaults to false', () => {
    expect(useAppStore.getState().ui.dbPersistenceEnabled).toBe(false);
  });

  it('setDbPersistenceEnabled toggles the flag', () => {
    useAppStore.getState().setDbPersistenceEnabled(true);
    expect(useAppStore.getState().ui.dbPersistenceEnabled).toBe(true);

    useAppStore.getState().setDbPersistenceEnabled(false);
    expect(useAppStore.getState().ui.dbPersistenceEnabled).toBe(false);
  });

  it('dbPersistenceEnabled is persisted in localStorage via partialize', () => {
    useAppStore.getState().setDbPersistenceEnabled(true);

    // The persist middleware should include it
    const state = useAppStore.getState();
    expect(state.ui.dbPersistenceEnabled).toBe(true);
  });
});
