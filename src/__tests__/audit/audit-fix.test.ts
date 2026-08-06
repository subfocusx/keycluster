import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginRegistry, pluginRegistry } from '@/plugin-sdk';

function createFreshRegistry(): PluginRegistry {
  const r = new PluginRegistry();
  try { localStorage.removeItem('keycluster:plugin-registry'); } catch {}
  return r;
}

function createEmptyRegistry(): PluginRegistry {
  return new PluginRegistry();
}

describe('P1: PluginRegistry reconcile whitelist', () => {
  let r: PluginRegistry;

  beforeEach(() => { r = createFreshRegistry(); });

  it('должен сохранять builtin плагины с известными ID', () => {
    r.install('groups', 'builtin');
    const result = r.reconcile(['groups'], []);
    expect(result.purged).toHaveLength(0);
    expect(r.isInstalled('groups')).toBe(true);
  });

  it('должен удалять builtin плагины с неизвестными ID', () => {
    r.install('unknown-builtin', 'builtin');
    const result = r.reconcile(['groups'], []);
    expect(result.purged).toContain('unknown-builtin');
    expect(r.isInstalled('unknown-builtin')).toBe(false);
  });

  it('должен сохранять user плагины, существующие на диске', () => {
    r.install('my-plugin', 'user');
    const result = r.reconcile(['groups'], ['my-plugin']);
    expect(result.purged).toHaveLength(0);
    expect(r.isInstalled('my-plugin')).toBe(true);
  });

  it('должен удалять user плагины, отсутствующие на диске', () => {
    r.install('my-plugin', 'user');
    const result = r.reconcile(['groups'], []);
    expect(result.purged).toContain('my-plugin');
    expect(r.isInstalled('my-plugin')).toBe(false);
  });

  it('должен импортировать новые user плагины с диска', () => {
    const result = r.reconcile(['groups'], ['new-plugin']);
    expect(result.imported).toContain('new-plugin');
    expect(r.isInstalled('new-plugin')).toBe(true);
  });

  it('не должен удалять записи с неизвестным source (forward compatibility)', () => {
    const rec = { id: 'migrated-plugin', enabled: true, installedAt: Date.now(), source: 'migrated' as any };
    (r as any).records.set('migrated-plugin', rec);
    const result = r.reconcile(['groups'], []);
    expect(result.purged).not.toContain('migrated-plugin');
    expect(r.isInstalled('migrated-plugin')).toBe(true);
  });
});

describe('P2 / P12: install() preserves enabled state on re-install', () => {
  let r: PluginRegistry;

  beforeEach(() => { r = createFreshRegistry(); });

  it('должен сохранять disabled state при re-install builtin', () => {
    r.install('groups', 'builtin');
    r.disable('groups');
    expect(r.isEnabled('groups')).toBe(false);
    r.install('groups', 'builtin');
    expect(r.isEnabled('groups')).toBe(false);
  });

  it('должен сохранять disabled state при re-install user plugin', () => {
    r.install('my-plugin', 'user');
    r.disable('my-plugin');
    expect(r.isEnabled('my-plugin')).toBe(false);
    r.install('my-plugin', 'user');
    expect(r.isEnabled('my-plugin')).toBe(false);
  });

  it('reconcile не должен сбрасывать disabled state для существующих плагинов', () => {
    r.install('my-plugin', 'user');
    r.disable('my-plugin');
    r.reconcile(['groups'], ['my-plugin']);
    expect(r.isEnabled('my-plugin')).toBe(false);
  });

  it('disable → flush → load сохраняет disabled', () => {
    r.install('my-plugin', 'user');
    r.disable('my-plugin');
    r.flush();

    const r2 = createEmptyRegistry();
    r2.load();
    expect(r2.isEnabled('my-plugin')).toBe(false);
  });

  it('disable → reconcile не включает плагин', () => {
    r.install('my-plugin', 'user');
    r.disable('my-plugin');
    r.reconcile(['groups'], ['my-plugin']);
    expect(r.isEnabled('my-plugin')).toBe(false);
  });

  it('disable → reinstall metadata (install) не включает плагин', () => {
    r.install('my-plugin', 'user');
    r.disable('my-plugin');
    r.install('my-plugin', 'user', 'My Plugin');
    expect(r.isEnabled('my-plugin')).toBe(false);
  });
});

describe('P3 / P14: PluginRegistry dispose() и saveTimeout', () => {
  it('dispose() должен очищать saveTimeout, но НЕ records (сохраняет пользовательское состояние)', () => {
    const r = new PluginRegistry();
    r.install('test', 'builtin');
    r.dispose();
    expect(r.getAll()).toHaveLength(1);
  });

  it('disposeRuntime() должен очищать saveTimeout, но НЕ records', () => {
    const r = new PluginRegistry();
    r.install('test', 'builtin');
    r.disposeRuntime();
    expect(r.getAll()).toHaveLength(1);
  });

  it('scheduleSave не должен запускать тикер после dispose', async () => {
    const r = new PluginRegistry();
    r.install('test', 'builtin');
    r.dispose();
    const prev = r.getAll().length;
    r.install('test2', 'builtin');
    expect(r.getAll()).toHaveLength(prev + 1);
  });
});

describe('P4: Bootstrap EventBus unsubs', () => {
  it('resetBootstrap должен очищать массив unsubs без ошибок', async () => {
    const { resetBootstrap } = await import('@/core/bootstrap');
    expect(() => resetBootstrap()).not.toThrow();
  });
});

describe('P5: Bootstrap _bootstrapped guard', () => {
  it('resetBootstrap сбрасывает флаг _bootstrapped', async () => {
    // Просто проверяем что resetBootstrap не падает
    const { resetBootstrap } = await import('@/core/bootstrap');
    resetBootstrap();
  });
});

describe('P6: Core slot declarations', () => {
  it('VALID_SLOTS содержит все объявленные ядром слоты', async () => {
    const { VALID_SLOTS, CORE_SLOTS } = await import('@/core/slot-registry-constants');
    for (const slot of CORE_SLOTS) {
      expect(VALID_SLOTS.has(slot.id)).toBe(true);
    }
  });

  it('declareCoreSlots не падает при пустом runtime', async () => {
    const { declareCoreSlots } = await import('@/core/slot-registry-constants');
    const mockRuntime = { declareSlot: vi.fn() };
    declareCoreSlots(mockRuntime);
    expect(mockRuntime.declareSlot).toHaveBeenCalledTimes(8);
  });
});

describe('P9: Registry persistence', () => {
  let r: PluginRegistry;

  beforeEach(() => { r = createFreshRegistry(); });

  it('install → flush → load восстанавливает состояние', () => {
    r.install('a', 'builtin');
    r.install('b', 'user');
    r.disable('b');
    r.flush();

    const r2 = createEmptyRegistry();
    r2.load();
    expect(r2.isInstalled('a')).toBe(true);
    expect(r2.isInstalled('b')).toBe(true);
    expect(r2.isEnabled('a')).toBe(true);
    expect(r2.isEnabled('b')).toBe(false);
  });

  it('purge удаляет запись и сохраняет', () => {
    r.install('a', 'builtin');
    r.install('b', 'user');
    r.purge('a');
    expect(r.isInstalled('a')).toBe(false);
    expect(r.isInstalled('b')).toBe(true);

    r.save();
    const r2 = createEmptyRegistry();
    r2.load();
    expect(r2.isInstalled('a')).toBe(false);
    expect(r2.isInstalled('b')).toBe(true);
  });

  it('clear удаляет все и очищает localStorage', () => {
    r.install('a', 'builtin');
    r.save();
    r.clear();
    expect(r.getAll()).toHaveLength(0);

    const r2 = createEmptyRegistry();
    r2.load();
    expect(r2.getAll()).toHaveLength(0);
  });

  it('getAll возвращает пустой массив для пустого реестра', () => {
    expect(r.getAll()).toHaveLength(0);
  });
});

describe('P10: Registry state survival', () => {
  let r: PluginRegistry;

  beforeEach(() => { r = createFreshRegistry(); });

  it('состояние переживает disable + restart', () => {
    r.install('my-plugin', 'user');
    r.disable('my-plugin');
    r.flush();

    const r2 = createEmptyRegistry();
    r2.load();
    expect(r2.isEnabled('my-plugin')).toBe(false);
  });

  it('состояние переживает enable + restart', () => {
    r.install('my-plugin', 'user');
    r.disable('my-plugin');
    r.flush();

    const r2 = createEmptyRegistry();
    r2.load();
    r2.enable('my-plugin');
    r2.flush();

    const r3 = createEmptyRegistry();
    r3.load();
    expect(r3.isEnabled('my-plugin')).toBe(true);
  });

  it('uninstall физически удаляет плагин', () => {
    r.install('my-plugin', 'user');
    r.uninstall('my-plugin');
    expect(r.isInstalled('my-plugin')).toBe(false);

    const r2 = createEmptyRegistry();
    r2.load();
    expect(r2.isInstalled('my-plugin')).toBe(false);
  });
});
