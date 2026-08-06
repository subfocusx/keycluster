// ============================================================
// Tests: core/keybinding-manager.ts — real module tests
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { keybindingManager } from '@/plugin-sdk';
import * as commandRegistry from '@/core/command-registry';

describe('keybindingManager — real module', () => {
  let getCommandRegistrySpy: any;

  beforeEach(() => {
    keybindingManager.clear();
    getCommandRegistrySpy = vi.spyOn(commandRegistry, 'getCommandRegistry');
  });

  afterEach(() => {
    keybindingManager.clear();
    getCommandRegistrySpy.mockRestore();
  });

  describe('register()', () => {
    it('should register keybinding', () => {
      keybindingManager.register('ctrl+k', 'test:command');
      expect(keybindingManager.get('ctrl+k')).toBe('test:command');
    });

    it('should normalize keys to lowercase', () => {
      keybindingManager.register('Ctrl+Shift+K', 'test:command');
      expect(keybindingManager.get('ctrl+shift+k')).toBe('test:command');
    });

    it('should warn on duplicate binding with different command', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      keybindingManager.register('ctrl+k', 'command:a');
      keybindingManager.register('ctrl+k', 'command:b');
      expect(keybindingManager.get('ctrl+k')).toBe('command:b');
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('should not warn when re-registering same command', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      keybindingManager.register('ctrl+k', 'command:a');
      keybindingManager.register('ctrl+k', 'command:a');
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('unregister()', () => {
    it('should remove keybinding', () => {
      keybindingManager.register('ctrl+k', 'test:command');
      keybindingManager.unregister('ctrl+k');
      expect(keybindingManager.get('ctrl+k')).toBeUndefined();
    });

    it('should handle unregistering non-existent binding', () => {
      expect(() => keybindingManager.unregister('ctrl+z')).not.toThrow();
    });
  });

  describe('parseEvent()', () => {
    it('should parse Ctrl+K', () => {
      const e = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
      expect(keybindingManager.parseEvent(e)).toBe('ctrl+k');
    });

    it('should parse Ctrl+Shift+F', () => {
      const e = new KeyboardEvent('keydown', { key: 'F', ctrlKey: true, shiftKey: true });
      expect(keybindingManager.parseEvent(e)).toBe('ctrl+shift+f');
    });

    it('should parse Alt+F4', () => {
      const e = new KeyboardEvent('keydown', { key: 'F4', altKey: true });
      expect(keybindingManager.parseEvent(e)).toBe('alt+f4');
    });

    it('should parse Meta key', () => {
      const e = new KeyboardEvent('keydown', { key: 's', metaKey: true });
      expect(keybindingManager.parseEvent(e)).toBe('meta+s');
    });

    it('should normalize space key', () => {
      const e = new KeyboardEvent('keydown', { key: ' ' });
      expect(keybindingManager.parseEvent(e)).toBe('space');
    });

    it('should normalize escape key', () => {
      const e = new KeyboardEvent('keydown', { key: 'Escape' });
      expect(keybindingManager.parseEvent(e)).toBe('esc');
    });

    it('should normalize arrow keys', () => {
      expect(keybindingManager.parseEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))).toBe('up');
      expect(keybindingManager.parseEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))).toBe('down');
      expect(keybindingManager.parseEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))).toBe('left');
      expect(keybindingManager.parseEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))).toBe('right');
    });

    it('should normalize delete and backspace', () => {
      expect(keybindingManager.parseEvent(new KeyboardEvent('keydown', { key: 'Delete' }))).toBe('del');
      expect(keybindingManager.parseEvent(new KeyboardEvent('keydown', { key: 'Backspace' }))).toBe('backspace');
    });

    it('should normalize enter and tab', () => {
      expect(keybindingManager.parseEvent(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe('enter');
      expect(keybindingManager.parseEvent(new KeyboardEvent('keydown', { key: 'Tab' }))).toBe('tab');
    });

    it('should not add modifier keys as main key', () => {
      const e = new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true });
      expect(keybindingManager.parseEvent(e)).toBe('ctrl');
    });
  });

  describe('handleKeydown() — Ctrl+Z undo', () => {
    it('should dispatch core.undo on Ctrl+Z', () => {
      const handler = vi.fn();
      const mockRegistry: Record<string, any> = {};
      mockRegistry.get = vi.fn(() => ({ handler }));
      mockRegistry.execute = vi.fn((id: string) => {
        const cmd = mockRegistry.get(id);
        if (cmd?.handler) { cmd.handler(); return true; }
        return false;
      });
      getCommandRegistrySpy.mockReturnValue(mockRegistry);
      keybindingManager.register('ctrl+z', 'core.undo');

      const e = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true });
      const result = keybindingManager.handleKeydown(e);

      expect(result).toBe(true);
      expect(handler).toHaveBeenCalled();
    });

    it('should dispatch core.redo on Ctrl+Shift+Z', () => {
      const handler = vi.fn();
      const mockRegistry: Record<string, any> = {};
      mockRegistry.get = vi.fn(() => ({ handler }));
      mockRegistry.execute = vi.fn((id: string) => {
        const cmd = mockRegistry.get(id);
        if (cmd?.handler) { cmd.handler(); return true; }
        return false;
      });
      getCommandRegistrySpy.mockReturnValue(mockRegistry);
      keybindingManager.register('ctrl+shift+z', 'core.redo');

      const e = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true });
      const result = keybindingManager.handleKeydown(e);

      expect(result).toBe(true);
      expect(handler).toHaveBeenCalled();
    });

    it('should dispatch core.redo on Ctrl+Y', () => {
      const handler = vi.fn();
      const mockRegistry: Record<string, any> = {};
      mockRegistry.get = vi.fn(() => ({ handler }));
      mockRegistry.execute = vi.fn((id: string) => {
        const cmd = mockRegistry.get(id);
        if (cmd?.handler) { cmd.handler(); return true; }
        return false;
      });
      getCommandRegistrySpy.mockReturnValue(mockRegistry);
      keybindingManager.register('ctrl+y', 'core.redo');

      const e = new KeyboardEvent('keydown', { key: 'y', ctrlKey: true });
      const result = keybindingManager.handleKeydown(e);

      expect(result).toBe(true);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('handleKeydown()', () => {
    it('should return false when no binding exists', () => {
      const e = new KeyboardEvent('keydown', { key: 'x', ctrlKey: true });
      expect(keybindingManager.handleKeydown(e)).toBe(false);
    });

    it('should return false when command not in registry', () => {
      const mockRegistry: Record<string, any> = {};
      mockRegistry.get = vi.fn(() => undefined);
      mockRegistry.execute = vi.fn((id: string) => {
        const cmd = mockRegistry.get(id);
        if (cmd?.handler) { cmd.handler(); return true; }
        return false;
      });
      getCommandRegistrySpy.mockReturnValue(mockRegistry);
      keybindingManager.register('ctrl+h', 'nonexistent:command');

      const e = new KeyboardEvent('keydown', { key: 'h', ctrlKey: true });
      const result = keybindingManager.handleKeydown(e);

      expect(result).toBe(false);
      expect(mockRegistry.get).toHaveBeenCalledWith('nonexistent:command');
    });

    it('should execute command and return true when found in registry', () => {
      const handler = vi.fn();
      const mockRegistry: Record<string, any> = {};
      mockRegistry.get = vi.fn(() => ({ handler }));
      mockRegistry.execute = vi.fn((id: string) => {
        const cmd = mockRegistry.get(id);
        if (cmd?.handler) { cmd.handler(); return true; }
        return false;
      });
      getCommandRegistrySpy.mockReturnValue(mockRegistry);
      keybindingManager.register('ctrl+h', 'find-replace:open');

      const e = new KeyboardEvent('keydown', { key: 'h', ctrlKey: true });
      const result = keybindingManager.handleKeydown(e);

      expect(result).toBe(true);
      expect(handler).toHaveBeenCalled();
    });

    it('should prevent default and stop propagation', () => {
      const handler = vi.fn();
      const mockRegistry: Record<string, any> = {};
      mockRegistry.get = vi.fn(() => ({ handler }));
      mockRegistry.execute = vi.fn((id: string) => {
        const cmd = mockRegistry.get(id);
        if (cmd?.handler) { cmd.handler(); return true; }
        return false;
      });
      getCommandRegistrySpy.mockReturnValue(mockRegistry);
      keybindingManager.register('ctrl+c', 'copy:action');

      const e = { preventDefault: vi.fn(), stopPropagation: vi.fn(), key: 'c', ctrlKey: true } as unknown as KeyboardEvent;
      keybindingManager.handleKeydown(e);

      expect(e.preventDefault).toHaveBeenCalled();
      expect(e.stopPropagation).toHaveBeenCalled();
    });
  });

  describe('getAll()', () => {
    it('should return all registered bindings', () => {
      keybindingManager.register('ctrl+k', 'command:a');
      keybindingManager.register('ctrl+shift+e', 'command:b');
      keybindingManager.register('alt+f4', 'command:c');

      const all = keybindingManager.getAll();
      expect(all).toHaveLength(3);
      expect(all.map(b => b.commandId)).toContain('command:a');
      expect(all.map(b => b.commandId)).toContain('command:b');
      expect(all.map(b => b.commandId)).toContain('command:c');
    });

    it('should return empty array when no bindings', () => {
      expect(keybindingManager.getAll()).toEqual([]);
    });
  });

  describe('get()', () => {
    it('should return commandId for registered binding', () => {
      keybindingManager.register('ctrl+k', 'test:command');
      expect(keybindingManager.get('ctrl+k')).toBe('test:command');
    });

    it('should return undefined for non-existent binding', () => {
      expect(keybindingManager.get('ctrl+z')).toBeUndefined();
    });

    it('should normalize keys', () => {
      keybindingManager.register('Ctrl+K', 'test:command');
      expect(keybindingManager.get('CTRL+K')).toBe('test:command');
    });
  });

  describe('clear()', () => {
    it('should remove all bindings', () => {
      keybindingManager.register('ctrl+k', 'command:a');
      keybindingManager.register('ctrl+shift+e', 'command:b');
      keybindingManager.clear();
      expect(keybindingManager.getAll()).toHaveLength(0);
    });
  });
});