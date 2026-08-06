import type { Phrase } from '@/plugin-sdk';
import { MIcon } from '@/shell/shared-icon';

export function renderSortIcon(field: keyof Phrase, sortField: keyof Phrase | null, sortDir: 'asc' | 'desc') {
  if (sortField !== field) return <MIcon name="unfold_more" className="!text-[12px] opacity-40 ml-0.5" />;
  return sortDir === 'asc'
    ? <MIcon name="expand_less" className="!text-[12px] ml-0.5" style={{ color: 'var(--kc-blue)' }} />
    : <MIcon name="expand_more" className="!text-[12px] ml-0.5" style={{ color: 'var(--kc-blue)' }} />;
}