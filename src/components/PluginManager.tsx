import type { ModuleStatus, PluginRecord } from '@/plugin-sdk';

import React, { useState, useEffect, useCallback } from 'react';
import { getRuntime } from '@/plugin-sdk';
import { pluginRegistry } from '@/plugin-sdk';
import { useRuntimeEvents } from '@/shell/useRuntimeEvents';
import { useKCDialog } from '@/components/KCDialog';
import { MIcon } from '@/components/plugin-badges';
import { useAppStore, LogStore } from '@/plugin-sdk';
import { AddPluginSection } from '@/components/plugin-add-section';
import { DBPersistenceToggle } from '@/components/plugin-db-persistence';
import { useCategoryManager } from './plugin-manager/useCategoryManager';
import { PluginCard } from './plugin-manager/PluginCard';
import { Separator } from '@/components/ui/separator';

export function PluginManagerSection() {
  const [statuses, setStatuses] = useState<ModuleStatus[]>([]);
  const [registryRecords, setRegistryRecords] = useState<PluginRecord[]>([]);
  const [reloading, setReloading] = useState<string | null>(null);
  const [uninstallingId, setUninstallingId] = useState<string | null>(null);
  const [expandedSettings, setExpandedSettings] = useState<string | null>(null);
  const kcDialog = useKCDialog();
  const modulesLoading = useAppStore(s => s.ui.modulesLoading);
  const isDev = process.env.NODE_ENV === 'development';

  const {
    draggingId,
    dragOverCategory,
    showCategoryEditor,
    categoryConfig,
    newCategoryName,
    editingCategory,
    editCategoryLabel,
    visibleCategories,
    categoryOverrides,
    setShowCategoryEditor,
    setNewCategoryName,
    setEditingCategory,
    setEditCategoryLabel,
    refreshConfig,
    handleAddCategory,
    handleRenameCategory,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
  } = useCategoryManager();

  const refreshStatuses = useCallback(() => {
    const rt = getRuntime();
    if (rt) {
      setStatuses(rt.getModuleStatuses());
    }
    setRegistryRecords(pluginRegistry.getAll());
    refreshConfig();
  }, [refreshConfig]);

  useEffect(() => {
    pluginRegistry.load();
    refreshStatuses();
  }, [refreshStatuses]);

  useRuntimeEvents(refreshStatuses);

  const handleToggle = (moduleId: string, enabled: boolean) => {
    const rt = getRuntime();
    if (!rt) return;
    if (enabled) {
      pluginRegistry.enable(moduleId);
      rt.enablePlugin(moduleId).catch(err => {
        console.error(`[PluginManager] Failed to enable plugin "${moduleId}":`, err);
      });
    } else {
      pluginRegistry.disable(moduleId);
      rt.disablePlugin(moduleId).catch(err => {
        console.error(`[PluginManager] Toggle failed for "${moduleId}":`, err);
      });
    }
    refreshStatuses();
  };

  const handleReload = async (moduleId: string) => {
    const rt = getRuntime();
    if (!rt) return;
    setReloading(moduleId);
    try {
      await rt.reloadModule(moduleId);
    } catch (err) {
      console.error(`[PluginManager] Failed to reload ${moduleId}:`, err);
    }
    setReloading(null);
    refreshStatuses();
  };

  const handleUninstall = async (moduleId: string) => {
    const record = pluginRegistry.get(moduleId);
    if (!record) return;

    if (!await kcDialog.confirm(`Полностью удалить плагин "${moduleId}"?\n\nПлагин будет деактивирован, выгружен из памяти, удалён из реестра и стёрт с диска.`, { title: 'Удаление плагина', confirmLabel: 'Удалить полностью', variant: 'destructive' })) return;

    setUninstallingId(moduleId);
    try {
      const rt = getRuntime();
      if (rt) {
        await rt.uninstallPlugin(moduleId, true);
      }
    } finally {
      setUninstallingId(null);
      refreshStatuses();
    }
  };

  const toggleSettings = (moduleId: string) => {
    setExpandedSettings(prev => prev === moduleId ? null : moduleId);
  };

  const hasSettings = (moduleId: string): boolean => {
    const rt = getRuntime();
    if (!rt) return false;
    const mod = rt.getModule(moduleId);
    return !!(
      (mod?.manifest?.settingsSchema && mod.manifest.settingsSchema.length > 0) ||
      mod?.manifest?.settingsComponent
    );
  };

  const allPlugins = registryRecords
    .filter(record => record.id !== 'devtools')
    .map(record => {
      const status = statuses.find(s => s.id === record.id);
      const rt = getRuntime();
      const module = rt ? rt.getModule(record.id) : undefined;
      const manifestCategory = module?.manifest?.category;
      return {
        id: record.id,
        source: record.source,
        enabled: record.enabled,
        installedAt: record.installedAt,
        name: status?.name ?? record.id,
        version: status?.version ?? '—',
        status: status?.status ?? (record.enabled ? 'not-loaded' : 'disabled'),
        error: status?.error,
        initTimeMs: status?.initTimeMs,
        uiContributionsCount: status?.uiContributionsCount,
        hasSettings: status ? hasSettings(record.id) : false,
        category: categoryOverrides[record.id] ?? manifestCategory ?? 'custom',
      };
    });

  const groupedPlugins = allPlugins.reduce((acc, plugin) => {
    const cat = plugin.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(plugin);
    return acc;
  }, {} as Record<string, typeof allPlugins>);

  for (const cat of Object.keys(groupedPlugins)) {
    groupedPlugins[cat].sort((a, b) => a.id.localeCompare(b.id));
  }

  return (
    <div className="p-3 space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[12px] font-semibold text-[var(--kc-text)] flex items-center gap-1.5">
            <MIcon name="puzzle" className="!text-[14px] text-[var(--kc-blue)]" />
            Установленные плагины ({allPlugins.length})
          </h3>
          <button
            className="text-[10px] opacity-50 hover:opacity-100 cursor-pointer"
            onClick={() => setShowCategoryEditor(!showCategoryEditor)}
            title="Редактировать категории"
          >
            <MIcon name="edit" className="!text-[14px]" />
          </button>
        </div>
        {isDev && (
          <button
            className="text-[10px] opacity-50 hover:opacity-100 mb-2 cursor-pointer"
            onClick={() => {
              useAppStore.getState().setDevtoolsOpen(true);
              useAppStore.getState().setDevtoolsTab('modules');
            }}
          >
            Открыть DevTools →
          </button>
        )}

        {showCategoryEditor && (
          <div className="mb-3 p-2 rounded-lg border border-[var(--kc-border)] bg-[var(--kc-surface)] space-y-2">
            <div className="text-[11px] font-semibold text-[var(--kc-text)]">Редактор категорий</div>
            {categoryConfig.order.map((catKey) => {
              return (
                <div key={catKey} className="flex items-center gap-2">
                  {editingCategory === catKey ? (
                    <>
                      <input
                        className="flex-1 h-6 text-[11px] rounded border border-[var(--kc-border)] bg-[var(--kc-bg)] px-1"
                        value={editCategoryLabel}
                        onChange={e => setEditCategoryLabel(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRenameCategory(catKey); }}
                        autoFocus
                      />
                      <button className="text-[10px] px-1 text-[var(--kc-blue)]" onClick={() => handleRenameCategory(catKey)}>save</button>
                      <button className="text-[10px] px-1" onClick={() => setEditingCategory(null)}>cancel</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-[11px] text-[var(--kc-text)]">{categoryConfig.labels[catKey] ?? catKey}</span>
                      <button
                        className="text-[10px] opacity-50 hover:opacity-100 cursor-pointer"
                        onClick={() => { setEditingCategory(catKey); setEditCategoryLabel(categoryConfig.labels[catKey] ?? catKey); }}
                      >
                        <MIcon name="edit" className="!text-[12px]" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
            <div className="flex items-center gap-2 pt-1">
              <input
                className="flex-1 h-6 text-[11px] rounded border border-[var(--kc-border)] bg-[var(--kc-bg)] px-1"
                placeholder="Новая категория..."
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); }}
              />
              <button className="text-[10px] px-1 text-[var(--kc-blue)]" onClick={handleAddCategory}>+</button>
            </div>
          </div>
        )}

        <div className={`space-y-3 ${modulesLoading ? 'pointer-events-none opacity-50' : ''}`}>
          {[...visibleCategories, ...Object.keys(groupedPlugins).filter(cat => !visibleCategories.includes(cat))].map(cat => {
            const plugins = groupedPlugins[cat];
            if (!plugins || plugins.length === 0) return null;
            return (
              <div key={cat}>
                <h4
                  className={`text-[11px] font-semibold text-[var(--kc-text-secondary)] uppercase tracking-wider mb-1 px-1 transition-colors ${dragOverCategory === cat ? 'bg-[var(--kc-blue)] bg-opacity-10' : ''}`}
                  onDragOver={e => handleDragOver(e, cat)}
                  onDragLeave={() => handleDragEnd()}
                  onDrop={() => handleDrop(cat)}
                >
                  {categoryConfig.labels[cat] ?? cat} ({plugins.length})
                </h4>
                <div className="space-y-1">
                  {plugins.map(plugin => (
                    <PluginCard
                      key={plugin.id}
                      plugin={plugin}
                      isExpanded={expandedSettings === plugin.id}
                      draggingId={draggingId}
                      reloading={reloading}
                      uninstallingId={uninstallingId}
                      onToggle={handleToggle}
                      onToggleSettings={toggleSettings}
                      onReload={handleReload}
                      onUninstall={handleUninstall}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      <AddPluginSection onPluginAdded={refreshStatuses} />

      <Separator />

      <div className="flex items-center justify-between p-3 bg-[var(--kc-surface)] rounded-lg border border-[var(--kc-border)]">
        <div>
          <div className="text-[12px] font-semibold text-[var(--kc-text)]">Сохранять в базу данных</div>
          <div className="text-[11px] text-[var(--kc-text-secondary)] mt-0.5">
            Синхронизация с SQLite. При выключении — только localStorage.
          </div>
        </div>
        <DBPersistenceToggle />
      </div>

    </div>
  );
}