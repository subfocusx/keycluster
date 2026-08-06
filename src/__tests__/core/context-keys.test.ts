// ============================================================
// Context Keys Tests
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createContextKeyService } from '@/core/context-keys';

describe('create Context Key Service', () => {
  let service: ReturnType<typeof createContextKeyService>;

  beforeEach(() => {
    service = createContextKeyService();
  });

  // ---- setKey / getKey ----

  it('should set and get a boolean key', () => {
    service.setKey('hasSelection', true);
    expect(service.getKey('hasSelection')).toBe(true);
  });

  it('should set and get a number key', () => {
    service.setKey('phraseCount', 42);
    expect(service.getKey('phraseCount')).toBe(42);
  });

  it('should set and get a string key', () => {
    service.setKey('mode', 'edit');
    expect(service.getKey('mode')).toBe('edit');
  });

  it('should return undefined for unset key', () => {
    expect(service.getKey('unknown')).toBeUndefined();
  });

  it('should update existing key value', () => {
    service.setKey('phraseCount', 5);
    service.setKey('phraseCount', 10);
    expect(service.getKey('phraseCount')).toBe(10);
  });

  it('should not notify when value unchanged', () => {
    const cb = vi.fn();
    service.setKey('test', true);
    service.subscribe('test', cb);
    cb.mockClear();
    service.setKey('test', true); // same value
    expect(cb).not.toHaveBeenCalled();
  });

  // ---- getAllKeys ----

  it('should return all keys', () => {
    service.setKey('a', true);
    service.setKey('b', 5);
    service.setKey('c', 'hello');
    const all = service.getAllKeys();
    expect(all).toEqual({ a: true, b: 5, c: 'hello' });
  });

  // ---- evaluate — truthy ----

  it('should evaluate truthy key as true', () => {
    service.setKey('enabled', true);
    expect(service.evaluate('enabled')).toBe(true);
  });

  it('should evaluate falsy key as false', () => {
    service.setKey('disabled', false);
    expect(service.evaluate('disabled')).toBe(false);
  });

  it('should evaluate unset key as false', () => {
    expect(service.evaluate('nonexistent')).toBe(false);
  });

  it('should evaluate truthy number as true', () => {
    service.setKey('count', 5);
    expect(service.evaluate('count')).toBe(true);
  });

  it('should evaluate zero as false', () => {
    service.setKey('count', 0);
    expect(service.evaluate('count')).toBe(false);
  });

  // ---- evaluate — negation ----

  it('should evaluate !key as true for falsy', () => {
    service.setKey('disabled', false);
    expect(service.evaluate('!disabled')).toBe(true);
  });

  it('should evaluate !key as false for truthy', () => {
    service.setKey('enabled', true);
    expect(service.evaluate('!enabled')).toBe(false);
  });

  it('should evaluate !unset as true', () => {
    expect(service.evaluate('!nonexistent')).toBe(true);
  });

  // ---- evaluate — numeric comparisons ----

  it('should evaluate "key > N" correctly', () => {
    service.setKey('phraseCount', 10);
    expect(service.evaluate('phraseCount > 5')).toBe(true);
    expect(service.evaluate('phraseCount > 15')).toBe(false);
  });

  it('should evaluate "key >= N" correctly', () => {
    service.setKey('count', 5);
    expect(service.evaluate('count >= 5')).toBe(true);
    expect(service.evaluate('count >= 6')).toBe(false);
  });

  it('should evaluate "key < N" correctly', () => {
    service.setKey('count', 3);
    expect(service.evaluate('count < 5')).toBe(true);
    expect(service.evaluate('count < 2')).toBe(false);
  });

  it('should evaluate "key <= N" correctly', () => {
    service.setKey('count', 5);
    expect(service.evaluate('count <= 5')).toBe(true);
    expect(service.evaluate('count <= 4')).toBe(false);
  });

  it('should return false for numeric comparison on non-number', () => {
    service.setKey('text', 'hello');
    expect(service.evaluate('text > 5')).toBe(false);
  });

  it('should handle decimal numbers', () => {
    service.setKey('threshold', 0.8);
    expect(service.evaluate('threshold > 0.5')).toBe(true);
    expect(service.evaluate('threshold < 0.9')).toBe(true);
  });

  // ---- evaluate — strict equality ----

  it('should evaluate "key === string" correctly', () => {
    service.setKey('mode', 'edit');
    expect(service.evaluate('mode === "edit"')).toBe(true);
    expect(service.evaluate('mode === "view"')).toBe(false);
  });

  it('should evaluate "key !== string" correctly', () => {
    service.setKey('mode', 'edit');
    expect(service.evaluate('mode !== "view"')).toBe(true);
    expect(service.evaluate('mode !== "edit"')).toBe(false);
  });

  it('should evaluate equality with single quotes', () => {
    service.setKey('type', 'auto');
    expect(service.evaluate("type === 'auto'")).toBe(true);
  });

  // ---- evaluate — logical operators ----

  it('should evaluate && (AND)', () => {
    service.setKey('a', true);
    service.setKey('b', true);
    expect(service.evaluate('a && b')).toBe(true);

    service.setKey('b', false);
    expect(service.evaluate('a && b')).toBe(false);
  });

  it('should evaluate || (OR)', () => {
    service.setKey('a', false);
    service.setKey('b', true);
    expect(service.evaluate('a || b')).toBe(true);

    service.setKey('b', false);
    expect(service.evaluate('a || b')).toBe(false);
  });

  it('should handle complex expressions with && and ||', () => {
    service.setKey('hasSelection', true);
    service.setKey('phraseCount', 10);
    service.setKey('isAdmin', false);
    // hasSelection && phraseCount > 5
    expect(service.evaluate('hasSelection && phraseCount > 5')).toBe(true);
    // isAdmin || phraseCount > 5
    expect(service.evaluate('isAdmin || phraseCount > 5')).toBe(true);
  });

  // ---- evaluate — empty/whitespace ----

  it('should return true for empty expression', () => {
    expect(service.evaluate('')).toBe(true);
    expect(service.evaluate('  ')).toBe(true);
  });

  // ---- subscribe ----

  it('should subscribe to expression changes', () => {
    const cb = vi.fn();
    service.subscribe('hasSelection', cb);

    // Initial call
    expect(cb).toHaveBeenCalledWith(false);

    // Change key
    service.setKey('hasSelection', true);
    expect(cb).toHaveBeenCalledWith(true);
  });

  it('should unsubscribe correctly', () => {
    const cb = vi.fn();
    const unsub = service.subscribe('test', cb);
    cb.mockClear();

    unsub();
    service.setKey('test', true);
    // After unsub, should not be called
    expect(cb).not.toHaveBeenCalled();
  });

  // ---- clear ----

  it('should clear all keys and subscriptions', () => {
    service.setKey('a', true);
    const cb = vi.fn();
    service.subscribe('a', cb);

    service.clear();
    expect(service.getKey('a')).toBeUndefined();

    cb.mockClear();
    service.setKey('a', true);
    // Subscription was cleared
    expect(cb).not.toHaveBeenCalled();
  });
});
