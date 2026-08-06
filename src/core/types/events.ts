export type EventMap = Record<string, any>;
export type EventHandler<T = any> = (payload: T) => void;

export interface EventBus {
  on<T>(event: string, handler: EventHandler<T>): () => void;
  onScoped<T>(event: string, scope: string, handler: EventHandler<T>): () => void;
  off<T>(event: string, handler: EventHandler<T>): void;
  emit<T>(event: string, payload?: T): void;
  once<T>(event: string, handler: EventHandler<T>): () => void;
  clear(): void;
  offAll(scopeId?: string): void;
}

export const AppEvents = {
  GROUPS_CHANGED: 'groups:changed',
  PHRASES_CHANGED: 'phrases:changed',
  MINUS_WORDS_CHANGED: 'minus-words:changed',

  GROUP_SELECTED: 'group:selected',
  PHRASE_SELECTED: 'phrase:selected',
  SELECTION_CHANGED: 'selection:changed',

  LEFT_PANEL_OPEN: 'left-panel:open',
  LEFT_PANEL_CLOSE: 'left-panel:close',
  RIGHT_PANEL_TOGGLE: 'right-panel:toggle',
  THEME_CHANGED: 'theme:changed',
  TOOL_OPEN: 'tool:open',
  MULTIGROUP_ENTER: 'multigroup:enter',
  MULTIGROUP_EXIT: 'multigroup:exit',

  MODULE_REGISTERED: 'module:registered',
  MODULE_INITIALIZED: 'module:initialized',
  MODULE_ERROR: 'module:error',
  MODULE_DISABLED: 'module:disabled',
  MODULE_ENABLED: 'module:enabled',
  MODULE_RELOADED: 'module:reloaded',

  IPC_ERROR: 'ipc:error',
  RUNTIME_ERROR: 'runtime:error',

  PHRASES_ADD: 'phrases:add',
  PHRASES_DELETE: 'phrases:delete',
  PHRASES_MOVE: 'phrases:move',
  PHRASES_COPY: 'phrases:copy',
  GROUP_ADD: 'group:add',
  GROUP_DELETE: 'group:delete',
  GROUP_RENAME: 'group:rename',
  GROUP_MOVE: 'group:move',

  PROJECT_LOADED: 'project:loaded',
  PROJECT_UPDATED: 'project:updated',
  DEMO_LOAD: 'demo:load',
} as const;
