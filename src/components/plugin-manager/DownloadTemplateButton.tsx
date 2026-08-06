import { useState } from 'react';
import { LogStore } from '@/plugin-sdk';

export function DownloadTemplateButton() {
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const downloadTemplate = async () => {
    setResult(null);
    setError(null);

    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { readDir, readTextFile, writeTextFile, mkdir, exists } = await import('@tauri-apps/plugin-fs');
      const { resourceDir, join } = await import('@tauri-apps/api/path');

      // Куда сохраняем
      const targetDir = await save({
        title: 'Сохранить шаблон плагина',
        defaultPath: 'my-first-plugin',
        filters: [],
      });
      if (!targetDir) return;

      // Сначала пробуем resource dir (работает в prod)
      const prodPath = await join(await resourceDir(), 'plugin-template');

      // Если не найдено — dev режим, берём прямо из папки проекта
      const templateDir = (await exists(prodPath))
        ? prodPath
        : await join(await resourceDir(), '..', '..', '..', 'plugin-template');

      console.log('[template] templateDir:', templateDir);

      // Рекурсивно копируем всё содержимое
      async function copyDir(srcDir: string, destDir: string) {
        if (!(await exists(destDir))) {
          await mkdir(destDir, { recursive: true });
        }
        const entries = await readDir(srcDir);
        for (const entry of entries) {
          const srcPath = await join(srcDir, entry.name);
          const destPath = await join(destDir, entry.name);
          if (entry.isDirectory) {
            await copyDir(srcPath, destPath);
          } else {
            const content = await readTextFile(srcPath);
            await writeTextFile(destPath, content);
          }
        }
      }

      await copyDir(templateDir, targetDir);

      LogStore._log('info', 'plugin-installer', `Template saved to: ${targetDir}`);
      setResult(targetDir);

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      LogStore._log('warn', 'plugin-installer', `Template download failed: ${msg}`);
      setError(msg);
    }
  };

  return (
    <>
      <button
        className="text-[10px] underline opacity-60 hover:opacity-100 cursor-pointer"
        onClick={downloadTemplate}
      >
        Скачать шаблон
      </button>

      {result && (
        <div
          className="text-[11px] rounded p-2 border space-y-1"
          style={{ borderColor: 'var(--accent-green)', color: 'var(--accent-green)' }}
        >
          <div>✓ Шаблон сохранён: <code className="font-mono">{result}</code></div>
          <div className="pt-1 border-t" style={{ borderColor: 'var(--accent-green)' }}>
            <div className="font-semibold">Компиляция перед установкой:</div>
            <code className="block text-[10px] mt-0.5">
              cd {result}<br />
              npx esbuild index.ts --bundle --format=esm --outfile=index.js --alias:react=./lib/react-shim.ts
            </code>
            <div className="opacity-70 mt-0.5">
              Затем: Настройки → Модули и плагины → Выбрать папку с плагином
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="text-[11px] rounded p-2" style={{ color: 'var(--accent-red)' }}>
          Ошибка: {error}
        </div>
      )}
    </>
  );
}
