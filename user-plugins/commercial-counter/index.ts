import type { AppModule, PluginContext } from 'plugin-sdk';
import CommercialCounterPanel from './components/CommercialCounterPanel';

export const COMMERCIAL_WORDS = [
  'купить', 'заказать', 'цена', 'стоимость', 'скидка',
  'доставка', 'дешево', 'акция', 'распродажа', 'кредит',
  'рассрочка', 'бесплатно', 'подарок', 'промокод',
];

const commercialCounterModule: AppModule = {
  manifest: {
    id: 'commercial-counter',
    name: 'Счётчик коммерческих слов',
    version: '1.0.0',
    description: 'Подсчитывает коммерческие слова в группах',
    category: 'analysis',
    slot: ['group:toolbar'],
    dependencies: [],
    settingsSchema: [],
    repository: 'https://github.com/keycluster/kc-commercial-counter',
    minAppVersion: '0.3.0',
  },

  init(ctx: PluginContext) {
    ctx.registerUI({
      slot: 'group:toolbar',
      label: 'Счётчик',
      component: CommercialCounterPanel,
      order: 100,
    });
  },

  destroy() {},
};

export default commercialCounterModule;
