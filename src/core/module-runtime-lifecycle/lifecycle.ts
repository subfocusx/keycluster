import type { AppModule, EventBus, StoreAccess } from '../types';
import type { LifecycleEvent } from '../plugin-api';
import { keybindingManager } from '../keybinding-manager';
import { getCommandRegistry } from '../command-registry';
import type { RuntimeState } from '../module-runtime-types';
import { buildPluginContext } from '../module-runtime-context';
import { LogStore } from '../logging/LogStore';
import { globalErrorCollector } from '../errors/ErrorCollector';
import type { ErrorRecord } from '../errors/types';
import { executionGate } from '../module-execution-gate';
import { pluginRegistry } from '../plugin-registry';
import { PLUGIN_EVENTS } from '../user-plugin-loader';

import { UI_REQUIRED_SLOTS } from '../slot-registry-constants';

import { withTimeout, PLUGIN_INIT_TIMEOUT, PLUGIN_DESTROY_TIMEOUT } from './utils';
import { topologicalSort } from './dependency';
import { runLifecycleHooks } from './hooks';

export class ModuleLifecycleManager {
  constructor(
    private state: RuntimeState,
    private eventBus: EventBus,
    private storeAccess: StoreAccess,
  ) {}

  register(module: AppModule): void {
      if (this.state.modules.has(module.manifest.id)) {
        console.warn(`[Runtime] Module "${module.manifest.id}" already registered, skipping.`);
        return;
      }
      // Normalize manifest so optional fields (dependencies, settingsSchema) are always defined.
      // Mutate in-place to preserve identity (some callers compare by reference).
      const m = module.manifest as unknown as Record<string, unknown>;
      if (m.dependencies === undefined) m.dependencies = [];
      if (m.settingsSchema === undefined) m.settingsSchema = [];
      this.state.modules.set(module.manifest.id, module);
      LogStore._log('info', module.manifest.id, `register: name="${module.manifest.name}" slot=[${module.manifest.slot.join(', ')}]`);
      this.eventBus.emit('module:registered', { id: module.manifest.id });
    }

  async initAll(): Promise<void> {
    if (this.state.initialized) {
      console.warn('[Runtime] Already initialized.');
      return;
    }

    const order = topologicalSort(this.state);
    for (const id of order) {
      if (this.state.disabledModules.has(id)) continue;
      if (!executionGate.isAllowed(id)) {
        console.warn(`[Runtime] Skipping init for blocked module "${id}".`);
        continue;
      }
      if (pluginRegistry.isInstalled(id) && !pluginRegistry.isEnabled(id)) {
        this.state.disabledModules.add(id);
        continue;
      }

      const mod = this.state.modules.get(id)!;
      const ctx = buildPluginContext(this.state, this.eventBus, this.storeAccess, id);
      this.state.contexts.set(id, ctx);

      this.state.initStartTimes.set(id, performance.now());
      LogStore._log('info', id, 'init:started');

      const deps = mod.manifest.dependencies;
      if (deps.length > 0) {
        const missing = deps.filter(dep => {
          const depMod = this.state.modules.get(dep);
          if (!depMod) return true;
          if (this.state.failedModules.has(dep)) return true;
          if (this.state.disabledModules.has(dep)) return true;
          return false;
        });
        if (missing.length > 0) {
          const errorMsg = `Missing dependencies: ${missing.join(', ')}`;
          this.state.failedModules.add(id);
          this.state.moduleErrors.set(id, errorMsg);
          this.eventBus.emit('module:error', { moduleId: id, error: new Error(errorMsg), phase: 'init' });
          LogStore._log('error', id, 'init:blocked', { missing });
          console.error(`[Runtime] Module "${id}" blocked: missing deps ${missing.join(', ')}`);
          continue;
        }
      }

      try {
        await withTimeout(Promise.resolve(mod.init(ctx)), PLUGIN_INIT_TIMEOUT, `init "${id}"`);
        const elapsed = performance.now() - this.state.initStartTimes.get(id)!;
        this.state.moduleErrors.delete(id);
        this.state.failedModules.delete(id);
        this.eventBus.emit('module:initialized', { id, initTimeMs: elapsed });
        LogStore._log('info', id, 'init:completed', { initTimeMs: elapsed });

        if (mod.manifest.slot.length > 0) {
          const hasRequiredSlots = mod.manifest.slot.some(s => UI_REQUIRED_SLOTS.has(s));
          if (!hasRequiredSlots) {
            this.eventBus.emit(PLUGIN_EVENTS.UI_REGISTERED, { pluginId: id, detail: `Theme-only plugin, UI not required` });
          } else {
            let uiCount = 0;
            for (const slot of mod.manifest.slot) {
              const contribs = this.state.slotRegistry.get(slot);
              if (contribs) {
                uiCount += contribs.contributions.filter(c => c.moduleId === id).length;
              }
            }
            if (uiCount > 0) {
              this.eventBus.emit(PLUGIN_EVENTS.UI_REGISTERED, { pluginId: id, detail: `UI components in slots: ${uiCount}` });
            } else {
              this.eventBus.emit(PLUGIN_EVENTS.UI_MISSING, { pluginId: id, detail: `No UI registered in slots: ${mod.manifest.slot.join(', ')}. Call ctx.registerUI() in init().` });
            }
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        this.state.failedModules.add(id);
        this.state.moduleErrors.set(id, errorMsg);
        this.eventBus.emit('module:error', { moduleId: id, error: err, phase: 'init' });
        LogStore._log('error', id, 'init:failed', { error: errorMsg });
        console.error(`[Runtime] Failed to init module "${id}":`, err);
      }
    }
    this.state.initialized = true;
  }

  async destroyAll(): Promise<void> {
    const order = topologicalSort(this.state).reverse();
    for (const id of order) {
      runLifecycleHooks(this.state, this.eventBus, id, 'beforeDestroy');
      this.hardStopModule(id);
      const mod = this.state.modules.get(id);
      if (mod) {
        try {
          await withTimeout(Promise.resolve(mod.destroy()), PLUGIN_DESTROY_TIMEOUT, `destroy "${id}"`);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          this.state.failedModules.add(id);
          this.state.moduleErrors.set(id, errorMsg);
          this.eventBus.emit('module:error', { moduleId: id, error: err, phase: 'destroy' });
          globalErrorCollector.add(id, 'destroy' as unknown as ErrorRecord['phase'], err);
          console.error(`[Runtime] Error destroying "${id}":`, err);
        }
      }
      this.eventBus.offAll(id);
    }
    this.state.contexts.clear();
    this.state.modules.clear();
    this.state.slotRegistry.clear();
    this.state.commands.clear();
    this.state.keybindings.clear();
    this.state.lifecycleHooks.clear();
    this.state.failedModules.clear();
    this.state.disabledModules.clear();
    this.state.initStartTimes.clear();
    this.state.moduleErrors.clear();
    this.state.handles.clear();
    this.state.initialized = false;

    getCommandRegistry().clear();
    keybindingManager.clear();
  }

  async initOne(moduleId: string): Promise<boolean> {
    const mod = this.state.modules.get(moduleId);
    if (!mod) {
      console.warn(`[Runtime] Cannot init unknown module "${moduleId}".`);
      return false;
    }
    if (this.state.disabledModules.has(moduleId)) {
      console.warn(`[Runtime] Cannot init disabled module "${moduleId}". Call enablePlugin() first.`);
      return false;
    }
    if (!executionGate.isAllowed(moduleId)) {
      console.warn(`[Runtime] Cannot init blocked module "${moduleId}".`);
      return false;
    }
    if (this.state.contexts.has(moduleId) && !this.state.failedModules.has(moduleId)) {
      console.warn(`[Runtime] Module "${moduleId}" already initialized.`);
      return true;
    }

    const ctx = buildPluginContext(this.state, this.eventBus, this.storeAccess, moduleId);
    this.state.contexts.set(moduleId, ctx);
    this.state.initStartTimes.set(moduleId, performance.now());
    LogStore._log('info', moduleId, 'init:started');

    const deps = mod.manifest.dependencies;
    if (deps.length > 0) {
      const missing = deps.filter(dep => {
        const depMod = this.state.modules.get(dep);
        if (!depMod) return true;
        if (this.state.failedModules.has(dep)) return true;
        if (this.state.disabledModules.has(dep)) return true;
        return false;
      });
      if (missing.length > 0) {
        const errorMsg = `Missing dependencies: ${missing.join(', ')}`;
        this.state.failedModules.add(moduleId);
        this.state.moduleErrors.set(moduleId, errorMsg);
        this.eventBus.emit('module:error', { moduleId, error: new Error(errorMsg), phase: 'init' });
        LogStore._log('error', moduleId, 'init:blocked', { missing });
        console.error(`[Runtime] Module "${moduleId}" blocked: missing deps ${missing.join(', ')}`);
        return false;
      }
    }

    try {
      await withTimeout(Promise.resolve(mod.init(ctx)), PLUGIN_INIT_TIMEOUT, `init "${moduleId}"`);
      const elapsed = performance.now() - this.state.initStartTimes.get(moduleId)!;
      this.state.moduleErrors.delete(moduleId);
      this.state.failedModules.delete(moduleId);
      this.eventBus.emit('module:initialized', { id: moduleId, initTimeMs: elapsed });
      LogStore._log('info', moduleId, 'init:completed', { initTimeMs: elapsed });

      if (mod.manifest.slot.length > 0) {
        const hasRequiredSlots = mod.manifest.slot.some(s => UI_REQUIRED_SLOTS.has(s));
        if (!hasRequiredSlots) {
          this.eventBus.emit(PLUGIN_EVENTS.UI_REGISTERED, { pluginId: moduleId, detail: `Theme-only plugin, UI not required` });
        } else {
          let uiCount = 0;
          for (const slot of mod.manifest.slot) {
            const contribs = this.state.slotRegistry.get(slot);
            if (contribs) {
              uiCount += contribs.contributions.filter(c => c.moduleId === moduleId).length;
            }
          }
          if (uiCount > 0) {
            this.eventBus.emit(PLUGIN_EVENTS.UI_REGISTERED, { pluginId: moduleId, detail: `UI components in slots: ${uiCount}` });
          } else {
            this.eventBus.emit(PLUGIN_EVENTS.UI_MISSING, { pluginId: moduleId, detail: `No UI registered in slots: ${mod.manifest.slot.join(', ')}. Call ctx.registerUI() in init().` });
          }
        }
      }

      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.state.failedModules.add(moduleId);
      this.state.moduleErrors.set(moduleId, errorMsg);
      this.eventBus.emit('module:error', { moduleId, error: err, phase: 'init' });
      LogStore._log('error', moduleId, 'init:failed', { error: errorMsg });
      console.error(`[Runtime] Failed to init module "${moduleId}":`, err);
      return false;
    }
  }

  private hardStopModule(moduleId: string): void {
    const handle = this.state.handles.get(moduleId);
    if (!handle) return;
    for (const id of handle.timers) globalThis.clearTimeout(id);
    for (const id of handle.intervals) globalThis.clearInterval(id);
    for (const fn of handle.unsubscribers) {
      try { fn(); } catch { /* ignore */ }
    }
    for (const fn of handle.cleanupFns) {
      try { fn(); } catch { /* ignore */ }
    }
    handle.timers.clear();
    handle.intervals.clear();
    handle.unsubscribers.clear();
    handle.cleanupFns.length = 0;
    this.state.handles.delete(moduleId);
  }

  async destroyOne(moduleId: string): Promise<void> {
    const mod = this.state.modules.get(moduleId);
    if (!mod) {
      console.warn(`[Runtime] Cannot destroy unknown module "${moduleId}".`);
      return;
    }

    runLifecycleHooks(this.state, this.eventBus, moduleId, 'beforeDestroy');
    this.hardStopModule(moduleId);

    try {
      await withTimeout(Promise.resolve(mod.destroy()), PLUGIN_DESTROY_TIMEOUT, `destroy "${moduleId}"`);
      LogStore._log('info', moduleId, 'destroy');
    } catch (err) {
      console.error(`[Runtime] Error destroying "${moduleId}":`, err);
      LogStore._log('error', moduleId, 'destroy:error', { error: err instanceof Error ? err.message : String(err) });
    }

    for (const [, entry] of this.state.slotRegistry) {
      entry.contributions = entry.contributions.filter(c => c.moduleId !== moduleId);
    }

    const registry = getCommandRegistry();
    for (const key of this.state.commands.keys()) {
      if (key.startsWith(`${moduleId}:`)) {
        registry.unregister(key);
        this.state.commands.delete(key);
      }
    }

    for (const [key, kb] of [...this.state.keybindings]) {
      if (kb.moduleId === moduleId) {
        this.state.keybindings.delete(key);
        keybindingManager.unregister(key);
      }
    }

    for (const [event, hooks] of this.state.lifecycleHooks) {
      this.state.lifecycleHooks.set(event, hooks.filter(h => h.moduleId !== moduleId));
    }

    this.eventBus.offAll(moduleId);

    this.state.failedModules.delete(moduleId);
    this.state.moduleErrors.delete(moduleId);
    this.state.contexts.delete(moduleId);
    this.state.disabledModules.add(moduleId);

    this.eventBus.emit('module:disabled', { id: moduleId });
    LogStore._log('info', moduleId, 'disabled');
  }

  async reloadModule(moduleId: string, _newMod?: AppModule): Promise<boolean> {
    const mod = this.state.modules.get(moduleId);
    if (!mod) {
      console.warn(`[Runtime] Cannot reload unknown module "${moduleId}".`);
      return false;
    }
    if (!executionGate.isAllowed(moduleId)) {
      console.warn(`[Runtime] Cannot reload blocked module "${moduleId}".`);
      return false;
    }
    runLifecycleHooks(this.state, this.eventBus, moduleId, 'beforeDestroy');
    this.hardStopModule(moduleId);

    // FIX-TS-3: capture registry BEFORE await to avoid use-after-drop
    const registry = getCommandRegistry();

    try {
      await withTimeout(Promise.resolve(mod.destroy()), PLUGIN_DESTROY_TIMEOUT, `destroy "${moduleId}" during reload`);
    } catch (err) {
      console.error(`[Runtime] Error destroying "${moduleId}" during reload:`, err);
    }

    for (const [, entry] of this.state.slotRegistry) {
      entry.contributions = entry.contributions.filter(c => c.moduleId !== moduleId);
    }
    for (const key of this.state.commands.keys()) {
      if (key.startsWith(`${moduleId}:`)) {
        registry.unregister(key);
        this.state.commands.delete(key);
      }
    }

    for (const [key, kb] of [...this.state.keybindings]) {
      if (kb.moduleId === moduleId) {
        this.state.keybindings.delete(key);
        keybindingManager.unregister(key);
      }
    }

    for (const [event, hooks] of this.state.lifecycleHooks) {
      this.state.lifecycleHooks.set(event, hooks.filter(h => h.moduleId !== moduleId));
    }

    this.eventBus.offAll(moduleId);

    this.state.failedModules.delete(moduleId);
    this.state.moduleErrors.delete(moduleId);

    if (_newMod) {
      this.state.modules.set(moduleId, _newMod);
    }

    const ctx = buildPluginContext(this.state, this.eventBus, this.storeAccess, moduleId);
    this.state.contexts.set(moduleId, ctx);
    this.state.initStartTimes.set(moduleId, performance.now());
    LogStore._log('info', moduleId, 'init:started');

    const activeMod = this.state.modules.get(moduleId)!;
    const deps = activeMod.manifest.dependencies;
    if (deps.length > 0) {
      const missing = deps.filter(dep => {
        const depMod = this.state.modules.get(dep);
        if (!depMod) return true;
        if (this.state.failedModules.has(dep)) return true;
        if (this.state.disabledModules.has(dep)) return true;
        return false;
      });
      if (missing.length > 0) {
        const errorMsg = `Missing dependencies: ${missing.join(', ')}`;
        this.state.failedModules.add(moduleId);
        this.state.moduleErrors.set(moduleId, errorMsg);
        this.eventBus.emit('module:error', { moduleId, error: new Error(errorMsg), phase: 'init' });
        LogStore._log('error', moduleId, 'init:blocked', { missing });
        console.error(`[Runtime] Module "${moduleId}" blocked: missing deps ${missing.join(', ')}`);
        return false;
      }
    }

    try {
      await withTimeout(Promise.resolve(activeMod.init(ctx)), PLUGIN_INIT_TIMEOUT, `reload init "${moduleId}"`);
      const elapsed = performance.now() - this.state.initStartTimes.get(moduleId)!;
      this.state.disabledModules.delete(moduleId);
      this.eventBus.emit('module:reloaded', { id: moduleId, initTimeMs: elapsed });
      LogStore._log('info', moduleId, 'init:completed', { initTimeMs: elapsed });
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      for (const key of this.state.commands.keys()) {
        if (key.startsWith(`${moduleId}:`)) {
          registry.unregister(key);
          this.state.commands.delete(key);
        }
      }
      for (const [key, kb] of [...this.state.keybindings]) {
        if (kb.moduleId === moduleId) {
          this.state.keybindings.delete(key);
          keybindingManager.unregister(key);
        }
      }

      this.state.failedModules.add(moduleId);
      this.state.moduleErrors.set(moduleId, errorMsg);
      this.eventBus.emit('module:error', { moduleId, error: err, phase: 'init' });
      LogStore._log('error', moduleId, 'init:failed', { error: errorMsg });
      console.error(`[Runtime] Failed to reload module "${moduleId}":`, err);
      return false;
    }
  }

  topologicalSort(): string[] {
    return topologicalSort(this.state);
  }

  runLifecycleHooks(moduleId: string, event: LifecycleEvent): void {
    runLifecycleHooks(this.state, this.eventBus, moduleId, event);
  }
}
