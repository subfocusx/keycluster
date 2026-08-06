import React from 'react';
import { Checkbox, Badge } from 'plugin-sdk';
import type { MinusWord } from 'plugin-sdk';
function MIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

interface MinusWordRowProps {
  mw: MinusWord;
  isSelected: boolean;
  groupName: string;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export function MinusWordRow({ mw, isSelected, groupName, onToggle, onDelete }: MinusWordRowProps) {
  return (
    <div className="flex items-center gap-2 py-1 px-2 rounded-[2px] hover:bg-[var(--kc-surface-hover)] text-[12px]">
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => onToggle(mw.id)}
        className="shrink-0"
        style={{ width: 14, height: 14 }}
      />
      <Badge
        variant={mw.isExact ? 'default' : 'secondary'}
        className="text-[10px] px-1.5 py-0"
        style={mw.isExact ? { backgroundColor: 'var(--kc-red)', color: 'white' } : {}}
      >
        {mw.isExact ? 'точн.' : mw.searchType === 'broad' ? 'ширк.' : 'слов.'}
      </Badge>
      <span className="flex-1 truncate">{mw.text}</span>
      <span className="text-[10px] text-[var(--kc-text-secondary)]">{groupName}</span>
      <button
        className="tool-btn !w-5 !h-5"
        style={{ color: 'var(--kc-red)' }}
        onClick={() => onDelete(mw.id)}
      >
        <MIcon name="close" className="!text-[12px]" />
      </button>
    </div>
  );
}

export { MIcon };
