// ============================================================
// Performance Test Helpers — realistic SEO key generators
// ============================================================

/** Action words common in Russian SEO queries */
const ACTIONS = [
  'купить', 'заказать', 'цена', 'стоимость', 'отзывы',
  'недорого', 'дешево', 'выбрать', 'сравнить', 'характеристики',
  'описание', 'фото', 'видео', 'обзор', 'рейтинг',
  'лучший', 'топ', 'популярный', 'новинка', 'распродажа',
  'скидка', 'акция', 'доставка', 'магазин', 'производитель',
];

/** Category words */
const CATEGORIES = [
  // Электроника
  'iPhone', 'Samsung', 'ноутбук', 'планшет', 'смартфон',
  'телевизор', 'наушники', 'клавиатура', 'монитор', 'мышь',
  'принтер', 'роутер', 'колонка', 'камера', 'часы',
  // Одежда
  'куртка', 'пальто', 'платье', 'рубашка', 'джинсы',
  'ботинки', 'кроссовки', 'сапоги', 'шапка', 'шарф',
  // Мебель
  'диван', 'кровать', 'стол', 'стул', 'шкаф',
  'комод', 'тумба', 'полка', 'кресло', 'матрас',
  // Строительство
  'ламинат', 'плитка', 'обои', 'краска', 'цемент',
  'дверь', 'окно', 'крыша', 'фундамент', 'теплоизоляция',
];

/** Modifier words */
const MODIFIERS = [
  'москва', 'спб', 'екб', 'казань', 'новосибирск',
  'недорого', 'дешево', 'качественный', 'оригинал', 'подлинный',
  'женский', 'мужской', 'детский', 'большой', 'маленький',
  'белый', 'черный', 'красный', 'синий', 'зеленый',
  '2024', '2025', '2026', 'новый', 'старый',
  'премиум', 'люкс', 'эконом', 'стандарт', 'профессиональный',
];

/** Brand/model modifiers */
const BRANDS = [
  '13', '14', '15', 'pro', 'max', 'mini', 'plus', 'ultra',
  '15 pro', '14 max', '16 plus', 'air', 'se',
];

/** Additional contextual words */
const CONTEXT = [
  'интернет', 'онлайн', 'официальный', 'сайт', 'каталог',
  'распродажа', 'черная пятница', 'кэшбэк', 'бонус', 'подарок',
  'самовывоз', 'курьером', 'почтой', 'сборка', 'установка',
  'гарантия', 'сервис', 'ремонт', 'запчасти', 'аксессуары',
];

/** Seeded pseudo-random number generator for reproducibility */
class SeededRNG {
  private state: number;
  constructor(seed: number) {
    this.state = seed;
  }
  next(): number {
    // xorshift32
    this.state ^= this.state << 13;
    this.state ^= this.state >> 17;
    this.state ^= this.state << 5;
    return (this.state >>> 0) / 4294967296;
  }
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  pick<T>(arr: T[]): T {
    return arr[this.nextInt(0, arr.length - 1)];
  }
}

/**
 * Generate realistic Russian SEO keywords.
 * Produces phrases like:
 *   "купить iPhone 13 недорого москва"
 *   "ноутбук Samsung отзывы цена"
 *   "диван кожаный черный доставка"
 */
export function generateKeys(count: number, seed: number = 42): string[] {
  const rng = new SeededRNG(seed);
  const keys: string[] = [];

  for (let i = 0; i < count; i++) {
    const pattern = rng.nextInt(0, 5);

    switch (pattern) {
      case 0: {
        // action + category + modifier
        const action = rng.pick(ACTIONS);
        const cat = rng.pick(CATEGORIES);
        const mod = rng.pick(MODIFIERS);
        keys.push(`${action} ${cat} ${mod}`);
        break;
      }
      case 1: {
        // category + brand + action
        const cat = rng.pick(CATEGORIES);
        const brand = rng.pick(BRANDS);
        const action = rng.pick(ACTIONS);
        keys.push(`${cat} ${brand} ${action}`);
        break;
      }
      case 2: {
        // action + category (short)
        const action = rng.pick(ACTIONS);
        const cat = rng.pick(CATEGORIES);
        keys.push(`${action} ${cat}`);
        break;
      }
      case 3: {
        // category + modifier + modifier + context
        const cat = rng.pick(CATEGORIES);
        const mod1 = rng.pick(MODIFIERS);
        const mod2 = rng.pick(MODIFIERS.filter(m => m !== mod1));
        const ctx = rng.pick(CONTEXT);
        keys.push(`${cat} ${mod1} ${mod2} ${ctx}`);
        break;
      }
      case 4: {
        // long tail: action + category + brand + modifier
        const action = rng.pick(ACTIONS);
        const cat = rng.pick(CATEGORIES);
        const brand = rng.pick(BRANDS);
        const mod = rng.pick(MODIFIERS);
        keys.push(`${action} ${cat} ${brand} ${mod}`);
        break;
      }
      case 5: {
        // just category + context (informational)
        const cat = rng.pick(CATEGORIES);
        const ctx = rng.pick(CONTEXT);
        keys.push(`${cat} ${ctx}`);
        break;
      }
    }
  }

  return keys;
}

/**
 * Generate a Phrase-like object array (matches Phrase type from core/types.ts)
 */
export function generatePhraseObjects(count: number, groupId: string, seed: number = 42): Array<{
  id: string;
  text: string;
  groupId: string;
  frequency?: number;
  kei?: number;
  cpc?: number;
  competition?: number;
  notes?: string;
  tags?: string[];
  createdAt: number;
}> {
  const keys = generateKeys(count, seed);
  const rng = new SeededRNG(seed + 1);

  return keys.map((text, i) => ({
    id: `phrase-${i}`,
    text,
    groupId,
    frequency: rng.nextInt(10, 50000),
    kei: Math.round(rng.next() * 100) / 10,
    cpc: Math.round(rng.next() * 500) / 100,
    competition: Math.round(rng.next() * 100) / 10,
    createdAt: Date.now() - rng.nextInt(0, 86400000 * 30),
  }));
}

/**
 * Generate CSV string for loading into the application.
 * Format: Фраза;Частота;KEI;CPC
 */
export function generateCSV(count: number, seed: number = 42, delimiter: string = ';'): string {
  const keys = generateKeys(count, seed);
  const rng = new SeededRNG(seed + 2);

  const lines: string[] = ['Фраза' + delimiter + 'Частота' + delimiter + 'KEI' + delimiter + 'CPC'];

  for (const key of keys) {
    const freq = rng.nextInt(10, 50000);
    const kei = Math.round(rng.next() * 100) / 10;
    const cpc = Math.round(rng.next() * 500) / 100;
    lines.push(`"${key}"${delimiter}${freq}${delimiter}${kei}${delimiter}${cpc}`);
  }

  return lines.join('\n');
}

/**
 * Format bytes to human-readable MB
 */
export function bytesToMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}
