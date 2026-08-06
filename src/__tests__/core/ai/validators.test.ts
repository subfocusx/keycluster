import { describe, it, expect } from 'vitest';
import {
  validatePlainText,
  tryExtractJson,
  sanitizeGroupName,
  sanitizeGroupDescription,
  sanitizeAIResponse,
} from '@/plugin-sdk';

describe('Validators', () => {
  describe('validatePlainText', () => {
    it('should return trimmed string for string input', () => {
      expect(validatePlainText('  Hello  ')).toBe('Hello');
    });

    it('should return null for empty string', () => {
      expect(validatePlainText('  ')).toBeNull();
    });

    it('should extract name from object', () => {
      expect(validatePlainText({ name: 'Group Name' })).toBe('Group Name');
    });
  });

  describe('tryExtractJson', () => {
    it('should extract object JSON from markdown', () => {
      const result = tryExtractJson('Here is the result: {"score": 4, "reason": "ok"}');
      expect(result).toEqual({ score: 4, reason: 'ok' });
    });

    it('should extract array JSON from text', () => {
      const result = tryExtractJson('Output: [{"phrase": "test", "intent": "commercial"}]');
      expect(result).toEqual([{ phrase: 'test', intent: 'commercial' }]);
    });

    it('should return null for text without JSON', () => {
      expect(tryExtractJson('Just plain text')).toBeNull();
    });

    it('should return null for malformed JSON', () => {
      expect(tryExtractJson('{"broken": true')).toBeNull();
    });

    it('should extract from triple backticks', () => {
      const result = tryExtractJson('```json\n{"key": "value"}\n```');
      expect(result).toEqual({ key: 'value' });
    });
  });

  describe('sanitizeGroupName', () => {
    it('should trim whitespace', () => {
      expect(sanitizeGroupName('  SEO Group  ')).toBe('SEO Group');
    });

    it('should remove quotes', () => {
      expect(sanitizeGroupName('"SEO Group"')).toBe('SEO Group');
    });

    it('should limit to 4 words', () => {
      expect(sanitizeGroupName('one two three four five')).toBe('one two three four');
    });

    it('should remove markdown', () => {
      expect(sanitizeGroupName('**SEO Group**')).toBe('SEO Group');
    });
  });

  describe('sanitizeGroupDescription', () => {
    it('should trim whitespace', () => {
      expect(sanitizeGroupDescription('  Description text.  ')).toBe('Description text.');
    });

    it('should limit to one sentence', () => {
      expect(sanitizeGroupDescription('First sentence. Second sentence.')).toBe('First sentence.');
    });

    it('should limit to 15 words', () => {
      const long = Array.from({ length: 20 }, (_, i) => `word${i}`).join(' ') + '.';
      const result = sanitizeGroupDescription(long);
      expect(result.split(/\s+/).length).toBeLessThanOrEqual(16);
    });
  });

  describe('sanitizeAIResponse', () => {
    it('should remove markdown code blocks', () => {
      expect(sanitizeAIResponse('```json\n{"key": "value"}\n```')).not.toContain('```');
    });

    it('should remove leading bullets', () => {
      expect(sanitizeAIResponse('- item\n- another')).not.toContain('- ');
    });

    it('should remove leading numbers', () => {
      expect(sanitizeAIResponse('1. first\n2. second')).not.toContain('1.');
    });
  });
});
