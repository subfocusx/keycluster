import React, { useState, useCallback, useMemo } from 'react';
import { useAppStore, Button, Label, Checkbox, pluralize } from 'plugin-sdk';
import type { PluginContext } from 'plugin-sdk';
import { ApplyPreview } from '@/components/ApplyPreview';
import type { ApplyPreviewItem } from '@/components/ApplyPreview';
import { collectDuplicateMatches } from './deduplicate';
import type { DuplicateMatch } from './deduplicate';

export function DeduplicatorPanel({ ctx }: { ctx: PluginContext }) {
  const [caseSensitive, setCaseSensitive] = useState(() => ctx.getSetting('caseSensitive') as boolean ?? false);
  const [withinGroup, setWithinGroup] = useState(() => ctx.getSetting('withinGroup') as boolean ?? true);
  const [result, setResult] = useState<{ removed: number; total: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [preview, setPreview] = useState<DuplicateMatch[] | null>(null);
  const phrases = useAppStore(s => s.phrases);
  const deletePhrases = useAppStore(s => s.deletePhrases);

  // Шаг 1 — поиск дублей. Ничего не удаляем: только готовим предпросмотр.
  const run = useCallback(() => {
    setRunning(true);
    setResult(null);
    setTimeout(() => {
      const matches = collectDuplicateMatches(phrases, { caseSensitive, withinGroup });
      setRunning(false);
      if (matches.length === 0) {
        setPreview(null);
        setResult({ removed: 0, total: phrases.length });
        return;
      }
      setPreview(matches);
    }, 50);
  }, [caseSensitive, withinGroup, phrases]);

  // Шаг 2 — применение (только после явного подтверждения в предпросмотре).
  const handleApply = useCallback(() => {
    if (!preview || preview.length === 0) return;
    const ids = preview.map(m => m.duplicate.id);
    deletePhrases(ids);
    setResult({ removed: ids.length, total: phrases.length });
    setPreview(null);
  }, [preview, phrases.length, deletePhrases]);

  const handleCancel = useCallback(() => {
    setPreview(null);
  }, []);

  const previewItems = useMemo<ApplyPreviewItem[]>(
    () =>
      (preview ?? []).map(m => ({
        id: m.duplicate.id,
        text: m.duplicate.text,
        type: 'remove' as const,
        note: `останется «${m.original.text}»`,
      })),
    [preview],
  );

  const affectedGroups = useMemo(
    () => new Set((preview ?? []).map(m => m.duplicate.groupId)).size,
    [preview],
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Checkbox
          id="dedup-case"
          checked={caseSensitive}
          onCheckedChange={(v) => setCaseSensitive(!!v)}
        />
        <Label htmlFor="dedup-case">Учитывать регистр</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="dedup-within-group"
          checked={withinGroup}
          onCheckedChange={(v) => setWithinGroup(!!v)}
        />
        <Label htmlFor="dedup-within-group">Дедупликация в пределах группы</Label>
      </div>

      <Button onClick={run} disabled={running || phrases.length === 0}>
        {running ? 'Поиск...' : 'Найти дубликаты'}
      </Button>

      {phrases.length === 0 && (
        <p className="text-sm text-[var(--text-secondary)]">Нет фраз для дедупликации.</p>
      )}

      {preview && preview.length > 0 && (
        <ApplyPreview
          title="Предпросмотр дедупликации"
          summary={`Будет удалено ${pluralize(preview.length, 'дубль', 'дубля', 'дублей')}. Проверьте список перед применением.`}
          counters={[
            { label: 'Будет удалено', value: preview.length },
            { label: 'Останется фраз', value: phrases.length - preview.length },
            { label: 'Групп затронуто', value: affectedGroups },
          ]}
          items={previewItems}
          totalCount={preview.length}
          onApply={handleApply}
          onCancel={handleCancel}
        />
      )}

      {result && (
        <div className="text-sm text-[var(--text-secondary)]">
          {result.removed > 0
            ? `Удалено ${pluralize(result.removed, 'дубль', 'дубля', 'дублей')} из ${result.total} фраз`
            : 'Дубликаты не найдены'}
        </div>
      )}
    </div>
  );
}
