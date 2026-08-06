import React from 'react';
import { useAppStore } from '@/plugin-sdk';
import { MIcon } from '@/shell/shared-icon';
import type { CustomTab } from '@/plugin-sdk';
import { RegistryRibbonButtons } from './RegistryRibbonButtons';
import { PluginRibbonButtons } from './PluginRibbonButtons';
import { useKCDialog } from '@/components/KCDialog';
import { SlotRenderer } from '@/shell/SlotRenderer';
import { clearCurrentProject } from '@/core/project-service';

export interface TabRibbonContext {
  ctx: any;
  activeTool: string | null;
  onToolOpen: (id: string) => void;
  onSettingsOpen: () => void;
  onProjectOpen: () => void;
  onThemeChange: () => void;
  onRefresh: () => void;
  allTabs: CustomTab[];
  overrides: Record<string, string>;
  activeTab: string;
}

function RibbonSep() {
  return <div className="ribbon-sep" />;
}

function ProjectGroup({ onProjectOpen }: { onProjectOpen: () => void }) {
  const kcDialog = useKCDialog();

  return (
    <div className="ribbon-group">
      <div className="ribbon-group-buttons">
        <button className="ribbon-btn" title="Управление проектами"
          onClick={onProjectOpen}
        >
          <MIcon name="folder_special" className="ribbon-icon" />
          <span className="ribbon-label">Проекты</span>
        </button>
        <button className="ribbon-btn" title="Новый проект"
          onClick={async () => {
            if (await kcDialog.confirm('Очистить все данные?', { title: 'Очистка', confirmLabel: 'Очистить', variant: 'destructive' })) clearCurrentProject();
          }}
        >
          <MIcon name="note_add" className="ribbon-icon" />
          <span className="ribbon-label">Создать</span>
        </button>
      </div>
    </div>
  );
}

function UndoRedoGroup() {
  const undoStack = useAppStore(s => s.undoStack);
  const redoStack = useAppStore(s => s.redoStack);
  const undo = useAppStore(s => s.undo);
  const redo = useAppStore(s => s.redo);

  return (
    <div className="ribbon-group">
      <div className="ribbon-group-buttons">
        <button
          className="ribbon-btn"
          title={`Отменить (Ctrl+Z)${undoStack.length > 0 ? ` · ${undoStack.length} шагов` : ''}`}
          onClick={undo}
          disabled={undoStack.length === 0}
        >
          <MIcon name="undo" className="ribbon-icon" />
          <span className="ribbon-label">
            Отменить{undoStack.length > 0 ? ` (${undoStack.length})` : ''}
          </span>
        </button>
        <button
          className="ribbon-btn"
          title={`Повторить (Ctrl+Shift+Z)${redoStack.length > 0 ? ` · ${redoStack.length} шагов` : ''}`}
          onClick={redo}
          disabled={redoStack.length === 0}
        >
          <MIcon name="redo" className="ribbon-icon" />
          <span className="ribbon-label">
            Повторить{redoStack.length > 0 ? ` (${redoStack.length})` : ''}
          </span>
        </button>
      </div>
    </div>
  );
}

function SlotGroup({ ctx, slots }: { ctx: any; slots: string[] }) {
  return (
    <div className="ribbon-group">
      <div className="ribbon-group-buttons">
        {slots.map(slot => (
          <SlotRenderer key={slot} slot={slot} ctx={ctx} />
        ))}
      </div>
    </div>
  );
}

function RegistryGroup(props: {
  tab: string;
  activeTool: string | null;
  onToolOpen: (id: string) => void;
  allTabs: CustomTab[];
  overrides: Record<string, string>;
}) {
  return (
    <div className="ribbon-group">
      <div className="ribbon-group-buttons">
        <RegistryRibbonButtons
          tab={props.tab}
          activeTool={props.activeTool}
          onToolOpen={props.onToolOpen}
          allTabs={props.allTabs}
          overrides={props.overrides}
        />
      </div>
    </div>
  );
}

function AIRibbonGroup() {
  const openPanel = React.useCallback(() => {
    const s = useAppStore.getState();
    if (s.ui.leftPanel.module === 'ai' && s.ui.leftPanel.open) {
      s.setLeftPanel(false);
    } else {
      s.setLeftPanel(true, 'ai');
    }
  }, []);

  return (
    <div className="flex items-center gap-0.5">
      <button className="ribbon-btn" title="AI Панель" onClick={openPanel}>
        <MIcon name="auto_awesome" className="ribbon-icon" />
        <span className="ribbon-label">AI Панель</span>
      </button>
    </div>
  );
}

function PluginRibbonGroup(props: {
  activeTool: string | null;
  onToolOpen: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <PluginRibbonButtons onToolOpen={props.onToolOpen} activeTool={props.activeTool} />
    </div>
  );
}

function ViewActionsGroup({ onRefresh, onThemeChange, onSettingsOpen }: {
  onRefresh: () => void;
  onThemeChange: () => void;
  onSettingsOpen: () => void;
}) {
  const theme = useAppStore(s => s.ui.theme);

  return (
    <>
      <div className="flex items-center gap-0.5">
        <button className="ribbon-btn" title="Обновить" onClick={onRefresh}>
          <MIcon name="refresh" className="ribbon-icon" />
          <span className="ribbon-label">Обновить</span>
        </button>
      </div>
      <div className="ribbon-sep" />
      <div className="flex items-center gap-0.5">
        <button className="ribbon-btn" title="Сменить тему" onClick={onThemeChange}>
          <MIcon name={theme === 'dark' || theme === 'dark-pro' ? 'light_mode' : 'dark_mode'} className="ribbon-icon" />
          <span className="ribbon-label">
            {theme === 'dark-pro' ? 'Dark Pro' : theme === 'dark' ? 'Тёмная' : 'Светлая'}
          </span>
        </button>
      </div>
      <div className="ribbon-sep" />
      <div className="flex items-center gap-0.5">
        <button className="ribbon-btn" title="Настройки" onClick={onSettingsOpen}>
          <MIcon name="settings" className="ribbon-icon" />
          <span className="ribbon-label">Настройки</span>
        </button>
      </div>
      <div className="ribbon-sep" />
      <div className="flex items-center gap-0.5">
        <button className="ribbon-btn" title="Автоподгонка ширины столбцов"
          onClick={() => useAppStore.getState().triggerColumnAutoResize()}
        >
          <MIcon name="width_normal" className="ribbon-icon" />
          <span className="ribbon-label">Авторазмер</span>
        </button>
      </div>
    </>
  );
}

export type TabRibbonGroupRenderer = React.ComponentType<TabRibbonContext>;

export const BUILTIN_TAB_RIBBONS: Record<string, TabRibbonGroupRenderer[]> = {
  data: [
    function DataRibbon(props: TabRibbonContext) {
      return (
        <>
          <ProjectGroup onProjectOpen={props.onProjectOpen} />
          <RibbonSep />
          <UndoRedoGroup />
          <RibbonSep />
          <SlotGroup ctx={props.ctx} slots={['ribbon:import-export', 'ribbon:file']} />
          <RibbonSep />
          <RegistryGroup
            tab="data"
            activeTool={props.activeTool}
            onToolOpen={props.onToolOpen}
            allTabs={props.allTabs}
            overrides={props.overrides}
          />
        </>
      );
    },
  ],
  algorithms: [
    function AlgoRibbon(props: TabRibbonContext) {
      return (
        <RegistryGroup
          tab="algorithms"
          activeTool={props.activeTool}
          onToolOpen={props.onToolOpen}
          allTabs={props.allTabs}
          overrides={props.overrides}
        />
      );
    },
  ],
  ai: [
    function AIRibbon(_props: TabRibbonContext) {
      return <AIRibbonGroup />;
    },
  ],
  plugins: [
    function PluginRibbon(props: TabRibbonContext) {
      return <PluginRibbonGroup activeTool={props.activeTool} onToolOpen={props.onToolOpen} />;
    },
  ],
  view: [
    function ViewRibbon(props: TabRibbonContext) {
      return (
        <ViewActionsGroup
          onRefresh={props.onRefresh}
          onThemeChange={props.onThemeChange}
          onSettingsOpen={props.onSettingsOpen}
        />
      );
    },
  ],
};

export function getBuiltinTabRibbons(tabId: string): TabRibbonGroupRenderer[] | undefined {
  return BUILTIN_TAB_RIBBONS[tabId];
}

export function isBuiltinTab(tabId: string): boolean {
  return tabId in BUILTIN_TAB_RIBBONS;
}