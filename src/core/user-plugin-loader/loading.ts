import { LogStore } from '../logging/LogStore';
import { pluginSourceRepo } from '../plugin-source-repository';
import { pluginRegistry } from '../plugin-registry';
import { PLUGIN_ID_RE } from '../plugin-fs-utils';
import type { AppModule } from '../types';
import { discovered, discoverUserPlugins } from './discovery';
import type { UserPluginManifest } from './discovery';

const LOG_MODULE = 'user-plugin-loader';

export const PLUGIN_EVENTS = {
  DISCOVERED: 'plugin:discovered',
  LOAD_STARTED: 'plugin:load-started',
  LOAD_SUCCESS: 'plugin:load-success',
  LOAD_FAILED: 'plugin:load-failed',
  INVALID_STRUCTURE: 'plugin:invalid-structure',
  UI_REGISTERED: 'plugin:ui-registered',
  UI_MISSING: 'plugin:ui-missing',
  INSTALL_VALIDATED: 'plugin:install-validated',
  INSTALLED: 'plugin:installed',
  UNINSTALLED: 'plugin:uninstalled',
} as const;

export interface PluginEventPayload {
  pluginId: string;
  name?: string;
  version?: string;
  error?: string;
  detail?: string;
}

async function emitPluginEvent(event: string, payload: PluginEventPayload) {
  LogStore._log('info', 'plugin-lifecycle', event, payload);
  try {
    const { getEventBus } = await import('../event-bus');
    const bus = getEventBus();
    if (bus) {
      bus.emit(event, payload);
    }
  } catch {
  }
}

export async function registerDiscoveredPlugins(): Promise<string[]> {
  const plugins = await discoverUserPlugins();
  const registered: string[] = [];

  for (const plugin of plugins) {
    if (pluginSourceRepo.has(plugin.id)) {
      LogStore._log('debug', LOG_MODULE, `Plugin "${plugin.id}" already registered as builtin, skipping user registration`);
      registered.push(plugin.id);
      continue;
    }

    const globPath = `/user-plugins/${plugin.id}/index.ts`;
    const importFn = discovered[globPath];
    if (!importFn) {
      LogStore._log('warn', LOG_MODULE, `Plugin "${plugin.id}" has no matching entry file`);
      continue;
    }

    pluginSourceRepo.registerUser(plugin.id, importFn as () => Promise<Record<string, unknown>>);

    if (!pluginRegistry.isInstalled(plugin.id)) {
      pluginRegistry.install(plugin.id, 'user', plugin.name);
    }

    LogStore._log('info', LOG_MODULE, `Discovered plugin: ${plugin.name} v${plugin.version}`);
    registered.push(plugin.id);
  }

  return registered;
}

export async function loadRuntimePlugin(
  pluginId: string,
  pluginsDir: string,
): Promise<{ default: AppModule }> {
  const { join } = await import('@tauri-apps/api/path');
  const { readTextFile, exists } = await import('@tauri-apps/plugin-fs');

  const manifestPath = await join(pluginsDir, pluginId, 'manifest.json');
  const manifestExists = await exists(manifestPath);
  if (!manifestExists) {
    LogStore._log('warn', LOG_MODULE, `[${pluginId}] LOAD FAILED: manifest.json not found at ${manifestPath}`);
    throw new Error(`manifest.json not found for plugin "${pluginId}"`);
  }
  const manifestContent = await readTextFile(manifestPath, { encoding: 'utf-8' });
  // FIX-TS-2: protect against corrupt JSON
  let manifest: UserPluginManifest;
  try {
    manifest = JSON.parse(manifestContent) as UserPluginManifest;
  } catch {
    LogStore._log('warn', LOG_MODULE, `[${pluginId}] LOAD FAILED: manifest.json is not valid JSON`);
    throw new Error(`manifest.json is not valid JSON for plugin "${pluginId}"`);
  }
  // Basic null checks (type coercion allowed — matches original behavior)
  if (!manifest.id || !manifest.name || !manifest.version) {
    LogStore._log('warn', LOG_MODULE, `[${pluginId}] LOAD FAILED: manifest.json missing required fields (id, name, version)`);
    throw new Error(`manifest.json missing required fields for plugin "${pluginId}"`);
  }

  const entryFile = manifest.entry || 'index.js';
  const entryPath = await join(pluginsDir, pluginId, entryFile);

  const entryExists = await exists(entryPath);
  if (!entryExists) {
    LogStore._log('warn', LOG_MODULE, `[${pluginId}] LOAD FAILED: entry file "${entryFile}" not found at ${entryPath}`);
    throw new Error(`Entry file "${entryFile}" not found for plugin "${pluginId}"`);
  }

  LogStore._log('info', LOG_MODULE, `[${pluginId}] LOAD: reading entry "${entryFile}"`);

  let code = await readTextFile(entryPath, { encoding: 'utf-8' });

  code = code.replace(/var\s+(\w+)\s*=\s*__toESM\(require_react\(\)\);/g, 'var $1 = window.React;');
  code = code.replace(/import\s+\*\s+as\s+React\s+from\s+["']react["']/g, 'const React = window.React');
  code = code.replace(/import\s+React\s+from\s+["']react["']/g, 'const React = window.React');
  code = code.replace(/import\s*\{([^}]+)\}\s*from\s*["']react["']/g, 'const {$1} = window.React');
  code = code.replace(
    /import\s*\{([^}]+)\}\s*from\s*["']react\/jsx-runtime["']/g,
    'const {$1} = window.__react_jsx_runtime',
  );
  code = code.replace(
    /var\s+(React\d*)\s*=\s*__require\(["']react["']\)\s*,/g,
    'var $1 = window.React,',
  );

  const FETCH_SHIM = 'const fetch = window.__pluginFetch ?? window.fetch;\n';
  code = FETCH_SHIM + code;

  LogStore._log('debug', LOG_MODULE, `[${pluginId}] LOAD: creating blob URL (${code.length} bytes)`);
  const blob = new Blob([code], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);

  try {
    const modExports = await import(/* @vite-ignore */ url);
    LogStore._log('info', LOG_MODULE, `[${pluginId}] LOAD SUCCESS: module loaded from blob`);
    return modExports as { default: AppModule };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    LogStore._log('warn', LOG_MODULE, `[${pluginId}] LOAD FAILED: blob import error: ${msg}`);
    throw err;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function registerRuntimeUserPlugins(): Promise<string[]> {
  const { readDir, readTextFile, exists } = await import('@tauri-apps/plugin-fs');
  const { appLocalDataDir } = await import('@tauri-apps/api/path');
  const { join } = await import('@tauri-apps/api/path');

  const registered: string[] = [];

  const base = await appLocalDataDir();
  const pluginsDir = await join(base, 'user-plugins');

  LogStore._log('info', LOG_MODULE, `Runtime discovery: scanning ${pluginsDir}`);

  const dirExists = await exists(pluginsDir);
  if (!dirExists) {
    LogStore._log('debug', LOG_MODULE, 'Runtime discovery: user-plugins dir does not exist, skipping');
    return registered;
  }

  const entries = await readDir(pluginsDir);
  LogStore._log('info', LOG_MODULE, `Runtime discovery: found ${entries.length} entries in user-plugins`);

  for (const entry of entries) {
    if (!entry.isDirectory) {
      LogStore._log('debug', LOG_MODULE, `Runtime discovery: skipping file "${entry.name}" (not a directory)`);
      continue;
    }

    const pluginId = entry.name;

    if (!PLUGIN_ID_RE.test(pluginId)) {
      LogStore._log('warn', LOG_MODULE, `[${pluginId}] SKIP: directory name fails safe-id check`);
      continue;
    }

    LogStore._log('info', LOG_MODULE, `[${pluginId}] === DISCOVERY: found plugin directory ===`);

    try {
      const manifestPath = await join(pluginsDir, pluginId, 'manifest.json');
      const manifestExists = await exists(manifestPath);
      if (!manifestExists) {
        LogStore._log('warn', LOG_MODULE, `[${pluginId}] LOAD MANIFEST FAILED: manifest.json not found, skipping`);
        continue;
      }

      const manifestContent = await readTextFile(manifestPath, { encoding: 'utf-8' });
      let manifest: UserPluginManifest;
      try {
        manifest = JSON.parse(manifestContent) as UserPluginManifest;
      } catch (e) {
        LogStore._log('warn', LOG_MODULE, `[${pluginId}] LOAD MANIFEST FAILED: invalid JSON (${e instanceof Error ? e.message : 'unknown error'}), skipping`);
        continue;
      }

      if (!manifest.id || !manifest.name || !manifest.version) {
        LogStore._log('warn', LOG_MODULE, `[${pluginId}] LOAD MANIFEST FAILED: missing required fields (id, name, version), skipping`);
        continue;
      }

      if (manifest.id !== pluginId) {
        LogStore._log('warn', LOG_MODULE, `[${pluginId}] LOAD MANIFEST FAILED: manifest.id="${manifest.id}" does not match dir name, skipping`);
        continue;
      }

      const entryFile = manifest.entry || 'index.js';
      const normalizedEntry = await (async () => {
        if (entryFile.endsWith('.js')) {
          const jsPath = await join(pluginsDir, pluginId, entryFile);
          const jsExists = await exists(jsPath);
          if (!jsExists) {
            const tsVariant = entryFile.replace(/\.js$/, '.ts');
            const tsPath = await join(pluginsDir, pluginId, tsVariant);
            const tsExists = await exists(tsPath);
            if (tsExists) {
              LogStore._log('info', LOG_MODULE, `[${pluginId}] ENTRY NORMALIZE: "${entryFile}" → "${tsVariant}" (js not found, ts exists)`);
              return tsVariant;
            }
          }
        }
        return entryFile;
      })();
      LogStore._log('info', LOG_MODULE, `[${pluginId}] LOAD MANIFEST SUCCESS: name="${manifest.name}" v=${manifest.version} entry="${normalizedEntry}"`);

      const entryPath = await join(pluginsDir, pluginId, normalizedEntry);
      const entryExists = await exists(entryPath);
      if (!entryExists) {
        const tsPath = await join(pluginsDir, pluginId, 'index.ts');
        const tsExists = await exists(tsPath);
        if (tsExists) {
          LogStore._log('info', LOG_MODULE, `[${pluginId}] ENTRY CHECK: source-only plugin, using Vite import`);
          if (!pluginRegistry.isInstalled(pluginId)) {
            pluginRegistry.install(pluginId, 'user', manifest.name);
            LogStore._log('info', LOG_MODULE, `[${pluginId}] REGISTRY: installed source-only plugin`);
          }
          registered.push(pluginId);
        } else {
          LogStore._log('warn', LOG_MODULE, `[${pluginId}] ENTRY CHECK FAILED: entry "${entryFile}" not found at ${entryPath}, skipping`);
          if (pluginRegistry.isInstalled(pluginId)) {
            pluginRegistry.purge(pluginId);
            LogStore._log('info', LOG_MODULE, `[${pluginId}] REGISTRY: purged orphaned record`);
          }
        }
        continue;
      }

      if (!normalizedEntry.endsWith('.js')) {
        LogStore._log('info', LOG_MODULE, `[${pluginId}] REGISTER IMPORT: entry is "${normalizedEntry}" (not .js), keeping Vite import`);
      } else {
        if (pluginSourceRepo.has(pluginId)) {
          LogStore._log('debug', LOG_MODULE, `[${pluginId}] SKIP REGISTER: already registered via Vite glob, keeping existing importFn`);
          if (!pluginRegistry.isInstalled(pluginId)) {
            pluginRegistry.install(pluginId, 'user', manifest.name);
          }
          registered.push(pluginId);
          continue;
        }

        LogStore._log('info', LOG_MODULE, `[${pluginId}] REGISTER IMPORT: registering FS-based loader for "${normalizedEntry}"`);

        pluginSourceRepo.registerUser(
          pluginId,
          async () => {
            const result = await loadRuntimePlugin(pluginId, pluginsDir);
            return result as unknown as Record<string, unknown>;
          },
        );

        LogStore._log('info', LOG_MODULE, `[${pluginId}] REGISTER IMPORT SUCCESS`);
      }

      if (!pluginRegistry.isInstalled(pluginId)) {
        pluginRegistry.install(pluginId, 'user', manifest.name);
        LogStore._log('info', LOG_MODULE, `[${pluginId}] REGISTRY: installed "${manifest.name}" v${manifest.version}`);
      } else {
        LogStore._log('debug', LOG_MODULE, `[${pluginId}] REGISTRY: already installed, skipping`);
      }

      registered.push(pluginId);
      LogStore._log('info', LOG_MODULE, `[${pluginId}] === REGISTRATION COMPLETE ===`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      LogStore._log('warn', LOG_MODULE, `[${pluginId}] REGISTRATION FAILED: ${msg}`);
    }
  }

  LogStore._log('info', LOG_MODULE, `Runtime discovery: ${registered.length} plugins registered [${registered.join(', ')}]`);
  return registered;
}
