import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DEFAULT_AI_SETTINGS } from '@/plugin-sdk';
import { AIService } from '@/core/ai';
import type { Phrase } from '@/core/types';

function makePhrases(texts: string[], groupId = 'g1'): Phrase[] {
  return texts.map((text, i) => ({
    id: `p${i}`,
    text,
    groupId,
    tags: [],
    createdAt: Date.now(),
  }));
}

function mockFetch(response: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(response),
    text: () => Promise.resolve(typeof response === 'string' ? response : JSON.stringify(response)),
  });
}

describe('AIService', () => {
  let service: AIService;

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new AIService({
      ...DEFAULT_AI_SETTINGS,
      endpoint: 'http://localhost:11434',
      model: 'qwen2.5:3b',
    });
  });

  describe('isAvailable', () => {
    it('should return true when ollama tags endpoint responds', async () => {
      globalThis.fetch = mockFetch({ models: [{ name: 'qwen2.5:3b' }] });
      const result = await service.isAvailable();
      expect(result).toBe(true);
    });

    it('should return false when all endpoints fail', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const result = await service.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('renameGroup', () => {
    it('should return sanitized group name from JSON response', async () => {
      globalThis.fetch = mockFetch({
        choices: [{ message: { content: JSON.stringify({ name: 'SEO Group' }) } }],
      });
      const phrases = makePhrases(['keyword1', 'keyword2']);
      const result = await service.renameGroup(phrases);
      expect(result).toBe('SEO Group');
    });

    it('should return sanitized plain text response', async () => {
      globalThis.fetch = mockFetch({
        choices: [{ message: { content: '"SEO Group Name"' } }],
      });
      const phrases = makePhrases(['keyword1']);
      const result = await service.renameGroup(phrases);
      expect(result).toBe('SEO Group Name');
    });

    it('should throw on empty response', async () => {
      globalThis.fetch = mockFetch({
        choices: [{ message: { content: '' } }],
      });
      await expect(service.renameGroup(makePhrases(['test']))).rejects.toThrow();
    });
  });

  describe('generateGroupNotes', () => {
    it('should return sanitized notes from JSON response', async () => {
      globalThis.fetch = mockFetch({
        choices: [{ message: { content: JSON.stringify({ text: 'Notes about cluster' }) } }],
      });
      const phrases = makePhrases(['kw1', 'kw2']);
      const result = await service.generateGroupNotes(phrases);
      expect(result).toBe('Notes about cluster');
    });

    it('should return sanitized plain text notes', async () => {
      globalThis.fetch = mockFetch({
        choices: [{ message: { content: 'A cluster about SEO keywords.' } }],
      });
      const result = await service.generateGroupNotes(makePhrases(['kw1']));
      expect(result).toBe('A cluster about SEO keywords.');
    });
  });

  describe('checkConnection', () => {
    it('should return connected when model responds', async () => {
      globalThis.fetch = mockFetch({
        choices: [{ message: { content: 'OK' } }],
      });
      const result = await service.checkConnection();
      expect(result).toBe('connected');
    });

    it('should return error when request fails', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const result = await service.checkConnection();
      expect(result).toBe('error');
    });
  });

  describe('cancel', () => {
    it('should abort pending request', async () => {
      let abortFn: (() => void) | null = null;
      globalThis.fetch = vi.fn().mockImplementation((_url, opts) => {
        return new Promise((_resolve, reject) => {
          abortFn = () => reject(new DOMException('Aborted', 'AbortError'));
          if (opts?.signal) {
            opts.signal.addEventListener('abort', abortFn);
          }
        });
      });

      const promise = service.renameGroup(makePhrases(['test']));

      await new Promise(r => setTimeout(r, 50));
      service.cancel();

      await expect(promise).rejects.toThrow();
    });
  });

  describe('cache', () => {
    it('should return cached result for same keywords', async () => {
      globalThis.fetch = mockFetch({
        choices: [{ message: { content: JSON.stringify({ name: 'SEO Group' }) } }],
      });
      const phrases = makePhrases(['kw1', 'kw2']);
      const result1 = await service.renameGroup(phrases);
      expect(result1).toBe('SEO Group');
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Should not be called'));
      const result2 = await service.renameGroup(phrases);
      expect(result2).toBe('SEO Group');
    });

    it('should bypass cache when disabled', async () => {
      service.updateSettings({ ...DEFAULT_AI_SETTINGS, cacheEnabled: false });
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          choices: [{ message: { content: JSON.stringify({ name: 'SEO Group' }) } }],
          model: 'test',
        }),
      });
      globalThis.fetch = fetchMock;
      const phrases = makePhrases(['kw1', 'kw2']);
      await service.renameGroup(phrases);
      await service.renameGroup(phrases);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('retry', () => {
    it('should retry on HTTP 429 and succeed', async () => {
      let attempts = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts === 1) {
          return { ok: false, status: 429, statusText: 'Too Many Requests', text: () => Promise.resolve('Rate limited'), json: () => Promise.resolve({}) };
        }
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            choices: [{ message: { content: JSON.stringify({ name: 'SEO Group' }) } }],
            model: 'qwen2.5:3b',
          }),
        };
      });

      const result = await service.renameGroup(makePhrases(['test']));
      expect(result).toBe('SEO Group');
      expect(attempts).toBe(2);
    }, 10000);
  });
});
