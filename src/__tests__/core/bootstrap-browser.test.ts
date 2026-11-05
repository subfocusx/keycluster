import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Regression test: bootstrap must complete in a plain browser
// where the Tauri runtime is absent. There, listen() rejects with
// "Cannot read properties of undefined (reading 'transformCallback')"
// because __TAURI_INTERNALS__ does not exist.
// Without the try/catch guard in bootstrap.ts the await throws
// and the whole bootstrap aborts (no initAll, no completed event).
// ============================================================

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.reject(
    new TypeError("Cannot read properties of undefined (reading 'transformCallback')"),
  )),
  emit: vi.fn(() => Promise.resolve()),
}));

const mockInitLogger = vi.fn();
vi.mock('@/core/tauri-logger', () => ({
  initLogger: (...args: any[]) => mockInitLogger(...args),
  tauriLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockGetAll = vi.fn().mockReturnValue([]);
vi.mock('@/core/plugin-registry', () => ({
  PluginRegistry: class {},
  pluginRegistry: {
    getAll: mockGetAll,
    isInstalled: () => false,
    install: vi.fn(),
    load: vi.fn(),
    get: () => undefined,
    purge: () => {},
    flush: vi.fn(),
    reconcile: vi.fn().mockReturnValue({ purged: [], imported: [], enabled: 0, disabled: 0 }),
  },
}));

const mockLoadModule = vi.fn();
vi.mock('@/core/module-loader', async (importOriginal) => {
  const actual = await importOriginal() as typeof import('@/core/module-loader');
  return {
    ...actual,
    loadModule: mockLoadModule,
  };
});

type BootstrapModule = typeof import('@/core/bootstrap');

let mod: BootstrapModule;

beforeEach(async () => {
  vi.resetModules();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  mockInitLogger.mockReset();
  mockGetAll.mockReturnValue([]);
  mockLoadModule.mockReset();
  localStorage.clear();
  mod = await import('@/core/bootstrap');
});

describe('bootstrap in browser (no Tauri runtime)', () => {
  it('should resolve and reach bootstrap:completed when Tauri listen() throws', async () => {
    await expect(mod.bootstrap()).resolves.toBeUndefined();

    const { LogStore } = await import('@/core/logging/LogStore');
    const logs = LogStore.getAll();
    expect(logs.some(l => l.message === 'bootstrap:started')).toBe(true);
    expect(logs.some(l => l.message === 'bootstrap:completed')).toBe(true);
  });

  it('should set modulesLoading=false even without backend event subscription', async () => {
    const { useAppStore } = await import('@/core/store');

    await mod.bootstrap();

    expect(useAppStore.getState().ui.modulesLoading).toBe(false);
  });
});
