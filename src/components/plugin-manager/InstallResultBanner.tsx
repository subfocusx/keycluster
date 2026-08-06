import { relaunch } from '@tauri-apps/plugin-process';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

function MIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export function InstallResultBanner({ pluginId }: { pluginId: string }) {
  const [relaunchError, setRelaunchError] = useState(false);

  const handleRelaunch = async () => {
    try {
      await relaunch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setRelaunchError(true);
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-[11px] rounded p-2" style={{ color: 'var(--accent-green)', backgroundColor: 'var(--bg-base)' }}>
        Плагин «{pluginId}» установлен
      </div>
      {!import.meta.env.DEV && (
        <>
          <div className="text-[11px] rounded p-2 border" style={{ borderColor: 'var(--accent-blue)' }}>
            Для активации необходим <strong>перезапуск приложения</strong>
          </div>
          {relaunchError ? (
            <div className="text-[11px] opacity-70 p-2 rounded" style={{ backgroundColor: 'var(--bg-base)' }}>
              Закройте и откройте приложение вручную для активации плагина.
            </div>
          ) : (
            <Button variant="outline" size="sm" className="w-full h-8 text-[11px] gap-1.5" onClick={handleRelaunch}>
              <MIcon name="restart_alt" className="!text-[14px]" />
              Перезапустить приложение
            </Button>
          )}
        </>
      )}
    </div>
  );
}
