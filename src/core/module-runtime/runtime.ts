import type { AppModule, InternalModuleManifest, ModuleUIContribution, EventBus, StoreAccess } from '../types';
import type { PluginContext } from '../plugin-api';
import { ModuleLifecycleManager } from '../module-runtime-lifecycle';
import type { SlotOptions, ModuleStatus, PluginStatusDetail, ModuleRuntimeHandle, RuntimeState, PluginDiagnostics } from '../module-runtime-types';
import { pluginRegistry } from '../plugin-registry';
import { LogStore } from '../logging/LogStore';

import { declareSlot, getUIContributions, getDeclaredSlots, getSlotOptions, getAllContributionsBySlot } from './slot-registry';
import { executeCommand, handleKeybinding, getKeybindings, getCommands } from './commands';
import { getModuleStatuses, getPluginDiagnostics, isModuleFailed, isModuleDisabled } from './diagnostics';
import { enableModule, disableModule, enablePlugin, disablePlugin, uninstallPlugin } from './plugin-ops';

export type { SlotOptions, SlotEntry, ModuleStatus, RuntimeState, PluginStatusDetail } from '../module-runtime-types';

export class ModuleRuntimeImpl {
  private state: RuntimeState = {
    modules: new Map(),
    contexts: new Map(),
    slotRegistry: new Map(),
    commands: new Map(),
    keybindings: new Map(),
    lifecycleHooks: new Map(),
    initialized: false,
    failedModules: new Set(),
    disabledModules: new Set(),
    initStartTimes: new Map(),
    moduleErrors: new Map(),
    handles: new Map(),
  };

  private eventBus: EventBus;
  private storeAccess: StoreAccess;
  private lifecycle: ModuleLifecycleManager;
  private enablingPlugins = new Set<string>();

  constructor(eventBus: EventBus, storeAccess: StoreAccess) {
    this.eventBus = eventBus;
    this.storeAccess = storeAccess;
    this.lifecycle = new ModuleLifecycleManager(this.state, this.eventBus, this.storeAccess);
  }

  // ---- Lifecycle Delegation (→ ModuleLifecycleManager) ----

  register(module: AppModule): void {
    this.lifecycle.register(module);
  }

  async initAll(): Promise<void> {
    await this.lifecycle.initAll();
  }

  async destroyAll(): Promise<void> {
    await this.lifecycle.destroyAll();
  }

  async initOne(moduleId: string): Promise<boolean> {
    return await this.lifecycle.initOne(moduleId);
  }

  async destroyOne(moduleId: string): Promise<void> {
    await this.lifecycle.destroyOne(moduleId);
  }

  async reloadModule(moduleId: string): Promise<boolean> {
    let newMod: AppModule | undefined;
    try {
      const { loadModule } = await import('../module-loader');
      const record = pluginRegistry.get(moduleId);
      newMod = await loadModule(moduleId, record?.source);
    } catch {
      // Module not in sourceRepo — reload existing instance
    }
    return this.lifecycle.reloadModule(moduleId, newMod);
  }

  // ---- Slot Registry ----

  declareSlot(slotId: string, options?: SlotOptions): void {
    declareSlot(this.state, slotId, options);
  }

  getUIContributions(slot: string): ModuleUIContribution[] {
    return getUIContributions(this.state, slot);
  }

  getDeclaredSlots(): string[] {
    return getDeclaredSlots(this.state);
  }

  getSlotOptions(slot: string): SlotOptions | undefined {
    return getSlotOptions(this.state, slot);
  }

  getAllContributionsBySlot(): Record<string, ModuleUIContribution[]> {
    return getAllContributionsBySlot(this.state);
  }

  // ---- Commands & Keybindings ----

  executeCommand(id: string): void {
    executeCommand(this.state, id);
  }

  handleKeybinding(keys: string): boolean {
    return handleKeybinding(this.state, keys);
  }

  getKeybindings() {
    return getKeybindings(this.state);
  }

  getCommands(): Map<string, () => void> {
    return getCommands(this.state);
  }

  // ---- Lifecycle Hooks (Settings) ----

  triggerSettingsChange(moduleId: string, key: string, value: unknown): void {
    const hooks = this.state.lifecycleHooks.get('onSettingsChange') ?? [];
    for (const entry of hooks) {
      if (entry.moduleId === moduleId || entry.moduleId === '*') {
        try {
          entry.hook({ moduleId, key, value });
        } catch (err) {
          console.error(`[Runtime] Error in onSettingsChange hook (${entry.moduleId}):`, err);
        }
      }
    }
  }

  // ---- Module Query ----

  getManifests(): InternalModuleManifest[] {
    return Array.from(this.state.modules.values()).map(m => m.manifest);
  }

  getModule(id: string): AppModule | undefined {
    return this.state.modules.get(id);
  }

  getContext(moduleId: string): PluginContext | undefined {
    return this.state.contexts.get(moduleId);
  }

  getModuleStatuses(): ModuleStatus[] {
    return getModuleStatuses(this.state);
  }

  getPluginDiagnostics(moduleId: string): PluginDiagnostics {
    return getPluginDiagnostics(this.state, moduleId);
  }

  isModuleFailed(moduleId: string): boolean {
    return isModuleFailed(this.state, moduleId);
  }

  isModuleDisabled(moduleId: string): boolean {
    return isModuleDisabled(this.state, moduleId);
  }

  getHandle(moduleId: string): ModuleRuntimeHandle {
    let handle = this.state.handles.get(moduleId);
    if (!handle) {
      handle = { timers: new Set(), intervals: new Set(), unsubscribers: new Set(), cleanupFns: [] };
      this.state.handles.set(moduleId, handle);
    }
    return handle;
  }

  // ---- Plugin Enable / Disable / Uninstall ----

  async disableModule(moduleId: string): Promise<void> {
    return disableModule(this.state, this.lifecycle, moduleId);
  }

  async enableModule(moduleId: string): Promise<boolean> {
    return enableModule(this.state, this.eventBus, this.lifecycle, moduleId);
  }

  async enablePlugin(moduleId: string): Promise<boolean> {
    return enablePlugin(this.state, this.eventBus, this.lifecycle, this.enablingPlugins, moduleId);
  }

  async disablePlugin(moduleId: string): Promise<void> {
    return disablePlugin(this.state, this.lifecycle, moduleId);
  }

  async uninstallPlugin(moduleId: string, deleteFiles = true): Promise<void> {
    return uninstallPlugin(this.state, this.eventBus, this.lifecycle, moduleId, deleteFiles);
  }
}

let runtime: ModuleRuntimeImpl | null = null;

export function createRuntime(eventBus: EventBus, storeAccess: StoreAccess): ModuleRuntimeImpl {
  runtime = new ModuleRuntimeImpl(eventBus, storeAccess);
  return runtime;
}

export function getRuntime(): ModuleRuntimeImpl | null {
  return runtime;
}
