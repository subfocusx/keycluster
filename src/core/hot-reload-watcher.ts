import { watch } from '@tauri-apps/plugin-fs';
import { appLocalDataDir, join } from '@tauri-apps/api/path';
import { getEventBus } from './event-bus';
import { pluginSourceRepo } from './plugin-source-repository';
import { getRuntime } from './module-runtime';
import { LogStore } from './logging/LogStore';

function extractPluginId(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  const idx = parts.indexOf('user-plugins');
  if (idx !== -1 && idx + 1 < parts.length) {
    return parts[idx + 1];
  }
  return null;
}

export async function startHotReloadWatcher(): Promise<() => void> {
  const bus = getEventBus();
  if (!bus) return () => {};

  const base = await appLocalDataDir();
  const pluginsDir = await join(base, 'user-plugins');

  const unwatch = await watch(pluginsDir, (event) => {
    const seen = new Set<string>();
    for (const path of event.paths) {
      const pluginId = extractPluginId(path);
      if (!pluginId || seen.has(pluginId)) continue;
      seen.add(pluginId);

      pluginSourceRepo.deleteCachedModule(pluginId);

      const runtime = getRuntime();
      if (runtime) {
        runtime.reloadModule(pluginId).then((success) => {
          if (success) {
            bus.emit('plugin:hot-reloaded', { pluginId, timestamp: Date.now() });
            LogStore._log('info', 'hot-reload', `Reloaded plugin "${pluginId}"`);
          }
        }).catch((err) => {
          LogStore._log('error', 'hot-reload', `Reload failed for "${pluginId}": ${err instanceof Error ? err.message : String(err)}`);
        });
      }
    }
  }, { recursive: true, delayMs: 300 });

  LogStore._log('info', 'hot-reload', `Watching ${pluginsDir} for plugin changes`);

  return unwatch;
}
