import React, { useState, useCallback } from 'react';
import { useAppStore, Button, Label, Checkbox, useKCDialog } from 'plugin-sdk';
import type { PluginContext } from 'plugin-sdk';
import { deduplicate } from './index';

export function DeduplicatorPanel({ ctx }: { ctx: PluginContext }) {
  const [caseSensitive, setCaseSensitive] = useState(() => ctx.getSetting('caseSensitive') as boolean ?? false);
  const [withinGroup, setWithinGroup] = useState(() => ctx.getSetting('withinGroup') as boolean ?? true);
  const [result, setResult] = useState<{ removed: number; total: number } | null>(null);
  const [running, setRunning] = useState(false);
  const phrases = useAppStore(s => s.phrases);
  const deletePhrases = useAppStore(s => s.deletePhrases);
  const kcDialog = useKCDialog();

  const run = useCallback(() => {
    setRunning(true);
    setResult(null);
    setTimeout(async () => {
      const duplicateIds = deduplicate(phrases, { caseSensitive, withinGroup });
      let removed = 0;
      if (duplicateIds.length > 0) {
        const ok = await kcDialog.confirm(`Удалить ${duplicateIds.length} дублей?`, { title: 'Дедупликация', confirmLabel: 'Удалить', variant: 'destructive' });
        if (ok) {
          deletePhrases(duplicateIds);
          removed = duplicateIds.length;
        }
      }
      setResult({ removed, total: phrases.length });
      setRunning(false);
    }, 50);
  }, [caseSensitive, withinGroup, phrases, deletePhrases, kcDialog]);

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
        {running ? 'Поиск...' : 'Удалить дубликаты'}
      </Button>

      {phrases.length === 0 && (
        <p className="text-sm text-[var(--text-secondary)]">Нет фраз для дедупликации.</p>
      )}

      {result && (
        <div className="text-sm text-[var(--text-secondary)]">
          {result.removed > 0
            ? `Удалено дублей: ${result.removed} из ${result.total} фраз`
            : 'Дубликаты не найдены'}
        </div>
      )}
    </div>
  );
}
