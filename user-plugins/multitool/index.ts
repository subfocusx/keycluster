import { __setCtx, __updatePluginSettings, __setPendingSync, handlerRefs } from './lib/sdk-shim';
import SeoMultitoolPanel, { GroupToolbarButton } from './components/SeoMultitoolPanel';
import {
  filterRegistry,
  batchDeduplicateInState,
  batchRemoveEmptyInState,
  batchCleanCharsInState,
} from './lib/filters';

let _pluginCtx: any = null;

const plugin = {
  manifest: {
    id: 'seo-multitool',
    name: 'SEO Multitool',
    version: '1.2.0',
    description: 'Очистка и фильтрация ключевых фраз: удаление дублей, пустых строк, спецсимволов; фильтры по длине, количеству слов, числам и вопросам',
    category: 'seo',
    icon: 'search',
    slot: ['ribbon:tools', 'context-menu:group'],
  },

  init(ctx: any) {
    __setCtx(ctx);
    _pluginCtx = ctx;

    // --- Task 4: Read settings from manifest settingsSchema ---
    const readSettings = () => ({
      syncWithSelection: ctx.getSetting('syncWithSelection') ?? false,
      defaultFilterMode: ctx.getSetting('defaultFilterMode') ?? 'copy',
      showStats: ctx.getSetting('showStats') ?? true,
      historySize: ctx.getSetting('historySize') ?? 10,
    });
    __updatePluginSettings(readSettings());

    ctx.registerLifecycleHook('onSettingsChange', () => {
      __updatePluginSettings(readSettings());
    });

    // --- UI slots ---
    ctx.registerUI({
      slot: 'ribbon:tools',
      label: 'SEO Multitool',
      icon: 'search',
      component: SeoMultitoolPanel,
      order: 100,
    });

    ctx.registerUI({
      slot: 'context-menu:group',
      label: 'SEO Multitool',
      icon: 'search',
      component: SeoMultitoolPanel,
      order: 100,
    });

    // --- Task 1: Context menu actions for groups ---
    function contextMenuAction(label: string, handler: (group: any, store: any) => void) {
      ctx.registerUI({
        slot: 'context-menu:group',
        label,
        icon: 'cleaning_services',
        action: (group: any, { store, eventBus }: any) => {
          handler(group, store);
          store.dispatch('pushUndo');
          eventBus.emit('notify', { message: `Группа «${group.name}» обработана`, duration: 2500 });
        },
      });
    }

    contextMenuAction('SEO Multitool: удалить дубли', (group, store) => {
      store.dispatch('batchOperation', (state: any) => {
        batchDeduplicateInState(state, group.id);
      });
    });

    contextMenuAction('SEO Multitool: удалить пустые', (group, store) => {
      store.dispatch('batchOperation', (state: any) => {
        batchRemoveEmptyInState(state, group.id);
      });
    });

    contextMenuAction('SEO Multitool: убрать спецсимволы', (group, store) => {
      store.dispatch('batchOperation', (state: any) => {
        batchCleanCharsInState(state, group.id);
      });
    });

    // --- Task 2: Group toolbar button ---
    ctx.registerUI({
      slot: 'group:toolbar',
      label: 'Multitool',
      icon: 'manufacturing',
      component: GroupToolbarButton,
      order: 50,
    });

    // --- Task 5: Commands ---
    ctx.registerCommand('deduplicate', () => handlerRefs.deduplicate());
    ctx.registerCommand('cleanChars',  () => handlerRefs.cleanChars());
    ctx.registerCommand('trim',        () => handlerRefs.trim());
    ctx.registerCommand('lowercase',   () => handlerRefs.lowercase());
    ctx.registerCommand('removeEmpty', () => handlerRefs.removeEmpty());

    // --- Task 5: Keybindings ---
    ctx.registerKeybinding('Ctrl+Shift+D', 'deduplicate');
    ctx.registerKeybinding('Ctrl+Shift+C', 'cleanChars');
    ctx.registerKeybinding('Ctrl+Shift+T', 'trim');
    ctx.registerKeybinding('Ctrl+Shift+L', 'lowercase');
    ctx.registerKeybinding('Ctrl+Shift+E', 'removeEmpty');

    // --- Task 5: Register all filters in host ---
    for (const filter of filterRegistry.getAll()) {
      // Wrap with (text) => check(text, undefined) for host compatibility
      ctx.registerFilter({
        id: filter.id,
        name: filter.name,
        check: (text: string) => filter.check(text),
      });
    }

    // --- Task 6: Exporter TXT + CSV ---
    ctx.registerExporter({
      id:        'seo-multitool-txt',
      label:     'SEO Multitool — текст (.txt)',
      extension: 'txt',
      export:    async ({ phrases }: { phrases: any[] }) => {
        return phrases.map((p: any) => p.text).join('\n');
      },
    });

    ctx.registerExporter({
      id:        'seo-multitool-csv',
      label:     'SEO Multitool — таблица (.csv)',
      extension: 'csv',
      export:    async ({ phrases }: { phrases: any[] }) => {
        const header = 'text,frequency,kei,intent,tags';
        const rows = phrases.map((p: any) => [
          `"${(p.text ?? '').replace(/"/g, '""')}"`,
          p.frequency ?? '',
          p.kei ?? '',
          p.intent ?? '',
          (p.tags ?? []).join(';'),
        ].join(','));
        return [header, ...rows].join('\n');
      },
    });

    // --- Task 3a: Auto-switch selected group ---
    ctx.onEvent('group:selected', (data: { groupId: string }) => {
      ctx.setSetting('selectedGroupId', data.groupId);
    });

    // --- Task 3c: Sync with app selection ---
    ctx.onEvent('selection:changed', () => {
      if (ctx.getSetting('syncWithSelection')) {
        const selectedIds = ctx.store.getState().selectedGroupIds;
        if (selectedIds) {
          __setPendingSync(Array.from(selectedIds));
        }
      }
    });
  },

  destroy() {
    // Exporters auto-unregister via runtime cleanupFns — nothing manual needed.
  },
};

export default plugin;
