// ============================================================
// KeyCluster Plugin SDK — публичный API для плагинов и UI
// Версия: 1.0
//
// Плагины и компоненты импортируют ТОЛЬКО из этого модуля.
// Запрещён прямой импорт из src/core/*.
// ============================================================

// ---- Data Model Types ----
export type { KCID, Phrase, Group, MinusWord, MinusWordGroup, IntentType } from './core/types';

// ---- Module System Types ----
export type {
  AppModule,
  ModuleManifest,
  ModuleContext,
  ModuleUIContribution,
  ModuleUIContribution as UIContribution,
  PhraseActionContext,
  FilterContribution,
  FilterContext,
  SettingFieldSchema,
  UISlot,
  BuiltinUISlot,
  AppState,
  UIState,
  WorkspaceLayoutProps,
} from './core/types';

export type { StoreAccess, EventBus, EventMap, EventHandler } from './core/types';

// ---- Plugin Context ----
export type { PluginContext, PluginAPIVersion, LifecycleEvent, LifecycleHook, KeybindingBinding, RegisteredKeybinding, RegisteredLifecycleHook } from './core/plugin-api';
export { PLUGIN_API_VERSION } from './core/plugin-api';

// ---- Platform API ----
export type { PlatformAPI } from './core/platform-api/types';

// ---- Runtime Values (shared) ----
export { useAppStore } from './core/store';
export type { AppStore } from './core/store';

export { getEventBus } from './core/event-bus';
export { AppEvents } from './core/types';

// ---- Module Runtime ----
export { getRuntime } from './core/module-runtime';
export type { SlotOptions, SlotEntry, ModuleStatus, RuntimeState, PluginStatusDetail, PluginDiagnostics } from './core/module-runtime-types';

// ---- Plugin Registry ----
export { PluginRegistry, pluginRegistry } from './core/plugin-registry';
export type { PluginRecord } from './core/plugin-registry';

// ---- Command Registry ----
export { getCommandRegistry } from './core/command-registry';
export type { CommandEntry } from './core/command-registry';

// ---- Tool Registry ----
export {
  TOOL_REGISTRY,
  getToolsByTab,
  getRibbonTools,
  getToolsByEngine,
  getToolConfig,
  isToolEnabled,
  isToolId,
  setToolEnabled,
} from './core/tool-registry';
export type { ToolId, ToolConfig, ToolTab, ToolEngine } from './core/tool-registry';

// ---- Tab Store ----
export { useTabStore } from './core/store/tabSlice';
export type { CustomTab, TabSlice } from './core/store/tabSlice';

// ---- Settings Store ----
export { useSettingsStore } from './core/settings-store';

// ---- Keybinding Manager ----
export { keybindingManager } from './core/keybinding-manager';

// ---- Context Keys ----
export { getContextKeyService } from './core/context-keys';

// ---- Label Registry ----
export { labelRegistry } from './core/label-registry';

// ---- Toast Notifications ----
export { toast, useToast } from './hooks/use-toast';

// ---- Logging ----
export { LogStore } from './core/logging/LogStore';
export type { LogEntry, LogLevel, LogFilter } from './core/logging/types';
export { globalErrorCollector } from './core/errors/ErrorCollector';
export type { ErrorRecord, ErrorFilter } from './core/errors/types';
export { globalEventFilter } from './core/observability/event-filter';

// ---- Module Loader ----
export {
  loadModule,
  loadManifest,
  preloadModule,
  getAvailableModuleIds,
  getBuiltinModuleIds,
  getUserPluginIds,
  getModuleCacheKeys,
  loadUserPluginManifest,
  getUserPluginPaths,
  ModuleLoadError,
} from './core/module-loader';
export type { ModuleSource } from './core/module-loader';

// ---- User Plugin Loader ----
export {
  validatePluginModule,
  discoverUserPlugins,
  PLUGIN_EVENTS,
} from './core/user-plugin-loader';
export type { UserPluginManifest, PluginEventPayload } from './core/user-plugin-loader';

// ---- Plugin FS Utils ----
export {
  selectPluginFolder,
  readManifestFromFolder,
  validateEntryFile,
  getPluginsDir,
} from './core/plugin-fs-utils';

// ---- Plugin Exporter ----
export { exportPlugin } from './core/plugin-exporter';

// ---- Plugin Updater ----
export { checkForUpdate, downloadAndUpdate } from './core/plugin-updater';
export type { UpdateCheckResult } from './core/plugin-updater';


// ---- Project Service ----
export {
  saveProjectAs,
  saveCurrentProject,
  loadProject,
  listProjects,
  deleteProject,
  exportProject,
  exportProjectWithDialog,
  importProject,
  importProjectFromString,
  getCurrentProjectId,
  enableAutoSave,
  disableAutoSave,
  isAutoSaveEnabled,
  getAutoSaveIntervalMs,
  setAutoSaveIntervalMs,
  getAutoSaveIntervalMinutes,
  setAutoSaveIntervalMinutes,
  getSaveStatus,
  getLastSaveTime,
  getLastSaveError,
  flushSaveQueue,
  recoverFromCrash,
  hasCrashRecovery,
} from './core/project-service';
export type { SaveStatus } from './core/project-service';
export type { ProjectListItem } from './core/project-types';

// ---- Project Statistics ----
export { computeProjectStats, computePhraseStats } from './core/project-statistics';
export type { ProjectStats, PhraseStats, GroupPhraseStat } from './core/project-statistics';

// ---- Search Provider Registry ----
export {
  registerSearchProvider,
  unregisterSearchProvider,
  getAllSearchProviders,
  getSearchProvider,
  clearSearchProviders,
} from './core/search-provider-registry';
export type { SearchProvider } from './core/search-provider-registry';

// ---- Export Registry ----
export {
  registerExportFormat,
  unregisterExportFormat,
  getAllExportFormats,
  getExportFormat,
  clearExportFormats,
} from './core/export-registry';
export type { ExportFormat, ExportPayload } from './core/export-registry';

// ---- Filter Registry ----
export {
  registerFilter,
  unregisterFilter,
  getFilter,
  getAllFilters,
  unregisterFiltersByModule,
  clearFilters,
} from './core/filter-registry';

// ---- Text Preprocessing ----
export {
  preprocessPhrase,
  simpleLemmatize,
  DEFAULT_STOP_WORDS,
} from './core/text-preprocessing';
export type { PreprocessingOptions } from './core/text-preprocessing';

// ---- Minus Words Engine ----
export { suggestMinusWords } from './core/minus-words/minus-words-engine';
export type { MinusWordResult, MinusWordsEngineOptions } from './core/minus-words/minus-words-engine';

// ---- AI ----
export {
  AIService,
  useAIStore,
  DEFAULT_AI_SETTINGS,
  PROVIDER_ENDPOINTS,
  RECOMMENDED_MODELS,
  TOOL_CONFIGS,
  TOOL_MAX_KEYWORDS,
  promptManager,
  validatePlainText,
  tryExtractJson,
  sanitizeAIResponse,
  sanitizeGroupName,
  sanitizeGroupDescription,
} from './core/ai';
export type { AIProvider, ConnectionStatus, PromptKey, PromptTemplates, AISettings, AILogEntry, AIQueueItem, AIToolId, AIChatMessage, AIChatResponse, AIState, AIToolConfig } from './core/ai';

// ---- UI Components (для плагинов) ----
export { Button } from '@/components/ui/button';
export { Input } from '@/components/ui/input';
export { Label } from '@/components/ui/label';
export { Checkbox } from '@/components/ui/checkbox';
export { Badge } from '@/components/ui/badge';
export { Slider } from '@/components/ui/slider';
export { ScrollArea } from '@/components/ui/scroll-area';
export { Progress } from '@/components/ui/progress';
export { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
export { Switch } from '@/components/ui/switch';
export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
export {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
export { useKCDialog, kcAlert } from '@/components/KCDialog';
export { Separator } from '@/components/ui/separator';
export { useActiveGroupIds } from '@/modules/phrases/useActiveGroupIds';
export {
  ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem,
  ContextMenuCheckboxItem, ContextMenuRadioItem, ContextMenuLabel,
  ContextMenuSeparator, ContextMenuShortcut, ContextMenuGroup,
  ContextMenuPortal, ContextMenuSub, ContextMenuSubContent,
  ContextMenuSubTrigger, ContextMenuRadioGroup,
} from '@/components/ui/context-menu';

// ---- Network Monitoring ----
export { NetworkStore } from './core/network/NetworkStore';
export type { NetworkRecord, NetworkRequestStatus } from './core/network/NetworkStore';

// ---- Group Tree Utils ----
export { buildChildrenMap, collectWithDescendants } from './core/utils/group-tree';


