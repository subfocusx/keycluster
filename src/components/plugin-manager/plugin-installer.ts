import type { ModuleManifest } from '@/plugin-sdk';
import { join } from '@tauri-apps/api/path';
import { exists } from '@tauri-apps/plugin-fs';
import { getRuntime, getPluginsDir, validateEntryFile } from '@/plugin-sdk';
import { registerUserPlugin, removeFromModuleCache, loadModule } from '@/core/module-loader';
import { pluginRegistry, LogStore, validatePluginModule } from '@/plugin-sdk';
import { loadRuntimePlugin } from '@/core/user-plugin-loader';
import { copyPluginToUserDir, removePluginFolder } from '@/core/plugin-fs-utils';
import { pluginSourceRepo } from '@/core/plugin-source-repository';
import { installationGate } from '@/core/installation-gate';

const LOG = 'plugin-installer';

async function rollbackInstall(
  pluginId: string,
  copied: boolean,
  registered: boolean,
  loaded: boolean,
  enabled: boolean,
): Promise<void> {
  LogStore._log('warn', LOG, `Rolling back install for "${pluginId}"`);

  const rt = getRuntime();

  if (enabled && rt) {
    try { await rt.disablePlugin(pluginId); } catch { }
  }

  if (loaded || registered) {
    pluginSourceRepo.remove(pluginId);
  }

  try { pluginRegistry.purge(pluginId); } catch { }

  if (copied) {
    try {
      await removePluginFolder(pluginId);
      LogStore._log('info', LOG, `Rollback: removed plugin folder for "${pluginId}"`);
    } catch (fsErr) {
      LogStore._log('warn', LOG, `Rollback: could not remove folder for "${pluginId}": ${fsErr}`);
    }
  }

  LogStore._log('info', LOG, `Rollback complete for "${pluginId}"`);
}

export async function installPluginAtomic(selectedPath: string, preview: ModuleManifest): Promise<void> {
  const pluginId = preview.id;
  let copied = false;
  let registered = false;
  let loaded = false;
  let enabled = false;

  try {
    installationGate.start(pluginId);

    LogStore._log('info', LOG, `Atomic install: phase 1/6 validate "${pluginId}"`);
    await validateEntryFile(selectedPath, preview);

    LogStore._log('info', LOG, `Atomic install: phase 1b/6 validate structure "${pluginId}"`);
    try {
      const isJs = preview.entry?.endsWith('.js') ?? false;
      if (!isJs) {
        throw new Error(`entry файл должен быть .js (указан "${preview.entry}"). Плагин нужно скомпилировать из .ts/.tsx в .js через esbuild.`);
      }
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      const entryPath = await join(selectedPath, preview.entry ?? 'index.js');
      if (!(await exists(entryPath))) {
        throw new Error(`Entry файл "${preview.entry}" не найден в папке плагина. Проверьте что файл существует и скомпилирован.`);
      }
      let code: string;
      try {
        code = await readTextFile(entryPath);
      } catch {
        throw new Error(`Не удалось прочитать entry файл "${preview.entry}". Проверьте права доступа.`);
      }
      const blob = new Blob([code], { type: 'text/javascript' });
      const url = URL.createObjectURL(blob);
      try {
        let mod: Record<string, unknown>;
        try {
          mod = await import(/* @vite-ignore */ url);
        } catch (importErr) {
          const syntaxMsg = importErr instanceof Error ? importErr.message : String(importErr);
          if (syntaxMsg.includes('Unexpected token') || syntaxMsg.includes('SyntaxError')) {
            throw new Error(`Синтаксическая ошибка в "${preview.entry}": ${syntaxMsg}. Возможно файл не скомпилирован из TypeScript.`);
          }
          throw new Error(`Ошибка импорта "${preview.entry}": ${syntaxMsg}. Убедитесь что файл скомпилирован в корректный ESM-бандл.`);
        }
        const exportedModule = mod.default ?? mod;
        const validationError = validatePluginModule(exportedModule, pluginId);
        if (validationError) {
          throw new Error(validationError);
        }
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      LogStore._log('error', LOG, `Validation failed for "${pluginId}": ${msg}`);
      throw new Error(`Плагин "${pluginId}" не прошёл валидацию: ${msg}`);
    }

    if (pluginRegistry.isInstalled(pluginId)) {
      const existing = pluginRegistry.get(pluginId)!;
      if (existing.source === 'builtin') {
        throw new Error(`Cannot install: "${pluginId}" is a builtin plugin`);
      }
      LogStore._log('info', LOG, `Upgrading existing plugin "${pluginId}"`);

      const rt = getRuntime();
      if (rt) {
        await rt.disablePlugin(pluginId);
      }
      removeFromModuleCache(pluginId);
      pluginSourceRepo.remove(pluginId);
    }

    LogStore._log('info', LOG, `Atomic install: phase 2/6 copy files "${pluginId}"`);
    copied = true;
    await copyPluginToUserDir(selectedPath, preview);

    LogStore._log('info', LOG, `Atomic install: phase 3/6 register "${pluginId}"`);
    const isJsPlugin = preview.entry?.endsWith('.js') ?? false;
    if (isJsPlugin) {
      const pluginsDir = await getPluginsDir();
      registerUserPlugin(
        pluginId,
        async () => {
          const result = await loadRuntimePlugin(pluginId, pluginsDir);
          return result as unknown as Record<string, unknown>;
        },
      );
    } else {
      registerUserPlugin(
        pluginId,
        () => import(/* @vite-ignore */ `/user-plugins/${pluginId}/index.ts`),
      );
    }
    registered = true;

    pluginRegistry.install(pluginId, 'user', preview.name);
    LogStore._log('info', LOG, `Atomic install: phase 4/6 registry saved`);

    LogStore._log('info', LOG, `Atomic install: phase 5/6 load & enable "${pluginId}"`);
    try {
      const mod = await loadModule(pluginId, 'user');
      loaded = true;

      const rt = getRuntime();
      if (rt) {
        rt.register(mod);
        await rt.enablePlugin(pluginId);
        enabled = true;
        LogStore._log('info', LOG, `Atomic install: phase 6/6 complete "${pluginId}"`);
      } else {
        LogStore._log('warn', LOG, `Runtime not available — plugin "${pluginId}" will activate after restart`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      LogStore._log('warn', LOG, `Load/enable failed for "${pluginId}": ${msg} — will activate after restart`);
    }

    LogStore._log('info', LOG, `Atomic install SUCCESS: "${pluginId}" v${preview.version}`);
  } catch (err) {
    LogStore._log('error', LOG, `Atomic install FAILED: "${pluginId}" - ${err instanceof Error ? err.message : String(err)}`);
    await rollbackInstall(pluginId, copied, registered, loaded, enabled);
    throw err;
  } finally {
    installationGate.end(pluginId);
  }
}
