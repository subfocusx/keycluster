import type { StoreAccess } from './store';
import type { EventBus } from './events';
import type { Phrase } from './domain';

export type BuiltinUISlot =
  | 'ribbon:file'
  | 'ribbon:tools'
  | 'ribbon:import-export'
  | 'left-panel'
  | 'right-panel'
  | 'context-menu:phrase'
  | 'context-menu:group'
  | 'phrase-row:actions'
  | 'group:toolbar'
  | 'workspace:panel'
  | 'workspace:layout'
  | 'settings:tab'
  | 'theme'
  | 'status-bar';

export type UISlot = BuiltinUISlot | string;

export interface PhraseActionContext {
  store: StoreAccess;
  eventBus: EventBus;
}

export interface ModuleUIContribution {
  slot: UISlot;
  label: string;
  icon?: string;
  component?: React.ComponentType<any>;
  order?: number;
  when?: string;
  priority?: number;
  moduleId?: string;
  action?: (item: any, ctx: PhraseActionContext) => void;
  tooltip?: string;
  themeId?: string;
  cssVars?: Record<string, string>;
  cssText?: string;
  layoutComponent?: React.ComponentType<WorkspaceLayoutProps>;
  tabId?: string;
  tabLabel?: string;
}

export interface WorkspaceLayoutProps {
  children: React.ReactNode;
  ctx: any;
}

export interface FilterContext {
  currentGroupId: string | null;
  selectedGroupIds: Set<string>;
  searchQuery: string;
}

export interface FilterContribution {
  id: string;
  label: string;
  predicate: (phrase: Phrase, context: FilterContext) => boolean;
  settingsComponent?: React.ComponentType<Record<string, unknown>>;
}

export interface SettingFieldSchema {
  key: string;
  type: 'boolean' | 'string' | 'number' | 'select';
  label: string;
  default: unknown;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
}

export interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  icon?: string;
  category?: 'algorithms' | 'data' | 'analysis' | 'system' | 'custom' | 'seo';
  dependencies?: string[];
  entry?: string;
  slot: UISlot[];
  settingsSchema?: SettingFieldSchema[];
  settingsComponent?: React.ComponentType<{ moduleId: string }>;
  allowedDomains?: string[];
  repository?: string;
  minAppVersion?: string;
  updateUrl?: string;
}

export interface InternalModuleManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  icon?: string;
  category?: 'algorithms' | 'data' | 'analysis' | 'system' | 'custom' | 'seo';
  dependencies: string[];
  entry?: string;
  slot: UISlot[];
  settingsSchema: SettingFieldSchema[];
  settingsComponent?: React.ComponentType<{ moduleId: string }>;
  allowedDomains?: string[];
  repository?: string;
  minAppVersion?: string;
  updateUrl?: string;
}

export interface AppModule {
  manifest: InternalModuleManifest;
  init(ctx: import('../plugin-api').PluginContext): void | Promise<void>;
  destroy(): void | Promise<void>;
}

export type { PluginContext as ModuleContext } from '../plugin-api';
