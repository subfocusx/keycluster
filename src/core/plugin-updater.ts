import type { ModuleManifest } from './types';
import { LogStore } from './logging/LogStore';
import { getPluginsDir } from './plugin-fs-utils';

export interface UpdateCheckResult {
  hasUpdate: boolean;
  latestVersion: string;
  downloadUrl: string;
  currentVersion: string;
}

function parseSemver(v: string): number[] {
  return v.replace(/^v/, '').split('.').map(Number);
}

function isNewer(latest: string, current: string): boolean {
  const l = parseSemver(latest);
  const c = parseSemver(current);
  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    const lv = l[i] ?? 0;
    const cv = c[i] ?? 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}

export async function checkForUpdate(manifest: ModuleManifest): Promise<UpdateCheckResult | null> {
  const repo = manifest.repository;
  if (!repo) return null;

  const apiUrl = repo.replace('https://github.com/', 'https://api.github.com/repos/') + '/releases/latest';

  try {
    const response = await fetch(apiUrl, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
    });

    if (!response.ok) {
      LogStore._log('warn', 'plugin-updater', `GitHub API returned ${response.status} for ${manifest.id}`);
      return null;
    }

    const data = await response.json() as { tag_name: string; html_url: string; assets?: Array<{ browser_download_url: string }> };
    const latestVersion = data.tag_name.replace(/^v/, '');

    const downloadAsset = data.assets?.find(a => a.browser_download_url.endsWith('.zip') || a.browser_download_url.endsWith('.js'));
    const downloadUrl = downloadAsset?.browser_download_url ?? data.html_url;

    const hasUpdate = isNewer(latestVersion, manifest.version);

    LogStore._log('info', 'plugin-updater', `Check for "${manifest.id}": current=${manifest.version}, latest=${latestVersion}, hasUpdate=${hasUpdate}`);

    return {
      hasUpdate,
      latestVersion,
      downloadUrl,
      currentVersion: manifest.version,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    LogStore._log('warn', 'plugin-updater', `Failed to check update for "${manifest.id}": ${msg}`);
    return null;
  }
}

export async function downloadAndUpdate(pluginId: string, downloadUrl: string): Promise<void> {
  const { join } = await import('@tauri-apps/api/path');
  const { writeFile, mkdir, exists } = await import('@tauri-apps/plugin-fs');

  LogStore._log('info', 'plugin-updater', `Downloading update for "${pluginId}" from ${downloadUrl}`);

  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const data = new Uint8Array(buffer);

  const pluginsDir = await getPluginsDir();
  const pluginDir = await join(pluginsDir, pluginId);

  if (!(await exists(pluginDir))) {
    await mkdir(pluginDir, { recursive: true });
  }

  const entryPath = await join(pluginDir, 'index.js');
  await writeFile(entryPath, data);

  LogStore._log('info', 'plugin-updater', `Updated "${pluginId}" written to ${entryPath}`);

  // Reload the module in runtime
  const { getRuntime } = await import('./module-runtime');
  const runtime = getRuntime();
  if (runtime) {
    const { removeFromModuleCache, pluginSourceRepo } = await import('./module-loader');
    removeFromModuleCache(pluginId);

    const entry = pluginSourceRepo.get(pluginId);
    if (entry) {
      entry.importFn = async () => {
        const { loadRuntimePlugin } = await import('./user-plugin-loader');
        const result = await loadRuntimePlugin(pluginId, pluginsDir);
        return result as unknown as Record<string, unknown>;
      };
    }

    try {
      await runtime.reloadModule(pluginId);
      LogStore._log('info', 'plugin-updater', `Reloaded "${pluginId}" after update`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      LogStore._log('warn', 'plugin-updater', `Reload after update failed for "${pluginId}": ${msg}`);
    }
  }
}
