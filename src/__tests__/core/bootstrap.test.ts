import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLoadModule = vi.fn();
const mockInitLogger = vi.fn();
const mockGetAll = vi.fn().mockReturnValue([]);
const mockIsInstalled = vi.fn().mockReturnValue(false);
const mockInstall = vi.fn();
const mockLoad = vi.fn();

const mockTauriLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/core/tauri-logger', () => ({
  initLogger: (...args: any[]) => mockInitLogger(...args),
  tauriLogger: mockTauriLogger,
}));

vi.mock('@/core/plugin-registry', () => ({
  PluginRegistry: class {},
  pluginRegistry: {
    getAll: mockGetAll,
    isInstalled: mockIsInstalled,
    install: mockInstall,
    load: mockLoad,
    get: () => undefined,
    purge: () => {},
    flush: vi.fn(),
    reconcile: vi.fn().mockReturnValue({ purged: [], imported: [], enabled: 0, disabled: 0 }),
  },
}));

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
  mockLoadModule.mockReset();
  mockInitLogger.mockReset();
  mockGetAll.mockReturnValue([]);
  mockIsInstalled.mockReturnValue(false);
  mockInstall.mockReset();
  mockLoad.mockReset();
  localStorage.clear();
  mod = await import('@/core/bootstrap');
});

describe('bootstrap', () => {
  it('should call initLogger on start', async () => {
    await mod.bootstrap();
    expect(mockInitLogger).toHaveBeenCalledOnce();
  });

  it('should set modulesLoading=true then false', async () => {
    const { useAppStore } = await import('@/core/store');

    expect(useAppStore.getState().ui.modulesLoading).toBe(true);

    await mod.bootstrap();

    expect(useAppStore.getState().ui.modulesLoading).toBe(false);
  });

  it('should create eventBus and runtime', async () => {
    expect(mod.eventBus).toBeUndefined();
    expect(mod.runtime).toBeUndefined();

    await mod.bootstrap();

    expect(mod.eventBus).toBeDefined();
    expect(mod.runtime).toBeDefined();
  });

  it('should load enabled modules from registry', async () => {
    mockGetAll.mockReturnValue([
      { id: 'clustering', source: 'builtin', enabled: true },
      { id: 'groups', source: 'builtin', enabled: true },
    ]);
    mockLoadModule.mockImplementation(async (id: string, source: string) => ({
      manifest: { id, name: id, version: '1.0.0', dependencies: [], settingsSchema: [], slot: [] },
      init: vi.fn(),
    }));

    await mod.bootstrap();

    expect(mockLoadModule).toHaveBeenCalledTimes(2);
    expect(mockLoadModule).toHaveBeenCalledWith('clustering', 'builtin');
    expect(mockLoadModule).toHaveBeenCalledWith('groups', 'builtin');
  });

  it('should skip disabled modules', async () => {
    mockGetAll.mockReturnValue([
      { id: 'clustering', source: 'builtin', enabled: false },
      { id: 'groups', source: 'builtin', enabled: true },
    ]);
    mockLoadModule.mockResolvedValue({
      manifest: { id: 'groups', name: 'Groups', version: '1.0.0', dependencies: [], settingsSchema: [], slot: [] },
      init: vi.fn(),
    });

    await mod.bootstrap();

    expect(mockLoadModule).toHaveBeenCalledTimes(1);
    expect(mockLoadModule).toHaveBeenCalledWith('groups', 'builtin');
  });

  it('should handle ModuleLoadError and continue', async () => {
    mockGetAll.mockReturnValue([
      { id: 'clustering', source: 'builtin', enabled: true },
      { id: 'groups', source: 'builtin', enabled: true },
    ]);

    const { ModuleLoadError } = await import('@/core/module-loader');
    mockLoadModule
      .mockRejectedValueOnce(new ModuleLoadError('clustering', 'Failed'))
      .mockResolvedValueOnce({
        manifest: { id: 'groups', name: 'Groups', version: '1.0.0', dependencies: [], settingsSchema: [], slot: [] },
        init: vi.fn(),
      });

    await expect(mod.bootstrap()).resolves.toBeUndefined();
    expect(mockLoadModule).toHaveBeenCalledTimes(2);
  });

  it('should handle non-ModuleLoadError and continue', async () => {
    mockGetAll.mockReturnValue([
      { id: 'clustering', source: 'builtin', enabled: true },
      { id: 'groups', source: 'builtin', enabled: true },
    ]);

    mockLoadModule
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        manifest: { id: 'groups', name: 'Groups', version: '1.0.0', dependencies: [], settingsSchema: [], slot: [] },
        init: vi.fn(),
      });

    await expect(mod.bootstrap()).resolves.toBeUndefined();
    expect(mockLoadModule).toHaveBeenCalledTimes(2);
  });

  it('should handle module init failure gracefully', async () => {
    mockGetAll.mockReturnValue([
      { id: 'clustering', source: 'builtin', enabled: true },
    ]);

    mockLoadModule.mockResolvedValue({
      manifest: { id: 'clustering', name: 'Clustering', version: '1.0.0', dependencies: [], settingsSchema: [], slot: [] },
      init: vi.fn().mockImplementation(() => { throw new Error('init failed'); }),
    });

    await expect(mod.bootstrap()).resolves.toBeUndefined();
  });

  it('should catch initAll catastrophic error', async () => {
    mockGetAll.mockReturnValue([]);

    const runtimeMod = await import('@/core/module-runtime');
    const origCreate = runtimeMod.createRuntime;
    vi.spyOn(runtimeMod, 'createRuntime').mockImplementation((...args: any[]) => {
      const rt = origCreate(args[0], args[1]);
      const origInit = rt.initAll;
      rt.initAll = async () => { throw new Error('rt crash'); };
      return rt;
    });

    vi.setConfig({ testTimeout: 5000 });
    await expect(mod.bootstrap()).resolves.toBeUndefined();
  });

  it('should log bootstrap:started and bootstrap:completed', async () => {
    mockGetAll.mockReturnValue([]);
    await mod.bootstrap();

    const { LogStore } = await import('@/core/logging/LogStore');
    const logs = LogStore.getAll();
    expect(logs.some(l => l.message === 'bootstrap:started')).toBe(true);
    expect(logs.some(l => l.message === 'bootstrap:completed')).toBe(true);
  });

  it('should skip duplicate bootstrap calls', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetAll.mockReturnValue([
      { id: 'clustering', source: 'builtin', enabled: true },
    ]);
    mockLoadModule.mockResolvedValue({
      manifest: { id: 'clustering', name: 'Clustering', version: '1.0.0', dependencies: [], settingsSchema: [], slot: [] },
      init: vi.fn(),
    });

    await mod.bootstrap();
    expect(mockLoadModule).toHaveBeenCalledTimes(1);

    // Second call should be skipped
    await mod.bootstrap();
    expect(mockLoadModule).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith('[Bootstrap] Already bootstrapped, skipping duplicate call.');

    warnSpy.mockRestore();
  });

});

describe('shutdown', () => {
  it('should call destroyAll on runtime if it exists', async () => {
    await mod.bootstrap();
    const destroySpy = vi.spyOn(mod.runtime!, 'destroyAll');
    await mod.shutdown();
    expect(destroySpy).toHaveBeenCalledOnce();
  });

  it('should not throw if runtime is undefined', async () => {
    expect(mod.runtime).toBeUndefined();
    await expect(mod.shutdown()).resolves.not.toThrow();
  });
});
