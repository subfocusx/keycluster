// ============================================================
// KeyCluster KeybindingManager — global keyboard shortcut system
// ============================================================
//
// Parses KeyboardEvent → normalized key string ("ctrl+shift+f")
// Looks up in bindings Map → dispatches via command-registry
// Format: lowercase, "+" separated: "ctrl+k", "ctrl+shift+p", "alt+f4"
// ============================================================

import { getCommandRegistry } from './command-registry';

class KeybindingManager {
  /** "ctrl+shift+f" → commandId */
  private bindings: Map<string, string> = new Map();

  /**
   * Register a keybinding: keys → commandId.
   * If keys already bound, overrides with warning.
   */
  register(keys: string, commandId: string): void {
    const normalized = keys.toLowerCase();
    const existing = this.bindings.get(normalized);
    if (existing && existing !== commandId) {
      console.warn(
        `[KeybindingManager] "${normalized}" already bound to "${existing}", overriding with "${commandId}".`,
      );
    }
    this.bindings.set(normalized, commandId);
  }

  /**
   * Unregister a keybinding by keys.
   */
  unregister(keys: string): void {
    this.bindings.delete(keys.toLowerCase());
  }

  /**
   * Parse a KeyboardEvent into a normalized key string.
   * Example: Ctrl+Shift+F → "ctrl+shift+f"
   */
  parseEvent(e: KeyboardEvent): string {
    const parts: string[] = [];

    if (e.ctrlKey) parts.push('ctrl');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey) parts.push('shift');
    if (e.metaKey) parts.push('meta');

    // Key value: prefer e.key, fallback to e.code
    let key = e.key.toLowerCase();

    // Normalize special keys
    const keyMap: Record<string, string> = {
      ' ': 'space',
      'escape': 'esc',
      'arrowup': 'up',
      'arrowdown': 'down',
      'arrowleft': 'left',
      'arrowright': 'right',
      'delete': 'del',
      'backspace': 'backspace',
      'enter': 'enter',
      'tab': 'tab',
    };

    if (keyMap[key]) {
      key = keyMap[key];
    }

    // Don't add modifier keys as the main key
    const modifierKeys = ['control', 'alt', 'shift', 'meta'];
    if (!modifierKeys.includes(key)) {
      parts.push(key);
    }

    return parts.join('+');
  }

  /**
   * Handle keydown event — look up binding and dispatch command.
   * Returns true if a binding was found and executed.
   */
  handleKeydown(e: KeyboardEvent): boolean {
    const keyString = this.parseEvent(e);
    const commandId = this.bindings.get(keyString);

    if (!commandId) return false;

    const registry = getCommandRegistry();
    if (registry.execute(commandId)) {
      e.preventDefault();
      e.stopPropagation();
      return true;
    }

    console.warn(
      `[KeybindingManager] Command "${commandId}" not found in registry for keys "${keyString}".`,
    );
    return false;
  }

  /**
   * Get all registered keybindings as entries.
   */
  getAll(): Array<{ keys: string; commandId: string }> {
    return Array.from(this.bindings.entries()).map(([keys, commandId]) => ({
      keys,
      commandId,
    }));
  }

  /**
   * Get the commandId for a key string, if any.
   */
  get(keys: string): string | undefined {
    return this.bindings.get(keys.toLowerCase());
  }

  /**
   * Clear all bindings (used in tests).
   */
  clear(): void {
    this.bindings.clear();
  }
}

/** Singleton instance */
export const keybindingManager = new KeybindingManager();
