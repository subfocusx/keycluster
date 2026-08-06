'use client';

import React, { Suspense, useState } from 'react';
import { getRuntime, exportPlugin, checkForUpdate } from '@/plugin-sdk';
import type { UpdateCheckResult } from '@/plugin-sdk';
import { ModuleErrorBoundary } from '@/components/ModuleErrorBoundary';
import { MIcon, StatusBadge } from '@/components/plugin-badges';
import { ModuleSettingsInline } from '@/components/plugin-settings-inline';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

interface PluginCardData {
  id: string;
  source: string;
  enabled: boolean;
  name: string;
  version: string;
  status: string;
  error?: string;
  initTimeMs?: number;
  uiContributionsCount?: number;
  hasSettings: boolean;
  category: string;
  isBuiltin?: boolean;
}

interface PluginCardProps {
  plugin: PluginCardData;
  isExpanded: boolean;
  draggingId: string | null;
  reloading: string | null;
  uninstallingId: string | null;
  onToggle: (id: string, enabled: boolean) => void;
  onToggleSettings: (id: string) => void;
  onReload: (id: string) => void;
  onUninstall: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}

export function PluginCard({
  plugin,
  isExpanded,
  draggingId,
  reloading,
  uninstallingId,
  onToggle,
  onToggleSettings,
  onReload,
  onUninstall,
  onDragStart,
  onDragEnd,
}: PluginCardProps) {
  const canShowSettings = plugin.hasSettings && plugin.enabled;
  const [exporting, setExporting] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const isCore = plugin.source === 'builtin';
  const isUserPlugin = plugin.source === 'user';
  const isDev = process.env.NODE_ENV === 'development';
  const isUninstalling = uninstallingId === plugin.id;

  const handleExport = async () => {
    setExporting(true);
    try {
      const dest = await exportPlugin(plugin.id);
      if (dest) {
        console.log(`[PluginCard] Exported "${plugin.name}" to ${dest}`);
      }
    } catch (err) {
      console.error(`[PluginCard] Export failed:`, err);
    } finally {
      setExporting(false);
    }
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateResult(null);
    try {
      const mod = getRuntime()?.getModule(plugin.id);
      if (!mod) return;
      const result = await checkForUpdate(mod.manifest);
      setUpdateResult(result);
      if (result?.hasUpdate) {
        console.log(`[PluginCard] Update available for "${plugin.name}": v${result.latestVersion}`);
      } else if (result && !result.hasUpdate) {
        console.log(`[PluginCard] "${plugin.name}" is up to date (v${result.currentVersion})`);
      }
    } catch (err) {
      console.error(`[PluginCard] Update check failed:`, err);
    } finally {
      setCheckingUpdate(false);
    }
  };

  return (
    <div
      className={`rounded-lg border transition-colors ${
        plugin.enabled
          ? 'border-[var(--kc-border)] bg-[var(--kc-surface)]'
          : 'border-[var(--kc-border-light)] bg-[var(--kc-bg)] opacity-70'
      } ${draggingId === plugin.id ? 'opacity-50' : ''} ${isUninstalling ? 'opacity-40 pointer-events-none' : ''}`}
      draggable={isUserPlugin && !isUninstalling}
      onDragStart={() => onDragStart(plugin.id)}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-center gap-3 px-3 py-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[12px] font-semibold ${plugin.enabled ? 'text-[var(--kc-text)]' : 'text-[var(--kc-text-secondary)]'}`}>
              {plugin.name}
            </span>
            <span className="text-[10px] text-[var(--kc-text-disabled)] font-mono">
              v{plugin.version}
            </span>
            {updateResult?.hasUpdate && (
              <Badge variant="outline" className="text-[9px] h-4 px-1 border-amber-500 text-amber-600">
                v{updateResult.latestVersion} доступно
              </Badge>
            )}
            <StatusBadge status={plugin.status as import('@/plugin-sdk').PluginStatusDetail} />
          </div>
          {plugin.error && (
            <div className="text-[10px] text-red-600 mt-0.5 max-w-[300px] truncate" title={plugin.error}>
              {plugin.error}
            </div>
          )}
          {plugin.status === 'no-ui' && (
            <div className="text-[10px] text-yellow-600 mt-0.5">
              Не зарегистрирован UI. Вызовите ctx.registerUI() в init()
            </div>
          )}
          {plugin.status === 'structure-error' && (
            <div className="text-[10px] text-orange-600 mt-0.5">
              Отсутствуют обязательные поля: manifest, init() или destroy()
            </div>
          )}
          {plugin.status === 'import-error' && (
            <div className="text-[10px] text-red-600 mt-0.5">
              Неверный экспорт. Ожидается export default {`{ manifest, init, destroy }`}
            </div>
          )}
          {plugin.uiContributionsCount !== undefined && plugin.uiContributionsCount > 0 && (
            <div className="text-[10px] text-green-700 mt-0.5">
              UI: {plugin.uiContributionsCount} компонент(ов)
            </div>
          )}
        </div>

        {!plugin.isBuiltin && (
          <Switch
            checked={plugin.enabled}
            onCheckedChange={(checked) => onToggle(plugin.id, checked)}
          />
        )}

        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 shrink-0"
          onClick={() => onToggleSettings(plugin.id)}
          disabled={!canShowSettings}
          title={canShowSettings ? (isExpanded ? 'Скрыть настройки' : 'Настройки модуля') : 'У модуля нет настроек'}
        >
          <MIcon
            name={isExpanded ? 'expand_less' : 'settings'}
            className={`!text-[16px] ${canShowSettings ? 'text-[var(--kc-blue)]' : 'text-[var(--kc-text-disabled)]'}`}
          />
        </Button>

        {isUserPlugin && isDev && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 shrink-0"
            onClick={() => onReload(plugin.id)}
            disabled={reloading === plugin.id}
            title="Перезагрузить модуль (hot reload)"
          >
            {reloading === plugin.id ? (
              <MIcon name="progress_activity" className="!text-[14px] animate-spin" />
            ) : (
              <MIcon name="refresh" className="!text-[14px] text-[var(--kc-text-secondary)]" />
            )}
          </Button>
        )}

        {isUserPlugin && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 shrink-0"
            onClick={handleExport}
            disabled={exporting}
            title="Экспортировать плагин"
          >
            {exporting ? (
              <MIcon name="progress_activity" className="!text-[14px] animate-spin" />
            ) : (
              <MIcon name="file_download" className="!text-[14px] text-[var(--kc-text-secondary)]" />
            )}
          </Button>
        )}

        {isUserPlugin && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 shrink-0"
            onClick={handleCheckUpdate}
            disabled={checkingUpdate}
            title={checkingUpdate ? 'Проверка...' : updateResult?.hasUpdate ? 'Доступно обновление' : 'Проверить обновления'}
          >
            {checkingUpdate ? (
              <MIcon name="progress_activity" className="!text-[14px] animate-spin" />
            ) : (
              <MIcon name="system_update" className={`!text-[14px] ${updateResult?.hasUpdate ? 'text-amber-500' : 'text-[var(--kc-text-secondary)]'}`} />
            )}
          </Button>
        )}

        {isUserPlugin && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 shrink-0 text-red-500 hover:text-red-700"
            onClick={() => onUninstall(plugin.id)}
            disabled={isUninstalling}
            title={isUninstalling ? 'Удаление...' : 'Удалить плагин'}
          >
            {isUninstalling ? (
              <MIcon name="progress_activity" className="!text-[14px] animate-spin" />
            ) : (
              <MIcon name="delete" className="!text-[14px]" />
            )}
          </Button>
        )}
      </div>

      {isExpanded && canShowSettings && (() => {
        const mod = getRuntime()?.getModule(plugin.id);
        const SettingsComp = mod?.manifest?.settingsComponent;
        if (SettingsComp) {
          return (
            <ModuleErrorBoundary moduleId={plugin.id} fallback={<div className="px-3 py-2 text-xs text-red-600">Ошибка в настройках плагина</div>}>
              <Suspense fallback={<div className="px-3 py-2 text-xs opacity-50">Загрузка...</div>}>
                <SettingsComp moduleId={plugin.id} />
              </Suspense>
            </ModuleErrorBoundary>
          );
        }
        return <ModuleSettingsInline moduleId={plugin.id} />;
      })()}
    </div>
  );
}

export type { PluginCardData };