import type { Logger } from '../logging/types';
import type { ModuleStatus } from '../module-runtime-types';
import type { AppStore } from '../store';

export interface PlatformStateAPI {
  get: <T>(selector: (state: AppStore) => T) => T;
  dispatch: (action: string, payload?: unknown) => void;
  /** Открыть/закрыть левую панель. moduleId — id плагина (manifest.id) */
  openPanel: (moduleId: string) => void;
  closePanel: () => void;
}

export interface PlatformEventsAPI {
  on: (event: string, handler: (payload?: unknown) => void) => () => void;
}

export interface PlatformCommandsAPI {
  execute: (id: string) => void;
  register: (id: string, handler: () => void) => () => void;
}

export interface PlatformRuntimeAPI {
  getStatus: () => ModuleStatus | undefined;
  getModuleIds: () => string[];
  isModuleEnabled: (id: string) => boolean;
  setModuleEnabled: (id: string, enabled: boolean) => void;
}

export interface HttpRequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string;
}

export interface HttpResponse {
  status: number;
  body: string;
  headers: Record<string, string>;
}

export interface PlatformAPI {
  logger: Logger;
  state: PlatformStateAPI;
  events: PlatformEventsAPI;
  commands: PlatformCommandsAPI;
  runtime: PlatformRuntimeAPI;
  /**
   * Выполнить HTTP-запрос через Tauri IPC (обходит CORS).
   * Плагины должны использовать этот метод вместо window.fetch
   * для запросов к внешним доменам.
   */
  httpRequest(options: HttpRequestOptions): Promise<HttpResponse>;
}
