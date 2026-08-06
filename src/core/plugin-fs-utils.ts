import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile, copyFile, mkdir, exists, readDir, remove } from '@tauri-apps/plugin-fs';
import { appLocalDataDir, join } from '@tauri-apps/api/path';
import type { ModuleManifest } from '@/core/types';
import { LogStore } from '@/core/logging/LogStore';

const LOG = 'plugin-installer';

const COPY_MAX_DEPTH = 4;
const COPY_MAX_FILES = 200;
const BLOCKED_DIRS = new Set(['node_modules', '.git', '.svn', '__pycache__', '.DS_Store']);
const ALLOWED_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.css', '.html', '.svg', '.png', '.wasm',
]);

export const PLUGIN_ID_RE = /^[a-z0-9][a-z0-9_-]{1,63}$/i;

export function assertSafePluginId(id: string): void {
  if (!PLUGIN_ID_RE.test(id)) {
    throw new Error(
      `Небезопасный или некорректный plugin id: "${id}". ` +
      `Допустимы только латинские буквы, цифры, дефис и подчёркивание (2–64 символа).`
    );
  }
}

export async function getPluginsDir(): Promise<string> {
  const base = await appLocalDataDir();
  return await join(base, 'user-plugins');
}

export async function copyFolderContents(
  src: string,
  dest: string,
  depth = 0,
  fileCount = { value: 0 },
): Promise<void> {
  if (depth > COPY_MAX_DEPTH) {
    LogStore._log('warn', LOG, `Copy depth limit reached at ${src}, skipping`);
    return;
  }

  const entries = await readDir(src);

  for (const entry of entries) {
    if (fileCount.value >= COPY_MAX_FILES) {
      LogStore._log('warn', LOG, `File count limit (${COPY_MAX_FILES}) reached, stopping copy`);
      return;
    }

    const name = entry.name;

    if (entry.isDirectory) {
      if (BLOCKED_DIRS.has(name)) {
        LogStore._log('debug', LOG, `Skipping blocked directory: ${name}`);
        continue;
      }
      const srcPath = await join(src, name);
      const destPath = await join(dest, name);
      if (!(await exists(destPath))) {
        await mkdir(destPath, { recursive: true });
      }
      await copyFolderContents(srcPath, destPath, depth + 1, fileCount);
    } else {
      const ext = name.includes('.') ? '.' + name.split('.').pop()!.toLowerCase() : '';
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        LogStore._log('debug', LOG, `Skipping non-allowed file: ${name} (ext: ${ext})`);
        continue;
      }
      const srcPath = await join(src, name);
      const destPath = await join(dest, name);
      await copyFile(srcPath, destPath);
      fileCount.value++;
      LogStore._log('debug', LOG, `Copied: ${name}`);
    }
  }
}

export async function selectPluginFolder(): Promise<string | null> {
  const selectedPath = await open({
    title: 'Выберите папку с плагином',
    directory: true,
    multiple: false,
  });

  if (!selectedPath || typeof selectedPath !== 'string') return null;
  return selectedPath;
}

export async function readManifestFromFolder(folderPath: string): Promise<ModuleManifest> {
  const manifestPath = await join(folderPath, 'manifest.json');

  const content = await readTextFile(manifestPath, { encoding: 'utf-8' });
  const manifest = JSON.parse(content) as ModuleManifest;

  if (!manifest.id || !manifest.name || !manifest.version) {
    throw new Error('manifest.json must contain id, name, version');
  }

  LogStore._log('info', LOG, `Manifest read: ${manifest.name} v${manifest.version} (id: ${manifest.id})`);
  return manifest;
}

export async function validateEntryFile(folderPath: string, manifest: ModuleManifest): Promise<void> {
  const entryFile = manifest.entry || 'index.js';
  const entryPath = await join(folderPath, entryFile);
  const entryExists = await exists(entryPath);
  if (!entryExists) {
    throw new Error(`Entry file "${entryFile}" not found at ${entryPath}. Manifest specifies entry: "${manifest.entry || 'index.ts'}"`);
  }
}

export async function copyPluginToUserDir(folderPath: string, manifest: ModuleManifest): Promise<string> {
  assertSafePluginId(manifest.id);
  const pluginsDir = await getPluginsDir();
  const targetDir = await join(pluginsDir, manifest.id);

  if (!(await exists(pluginsDir))) {
    await mkdir(pluginsDir, { recursive: true });
  }

  if (await exists(targetDir)) {
    LogStore._log('warn', LOG, `Plugin "${manifest.id}" already exists at ${targetDir}, overwriting`);
  } else {
    await mkdir(targetDir, { recursive: true });
  }

  await copyFolderContents(folderPath, targetDir);
  LogStore._log('info', LOG, `Plugin "${manifest.id}" copied to ${targetDir}`);
  return targetDir;
}

export async function removePluginFolder(pluginId: string): Promise<void> {
  assertSafePluginId(pluginId);
  const pluginsDir = await getPluginsDir();
  const targetDir = await join(pluginsDir, pluginId);

  if (!(await exists(targetDir))) {
    LogStore._log('warn', LOG, `Plugin "${pluginId}" folder not found at ${targetDir}`);
    return;
  }

  await remove(targetDir, { recursive: true });
  LogStore._log('info', LOG, `Plugin "${pluginId}" folder deleted from ${targetDir}`);
}

export async function removeDevPluginFolder(pluginId: string): Promise<void> {
  assertSafePluginId(pluginId);
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const projectRoot = await invoke<string>('get_project_root');
    const { join: joinPath } = await import('@tauri-apps/api/path');
    const devDir = await joinPath(projectRoot, 'user-plugins', pluginId);
    if (await exists(devDir)) {
      await remove(devDir, { recursive: true });
      LogStore._log('info', LOG, `Dev plugin folder "${pluginId}" deleted from ${devDir}`);
    }
  } catch {
    LogStore._log('debug', LOG, `No dev plugin folder to remove for "${pluginId}"`);
  }
}
