import type { CustomTab } from '@/plugin-sdk';
import React, { useState, useMemo } from 'react';
import { getRuntime, TOOL_REGISTRY , getToolsByTab, isToolId} from '@/plugin-sdk';
import type { ToolConfig, ToolTab } from '@/plugin-sdk';
import { useTabStore } from '@/plugin-sdk';
import { MIcon } from '@/shell/shared-icon';
import { useRuntimeEvents } from '@/shell/useRuntimeEvents';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

const TOOL_ICONS: Record<string, string> = {
  'minus-words': 'block',
  'cross-search': 'content_copy',
  'find-replace': 'find_replace',
  'duplicates': 'content_copy',
  'clustering': 'hub',
  'group-analysis': 'analytics',
  'ngrams': 'language',
  'tfidf': 'functions',
  'implicit-duplicates': 'content_copy',
  'deduplicator': 'auto_fix_high',
};

function getEffectiveTab(toolId: string, overrides: Record<string, string>): string {
  return overrides[toolId] ?? (isToolId(toolId) ? TOOL_REGISTRY[toolId]?.ui?.tab : undefined) ?? 'data';
}

export function RegistryRibbonButtons({
  tab,
  activeTool,
  onToolOpen,
  allTabs,
  overrides,
}: {
  tab: string;
  activeTool: string | null;
  onToolOpen: (id: string) => void;
  allTabs: CustomTab[];
  overrides: Record<string, string>;
}) {
  const moveToolToTab = useTabStore(s => s.moveToolToTab);
  const [refreshKey, setRefreshKey] = useState(0);
  useRuntimeEvents(() => setRefreshKey(n => n + 1));

  const tools = useMemo(() => {
    const isBuiltinTab = ['data', 'algorithms', 'ai', 'plugins', 'view'].includes(tab);

    if (isBuiltinTab) {
      return getToolsByTab(tab as ToolTab).filter(t => {
        if (!t.ui.ribbon) return false;
        const rt = getRuntime();
        if (!rt) return true;
        return !rt.isModuleDisabled(t.id);
      }).filter(t => {
        const effective = getEffectiveTab(t.id, overrides);
        return effective === tab;
      });
    } else {
      return Object.entries(overrides)
        .filter(([, targetTab]) => targetTab === tab)
        .map(([toolId]) => isToolId(toolId) ? TOOL_REGISTRY[toolId] : undefined)
        .filter((t): t is ToolConfig => !!t && !!t.ui.ribbon);
    }
  }, [tab, overrides, refreshKey]);

  if (tools.length === 0) return null;

  return (
    <>
      {tools.map(t => {
        const effectiveTab = getEffectiveTab(t.id, overrides);

        return (
          <div key={t.id} className="group/tool relative flex items-stretch">
            <button
              className={`ribbon-btn ${activeTool === t.id ? 'active' : ''}`}
              title={t.description}
              onClick={() => onToolOpen(t.id)}
            >
              <MIcon name={TOOL_ICONS[t.id] || 'extension'} className="ribbon-icon" />
              <span className="ribbon-label">{t.label}</span>
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={
                    'ribbon-btn--move ' +
                    'opacity-0 group-hover/tool:opacity-100 ' +
                    'absolute right-0 top-1/2 -translate-y-1/2 ' +
                    'w-4 h-4 rounded flex items-center justify-center ' +
                    'bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] ' +
                    'border border-[var(--border)] ' +
                    'transition-opacity z-10'
                  }
                  title="Переместить в другую вкладку"
                  onClick={e => e.stopPropagation()}
                >
                  <MIcon name="drag_indicator" className="!text-[11px]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align="start">
                <DropdownMenuLabel>Переместить в</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {allTabs.map(tabOption => (
                  <DropdownMenuItem
                    key={tabOption.id}
                    disabled={effectiveTab === tabOption.id}
                    onClick={() => moveToolToTab(t.id, tabOption.id)}
                  >
                    {effectiveTab === tabOption.id
                      ? <MIcon name="check" className="mr-2 !text-[14px] text-[var(--kc-primary)]" />
                      : <span className="w-[18px] mr-2" />
                    }
                    {tabOption.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}
    </>
  );
}