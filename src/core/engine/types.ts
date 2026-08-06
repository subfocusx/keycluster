// Engine types — unified tool execution abstraction
// Supports algorithm / llm / hybrid execution strategies.
// Every tool execution goes through this layer.

import type { ToolId, ToolEngine } from '@/core/tool-registry';
import type { AIService } from '@/core/ai/service';
import type { MinusWordsEngineOptions, MinusWordResult } from '@/core/minus-words/minus-words-engine';

// ---- Execution context ----

export interface EngineContext {
  aiService?: AIService | null;
  groups?: Group[];
  phrases?: Phrase[];
  settings?: Record<string, unknown>;
  signal?: AbortSignal;
}

// ---- Unified request / result ----

export interface EngineRequest {
  toolId: ToolId;
  input: unknown;
  context: EngineContext;
}

export interface EngineResult {
  success: boolean;
  data: unknown;
  error?: string;
  engine: ToolEngine;
  engineUsed: 'algorithm' | 'llm';
  confidence: number;
  duration: number;
  toolId: ToolId;
}

// ---- Handler signature ----

export type EngineHandler = (
  request: EngineRequest
) => Promise<EngineResult>;

// ---- Hybrid tool config ----

export interface HybridConfig {
  algorithmHandler: EngineHandler;
  llmHandler: EngineHandler;
  confidenceThreshold: number;
  alwaysRunAlgorithm: boolean;
}

// ---- Registry entry ----

export interface EngineRegistryEntry {
  toolId: ToolId;
  engine: ToolEngine;
  handler: EngineHandler;
  hybridConfig?: HybridConfig;
}

// ---- Typed helpers for handler implementations ----

import type { Phrase, Group } from '@/core/types';

export interface MinusWordsInput {
  phrases: Phrase[];
  groups: Group[];
  options?: MinusWordsEngineOptions;
}
