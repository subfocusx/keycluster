import { LogStore } from '@/core/logging/LogStore';
import { getPluginsDir } from '@/core/plugin-fs-utils';

export async function exportPlugin(pluginId: string): Promise<string | null> {
  const { join } = await import('@tauri-apps/api/path');
  const { exists, mkdir, readDir, copyFile } = await import('@tauri-apps/plugin-fs');
  const { open } = await import('@tauri-apps/plugin-dialog');

  const pluginsDir = await getPluginsDir();
  const sourceDir = await join(pluginsDir, pluginId);

  const dirExists = await exists(sourceDir);
  if (!dirExists) {
    throw new Error(`Plugin "${pluginId}" folder not found at ${sourceDir}`);
  }

  const destDir = await open({
    title: 'Выберите папку для экспорта плагина',
    directory: true,
    multiple: false,
  });
  if (!destDir || Array.isArray(destDir)) return null;

  if (!destDir) return null;

  if (!(await exists(destDir))) {
    await mkdir(destDir, { recursive: true });
  }

  await copyFolderContents(sourceDir, destDir);

  LogStore._log('info', 'plugin-exporter', `Plugin "${pluginId}" exported to ${destDir}`);
  return destDir;
}

async function copyFolderContents(
  src: string,
  dest: string,
  depth = 0,
  fileCount = { value: 0 },
): Promise<void> {
  const { join } = await import('@tauri-apps/api/path');
  const { readDir, copyFile, mkdir, exists } = await import('@tauri-apps/plugin-fs');

  const MAX_DEPTH = 4;
  const MAX_FILES = 200;
  const BLOCKED_DIRS = new Set(['node_modules', '.git', '.svn', '__pycache__', '.DS_Store']);

  if (depth > MAX_DEPTH) return;

  const entries = await readDir(src);

  for (const entry of entries) {
    if (fileCount.value >= MAX_FILES) return;

    if (entry.isDirectory) {
      if (BLOCKED_DIRS.has(entry.name)) continue;
      const srcPath = await join(src, entry.name);
      const destPath = await join(dest, entry.name);
      if (!(await exists(destPath))) {
        await mkdir(destPath, { recursive: true });
      }
      await copyFolderContents(srcPath, destPath, depth + 1, fileCount);
    } else {
      const srcPath = await join(src, entry.name);
      const destPath = await join(dest, entry.name);
      await copyFile(srcPath, destPath);
      fileCount.value++;
    }
  }
}
