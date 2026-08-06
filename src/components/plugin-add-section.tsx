import { useState } from 'react';
import type { ModuleManifest } from '@/plugin-sdk';
import { LogStore } from '@/plugin-sdk';
import { installationGate } from '@/core/installation-gate';
import {
  selectPluginFolder,
  readManifestFromFolder,
} from '@/plugin-sdk';
import { DownloadTemplateButton } from './plugin-manager/DownloadTemplateButton';
import { PluginPreviewCard } from './plugin-manager/PluginPreviewCard';
import { InstallResultBanner } from './plugin-manager/InstallResultBanner';
import { Button } from '@/components/ui/button';
import { installPluginAtomic } from './plugin-manager/plugin-installer';

function MIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

const LOG = 'plugin-installer';

function AddPluginSection({ onPluginAdded }: { onPluginAdded: () => void }) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ModuleManifest | null>(null);
  const [installResult, setInstallResult] = useState<string | null>(null);
  const handleSelectFolder = async () => {
    setLoading(true);
    setError(null);
    setPreview(null);
    setInstallResult(null);

    try {
      const path = await selectPluginFolder();
      if (!path) { setLoading(false); return; }

      setSelectedPath(path);
      LogStore._log('info', LOG, `Selected plugin folder: ${path}`);

      const manifest = await readManifestFromFolder(path);
      setPreview(manifest);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      LogStore._log('error', LOG, `Failed to read plugin folder: ${msg}`, { error: msg });
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async () => {
    if (!preview || !selectedPath) return;
    setLoading(true);
    setError(null);

    try {
      if (installationGate.isInstalling(preview.id)) {
        throw new Error(`Plugin "${preview.id}" is already being installed`);
      }

      await installPluginAtomic(selectedPath, preview);

      setInstallResult(preview.id);
      setPreview(null);
      setSelectedPath(null);
      onPluginAdded();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      LogStore._log('error', LOG, `Install failed for "${preview?.id}": ${msg}`, { error: msg });
      setError(`Ошибка установки: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setError(null);
    setSelectedPath(null);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-[12px] font-semibold flex items-center gap-1.5" style={{ color: 'var(--kc-text)' }}>
        <MIcon name="add_circle" className="!text-[14px]" />
        Добавить плагин
      </h3>

      <Button
        variant="outline"
        size="sm"
        className="w-full h-9 text-[12px] gap-2"
        onClick={handleSelectFolder}
        disabled={loading}
      >
        <MIcon name="folder_open" className="!text-[14px]" />
        {loading ? 'Загрузка...' : 'Выбрать папку с плагином'}
      </Button>

      <div className="text-[10px] opacity-50 text-center">
        Выберите папку содержащую manifest.json и скомпилированный index.js
      </div>

      {error && (
        <div className="text-[11px] rounded p-2" style={{ color: 'var(--accent-red)', backgroundColor: 'var(--bg-base)' }}>
          {error}
        </div>
      )}

      {preview && !installResult && (
        <PluginPreviewCard
          preview={preview}
          loading={loading}
          onInstall={handleInstall}
          onCancel={handleCancel}
        />
      )}

      {installResult && <InstallResultBanner pluginId={installResult} />}

      <DownloadTemplateButton />
    </div>
  );
}

export { AddPluginSection };