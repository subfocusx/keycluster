import type { RuntimeState } from '../module-runtime-types';

export function topologicalSort(state: RuntimeState): string[] {
  const visited = new Set<string>();
  const result: string[] = [];
  const visiting = new Set<string>();
  const cycleNodes = new Set<string>();

  const visit = (id: string) => {
    if (visited.has(id)) return;
    if (state.disabledModules.has(id)) return;
    if (visiting.has(id)) {
      console.warn(`[Runtime] Circular dependency detected: ${id}`);
      cycleNodes.add(id);
      return;
    }
    visiting.add(id);

    const mod = state.modules.get(id);
    if (mod?.manifest.dependencies) {
      for (const dep of mod.manifest.dependencies) {
        if (state.modules.has(dep)) visit(dep);
        else console.warn(`[Runtime] Module "${id}" depends on "${dep}" which is not registered.`);
      }
    }
    visiting.delete(id);
    if (!cycleNodes.has(id)) {
      visited.add(id);
      result.push(id);
    }
  };

  for (const id of state.modules.keys()) visit(id);
  return result;
}
