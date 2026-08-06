import { describe, it, expect } from 'vitest';
import { classifyIntent, classifyIntents } from '@/core/intent/intent-classifier';

describe('classifyIntent', () => {
  it('returns null for empty string', () => {
    expect(classifyIntent('')).toBeNull();
    expect(classifyIntent('   ')).toBeNull();
  });

  it('classifies commercial intent', () => {
    expect(classifyIntent('купить холодильник цена')).toBe('commercial');
    expect(classifyIntent('стоимость доставки москва')).toBe('commercial');
    expect(classifyIntent('заказать пиццу скидка')).toBe('commercial');
  });

  it('classifies transactional intent', () => {
    expect(classifyIntent('скачать бесплатно книгу')).toBe('transactional');
    expect(classifyIntent('смотреть онлайн фильм')).toBe('transactional');
    expect(classifyIntent('регистрация личный кабинет')).toBe('transactional');
  });

  it('classifies informational intent', () => {
    expect(classifyIntent('как выбрать ноутбук')).toBe('informational');
    expect(classifyIntent('отзывы о пылесосе')).toBe('informational');
    expect(classifyIntent('что такое искусственный интеллект')).toBe('informational');
  });

  it('classifies navigational intent', () => {
    expect(classifyIntent('официальный сайт')).toBe('navigational');
    expect(classifyIntent('контакты магазина')).toBe('navigational');
    expect(classifyIntent('адрес доставки')).toBe('navigational');
  });

  it('returns null for non-matching phrases', () => {
    expect(classifyIntent('привет мир')).toBeNull();
    expect(classifyIntent('сегодня хорошая погода')).toBeNull();
  });
});

describe('classifyIntents', () => {
  it('classifies multiple phrases', () => {
    const result = classifyIntents(['купить телефон', 'как похудеть', 'официальный сайт', 'случайный текст']);
    expect(result).toHaveLength(3);
    expect(result[0].phrase).toBe('купить телефон');
    expect(result[0].intent).toBe('commercial');
    expect(result[1].phrase).toBe('как похудеть');
    expect(result[1].intent).toBe('informational');
    expect(result[2].phrase).toBe('официальный сайт');
    expect(result[2].intent).toBe('navigational');
  });

  it('returns empty for no matches', () => {
    expect(classifyIntents([''])).toEqual([]);
  });

  it('assigns correct confidence levels', () => {
    const result = classifyIntents(['купить дешево недорого цена доставка', 'купить']);

    const highConf = result.find(r => r.confidence === 'high');
    const lowConf = result.find(r => r.confidence === 'low');
    expect(highConf).toBeDefined();
    expect(lowConf).toBeDefined();
  });
});
