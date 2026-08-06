import type { Phrase } from '@/plugin-sdk';
'use client';

import React, { useMemo } from 'react';
import { useAppStore, computeProjectStats, computePhraseStats } from '@/plugin-sdk';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MIcon } from '@/shell/shared-icon';


function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-[12px] border-b border-[var(--kc-border-light)] last:border-0">
      <span className="text-[var(--kc-text-secondary)]">{label}</span>
      <span className="font-mono-data tabular-nums">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <h3 className="font-label-caps text-[var(--kc-text-secondary)] mb-2">{title}</h3>
      {children}
    </div>
  );
}

export function ProjectStatisticsDialog({
  open,
  onOpenChange,
  selectedPhrases,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selectedPhrases?: Phrase[];
}) {
  const groups = useAppStore(s => s.groups);
  const phrases = useAppStore(s => s.phrases);
  const minusWords = useAppStore(s => s.minusWords);
  const minusWordGroups = useAppStore(s => s.minusWordGroups);

  const stats = useMemo(
    () => computeProjectStats(groups, phrases, minusWords, minusWordGroups),
    [groups, phrases, minusWords, minusWordGroups],
  );

  const phraseDetails = useMemo(() => {
    if (!selectedPhrases || selectedPhrases.length !== 1) return null;
    const p = selectedPhrases[0];
    const groupName = groups.find(g => g.id === p.groupId)?.name ?? '—';
    return computePhraseStats(p, groupName);
  }, [selectedPhrases, groups]);

  const title = phraseDetails
    ? 'Статистика фразы'
    : 'Статистика проекта';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MIcon name="bar_chart" className="!text-[18px]" style={{ color: 'var(--kc-blue)' }} />
            {title}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-1 px-1">
          <div className="space-y-4 pr-2">
            {phraseDetails && (
              <Section title="Выбранная фраза">
                <p className="text-[12px] mb-2 truncate" title={phraseDetails.text}>{phraseDetails.text}</p>
                <StatRow label="Группа" value={phraseDetails.groupName} />
                <StatRow label="Символов" value={phraseDetails.length} />
                <StatRow label="Слов" value={phraseDetails.wordCount} />
                {phraseDetails.frequency != null && <StatRow label="Частота" value={phraseDetails.frequency} />}
                {phraseDetails.kei != null && <StatRow label="KEI" value={phraseDetails.kei} />}
                {phraseDetails.cpc != null && <StatRow label="CPC" value={phraseDetails.cpc} />}
                <StatRow label="Избранное" value={phraseDetails.starred ? 'Да' : 'Нет'} />
              </Section>
            )}

            <Section title="Общее">
              <StatRow label="Ключевых фраз" value={stats.phraseCount.toLocaleString('ru-RU')} />
              <StatRow label="Групп" value={stats.groupCount} />
              <StatRow label="Пустых групп" value={stats.emptyGroupCount} />
              <StatRow label="В избранном" value={stats.starredCount} />
              <StatRow label="В корзине" value={stats.trashCount} />
            </Section>

            <Section title="Текст">
              <StatRow label="Всего символов" value={stats.totalChars.toLocaleString('ru-RU')} />
              <StatRow label="Средняя длина фразы" value={stats.avgPhraseLength} />
              <StatRow label="Мин. / макс. длина" value={`${stats.minPhraseLength} / ${stats.maxPhraseLength}`} />
            </Section>

            <Section title="Минус-фразы">
              <StatRow label="Всего" value={stats.minusWordCount} />
              <StatRow label="Папок" value={stats.minusWordGroupCount} />
              <StatRow label="Глобальных" value={stats.minusGlobal} />
              <StatRow label="По группам" value={stats.minusScoped} />
              <StatRow label="Точных / широких / по словам" value={`${stats.minusByType.exact} / ${stats.minusByType.broad} / ${stats.minusByType.word}`} />
            </Section>

            {stats.topGroups.length > 0 && (
              <Section title="Топ групп по фразам">
                {stats.topGroups.map(g => (
                  <StatRow key={g.groupId} label={g.name} value={g.count} />
                ))}
              </Section>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
