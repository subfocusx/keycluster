'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useTabStore } from '@/plugin-sdk';
import { MIcon } from '@/shell/shared-icon';
import { getBuiltinTabRibbons, isBuiltinTab } from './tab-router/runtime-tabs';
import type { TabRibbonContext } from './tab-router/runtime-tabs';
import { TabBar } from './tab-router/TabBar';
import { RegistryRibbonButtons } from './tab-router/RegistryRibbonButtons';

function RibbonToolbar(props: TabRibbonContext) {
  const { activeTab } = props;
  const builtinRibbons = getBuiltinTabRibbons(activeTab);

  return (
    <div className="flex items-stretch bg-[var(--bg-panel)] border-b border-[var(--border)] px-2 py-1 gap-0 h-[52px]">
      {builtinRibbons
        ? builtinRibbons.map((Group, i) => <Group key={i} {...props} />)
        : (
          <div className="ribbon-group">
            <div className="ribbon-group-buttons">
              <RegistryRibbonButtons
                tab={activeTab}
                activeTool={props.activeTool}
                onToolOpen={props.onToolOpen}
                allTabs={props.allTabs}
                overrides={props.overrides}
              />
            </div>
          </div>
        )
      }
      <div className="ml-auto" />
    </div>
  );
}

export interface TabRouterProps {
  ctx: any;
  activeTool: string | null;
  onToolOpen: (id: string) => void;
  onSettingsOpen: () => void;
  onProjectOpen: () => void;
  onThemeChange: () => void;
  onRefresh: () => void;
}

export function TabRouter({
  ctx,
  activeTool,
  onToolOpen,
  onSettingsOpen,
  onProjectOpen,
  onThemeChange,
  onRefresh,
}: TabRouterProps) {
  const allTabs = useTabStore(s => s.customTabs);
  const overrides = useTabStore(s => s.toolTabOverrides);

  const sortedTabs = useMemo(() =>
    [...allTabs].sort((a, b) => a.order - b.order),
    [allTabs]
  );

  const [activeTab, setActiveTab] = useState('data');

  const handleTabChange = useCallback((tabId: string) => {
    const exists = sortedTabs.some(t => t.id === tabId);
    setActiveTab(exists ? tabId : 'data');
  }, [sortedTabs]);

  const effectiveActiveTab = useMemo(() => {
    return sortedTabs.some(t => t.id === activeTab) ? activeTab : 'data';
  }, [sortedTabs, activeTab]);

  return (
    <>
      <TabBar
        tabs={sortedTabs}
        activeTab={effectiveActiveTab}
        onTabChange={handleTabChange}
      />
      <RibbonToolbar
        ctx={ctx}
        activeTool={activeTool}
        onToolOpen={onToolOpen}
        onSettingsOpen={onSettingsOpen}
        onProjectOpen={onProjectOpen}
        onThemeChange={onThemeChange}
        onRefresh={onRefresh}
        allTabs={sortedTabs}
        overrides={overrides}
        activeTab={effectiveActiveTab}
      />
    </>
  );
}
