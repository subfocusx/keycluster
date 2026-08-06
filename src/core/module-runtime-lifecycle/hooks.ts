import type { RuntimeState } from '../module-runtime-types';
import type { EventBus } from '../types';
import type { LifecycleEvent } from '../plugin-api';

export function runLifecycleHooks(state: RuntimeState, eventBus: EventBus, moduleId: string, event: LifecycleEvent): void {
  const hooks = state.lifecycleHooks.get(event) ?? [];
  for (const entry of hooks) {
    if (entry.moduleId === moduleId) {
      try {
        entry.hook();
      } catch (err) {
        console.error(`[Runtime] Error in ${event} hook for "${moduleId}":`, err);
        eventBus.emit('runtime:error', { moduleId, event, error: err });
      }
    }
  }
}
