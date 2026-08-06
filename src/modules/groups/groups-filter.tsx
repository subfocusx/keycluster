import React from 'react';

function MIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

interface GroupsFilterBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function GroupsFilterBar({ value, onChange }: GroupsFilterBarProps) {
  return (
    <div className="px-3 py-1.5 border-b border-[var(--border)] shrink-0">
      <div className="relative">
        <MIcon name="search" className="!text-[14px] absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
        <input
          className="w-full h-[22px] pl-6 pr-7 text-[12px] rounded-[3px] border border-[var(--border)] bg-[var(--bg-surface)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)] focus:border-[var(--accent-blue)]"
          placeholder="Фильтр: kw>0, children=0..."
          value={value}
          onChange={e => onChange(e.target.value)}
        />
        {value && (
          <button
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            onClick={() => onChange('')}
          >
            <MIcon name="close" className="!text-[12px]" />
          </button>
        )}
      </div>
    </div>
  );
}
