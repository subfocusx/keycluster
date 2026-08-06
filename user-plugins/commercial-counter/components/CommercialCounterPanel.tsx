

import React, { useMemo } from 'react';
import { useAppStore } from 'plugin-sdk';
import { COMMERCIAL_WORDS } from '../index';

interface CommercialCounterPanelProps {
  groupId: string;
}

export function CommercialCounterPanel({ groupId }: CommercialCounterPanelProps) {
  const phrases = useAppStore(s => s.phrases);

  const count = useMemo(() => {
    const groupPhrases = phrases.filter(p => p.groupId === groupId);
    const matched = groupPhrases.filter(phrase => {
      const lower = phrase.text.toLowerCase();
      return COMMERCIAL_WORDS.some(word => lower.includes(word));
    });
    return { matched: matched.length, total: groupPhrases.length };
  }, [phrases, groupId]);

  if (count.matched === 0) return null;

  return (
    <div className="flex items-center gap-1 px-2 py-1 rounded bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/30 text-[11px]">
      <span className="material-symbols-outlined !text-[14px] text-yellow-600 dark:text-yellow-400">
        sell
      </span>
      <span className="font-medium text-yellow-700 dark:text-yellow-300">
        {count.matched}
      </span>
      <span className="text-yellow-600 dark:text-yellow-400">
        коммерч.
      </span>
      {count.matched > 0 && (
        <span className="text-[10px] text-yellow-500 dark:text-yellow-500 ml-1">
          ({count.total} фраз)
        </span>
      )}
    </div>
  );
}

export default CommercialCounterPanel;
