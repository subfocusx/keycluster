import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BUILTIN_EXPORT_FORMATS } from '@user-plugins/import-export/formats';
import type { ExportPayload } from 'plugin-sdk';
import type { Phrase, Group, MinusWord } from 'plugin-sdk';

vi.mock('xlsx', () => ({
  default: {},
  write: vi.fn(() => new ArrayBuffer(0)),
  utils: {
    book_new: vi.fn(() => ({ SheetNames: [], Sheets: {} })),
    book_append_sheet: vi.fn(),
    json_to_sheet: vi.fn(() => ({})),
  },
}));

function makePhrase(overrides: Partial<Phrase> = {}): Phrase {
  return {
    id: 'p1', text: 'test phrase', groupId: 'g1',
    frequency: 100, kei: 10, cpc: 5, createdAt: Date.now(),
    ...overrides,
  };
}

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'g1', name: 'Group 1', parentId: null,
    isExpanded: false, isTrash: false, createdAt: Date.now(),
    ...overrides,
  };
}

function makeMinusWord(overrides: Partial<MinusWord> = {}): MinusWord {
  return {
    id: 'mw1', text: 'minus word', isExact: false,
    groupId: null, searchType: 'broad', createdAt: Date.now(),
    ...overrides,
  };
}

function defaultPayload(overrides: Partial<ExportPayload> = {}): ExportPayload {
  return {
    phrases: [makePhrase(), makePhrase({ id: 'p2', text: 'another phrase', frequency: 50 })],
    groups: [makeGroup()],
    minusWords: [makeMinusWord()],
    columns: ['text', 'group', 'frequency'],
    includeHeader: true,
    ...overrides,
  };
}

describe('BUILTIN_EXPORT_FORMATS', () => {
  it('should have 5 built-in formats', () => {
    expect(BUILTIN_EXPORT_FORMATS).toHaveLength(5);
    expect(BUILTIN_EXPORT_FORMATS.map(f => f.id)).toEqual(['csv', 'tsv', 'txt', 'json', 'xlsx']);
  });
});

describe('csvFormat', () => {
  const csvFormat = BUILTIN_EXPORT_FORMATS.find(f => f.id === 'csv')!;

  it('should export header + rows', async () => {
    const result = await csvFormat.serialize(defaultPayload());
    expect(result).toBe('Фраза,Группа,Частота\ntest phrase,Group 1,100\nanother phrase,Group 1,50');
  });

  it('should export without header', async () => {
    const result = await csvFormat.serialize(defaultPayload({ includeHeader: false }));
    expect(result).toBe('test phrase,Group 1,100\nanother phrase,Group 1,50');
  });

  it('should export minusWords when exportMinusWords is true', async () => {
    const result = await csvFormat.serialize(defaultPayload({
      exportMinusWords: true,
      columns: ['text'],
      includeHeader: false,
    }));
    expect(result).toBe('minus word');
  });

  it('should export minusWords with header', async () => {
    const result = await csvFormat.serialize(defaultPayload({
      exportMinusWords: true,
      columns: ['text'],
      includeHeader: true,
    }));
    expect(result).toBe('Minus-фраза\nminus word');
  });

  it('should handle empty phrases', async () => {
    const result = await csvFormat.serialize(defaultPayload({ phrases: [] }));
    expect(result).toBe('Фраза,Группа,Частота');
  });

  it('should handle empty minusWords with header', async () => {
    const result = await csvFormat.serialize(defaultPayload({
      exportMinusWords: true, minusWords: [],
      columns: ['text'], includeHeader: true,
    }));
    expect(result).toBe('Minus-фраза');
  });

  it('should use custom column labels', async () => {
    const result = await csvFormat.serialize(defaultPayload({
      columnLabels: { text: 'Keyword', group: 'Group', frequency: 'Freq' },
    }));
    expect(result).toContain('Keyword,Group,Freq');
  });
});

describe('tsvFormat', () => {
  const tsvFormat = BUILTIN_EXPORT_FORMATS.find(f => f.id === 'tsv')!;

  it('should export with tab delimiter', async () => {
    const result = await tsvFormat.serialize(defaultPayload());
    expect(result).toBe('Фраза\tГруппа\tЧастота\ntest phrase\tGroup 1\t100\nanother phrase\tGroup 1\t50');
  });

  it('should export minusWords', async () => {
    const result = await tsvFormat.serialize(defaultPayload({
      exportMinusWords: true, columns: ['text'], includeHeader: false,
    }));
    expect(result).toBe('minus word');
  });
});

describe('txtFormat', () => {
  const txtFormat = BUILTIN_EXPORT_FORMATS.find(f => f.id === 'txt')!;

  it('should export phrases one per line', async () => {
    const result = await txtFormat.serialize(defaultPayload());
    expect(result).toBe('test phrase\nanother phrase');
  });

  it('should export minusWords one per line', async () => {
    const result = await txtFormat.serialize(defaultPayload({
      exportMinusWords: true,
    }));
    expect(result).toBe('minus word');
  });

  it('should handle empty phrases', async () => {
    const result = await txtFormat.serialize(defaultPayload({ phrases: [] }));
    expect(result).toBe('');
  });
});

describe('jsonFormat', () => {
  const jsonFormat = BUILTIN_EXPORT_FORMATS.find(f => f.id === 'json')!;

  it('should export phrases as JSON', async () => {
    const result = await jsonFormat.serialize(defaultPayload());
    const parsed = JSON.parse(result as string);
    expect(parsed.version).toBe(1);
    expect(parsed.phrases).toHaveLength(2);
    expect(parsed.groups).toHaveLength(1);
    expect(parsed.minusWords).toHaveLength(1);
  });

  it('should export minusWords as JSON', async () => {
    const result = await jsonFormat.serialize(defaultPayload({
      exportMinusWords: true,
    }));
    const parsed = JSON.parse(result as string);
    expect(parsed.minusWords).toEqual(['minus word']);
  });

  it('should handle empty data', async () => {
    const result = await jsonFormat.serialize(defaultPayload({
      phrases: [], groups: [], minusWords: [],
    }));
    const parsed = JSON.parse(result as string);
    expect(parsed.phrases).toHaveLength(0);
  });
});

describe('xlsxFormat', () => {
  const xlsxFormat = BUILTIN_EXPORT_FORMATS.find(f => f.id === 'xlsx')!;

  it('should return Uint8Array', async () => {
    const result = await xlsxFormat.serialize(defaultPayload());
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('should handle exportMinusWords', async () => {
    const result = await xlsxFormat.serialize(defaultPayload({
      exportMinusWords: true,
    }));
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('should handle empty phrases', async () => {
    const result = await xlsxFormat.serialize(defaultPayload({ phrases: [] }));
    expect(result).toBeInstanceOf(Uint8Array);
  });
});
