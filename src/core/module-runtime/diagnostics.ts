import type { RuntimeState, ModuleStatus, PluginStatusDetail, PluginDiagnostics } from '../module-runtime-types';
import type { AppModule } from '../types';
import { pluginRegistry } from '../plugin-registry';
import { UI_REQUIRED_SLOTS } from '../slot-registry-constants';
import { getUIContributions } from './slot-registry';

function detectDetailedStatus(
  state: RuntimeState,
  id: string,
  isFailed: boolean,
  isDisabled: boolean,
  isLoaded: boolean,
  mod: AppModule,
): { status: PluginStatusDetail; error: string | undefined } {
  const error = state.moduleErrors.get(id);

  if (error?.includes('\u043D\u0435 \u044D\u043A\u0441\u043F\u043E\u0440\u0442\u0438\u0440\u0443\u0435\u0442') || error?.includes('\u044D\u043A\u0441\u043F\u043E\u0440\u0442') || error?.includes('\u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D')) {
    return { status: 'import-error', error };
  }

  if (error?.includes('\u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0443') || error?.includes('\u041E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442')) {
    return { status: 'structure-error', error };
  }

  if (isFailed) {
    return { status: 'failed', error };
  }

  if (!isLoaded) {
    return { status: 'not-loaded', error };
  }

  const record = pluginRegistry.get(id);
  if (record?.source === 'user' && mod.manifest.slot.length > 0) {
    const hasRequiredSlots = mod.manifest.slot.some(s => UI_REQUIRED_SLOTS.has(s));
    if (hasRequiredSlots) {
      let hasUI = false;
      for (const slot of mod.manifest.slot) {
        const contribs = getUIContributions(state, slot);
        if (contribs.some(c => c.moduleId === id)) {
          hasUI = true;
          break;
        }
      }
      if (!hasUI) {
        return { status: 'no-ui', error: `\u041F\u043B\u0430\u0433\u0438\u043D \u043D\u0435 \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043B UI \u0432 \u0441\u043B\u043E\u0442\u0430\u0445: ${mod.manifest.slot.join(', ')}. \u0412\u044B\u0437\u043E\u0432\u0438\u0442\u0435 ctx.registerUI() \u0432 init().` };
      }
    }
  }

  return { status: 'ok', error: undefined };
}

export function isModuleFailed(state: RuntimeState, moduleId: string): boolean {
  return state.failedModules.has(moduleId);
}

export function isModuleDisabled(state: RuntimeState, moduleId: string): boolean {
  return state.disabledModules.has(moduleId);
}

export function getModuleStatuses(state: RuntimeState): ModuleStatus[] {
  const result: ModuleStatus[] = [];

  for (const mod of state.modules.values()) {
    const id = mod.manifest.id;
    const isFailed = state.failedModules.has(id);
    const isDisabled = state.disabledModules.has(id);
    const isLoaded = state.contexts.has(id);

    const detail = isDisabled
      ? { status: 'disabled' as PluginStatusDetail, error: undefined }
      : detectDetailedStatus(state, id, isFailed, isDisabled, isLoaded, mod);

    const record = pluginRegistry.get(id);

    let uiCount = 0;
    if (detail.status === 'ok') {
      for (const slot of mod.manifest.slot) {
        uiCount += getUIContributions(state, slot).filter(c => c.moduleId === id).length;
      }
    }

    result.push({
      id,
      name: mod.manifest.name,
      version: mod.manifest.version,
      enabled: !isDisabled,
      status: detail.status,
      error: detail.error,
      initTimeMs: undefined,
      source: record?.source,
      uiContributionsCount: uiCount,
    });
  }

  for (const record of pluginRegistry.getAll()) {
    if (!state.modules.has(record.id)) {
      const isFailed = state.failedModules.has(record.id);

      result.push({
        id: record.id,
        name: record.name ?? record.id,
        version: '\u2014',
        enabled: !isFailed && record.enabled,
        status: isFailed ? 'failed' : 'disabled',
        error: isFailed ? state.moduleErrors.get(record.id) : undefined,
        initTimeMs: undefined,
        source: record.source,
        uiContributionsCount: undefined,
      });
    }
  }

  return result;
}

export function getPluginDiagnostics(state: RuntimeState, moduleId: string): PluginDiagnostics {
  const mod = state.modules.get(moduleId);
  const isFailed = state.failedModules.has(moduleId);
  const isDisabled = state.disabledModules.has(moduleId);
  const isLoaded = state.contexts.has(moduleId);
  const detail = isDisabled
    ? { status: 'disabled' as PluginStatusDetail, error: undefined }
    : detectDetailedStatus(state, moduleId, isFailed, isDisabled, isLoaded, mod!);

  let uiCount = 0;
  if (mod?.manifest.slot) {
    for (const slot of mod.manifest.slot) {
      const contribs = getUIContributions(state, slot);
      uiCount += contribs.filter(c => c.moduleId === moduleId).length;
    }
  }

  const commandCount = [...state.commands.keys()].filter(k => k.startsWith(`${moduleId}:`)).length;

  const injectedCSSCount = document.querySelectorAll(`style[id^="plugin-style-${moduleId}"]`).length +
    (document.getElementById(`theme-${moduleId}`) ? 1 : 0) +
    (document.getElementById(`theme-css-${moduleId}`) ? 1 : 0);

  return {
    id: moduleId,
    version: mod?.manifest.version ?? '\u2014',
    enabled: !isDisabled,
    initialized: isLoaded,
    commandCount,
    uiContributionCount: uiCount,
    listenerScopes: [],
    labelCount: 0,
    injectedCSSCount,
    errors: detail.error,
    status: detail.status,
  };
}
