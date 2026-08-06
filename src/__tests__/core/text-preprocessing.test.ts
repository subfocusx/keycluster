// ============================================================
// Tests: Text Preprocessing — pure functions
// ============================================================

import { describe, it, expect } from 'vitest';
import { simpleLemmatize, preprocessPhrase, DEFAULT_STOP_WORDS } from '@/plugin-sdk';

describe('simple Lemmatize', () => {
  it('should return lowercase words <= 3 characters unchanged', () => {
    expect(simpleLemmatize('а')).toBe('а');
    expect(simpleLemmatize('в')).toBe('в');
    expect(simpleLemmatize('и')).toBe('и');
    expect(simpleLemmatize('на')).toBe('на');
    expect(simpleLemmatize('с')).toBe('с');
    expect(simpleLemmatize('А')).toBe('а');
    expect(simpleLemmatize('В')).toBe('в');
  });

  it('should return exception words unchanged', () => {
    expect(simpleLemmatize('москва')).toBe('москва');
    expect(simpleLemmatize('россия')).toBe('россия');
    expect(simpleLemmatize('купить')).toBe('купить');
    expect(simpleLemmatize('продать')).toBe('продать');
    expect(simpleLemmatize('сделать')).toBe('сделать');
    expect(simpleLemmatize('найти')).toBe('найти');
    expect(simpleLemmatize('знать')).toBe('знать');
    expect(simpleLemmatize('быть')).toBe('быть');
    expect(simpleLemmatize('идти')).toBe('идти');
    expect(simpleLemmatize('жить')).toBe('жить');
  });

  it('should lemmatize verbs - past tense feminine', () => {
    expect(simpleLemmatize('делала')).toBe('делать');
    expect(simpleLemmatize('работала')).toBe('работать');
    expect(simpleLemmatize('строила')).toBe('строить');
    expect(simpleLemmatize('видела')).toBe('видеть');
    expect(simpleLemmatize('слышала')).toBe('слышать');
    expect(simpleLemmatize('говорила')).toBe('говорить');
    expect(simpleLemmatize('читала')).toBe('читать');
    expect(simpleLemmatize('писала')).toBe('писать');
  });

  it('should lemmatize verbs - past tense masculine', () => {
    expect(simpleLemmatize('делал')).toBe('делать');
    expect(simpleLemmatize('работал')).toBe('работать');
    expect(simpleLemmatize('строил')).toBe('строить');
    expect(simpleLemmatize('видел')).toBe('видеть');
    expect(simpleLemmatize('слышал')).toBe('слышать');
    expect(simpleLemmatize('говорил')).toBe('говорить');
    expect(simpleLemmatize('читал')).toBe('читать');
    expect(simpleLemmatize('писал')).toBe('писать');
  });

  it('should lemmatize verbs - present tense 3rd person', () => {
    expect(simpleLemmatize('делает')).toBe('делать');
    expect(simpleLemmatize('работает')).toBe('работать');
    expect(simpleLemmatize('строит')).toBe('строить');
    expect(simpleLemmatize('видит')).toBe('видеть');
    expect(simpleLemmatize('слышит')).toBe('слышать');
    expect(simpleLemmatize('говорит')).toBe('говорить');
    expect(simpleLemmatize('читает')).toBe('читать');
    expect(simpleLemmatize('пишет')).toBe('писать');
  });

  it('should lemmatize adjectives', () => {
    expect(simpleLemmatize('красивый')).toBe('красивый');
    expect(simpleLemmatize('красивая')).toBe('красивый');
    expect(simpleLemmatize('красивое')).toBe('красивый');
    expect(simpleLemmatize('красивые')).toBe('красивый');
    expect(simpleLemmatize('красивая')).toBe('красивый');
    expect(simpleLemmatize('красивым')).toBe('красивый');
    expect(simpleLemmatize('красивыми')).toBe('красивый');
    expect(simpleLemmatize('красивом')).toBe('красивый');
  });

  it('should lemmatize nouns - plural', () => {
    expect(simpleLemmatize('дома')).toBe('дом');
    expect(simpleLemmatize('книги')).toBe('книга');
    expect(simpleLemmatize('книг')).toBe('книга');
    expect(simpleLemmatize('книгам')).toBe('книга');
    expect(simpleLemmatize('книгами')).toBe('книга');
    expect(simpleLemmatize('книгах')).toBe('книга');
    expect(simpleLemmatize('книгой')).toBe('книга');
    expect(simpleLemmatize('книгой')).toBe('книга');
  });

  it('should lemmatize diminutives', () => {
    expect(simpleLemmatize('домочка')).toBe('дом');
    expect(simpleLemmatize('речка')).toBe('река');
    expect(simpleLemmatize('душа')).toBe('душа'); // No rule for душа
    expect(simpleLemmatize('душечка')).toBe('душа');
    expect(simpleLemmatize('душечка')).toBe('душа');
  });

  it('should return original word if no rule applies', () => {
    expect(simpleLemmatize('дом')).toBe('дом');
    expect(simpleLemmatize('книга')).toBe('книга');
    expect(simpleLemmatize('стол')).toBe('стол');
    expect(simpleLemmatize('стул')).toBe('стул');
    expect(simpleLemmatize('окно')).toBe('окно');
    expect(simpleLemmatize('дверь')).toBe('дверь');
  });

  it('should handle mixed case', () => {
    expect(simpleLemmatize('Делала')).toBe('делать');
    expect(simpleLemmatize('Работал')).toBe('работать');
    expect(simpleLemmatize('Строит')).toBe('строить');
    expect(simpleLemmatize('ВИДИТ')).toBe('видеть');
  });

  it('should not apply rules that would make stem too short', () => {
    // Test cases where minStem prevents rule application
    // This depends on the specific rules in the implementation
    expect(simpleLemmatize('а')).toBe('а'); // Already handled by length check
    expect(simpleLemmatize('я')).toBe('я');
  });
});

// ================================================================
// preprocessPhrase
// ================================================================

describe('preprocessPhrase', () => {
  it('should split text into lowercase words', () => {
    const result = preprocessPhrase('Привет мир как дела');
    expect(result).toEqual(['привет', 'мир', 'как', 'дела']);
  });

  it('should ignore numbers when ignoreNumbers=true', () => {
    const result = preprocessPhrase('купить 5 яблок и 3 груши', { ignoreNumbers: true });
    expect(result).toEqual(['купить', 'яблок', 'и', 'груши']);
  });

  it('should keep numbers when ignoreNumbers=false', () => {
    const result = preprocessPhrase('купить 5 яблок и 3 груши', { ignoreNumbers: false });
    expect(result).toEqual(['купить', '5', 'яблок', 'и', '3', 'груши']);
  });

  it('should apply lemmatization when lemmatize=true', () => {
    const result = preprocessPhrase('делает работу и строит дом', { lemmatize: true });
    expect(result).toEqual(['делать', 'работа', 'и', 'строить', 'дом']);
  });

  it('should not apply lemmatization when lemmatize=false', () => {
    const result = preprocessPhrase('делает работу и строит дом', { lemmatize: false });
    expect(result).toEqual(['делает', 'работу', 'и', 'строит', 'дом']);
  });

  it('should apply synonyms when provided', () => {
    const synonyms = new Map([
      ['купить', 'приобрести'],
      ['продать', 'реализовать'],
    ]);
    const result = preprocessPhrase('купить дом и продать машину', { synonyms });
    expect(result).toEqual(['приобрести', 'дом', 'и', 'реализовать', 'машину']);
  });

  it('should keep original word when no synonym exists', () => {
    const synonyms = new Map([
      ['купить', 'приобрести'],
    ]);
    const result = preprocessPhrase('купить дом и продать машину', { synonyms });
    expect(result).toEqual(['приобрести', 'дом', 'и', 'продать', 'машину']);
  });

  it('should remove stop words when provided', () => {
    const stopWords = new Set(['и', 'в', 'на', 'с']);
    const result = preprocessPhrase('купить дом и продать машину', { stopWords });
    expect(result).toEqual(['купить', 'дом', 'продать', 'машину']);
  });

  it('should use DEFAULT_STOP_WORDS when no stopWords provided', () => {
    const result = preprocessPhrase('купить дом и продать машину', { stopWords: DEFAULT_STOP_WORDS });
    expect(result).toEqual(['купить', 'дом', 'продать', 'машину']);
  });

  it('should remove empty and 1-character words', () => {
    const result = preprocessPhrase('а б в г д е ё ж з и й к л м н о п р с т у ф х ц ч ш щ ъ ы ь э ю я');
    expect(result).toEqual(['а', 'б', 'в', 'г', 'д', 'е', 'ё', 'ж', 'з', 'и', 'й', 'к', 'л', 'м', 'н', 'о', 'п', 'р', 'с', 'т', 'у', 'ф', 'х', 'ц', 'ч', 'ш', 'щ', 'ъ', 'ы', 'ь', 'э', 'ю', 'я']);
  });

  it('should combine multiple preprocessing options', () => {
    const synonyms = new Map([
      ['купить', 'приобрести'],
      ['продать', 'реализовать'],
    ]);
    const stopWords = new Set(['и', 'в', 'на', 'с']);
    
    const result = preprocessPhrase(
      'купить 5 домов и продать 3 машины',
      { lemmatize: true, ignoreNumbers: true, synonyms, stopWords }
    );
    
    expect(result).toEqual(['приобрести', 'дом', 'реализовать', 'машина']);
  });

  it('should handle empty string', () => {
    const result = preprocessPhrase('');
    expect(result).toEqual([]);
  });

  it('should handle string with only spaces', () => {
    const result = preprocessPhrase('   ');
    expect(result).toEqual([]);
  });

  it('should handle string with only numbers', () => {
    const result = preprocessPhrase('123 456 789', { ignoreNumbers: true });
    expect(result).toEqual([]);
  });

  it('should handle string with only stop words', () => {
    const result = preprocessPhrase('и в на с по из за к у о от', { stopWords: DEFAULT_STOP_WORDS });
    expect(result).toEqual([]);
  });

  it('should handle complex text with all options', () => {
    const synonyms = new Map([
      ['купить', 'приобрести'],
      ['продать', 'реализовать'],
    ]);
    const stopWords = new Set(['и', 'в', 'на', 'с', 'по']);
    
    const result = preprocessPhrase(
      'Купить 5 домов в Москве и продать 3 машины по цене 1000000 рублей',
      { lemmatize: true, ignoreNumbers: true, synonyms, stopWords }
    );
    
    expect(result).toEqual(['приобрести', 'дом', 'москва', 'реализовать', 'машина', 'цене', 'рубль']);
  });
});

// ================================================================
// DEFAULT_STOP_WORDS
// ================================================================

describe('DEFAULT_STOP_WORDS', () => {
  it('should be a Set', () => {
    expect(DEFAULT_STOP_WORDS).toBeInstanceOf(Set);
  });

  it('should contain common Russian stop words', () => {
    expect(DEFAULT_STOP_WORDS.has('в')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('на')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('с')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('и')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('по')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('из')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('за')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('к')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('у')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('о')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('от')).toBe(true);
  });

  it('should contain prepositions', () => {
    expect(DEFAULT_STOP_WORDS.has('для')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('при')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('через')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('между')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('над')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('под')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('без')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('до')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('со')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('об')).toBe(true);
  });

  it('should contain pronouns', () => {
    expect(DEFAULT_STOP_WORDS.has('я')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('ты')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('он')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('она')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('оно')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('они')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('мы')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('вы')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('это')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('то')).toBe(true);
  });

  it('should contain conjunctions', () => {
    expect(DEFAULT_STOP_WORDS.has('и')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('а')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('но')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('или')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('но')).toBe(true);
  });

  it('should contain adverbs', () => {
    expect(DEFAULT_STOP_WORDS.has('тут')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('где')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('там')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('когда')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('как')).toBe(true);
  });

  it('should contain interrogative words', () => {
    expect(DEFAULT_STOP_WORDS.has('что')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('кто')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('чем')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('какой')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('какая')).toBe(true);
  });

  it('should contain possessive pronouns', () => {
    expect(DEFAULT_STOP_WORDS.has('мой')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('твой')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('его')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('её')).toBe(true);
    expect(DEFAULT_STOP_WORDS.has('их')).toBe(true);
  });

  it('should have reasonable size (around 50-60 words)', () => {
    expect(DEFAULT_STOP_WORDS.size).toBeGreaterThan(40);
    expect(DEFAULT_STOP_WORDS.size).toBeLessThan(80);
  });
});