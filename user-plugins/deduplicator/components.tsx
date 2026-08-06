import React, { useState, useCallback } from 'react';
import { useAppStore, Button, Label, Checkbox } from 'plugin-sdk';
import type { PluginContext } from 'plugin-sdk';
import { deduplicate } from './index';

export function DeduplicatorPanel({ ctx }: { ctx: PluginContext }) {
  const [caseSensitive, setCaseSensitive] = useState(() => ctx.getSetting('caseSensitive') as boolean ?? false);
  const [withinGroup, setWithinGroup] = useState(() => ctx.getSetting('withinGroup') as boolean ?? true);
  const [result, setResult] = useState<{ removed: number; total: number } | null>(null);
  const [running, setRunning] = useState(false);
  const phrases = useAppStore(s => s.phrases);
  const deletePhrases = useAppStore(s => s.deletePhrases);

  const run = useCallback(() => {
    setRunning(true);
    setResult(null);
    setTimeout(() => {
      const duplicateIds = deduplicate(phrases, { caseSensitive, withinGroup });
      if (duplicateIds.length > 0) {
        deletePhrases(duplicateIds);
      }
      setResult({ removed: duplicateIds.length, total: phrases.length });
      setRunning(false);
    }, 50);
  }, [caseSensitive, withinGroup, phrases, deletePhrases]);

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
