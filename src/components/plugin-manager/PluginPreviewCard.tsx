import type { ModuleManifest } from '@/plugin-sdk';
import { Button } from '@/components/ui/button';

function MIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export function PluginPreviewCard({
  preview,
  loading,
  onInstall,
  onCancel,
}: {
  preview: ModuleManifest;
  loading: boolean;
  onInstall: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="border rounded-lg p-3 space-y-2" style={{ borderColor: 'var(--border-color)' }}>
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-semibold">{preview.name}</span>
        <span className="text-[10px] opacity-50 font-mono">v{preview.version}</span>
      </div>
      {preview.description && (
        <div className="text-[11px] opacity-70">{preview.description}</div>
      )}
      {preview.dependencies && preview.dependencies.length > 0 && (
        <div className="text-[10px] opacity-50">Зависимости: {preview.dependencies.join(', ')}</div>
      )}
      {preview.slot && (
        <div className="text-[10px] opacity-50">Слот: {preview.slot}</div>
      )}
      {preview.allowedDomains && preview.allowedDomains.length > 0 && (
        <div className="text-[10px] text-amber-600 flex items-start gap-1">
          <span className="material-symbols-outlined !text-[11px] mt-px">warning</span>
          <span>Плагин запрашивает доступ к интернету: {preview.allowedDomains.join(', ')}</span>
        </div>
      )}
      <div className="text-[10px] opacity-50 font-mono">id: {preview.id}</div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="h-7 text-[11px]" onClick={onInstall} disabled={loading}>
          {loading ? 'Установка...' : 'Установить'}
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </div>
  );
}