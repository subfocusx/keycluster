import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DEFAULT_AI_SETTINGS } from '@/plugin-sdk';
import { AIService } from '@/core/ai';

function createPhrases(texts: string[], frequencies?: number[]) {
  return texts.map((text, i) => ({
    id: 'p' + i,
    text,
    groupId: 'g1',
    frequency: frequencies?.[i],
    createdAt: Date.now(),
  }));
}

function makePhrases(texts: string[], freqs: number[]) {
  return createPhrases(texts, freqs);
}

function mockFetch(response: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      choices: [{ message: { content: JSON.stringify(response) } }],
      model: 'test',
    }),
    text: () => Promise.resolve(JSON.stringify(response)),
  });
}

function extractKeywordLines(promptArg: string): string[] {
  const afterKeywords = promptArg.split('Keywords:')[1] ?? '';
  return afterKeywords.split('\n').filter((l: string) => l.startsWith('- '));
}

describe('AIService renameGroup limited payload', () => {
  let service: AIService;

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new AIService({ ...DEFAULT_AI_SETTINGS, endpoint: 'http://localhost:11434', model: 'test' });
  });

  it('use only top 15 keywords by frequency when available', async () => {
    globalThis.fetch = mockFetch({ name: 'SEO Group' });
    const freqs = Array.from({ length: 50 }, (_, i) => 100 - i);
    const phrases = makePhrases(
      Array.from({ length: 50 }, (_, i) => 'keyword-' + i),
      freqs,
    );
    const spy = vi.spyOn(service as any, 'sendChat');
    const result = await service.renameGroup(phrases);
    expect(result).toBe('SEO Group');
    const promptArg = (spy.mock.calls[0][0] as any[]).find((m: any) => m.role === 'user')?.content ?? '';
    const lines = extractKeywordLines(promptArg);
    expect(lines.length).toBeLessThanOrEqual(15);
  });

  it('use first 15 keywords when no frequency data', async () => {
    globalThis.fetch = mockFetch({ name: 'Test Group' });
    const phrases = createPhrases(Array.from({ length: 50 }, (_, i) => 'keyword-' + i));
    const spy = vi.spyOn(service as any, 'sendChat');
    const result = await service.renameGroup(phrases);
    expect(result).toBe('Test Group');
    const promptArg = (spy.mock.calls[0][0] as any[]).find((m: any) => m.role === 'user')?.content ?? '';
    const lines = extractKeywordLines(promptArg);
    expect(lines.length).toBeLessThanOrEqual(15);
  });

  it('work with fewer than 15 keywords', async () => {
    globalThis.fetch = mockFetch({ name: 'Small Group' });
    const phrases = createPhrases(Array.from({ length: 5 }, (_, i) => 'kw-' + i));
    const result = await service.renameGroup(phrases);
    expect(result).toBe('Small Group');
  });
});

describe('AIService generateGroupNotes limited payload', () => {
  let service: AIService;

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new AIService({ ...DEFAULT_AI_SETTINGS, endpoint: 'http://localhost:11434', model: 'test' });
  });

  it('limit to 15 keywords', async () => {
    globalThis.fetch = mockFetch({ text: 'Notes about cluster' });
    const phrases = createPhrases(Array.from({ length: 100 }, (_, i) => 'kw-' + i));
    const spy = vi.spyOn(service as any, 'sendChat');
    await service.generateGroupNotes(phrases);
    const promptArg = (spy.mock.calls[0][0] as any[]).find((m: any) => m.role === 'user')?.content ?? '';
    const lines = extractKeywordLines(promptArg);
    expect(lines.length).toBeLessThanOrEqual(15);
  });
});
