import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/plugin-sdk';

function parseImportText(lines: string, existing: string[]): { words: string[]; duplicates: number; empty: number } {
  const all: string[] = [];
  for (const line of lines.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/[,;\t]+/);
    for (const part of parts) {
      const w = part.trim().replace(/\s+/g, ' ');
      if (w) all.push(w);
    }
  }
  const existingSet = new Set(existing.map(w => w.toLowerCase()));
  const unique: string[] = [];
  let duplicates = 0;
  for (const w of all) {
    if (existingSet.has(w.toLowerCase())) {
      duplicates++;
    } else if (!unique.some(u => u.toLowerCase() === w.toLowerCase())) {
      unique.push(w);
    }
  }
  return { words: unique, duplicates, empty: all.length - unique.length - duplicates };
}

describe('Minus words bulk import parsing', () => {
  it('should parse newline-separated words', () => {
    const result = parseImportText('word1\nword2\nword3', []);
    expect(result.words).toEqual(['word1', 'word2', 'word3']);
    expect(result.duplicates).toBe(0);
    expect(result.empty).toBe(0);
  });

  it('should parse comma-separated words', () => {
    const result = parseImportText('word1, word2, word3', []);
    expect(result.words).toEqual(['word1', 'word2', 'word3']);
  });

  it('should parse tab-separated words', () => {
    const result = parseImportText('word1\tword2\tword3', []);
    expect(result.words).toEqual(['word1', 'word2', 'word3']);
  });

  it('should parse semicolon-separated words', () => {
    const result = parseImportText('word1; word2; word3', []);
    expect(result.words).toEqual(['word1', 'word2', 'word3']);
  });

  it('should handle mixed separators', () => {
    const result = parseImportText('word1, word2\nword3;\tword4', []);
    expect(result.words).toEqual(['word1', 'word2', 'word3', 'word4']);
  });

  it('should remove duplicates within import', () => {
    const result = parseImportText('word1\nword2\nword1', []);
    expect(result.words).toEqual(['word1', 'word2']);
    expect(result.duplicates).toBe(0);
  });

  it('should detect duplicates against existing words', () => {
    const result = parseImportText('word1\nword2', ['word1']);
    expect(result.words).toEqual(['word2']);
    expect(result.duplicates).toBe(1);
  });

  it('should trim values and remove empty', () => {
    const result = parseImportText('  word1  \n\n  \nword2', []);
    expect(result.words).toEqual(['word1', 'word2']);
  });

  it('should normalize internal spaces', () => {
    const result = parseImportText('word1   test', []);
    expect(result.words).toEqual(['word1 test']);
  });

  it('should handle empty input', () => {
    const result = parseImportText('', []);
    expect(result.words).toEqual([]);
    expect(result.duplicates).toBe(0);
  });

  it('should handle case-insensitive duplicates', () => {
    const result = parseImportText('Word1\nword1', ['WORD1']);
    expect(result.words).toEqual([]);
    expect(result.duplicates).toBe(2);
  });
});

describe('Minus words bulk import via store', () => {
  beforeEach(() => {
    useAppStore.getState().clearAll();
  });

  it('should add multiple minus words from parsed list', () => {
    const words = ['word1', 'word2', 'word3'];
    for (const w of words) {
      useAppStore.getState().addMinusWord(w, false, null, 'broad');
    }
    expect(useAppStore.getState().minusWords).toHaveLength(3);
    expect(useAppStore.getState().minusWords.map(mw => mw.text)).toEqual(['word1', 'word2', 'word3']);
  });

  it('should not add duplicates via store', () => {
    useAppStore.getState().addMinusWord('word1', false, null, 'broad');
    useAppStore.getState().addMinusWord('word1', false, null, 'broad');
    expect(useAppStore.getState().minusWords).toHaveLength(2);
  });
});
