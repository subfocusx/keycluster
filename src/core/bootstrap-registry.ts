import { pluginRegistry } from './plugin-registry';
import { LogStore } from './logging/LogStore';
import { executionGate } from './module-execution-gate';
import { setToolEnabled, isToolId } from '@/core/tool-registry';

export function orchestrateRegistry(knownIds: string[], allUserPluginIds: string[]): void {
  const knownIdSet = new Set(knownIds);

  pluginRegistry.load();
  LogStore._log('debug', 'system', `Registry loaded: ${pluginRegistry.getAll().length} records`);

  // НЕ включаем принудительно выключенные пользователем плагины:
  // запись rec.enabled=false — осознанный выбор, переживает рестарт.
  for (const id of allUserPluginIds) {
    const rec = pluginRegistry.getAll().find(r => r.id === id);
    if (!rec) {
      pluginRegistry.install(id, 'user');
    }
  }

  for (const record of pluginRegistry.getAll()) {
    if (record.source !== 'user' && !knownIdSet.has(record.id)) {
      LogStore._log('warn', 'system', `Purged orphaned plugin record: "${record.id}" (source=${record.source})`);
      pluginRegistry.purge(record.id);
    }
  }
  LogStore._log('debug', 'system', `Registry after purge: ${pluginRegistry.getAll().length} records`);

  for (const id of knownIds) {
    if (!pluginRegistry.isInstalled(id)) {
      pluginRegistry.install(id, 'builtin');
    }
  }
  LogStore._log('debug', 'system', `Builtin modules ensured: ${knownIds.length}`);

  let disabledCount = 0;
  for (const record of pluginRegistry.getAll()) {
    if (!record.enabled) {
      executionGate.disable(record.id);
      disabledCount++;
      if (isToolId(record.id)) {
        setToolEnabled(record.id, false);
      }
    }
  }
  LogStore._log('debug', 'system', `Execution gate synced: ${disabledCount} modules disabled`);

  const reconcileResult = pluginRegistry.reconcile(knownIds, allUserPluginIds);
  LogStore._log('info', 'system', `Reconciliation: ${reconcileResult.purged.length} purged, ${reconcileResult.imported.length} imported`);
}
