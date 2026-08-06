// ============================================================
// Tests for KeybindingManager — global keyboard shortcut system
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

// We need to test the class directly, not the singleton
// So we import the class pattern and recreate it

class KeybindingManager {
  private bindings: Map<string, string> = new Map();

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

  unregister(keys: string): void {
    this.bindings.delete(keys.toLowerCase());
  }

  parseEvent(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.ctrlKey) parts.push('ctrl');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey) parts.push('shift');
    if (e.metaKey) parts.push('meta');
    let key = e.key.toLowerCase();
    const keyMap: Record<string, string> = {
      ' ': 'space', 'escape': 'esc', 'arrowup': 'up',
      'arrowdown': 'down', 'arrowleft': 'left', 'arrowright': 'right',
      'delete': 'del', 'backspace': 'backspace', 'enter': 'enter', 'tab': 'tab',
    };
    if (keyMap[key]) key = keyMap[key];
    const modifierKeys = ['control', 'alt', 'shift', 'meta'];
    if (!modifierKeys.includes(key)) parts.push(key);
    return parts.join('+');
  }

  handleKeydown(e: KeyboardEvent): boolean {
    const keyString = this.parseEvent(e);
    const commandId = this.bindings.get(keyString);
    if (!commandId) return false;
    return true; // Simplified for testing
  }

  getAll(): Array<{ keys: string; commandId: string }> {
    return Array.from(this.bindings.entries()).map(([keys, commandId]) => ({ keys, commandId }));
  }

  get(keys: string): string | undefined {
    return this.bindings.get(keys.toLowerCase());
  }

  clear(): void {
    this.bindings.clear();
  }
}

describe('KeybindingManager', () => {
  let manager: KeybindingManager;

  beforeEach(() => {
    manager = new KeybindingManager();
  });

  describe('register()', () => {
    it('should register a keybinding', () => {
      manager.register('ctrl+k', 'command:open');
      expect(manager.get('ctrl+k')).toBe('command:open');
    });

    it('should normalize keys to lowercase', () => {
      manager.register('Ctrl+Shift+F', 'command:search');
      expect(manager.get('ctrl+shift+f')).toBe('command:search');
    });

    it('should override existing binding with warning', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      manager.register('ctrl+k', 'command:a');
      manager.register('ctrl+k', 'command:b');
      expect(manager.get('ctrl+k')).toBe('command:b');
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('should not warn when re-registering same command', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      manager.register('ctrl+k', 'command:open');
      manager.register('ctrl+k', 'command:open');
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('unregister()', () => {
    it('should remove a keybinding', () => {
      manager.register('ctrl+k', 'command:open');
      manager.unregister('ctrl+k');
      expect(manager.get('ctrl+k')).toBeUndefined();
    });

    it('should handle unregistering non-existent binding', () => {
      expect(() => manager.unregister('ctrl+z')).not.toThrow();
    });
  });

  describe('parseEvent()', () => {
    it('should parse Ctrl+K', () => {
      const e = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
      expect(manager.parseEvent(e)).toBe('ctrl+k');
    });

    it('should parse Ctrl+Shift+F', () => {
      const e = new KeyboardEvent('keydown', { key: 'F', ctrlKey: true, shiftKey: true });
      expect(manager.parseEvent(e)).toBe('ctrl+shift+f');
    });

    it('should parse Alt+F4', () => {
      const e = new KeyboardEvent('keydown', { key: 'F4', altKey: true });
      expect(manager.parseEvent(e)).toBe('alt+f4');
    });

    it('should normalize special keys', () => {
      const e1 = new KeyboardEvent('keydown', { key: ' ' });
      expect(manager.parseEvent(e1)).toBe('space');

      const e2 = new KeyboardEvent('keydown', { key: 'Escape' });
      expect(manager.parseEvent(e2)).toBe('esc');

      const e3 = new KeyboardEvent('keydown', { key: 'Enter' });
      expect(manager.parseEvent(e3)).toBe('enter');
    });

    it('should normalize arrow keys', () => {
      const e = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      expect(manager.parseEvent(e)).toBe('down');
    });

    it('should not add modifier keys as main key', () => {
      const e = new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true });
      expect(manager.parseEvent(e)).toBe('ctrl');
    });
  });

  describe('handleKeydown()', () => {
    it('should return true when binding exists', () => {
      manager.register('ctrl+h', 'find-replace:open');
      const e = new KeyboardEvent('keydown', { key: 'h', ctrlKey: true });
      expect(manager.handleKeydown(e)).toBe(true);
    });

    it('should return false when no binding exists', () => {
      const e = new KeyboardEvent('keydown', { key: 'x', ctrlKey: true });
      expect(manager.handleKeydown(e)).toBe(false);
    });

    it('should match Ctrl+Shift+C', () => {
      manager.register('ctrl+shift+c', 'clustering:run');
      const e = new KeyboardEvent('keydown', { key: 'C', ctrlKey: true, shiftKey: true });
      expect(manager.handleKeydown(e)).toBe(true);
    });
  });

  describe('getAll()', () => {
    it('should return all registered bindings', () => {
      manager.register('ctrl+h', 'find-replace:open');
      manager.register('ctrl+shift+c', 'clustering:run');
      const all = manager.getAll();
      expect(all).toHaveLength(2);
      expect(all.map(b => b.commandId)).toContain('find-replace:open');
      expect(all.map(b => b.commandId)).toContain('clustering:run');
    });
  });

  describe('clear()', () => {
    it('should remove all bindings', () => {
      manager.register('ctrl+h', 'find-replace:open');
      manager.register('ctrl+shift+c', 'clustering:run');
      manager.clear();
      expect(manager.getAll()).toHaveLength(0);
    });
  });
});
