import { describe, it, expect, beforeEach } from 'vitest';
import { createEventBus } from '@/core/event-bus';
import { createStoreAccess } from '@/core/store';
import { clearModuleCache } from '@/core/module-loader';
import { useSettingsStore } from '@/core/settings-store';
import { clearExportFormats } from '@/core/export-registry';
import { labelRegistry } from '@/core/label-registry';
import { pluginRegistry } from '@/core/plugin-registry';
import { createRuntime } from '@/core/module-runtime';
import { clearSearchProviders } from '@/core/search-provider-registry';
import { buildInternalModuleManifest } from '@/core/validation/module-manifest';
import { clearFilters } from '@/core/filter-registry';
import { validatePluginModule } from '@/core/user-plugin-loader';
import commercialCounterModule from '../../../user-plugins/commercial-counter/index';
import darkThemePlugin from '../../../user-plugins/dark-theme/index';

type AppModule = { manifest: { id: string; name: string; version: string; description: string; slot: string[]; dependencies: string[]; settingsSchema: import('@/plugin-sdk').SettingFieldSchema[] }; init: (ctx: any) => void; destroy: () => void };

function createTestRuntime() {
  const eventBus = createEventBus();
  eventBus.clear();
  const storeAccess = createStoreAccess();
  const rt = createRuntime(eventBus, storeAccess);
  rt.declareSlot('ribbon:tools', { label: 'Tools' });
  rt.declareSlot('workspace:layout', { label: 'Layout' });
  rt.declareSlot('group:toolbar', { label: 'Toolbar' });
  rt.declareSlot('theme', { label: 'Theme', defaultVisible: false });
  return rt;
}

beforeEach(() => {
  localStorage.clear();
  pluginRegistry.clear();
  useSettingsStore.getState().resetModuleSettings('core');
  document.head.innerHTML = '';
  clearModuleCache();
  clearSearchProviders();
  clearExportFormats();
  clearFilters();
});

type PluginTestCase = {
  id: string;
  mod: AppModule;
  uiSlots: string[];
};

const plugins: PluginTestCase[] = [
  { id: 'commercial-counter', mod: { ...commercialCounterModule, manifest: buildInternalModuleManifest(commercialCounterModule.manifest as any) } as unknown as AppModule, uiSlots: ['group:toolbar'] },
  { id: 'dark-theme', mod: { ...darkThemePlugin, manifest: buildInternalModuleManifest(darkThemePlugin.manifest as any) } as unknown as AppModule, uiSlots: [] },
];

describe.each(plugins)('$id lifecycle', ({ id, mod, uiSlots }) => {
  let rt: ReturnType<typeof createTestRuntime>;

  beforeEach(() => {
    rt = createTestRuntime();
  });

  it('validatePluginModule passes', () => {
    expect(validatePluginModule(mod, id)).toBeNull();
    expect(mod.manifest.id).toBe(id);
  });

  it('register -> init -> disable -> reload -> uninstall', async () => {
    // 1. Register
    rt.register(mod);
    expect(rt.getManifests().some(m => m.id === id)).toBe(true);

    // 2. Init
    const initResult = await rt.initOne(id);
    expect(initResult).toBe(true);
    expect(rt.isModuleFailed(id)).toBe(false);

    const diagAfterInit = rt.getPluginDiagnostics(id);
    expect(diagAfterInit.initialized).toBe(true);

    // UI contributions exist (for plugins that register UI)
    for (const slot of uiSlots) {
      const contribs = rt.getUIContributions(slot);
      expect(contribs.filter(c => c.moduleId === id).length).toBeGreaterThanOrEqual(1);
    }

    // 3. Disable (destroy)
    await rt.destroyOne(id);
    const diagDisabled = rt.getPluginDiagnostics(id);
    expect(diagDisabled.status).toBe('disabled');

    // Contributions cleared from all slots
    for (const slot of uiSlots) {
      const contribs = rt.getUIContributions(slot);
      expect(contribs.filter(c => c.moduleId === id)).toHaveLength(0);
    }

    // 4. Re-enable via reloadModule (async)
    const reloadResult = await rt.reloadModule(id);
    expect(reloadResult).toBe(true);
    expect(rt.isModuleFailed(id)).toBe(false);

    // Contributions restored
    for (const slot of uiSlots) {
      const contribs = rt.getUIContributions(slot);
      expect(contribs.filter(c => c.moduleId === id).length).toBeGreaterThanOrEqual(1);
    }

    // 5. Destroy again — no artifacts
    await rt.destroyOne(id);
    for (const slot of uiSlots) {
      const contribs = rt.getUIContributions(slot);
      expect(contribs.filter(c => c.moduleId === id)).toHaveLength(0);
    }

    // Commands cleaned up
    const commands = rt.getCommands();
    for (const key of commands.keys()) {
      expect(key.startsWith(`${id}:`)).toBe(false);
    }

    // Keybindings cleaned up
    const keybindings = rt.getKeybindings();
    expect(keybindings.filter(kb => kb.moduleId === id)).toHaveLength(0);
  });

  it('can be re-initialized after destroy', async () => {
    rt.register(mod);
    expect(await rt.initOne(id)).toBe(true);
    await rt.destroyOne(id);
    const reInit = rt.reloadModule(id);
    expect(reInit).toBeInstanceOf(Promise);
  });
});
