// Engine Registry — maps ToolIds to handler functions
// Every tool MUST have a registered handler.
// Registration is done at import time.

import type { ToolId } from '@/core/tool-registry';
import { getToolConfig } from '@/core/tool-registry';
import type { EngineHandler, EngineRegistryEntry, HybridConfig } from './types';
import type { ToolEngine } from '@/core/tool-registry';

const registry = new Map<ToolId, EngineRegistryEntry>();
const hybridConfigs = new Map<ToolId, HybridConfig>();

export function registerEngineHandler(
  toolId: ToolId,
  engine: ToolEngine,
  handler: EngineHandler,
  hybrid?: HybridConfig,
): void {
  registry.set(toolId, { toolId, engine, handler, hybridConfig: hybrid });
  if (hybrid) {
    hybridConfigs.set(toolId, hybrid);
  }
}

export function getEngineHandler(toolId: ToolId): EngineHandler | undefined {
  return registry.get(toolId)?.handler;
}

export function getEngineType(toolId: ToolId): ToolEngine | undefined {
  const config = getToolConfig(toolId);
  return config?.engine;
}

export function getHybridConfig(toolId: ToolId): HybridConfig | undefined {
  return hybridConfigs.get(toolId);
}

export function getRegistryEntry(toolId: ToolId): EngineRegistryEntry | undefined {
  return registry.get(toolId);
}

export function isHandlerRegistered(toolId: ToolId): boolean {
  return registry.has(toolId);
}

export function getAllRegisteredTools(): ToolId[] {
  return Array.from(registry.keys());
}

export function unregisterEngineHandler(toolId: ToolId): void {
  registry.delete(toolId);
  hybridConfigs.delete(toolId);
}

export function clearRegistry(): void {
  registry.clear();
  hybridConfigs.clear();
}
