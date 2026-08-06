import { LogStore } from './logging/LogStore';
import { pluginSourceRepo } from './plugin-source-repository';
import { registerDiscoveredPlugins, registerRuntimeUserPlugins } from './user-plugin-loader';

export async function orchestrateDiscovery(): Promise<string[]> {
  let userPluginIdsOnDisk: string[] = [];

  const [discoveredResult, runtimeResult] = await Promise.allSettled([
    registerDiscoveredPlugins().then(discovered => {
      LogStore._log('info', 'bootstrap', `User plugins discovered (Vite glob): ${discovered.length}`, { ids: discovered });
      return discovered;
    }),
    registerRuntimeUserPlugins().then(runtimeDiscovered => {
      if (runtimeDiscovered.length > 0) {
        LogStore._log('info', 'bootstrap', `User plugins discovered (runtime): ${runtimeDiscovered.length}`, { ids: runtimeDiscovered });
      }
      return runtimeDiscovered;
    }),
  ]);

  if (discoveredResult.status === 'fulfilled') {
    userPluginIdsOnDisk = [...userPluginIdsOnDisk, ...discoveredResult.value];
  } else {
    const msg = discoveredResult.reason instanceof Error ? discoveredResult.reason.message : String(discoveredResult.reason);
    LogStore._log('error', 'bootstrap', `Failed to discover user plugins via Vite glob: ${msg}`, { error: msg });
  }

  if (runtimeResult.status === 'fulfilled') {
    userPluginIdsOnDisk = [...userPluginIdsOnDisk, ...runtimeResult.value];
  } else {
    const msg = runtimeResult.reason instanceof Error ? runtimeResult.reason.message : String(runtimeResult.reason);
    LogStore._log('warn', 'bootstrap', `Failed to discover runtime user plugins: ${msg}`, { error: msg });
  }

  const allUserPluginIds = [...new Set(userPluginIdsOnDisk)];
  if (allUserPluginIds.length !== userPluginIdsOnDisk.length) {
    LogStore._log('warn', 'bootstrap', `Duplicate user plugin ids deduplicated: ${userPluginIdsOnDisk.length} → ${allUserPluginIds.length}`);
  }

  return allUserPluginIds;
}
