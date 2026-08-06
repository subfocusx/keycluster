'use client';

import { useEffect } from 'react';
import { useAppStore , AppEvents} from '@/plugin-sdk';
import type { PluginContext, KCID } from '@/plugin-sdk';
import { toast } from '@/hooks/use-toast';

export function useTableKeyboard(ctx: PluginContext, activeGroupId: KCID | null, selectedPhraseIds: Set<KCID>) {
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.ctrlKey && e.key === 'c' && selectedPhraseIds.size > 0) {
        e.preventDefault();
        const sorted = useAppStore.getState().phrases;
        const selected = sorted.filter(p => selectedPhraseIds.has(p.id));
        const text = selected.map(p => p.text).join('\n');
        await navigator.clipboard.writeText(text);
        toast({ title: `Скопировано ${selected.length} фраз` });
      }
      if (e.ctrlKey && e.key === 'v' && activeGroupId && activeGroupId !== 'all') {
        e.preventDefault();
        const text = await navigator.clipboard.readText();
        if (text.trim()) {
          const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
          if (lines.length > 0) {
            const addPhrases = useAppStore.getState().addPhrases;
            addPhrases(lines, activeGroupId);
            ctx.eventBus.emit(AppEvents.PHRASES_CHANGED);
            toast({ title: `Добавлено ${lines.length} фраз из буфера` });
          }
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [selectedPhraseIds, activeGroupId, ctx.eventBus]);
}