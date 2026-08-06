// ============================================================
// Command Registry Tests
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCommandRegistry } from '@/core/command-registry';

describe('create Command Registry', () => {
  let registry: ReturnType<typeof createCommandRegistry>;

  beforeEach(() => {
    registry = createCommandRegistry();
    localStorage.clear();
  });

  // ---- register / unregister ----

  it('should register a command', () => {
    registry.register({
      id: 'test:cmd1',
      label: 'Test Command',
      category: 'test',
      handler: vi.fn(),
    });

    expect(registry.getAll()).toHaveLength(1);
    expect(registry.get('test:cmd1')?.label).toBe('Test Command');
  });

  it('should overwrite a command with same id on re-register', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    registry.register({ id: 'test:cmd', label: 'V1', category: 'test', handler: handler1 });
    registry.register({ id: 'test:cmd', label: 'V2', category: 'test', handler: handler2 });

    expect(registry.getAll()).toHaveLength(1);
    expect(registry.get('test:cmd')?.label).toBe('V2');
  });

  it('should unregister a command by id', () => {
    registry.register({ id: 'test:cmd', label: 'Test', category: 'test', handler: vi.fn() });
    const result = registry.unregister('test:cmd');

    expect(result).toBe(true);
    expect(registry.getAll()).toHaveLength(0);
  });

  it('should return false when unregistering non-existent command', () => {
    expect(registry.unregister('nope:cmd')).toBe(false);
  });

  // ---- getAll / get ----

  it('should return empty array when no commands registered', () => {
    expect(registry.getAll()).toEqual([]);
  });

  it('should return undefined for non-existent command', () => {
    expect(registry.get('nope:cmd')).toBeUndefined();
  });

  it('should register multiple commands', () => {
    registry.register({ id: 'a:cmd1', label: 'A1', category: 'a', handler: vi.fn() });
    registry.register({ id: 'a:cmd2', label: 'A2', category: 'a', handler: vi.fn() });
    registry.register({ id: 'b:cmd1', label: 'B1', category: 'b', handler: vi.fn() });

    expect(registry.getAll()).toHaveLength(3);
  });

  // ---- search ----

  it('should search by label (case-insensitive)', () => {
    registry.register({ id: 'a:find', label: 'Find & Replace', category: 'a', handler: vi.fn() });
    registry.register({ id: 'a:delete', label: 'Delete phrase', category: 'a', handler: vi.fn() });

    const results = registry.search('find');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('a:find');
  });

  it('should search by id', () => {
    registry.register({ id: 'clustering:run', label: 'Run', category: 'clustering', handler: vi.fn() });
    registry.register({ id: 'groups:add', label: 'Add Group', category: 'groups', handler: vi.fn() });

    const results = registry.search('clustering');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('clustering:run');
  });

  it('should return all commands for empty query', () => {
    registry.register({ id: 'a:x', label: 'X', category: 'a', handler: vi.fn() });
    registry.register({ id: 'b:y', label: 'Y', category: 'b', handler: vi.fn() });

    expect(registry.search('')).toHaveLength(2);
    expect(registry.search('  ')).toHaveLength(2);
  });

  it('should return empty for non-matching query', () => {
    registry.register({ id: 'a:cmd', label: 'Hello', category: 'a', handler: vi.fn() });
    expect(registry.search('xyz')).toHaveLength(0);
  });

  // ---- execute ----

  it('should execute a command and return true', () => {
    const handler = vi.fn();
    registry.register({ id: 'test:run', label: 'Run', category: 'test', handler });

    const result = registry.execute('test:run');
    expect(result).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('should return false for non-existent command on execute', () => {
    expect(registry.execute('nope:cmd')).toBe(false);
  });

  // ---- recent commands ----

  it('should track recent commands', () => {
    registry.register({ id: 'a:cmd1', label: 'C1', category: 'a', handler: vi.fn() });
    registry.register({ id: 'a:cmd2', label: 'C2', category: 'a', handler: vi.fn() });

    registry.execute('a:cmd1');
    registry.execute('a:cmd2');

    const recent = registry.getRecent();
    expect(recent[0]).toBe('a:cmd2'); // most recent first
    expect(recent[1]).toBe('a:cmd1');
  });

  it('should deduplicate recent commands (move to top)', () => {
    registry.register({ id: 'a:cmd1', label: 'C1', category: 'a', handler: vi.fn() });
    registry.register({ id: 'a:cmd2', label: 'C2', category: 'a', handler: vi.fn() });

    registry.execute('a:cmd1');
    registry.execute('a:cmd2');
    registry.execute('a:cmd1'); // again

    const recent = registry.getRecent();
    expect(recent[0]).toBe('a:cmd1');
    // Only unique entries for the commands we executed
    const uniqueRecent = [...new Set(recent)];
    expect(uniqueRecent).toHaveLength(2);
  });

  it('should limit recent to 5 entries', () => {
    for (let i = 0; i < 8; i++) {
      registry.register({ id: `a:cmd${i}`, label: `C${i}`, category: 'a', handler: vi.fn() });
      registry.execute(`a:cmd${i}`);
    }

    const recent = registry.getRecent();
    expect(recent).toHaveLength(5);
    expect(recent[0]).toBe('a:cmd7'); // most recent
  });

  // ---- keybinding ----

  it('should store keybinding in command entry', () => {
    registry.register({
      id: 'a:find',
      label: 'Find',
      category: 'a',
      keybinding: 'Ctrl+F',
      handler: vi.fn(),
    });

    expect(registry.get('a:find')?.keybinding).toBe('Ctrl+F');
  });

  // ---- clear ----

  it('should clear all commands', () => {
    registry.register({ id: 'a:cmd', label: 'C', category: 'a', handler: vi.fn() });
    registry.clear();
    expect(registry.getAll()).toHaveLength(0);
  });
});
