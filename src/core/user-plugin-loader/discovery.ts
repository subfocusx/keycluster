import { LogStore } from '../logging/LogStore';
import { pluginSourceRepo } from '../plugin-source-repository';
import { pluginRegistry } from '../plugin-registry';

export interface UserPluginManifest {
  id: string;
  name: string;
  version: string;
  entry?: string;
}

export const EXCLUDED_PLUGIN_DIRS = new Set<string>([
  // исторически: 'my-first-plugin', 'group-notes' — каталогов нет в репо, список пуст
]);

export const discovered = import.meta.glob('/user-plugins/**/index.ts');

const LOG_MODULE = 'user-plugin-loader';

async function readManifest(pluginId: string): Promise<UserPluginManifest | null> {
  try {
    const res = await fetch(`/user-plugins/${pluginId}/manifest.json`);
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.trim().length === 0) return null;
    return JSON.parse(text) as UserPluginManifest;
  } catch {
    return null;
  }
}

export async function discoverUserPlugins(): Promise<UserPluginManifest[]> {
  const plugins: UserPluginManifest[] = [];

  for (const [path] of Object.entries(discovered)) {
    const match = path.match(/\/user-plugins\/([^/]+)\/index\.ts$/);
    if (!match) continue;

    const pluginId = match[1];
    if (EXCLUDED_PLUGIN_DIRS.has(pluginId)) continue;

    const manifest = await readManifest(pluginId);
    if (manifest) {
      plugins.push(manifest);
    } else {
      LogStore._log('warn', LOG_MODULE, `Plugin "${pluginId}" skipped: manifest not found or invalid, cleaning up stale references`);
      pluginSourceRepo.remove(pluginId);
      if (pluginRegistry.isInstalled(pluginId)) {
        pluginRegistry.purge(pluginId);
        LogStore._log('info', LOG_MODULE, `Plugin "${pluginId}" purged from registry`);
      }
    }
  }

  return plugins;
}
