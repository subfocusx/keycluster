import React from 'react';
import { useAppStore } from 'plugin-sdk';
import type { PluginContext } from 'plugin-sdk';

interface MyPluginPanelProps {
  ctx: PluginContext;
}

export function MyPluginPanel({ ctx }: MyPluginPanelProps) {
  const groups = useAppStore(s => s.groups);
  const phrases = useAppStore(s => s.phrases);

  return (
    <div style={{ padding: 16 }}>
      <h2>Мой плагин</h2>
      <p>Групп: {groups.length}, Фраз: {phrases.length}</p>
    </div>
  );
}
