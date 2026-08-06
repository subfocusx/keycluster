import React from 'react';
import type { AppModule } from 'plugin-sdk';
import type { PluginContext, KCID } from 'plugin-sdk';

function MIcon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export function FavoritesToolbarButton({ groupId, ctx }: { groupId: KCID | null; ctx: PluginContext }) {
  const [active, setActive] = React.useState(false);

  const handleToggle = () => {
    const next = !active;
    setActive(next);
    ctx.eventBus.emit('favorites:toggle-filter' as any, { showStarredOnly: next });
  };

  return (
    <button
      className="tool-btn !w-7 !h-7"
      title={active ? 'Показать все фразы' : 'Только избранное'}
      aria-label={active ? 'Показать все фразы' : 'Только избранное'}
      onClick={handleToggle}
      style={active ? { color: 'var(--kc-yellow)' } : {}}
    >
      <MIcon name={active ? 'star' : 'star_outline'} className="!text-[16px]" />
    </button>
  );
}
