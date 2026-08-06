import type { IntentType } from '@/core/types';

const COMMERCIAL_WORDS = new Set([
  'купить', 'цена', 'стоимость', 'заказать', 'продажа', 'продать', 'продам',
  'доставка', 'скидка', 'акция', 'распродажа', 'оптом', 'розница',
  'прайс', 'стоит', 'цен', 'прейскурант', 'тариф', 'стоимостью',
  'бюджет', 'дешево', 'дешевый', 'недорого', 'недорогой',
  'дилер', 'поставщик', 'каталог', 'ассортимент',
  'предложение', 'спецпредложение', 'акционный', 'скидочный',
  'оплата', 'рассрочка', 'кредит', 'кредитный',
  'подписка', 'абонемент', 'членство',
  'аренда', 'арендовать', 'снять', 'сдам',
  'забронировать', 'бронь', 'бронирование',
  'офис', 'магазин', 'бутик', 'салон', 'ателье',
  'услуга', 'услуги', 'сервис', 'обслуживание',
  'консультация', 'выезд', 'замер', 'монтаж', 'установка',
  'ремонт', 'настройка', 'обновление', 'замена',
  'стоимость_услуг', 'прайс_лист',
  'заказ', 'заказы', 'оформить', 'корзина',
  'чек', 'нал', 'безнал', 'терминал',
]);

const TRANSACTIONAL_WORDS = new Set([
  'скачать', 'бесплатно', 'онлайн', 'смотреть', 'слушать', 'читать',
  'скачать_бесплатно', 'смотреть_онлайн', 'слушать_онлайн',
  'download', 'free', 'watch', 'listen',
  'регистрация', 'зарегистрироваться', 'войти', 'вход',
  'авторизация', 'логин', 'login', 'signup', 'sign_up',
  'получить', 'оформить_заявку', 'заявка', 'подать_заявку',
  'записаться', 'запись', 'запись_на_прием',
  'отправить', 'отправка', 'послать',
  'трек', 'трекинг', 'отследить', 'отслеживание',
  'личный_кабинет', 'кабинет', 'профиль',
  'скачать_бесплатно', 'загрузить', 'загрузка',
  'шаблон', 'образец', 'бланк', 'форма', 'форму',
  'инструкция', 'руководство', 'памятка',
]);

const INFORMATIONAL_WORDS = new Set([
  'как', 'что', 'почему', 'зачем', 'сколько', 'какой', 'какая',
  'какие', 'какое', 'какие', 'чем', 'когда', 'где', 'откуда',
  'куда', 'почему', 'зачем', 'для_чего',
  'отзыв', 'отзывы', 'рейтинг', 'топ', 'лучший', 'лучшие',
  'сравнение', 'сравнить', 'отличие', 'разница',
  'инструкция', 'совет', 'рекомендация', 'правило',
  'пример', 'список', 'перечень', 'виды', 'типы',
  'характеристика', 'характеристики', 'описание', 'параметры',
  'обзор', 'анализ', 'исследование', 'статья',
  'книга', 'учебник', 'справочник', 'словарь',
  'форум', 'блог', 'вопрос', 'ответ', 'faq', 'частые_вопросы',
  'метод', 'способ', 'технология', 'техника',
  'свойства', 'особенности', 'нюансы', 'тонкости',
  'диагностика', 'проверка', 'тест', 'тестирование',
  'норма', 'норматив', 'требование', 'стандарт',
  'расчет', 'калькуляция', 'калькулятор',
  'состав', 'компоненты', 'ингредиенты',
  'схема', 'чертеж', 'план', 'карта',
  'курс', 'обучение', 'тренинг', 'вебинар', 'семинар',
  'новости', 'события', 'мероприятия', 'анонс',
  'история', 'факты', 'данные', 'статистика',
  'можно_ли', 'нужно_ли', 'стоит_ли', 'как_правильно',
  'DIY', 'своими_руками', 'самому',
]);

const NAVIGATIONAL_WORDS = new Set([
  'сайт', 'официальный', 'официальный_сайт', 'домен',
  'контакты', 'контакт', 'телефон', 'адрес', 'email',
  'наши_контакты', 'обратная_связь', 'связь',
  'карта_проезда', 'проезд', 'как_добраться',
  'главная', 'страница', 'раздел', 'категория',
  'карьера', 'вакансии', 'работа', 'резюме',
  'о_компании', 'о_нас', 'о_проекте', 'о_сервисе',
  'политика', 'конфиденциальность', 'соглашение',
  'документы', 'документация', 'реквизиты',
  'поддержка', 'саппорт', 'help', 'помощь',
  'отдел', 'управление', 'департамент',
  'партнеры', 'партнерство', 'сотрудничество',
  'лицензия', 'сертификат', 'свидетельство',
  'блог', 'новости_компании', 'пресса', 'медиа',
  'правила', 'условия', 'публичная_оферта',
  'vkontakte', 'instagram', 'telegram', 'youtube', 'twitter',
  'facebook', 'tiktok', 'социальные_сети',
  'мой_аккаунт', 'account', 'dashboard',
]);

function getWords(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^\wа-яё\s-]/gi, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);
}

function countMatches(words: string[], dictionary: Set<string>): number {
  let count = 0;
  for (const w of words) {
    if (dictionary.has(w)) count++;
  }
  return count;
}

function hasBigramMatch(text: string, dictionary: Set<string>): number {
  let count = 0;
  for (const entry of dictionary) {
    if (entry.includes('_') && text.includes(entry.replace('_', ' '))) {
      count++;
    }
  }
  return count;
}

function scoreIntent(words: string[], text: string, dict: Set<string>): number {
  const wordMatches = countMatches(words, dict);
  const bigramMatches = hasBigramMatch(text, dict);
  return wordMatches * 2 + bigramMatches * 3;
}

export function classifyIntent(phrase: string): IntentType | null {
  if (!phrase || phrase.trim().length === 0) return null;

  const text = phrase.toLowerCase().trim();
  const words = getWords(text);

  if (words.length === 0) return null;

  const scores: Record<IntentType, number> = {
    commercial: scoreIntent(words, text, COMMERCIAL_WORDS),
    transactional: scoreIntent(words, text, TRANSACTIONAL_WORDS),
    informational: scoreIntent(words, text, INFORMATIONAL_WORDS),
    navigational: scoreIntent(words, text, NAVIGATIONAL_WORDS),
  };

  const maxScore = Math.max(...Object.values(scores));
  if (maxScore <= 0) return null;

  const winners = (Object.entries(scores) as [IntentType, number][])
    .filter(([, score]) => score === maxScore);

  if (winners.length === 1) return winners[0][0];

  const priority: IntentType[] = ['commercial', 'transactional', 'informational', 'navigational'];
  for (const p of priority) {
    if (scores[p] === maxScore) return p;
  }

  return null;
}

export interface IntentClassificationResult {
  phrase: string;
  intent: IntentType;
  confidence: 'high' | 'medium' | 'low';
}

export function classifyIntents(phrases: string[]): IntentClassificationResult[] {
  const results: IntentClassificationResult[] = [];

  for (const phrase of phrases) {
    const intent = classifyIntent(phrase);
    if (intent) {
      const words = getWords(phrase);
      const text = phrase.toLowerCase();
      const score = scoreIntent(words, text, COMMERCIAL_WORDS)
        + scoreIntent(words, text, TRANSACTIONAL_WORDS)
        + scoreIntent(words, text, INFORMATIONAL_WORDS)
        + scoreIntent(words, text, NAVIGATIONAL_WORDS);

      let confidence: 'high' | 'medium' | 'low' = 'low';
      if (score >= 6) confidence = 'high';
      else if (score >= 3) confidence = 'medium';

      results.push({ phrase, intent, confidence });
    }
  }

  return results;
}

export { COMMERCIAL_WORDS, TRANSACTIONAL_WORDS, INFORMATIONAL_WORDS, NAVIGATIONAL_WORDS };
