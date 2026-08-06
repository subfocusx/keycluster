import type { RuntimeState, SlotOptions } from '../module-runtime-types';
import type { ModuleUIContribution } from '../types';
import { getContextKeyService } from '../context-keys';

export function declareSlot(state: RuntimeState, slotId: string, options?: SlotOptions): void {
  if (state.slotRegistry.has(slotId)) {
    const entry = state.slotRegistry.get(slotId)!;
    if (options?.label) entry.options.label = options.label;
    if (options?.defaultVisible !== undefined) entry.options.defaultVisible = options.defaultVisible;
    return;
  }
  state.slotRegistry.set(slotId, {
    contributions: [],
    options: {
      label: options?.label ?? slotId,
      defaultVisible: options?.defaultVisible ?? true,
    },
  });
}

export function getUIContributions(state: RuntimeState, slot: string): ModuleUIContribution[] {
  const entry = state.slotRegistry.get(slot);
  if (!entry) return [];

  const contextKeys = getContextKeyService();
  const filtered = entry.contributions.filter(c => {
    if (c.moduleId && state.failedModules.has(c.moduleId)) return false;
    if (c.moduleId && state.disabledModules.has(c.moduleId)) return false;
    if (!c.when) return true;
    return contextKeys.evaluate(c.when);
  });

  return [...filtered].sort((a, b) => {
    const pa = a.priority ?? 0;
    const pb = b.priority ?? 0;
    if (pb !== pa) return pb - pa;
    return (a.order ?? 0) - (b.order ?? 0);
  });
}

export function getDeclaredSlots(state: RuntimeState): string[] {
  return Array.from(state.slotRegistry.keys());
}

export function getSlotOptions(state: RuntimeState, slot: string): SlotOptions | undefined {
  return state.slotRegistry.get(slot)?.options;
}

export function getAllContributionsBySlot(state: RuntimeState): Record<string, ModuleUIContribution[]> {
  const result: Record<string, ModuleUIContribution[]> = {};
  for (const [slotId, entry] of state.slotRegistry) {
    result[slotId] = [...entry.contributions];
  }
  return result;
}
