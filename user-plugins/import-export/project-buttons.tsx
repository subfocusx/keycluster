'use client';

import type { PluginContext } from 'plugin-sdk';
import React, { useState } from 'react';
import { useAppStore , AppEvents} from 'plugin-sdk';
import { kcAlert, Button } from 'plugin-sdk';

function MIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export function ProjectButtons({ ctx }: { ctx: PluginContext }) {
  const groups = useAppStore(s => s.groups);
  const phrases = useAppStore(s => s.phrases);
  const minusWords = useAppStore(s => s.minusWords);
  const loadProject = useAppStore(s => s.loadProject);
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = () => {
    const data = JSON.stringify({ groups, phrases, minusWords, version: 1 }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keycluster-project-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoad = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setIsLoading(true);
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        loadProject(data);
        ctx.eventBus.emit(AppEvents.GROUPS_CHANGED);
        ctx.eventBus.emit(AppEvents.PHRASES_CHANGED);
      } catch {
        await kcAlert('Ошибка при загрузке файла', { title: 'Ошибка' });
      } finally {
        setIsLoading(false);
      }
    };
    input.click();
  };

  return (
    <>
      <div className="h-px bg-[var(--kc-border-light)]" />
      <Button variant="outline" className="w-full justify-start text-[12px]" onClick={handleSave}>
        <MIcon name="save" className="!text-[16px] mr-2" /> Сохранить проект
      </Button>
      <Button variant="outline" className="w-full justify-start text-[12px]" onClick={handleLoad} disabled={isLoading}>
        {isLoading ? (
          <>
            <MIcon name="progress_activity" className="!text-[16px] mr-2 animate-spin" /> Загрузка...
          </>
        ) : (
          <>
            <MIcon name="folder_open" className="!text-[16px] mr-2" /> Открыть проект
          </>
        )}
      </Button>
    </>
  );
}