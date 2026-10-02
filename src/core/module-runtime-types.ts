import type { ModuleManifest, ModuleUIContribution } from './types';
import type { PluginContext, RegisteredKeybinding, LifecycleEvent, RegisteredLifecycleHook } from './plugin-api';
import type { ModuleSource } from './module-loader';

export interface SlotOptions {
  label?: string;
  defaultVisible?: boolean;
}

export interface SlotEntry {
  contributions: ModuleUIContribution[];
  options: SlotOptions;
}

export type PluginStatusDetail =
  | 'ok'
  | 'failed'
  | 'loading'
  | 'disabled'
  | 'not-loaded'
  | 'structure-error'
  | 'import-error'
  | 'no-ui'
  | 'api-mismatch';

export interface ModuleStatus {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  status: PluginStatusDetail;
  error?: string;
  initTimeMs?: number;
  source?: ModuleSource;
  /** Количество зарегистрированных UI-компонентов */
  uiContributionsCount?: number;
}

export type TimeoutId = ReturnType<typeof setTimeout>;
export type IntervalId = ReturnType<typeof setInterval>;

export interface ModuleRuntimeHandle {
  timers: Set<TimeoutId>;
  intervals: Set<IntervalId>;
  unsubscribers: Set<() => void>;
  cleanupFns: Array<() => void>;
}

export interface RuntimeState {
  modules: Map<string, AppModule>;
  contexts: Map<string, PluginContext>;
  slotRegistry: Map<string, SlotEntry>;
  commands: Map<string, () => void>;
  keybindings: Map<string, RegisteredKeybinding>;
  lifecycleHooks: Map<LifecycleEvent, RegisteredLifecycleHook[]>;
  initialized: boolean;
  failedModules: Set<string>;
  disabledModules: Set<string>;
  initStartTimes: Map<string, number>;
  moduleErrors: Map<string, string>;
  handles: Map<string, ModuleRuntimeHandle>;
}

import type { AppModule } from './types';

export interface PluginDiagnostics {
  id: string;
  version: string;
  enabled: boolean;
  initialized: boolean;
  commandCount: number;
  uiContributionCount: number;
  listenerScopes: string[];
  labelCount: number;
  injectedCSSCount: number;
  errors: string | undefined;
  status: PluginStatusDetail;
}
