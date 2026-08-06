import type { RuntimeState } from '../module-runtime-types';
import type { RegisteredKeybinding } from '../plugin-api';

export function executeCommand(state: RuntimeState, id: string): void {
  const handler = state.commands.get(id);
  if (handler) {
    handler();
  } else {
    console.warn(`[Runtime] Command "${id}" not found.`);
  }
}

export function handleKeybinding(state: RuntimeState, keys: string): boolean {
  const binding = state.keybindings.get(keys);
  if (!binding) return false;
  const handler = state.commands.get(binding.fullCommandId);
  if (handler) {
    handler();
    return true;
  }
  return false;
}

export function getKeybindings(state: RuntimeState): RegisteredKeybinding[] {
  return Array.from(state.keybindings.values());
}

export function getCommands(state: RuntimeState): Map<string, () => void> {
  return state.commands;
}
