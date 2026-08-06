// ============================================================
// Plugin: Implicit Duplicates — поиск неявных дублей фраз
// ============================================================
//
// Аналог Key Collector «Неявные дубли»:
//   - Перестановки слов: «купить телефон» ≈ «телефон купить»
//   - Морфология: «ремонт квартир» ≈ «ремонт квартиры»
//   - Опечатки: «дизайн интерера» ≈ «дизайн интерьера»
//   - Лишние слова: «ремонт квартир москва» ≈ «ремонт квартир»
//
// Алгоритм: комбинированная метрика (Жаккар + Дайс + Левенштейн +
// перестановки) с Union-Find группировкой.
// ============================================================

import type { AppModule, PluginContext } from 'plugin-sdk';
import { useAppStore } from 'plugin-sdk';
import { ImplicitDuplicatesPanel, terminateWorkerBridge } from './components';

export const implicitDuplicatesModule: AppModule = {
  manifest: {
    id: 'implicit-duplicates',
    name: 'Неявные дубликаты',
    version: '1.0.0',
    description: 'Поиск и удаление неявных дублей: перестановки слов, морфология, опечатки, лишние слова',
    category: 'analysis',
    dependencies: ['phrases'],
    slot: ['ribbon:tools', 'left-panel'],
    icon: 'content_copy',
    settingsSchema: [
      { key: 'threshold', type: 'number', label: 'Порог схожести (%)', default: 80 },
      { key: 'ignoreStopWords', type: 'boolean', label: 'Игнорировать стоп-слова', default: true },
      { key: 'compareWordOrder', type: 'boolean', label: 'Учитывать порядок слов', default: false },
      { key: 'keepHigherFrequency', type: 'boolean', label: 'Оставлять фразу с большей частотностью', default: true },
    ],
  },

  init(ctx: PluginContext) {
    // Настройки читаются в компоненте через ctx.getSetting()

    // Регистрация UI-панели в левую панель
    ctx.registerUI({
      slot: 'left-panel',
      label: 'Неявные дубликаты',
      icon: 'content_copy',
      component: () => ImplicitDuplicatesPanel({ ctx }),
      order: 35,
      priority: 0,
    });

    // Регистрация кнопки в ленте инструментов
    ctx.registerUI({
      slot: 'ribbon:tools',
      label: 'Неявные дубли',
      icon: 'content_copy',
      component: () => ImplicitDuplicatesPanel({ ctx }),
      order: 35,
    });

    // Команда: открыть панель
    ctx.registerCommand('open', () => {
      ctx.store.dispatch('setLeftPanel', { open: true, module: 'implicit-duplicates' });
    });

    // Горячая клавиша: Ctrl+Shift+I
    ctx.registerKeybinding?.('ctrl+shift+i', 'open', {
      label: 'Неявные дубликаты',
    });

    // Подписка на изменение настроек
    ctx.registerLifecycleHook?.('onSettingsChange', (payload) => {
      if (payload?.moduleId === 'implicit-duplicates') {
        // Настройки читаются компонентом напрямую через ctx.getSetting()
      }
    });
  },

  destroy() {
    terminateWorkerBridge();
  },
};

export default implicitDuplicatesModule;