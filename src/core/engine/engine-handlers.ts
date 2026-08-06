// Engine handlers — wires existing implementations into the engine registry
// Only tools with programmatic APIs are registered here.

import { registerEngineHandler } from './engine-registry';
import { suggestMinusWords } from '@/core/minus-words/minus-words-engine';
import type { MinusWordsInput } from './types';

// ---- minus-words (algorithm) ----

registerEngineHandler(
  'minus-words',
  'algorithm',
  async (request) => {
    const startTime = performance.now();
    const { phrases, groups, options } = request.input as MinusWordsInput;
    const signal = request.context.signal;

    if (signal?.aborted) {
      return {
        success: false,
        data: null,
        error: 'Cancelled',
        engine: 'algorithm' as const,
        engineUsed: 'algorithm' as const,
        confidence: 0,
        duration: 0,
        toolId: 'minus-words' as const,
      };
    }

    try {
      const results = suggestMinusWords(phrases, groups, options);
      const duration = performance.now() - startTime;

      if (results.length === 0) {
        return {
          success: true,
          data: [],
          engine: 'algorithm' as const,
          engineUsed: 'algorithm' as const,
          confidence: 1,
          duration,
          toolId: 'minus-words' as const,
        };
      }

      const avgConfidence = results.reduce((s, r) => s + r.confidence, 0) / results.length;

      return {
        success: true,
        data: results,
        engine: 'algorithm' as const,
        engineUsed: 'algorithm' as const,
        confidence: avgConfidence,
        duration,
        toolId: 'minus-words' as const,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return {
        success: false,
        data: null,
        error: msg,
        engine: 'algorithm' as const,
        engineUsed: 'algorithm' as const,
        confidence: 0,
        duration: performance.now() - startTime,
        toolId: 'minus-words' as const,
      };
    }
  },
);


