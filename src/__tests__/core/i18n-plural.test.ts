import { describe, it, expect } from 'vitest';
import { plural, pluralize } from '@/core/i18n/plural';

describe('plural (русская склонка)', () => {
  it('выбирает форму по последней цифре', () => {
    expect(plural(1, 'шаг', 'шага', 'шагов')).toBe('шаг');
    expect(plural(2, 'шаг', 'шага', 'шагов')).toBe('шага');
    expect(plural(4, 'шаг', 'шага', 'шагов')).toBe('шага');
    expect(plural(5, 'шаг', 'шага', 'шагов')).toBe('шагов');
    expect(plural(11, 'шаг', 'шага', 'шагов')).toBe('шагов');
    expect(plural(12, 'шаг', 'шага', 'шагов')).toBe('шагов');
    expect(plural(21, 'шаг', 'шага', 'шагов')).toBe('шаг');
    expect(plural(0, 'плагин', 'плагина', 'плагинов')).toBe('плагинов');
  });

  it('pluralize склеивает число и слово', () => {
    expect(pluralize(1, 'плагин', 'плагина', 'плагинов')).toBe('1 плагин');
    expect(pluralize(2, 'плагин', 'плагина', 'плагинов')).toBe('2 плагина');
    expect(pluralize(4, 'плагин', 'плагина', 'плагинов')).toBe('4 плагина');
    expect(pluralize(5, 'плагин', 'плагина', 'плагинов')).toBe('5 плагинов');
    expect(pluralize(1, 'дубль', 'дубля', 'дублей')).toBe('1 дубль');
    expect(pluralize(3, 'дубль', 'дубля', 'дублей')).toBe('3 дубля');
  });

  it('учитывает отрицательные значения по модулю', () => {
    expect(plural(-1, 'шаг', 'шага', 'шагов')).toBe('шаг');
    expect(plural(-3, 'шаг', 'шага', 'шагов')).toBe('шага');
  });
});
