// Hybrid Executor — unified tool execution
// Routes to algorithm / llm / hybrid strategy based on ToolConfig.engine.
// Hybrid: runs algorithm first, checks confidence threshold, falls back to LLM if below.

import type { ToolId } from '@/core/tool-registry';
import { getToolConfig } from '@/core/tool-registry';
import type { EngineRequest, EngineResult, EngineContext } from './types';
import { getEngineHandler, getHybridConfig } from './engine-registry';

const DEFAULT_CONFIDENCE_THRESHOLD = 0.5;

export async function executeTool(
  request: EngineRequest,
): Promise<EngineResult> {
  const { toolId, context } = request;
  const toolConfig = getToolConfig(toolId);
  const engineType = toolConfig?.engine;

  if (!toolConfig || !engineType) {
    return {
      success: false,
      data: null,
      error: `Tool "${toolId}" not found in registry`,
      engine: 'algorithm',
      engineUsed: 'algorithm',
      confidence: 0,
      duration: 0,
      toolId,
    };
  }

  switch (engineType) {
    case 'algorithm':
      return executeAlgorithm(request);
    case 'llm':
      return executeLlm(request);
    case 'hybrid':
      return executeHybrid(request);
    default:
      return {
        success: false,
        data: null,
        error: `Unknown engine type: ${engineType}`,
        engine: engineType,
        engineUsed: 'algorithm',
        confidence: 0,
        duration: 0,
        toolId,
      };
  }
}

async function executeAlgorithm(
  request: EngineRequest,
): Promise<EngineResult> {
  const { toolId, context } = request;
  const handler = getEngineHandler(toolId);
  const startTime = performance.now();

  if (!handler) {
    return {
      success: false,
      data: null,
      error: `No algorithm handler registered for "${toolId}"`,
      engine: 'algorithm',
      engineUsed: 'algorithm',
      confidence: 0,
      duration: 0,
      toolId,
    };
  }

  if (context.signal?.aborted) {
    return {
      success: false,
      data: null,
      error: 'Cancelled',
      engine: 'algorithm',
      engineUsed: 'algorithm',
      confidence: 0,
      duration: performance.now() - startTime,
      toolId,
    };
  }

  try {
    return await handler(request);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return {
      success: false,
      data: null,
      error: msg,
      engine: 'algorithm',
      engineUsed: 'algorithm',
      confidence: 0,
      duration: performance.now() - startTime,
      toolId,
    };
  }
}

async function executeLlm(
  request: EngineRequest,
): Promise<EngineResult> {
  const { toolId, context } = request;
  const startTime = performance.now();

  if (!context.aiService) {
    return {
      success: false,
      data: null,
      error: 'AI service not available',
      engine: 'llm',
      engineUsed: 'algorithm',
      confidence: 0,
      duration: 0,
      toolId,
    };
  }

  if (context.signal?.aborted) {
    return {
      success: false,
      data: null,
      error: 'Cancelled',
      engine: 'llm',
      engineUsed: 'algorithm',
      confidence: 0,
      duration: performance.now() - startTime,
      toolId,
    };
  }

  const handler = getEngineHandler(toolId);
  if (!handler) {
    return {
      success: false,
      data: null,
      error: `No LLM handler registered for "${toolId}"`,
      engine: 'llm',
      engineUsed: 'algorithm',
      confidence: 0,
      duration: 0,
      toolId,
    };
  }

  try {
    const result = await handler(request);
    return {
      ...result,
      engine: 'llm',
      engineUsed: 'llm',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return {
      success: false,
      data: null,
      error: msg,
      engine: 'llm',
      engineUsed: 'algorithm',
      confidence: 0,
      duration: performance.now() - startTime,
      toolId,
    };
  }
}

async function executeHybrid(
  request: EngineRequest,
): Promise<EngineResult> {
  const { toolId, context } = request;
  const startTime = performance.now();
  const hybrid = getHybridConfig(toolId);

  if (!hybrid) {
    return executeAlgorithm(request);
  }

  const threshold = hybrid.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

  if (context.signal?.aborted) {
    return {
      success: false,
      data: null,
      error: 'Cancelled',
      engine: 'hybrid',
      engineUsed: 'algorithm',
      confidence: 0,
      duration: performance.now() - startTime,
      toolId,
    };
  }

  // Phase 1: Run algorithm
  const algoResult = await hybrid.algorithmHandler(request);

  if (!algoResult.success || !algoResult.data) {
    return algoResult;
  }

  const algoDuration = performance.now() - startTime;

  // Phase 2: Check confidence
  if (algoResult.confidence >= threshold) {
    return {
      ...algoResult,
      engine: 'hybrid',
      engineUsed: 'algorithm',
      duration: algoDuration,
    };
  }

  // Phase 3: Fallback to LLM (if available)
  if (!context.aiService) {
    return {
      ...algoResult,
      engine: 'hybrid',
      engineUsed: 'algorithm',
      duration: algoDuration,
    };
  }

  try {
    const llmResult = await hybrid.llmHandler(request);

    return {
      ...llmResult,
      confidence: llmResult.confidence,
      engine: 'hybrid',
      engineUsed: 'llm',
      duration: performance.now() - startTime,
    };
  } catch {
    return {
      ...algoResult,
      engine: 'hybrid',
      engineUsed: 'algorithm',
      confidence: algoResult.confidence,
      duration: performance.now() - startTime,
    };
  }
}

export async function executeToolWithQueue(
  request: EngineRequest,
): Promise<EngineResult> {
  const { aiQueueManager } = await import('@/core/ai/queue-manager');
  const toolConfig = getToolConfig(request.toolId);
  const toolLabel = toolConfig?.label ?? request.toolId;

  return new Promise((resolve, reject) => {
    aiQueueManager.enqueue({
      toolId: request.toolId as any,
      label: toolLabel,
      priority: 0,
      run: async (_svc, signal) => {
        const context: EngineContext = {
          ...request.context,
          signal,
        };
        const result = await executeTool({
          ...request,
          context,
        });
        if (result.success) {
          resolve(result);
        } else {
          reject(new Error(result.error ?? 'Tool execution failed'));
        }
      },
    });
  });
}
