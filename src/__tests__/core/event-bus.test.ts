// ============================================================
// Tests: core/event-bus.ts
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEventBus } from '@/core/event-bus';

describe('create Event Bus', () => {
  beforeEach(() => {
    // Each test gets a fresh instance
  });

  it('should create an EventBus instance', () => {
    const bus = createEventBus();
    expect(bus).toBeDefined();
    expect(bus.on).toBeTypeOf('function');
    expect(bus.off).toBeTypeOf('function');
    expect(bus.emit).toBeTypeOf('function');
    expect(bus.once).toBeTypeOf('function');
  });

  // ---- on / emit ----

  it('should call handler when event is emitted', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.on('test:event', handler);
    bus.emit('test:event', { value: 42 });
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ value: 42 });
  });

  it('should call multiple handlers for the same event', () => {
    const bus = createEventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('evt', h1);
    bus.on('evt', h2);
    bus.emit('evt');
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('should not call handler for a different event', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.on('evt:a', handler);
    bus.emit('evt:b');
    expect(handler).not.toHaveBeenCalled();
  });

  it('should support emitting without payload', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.on('evt', handler);
    bus.emit('evt');
    expect(handler).toHaveBeenCalledWith(undefined);
  });

  // ---- off ----

  it('should remove handler via off()', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.on('evt', handler);
    bus.off('evt', handler);
    bus.emit('evt');
    expect(handler).not.toHaveBeenCalled();
  });

  it('should not break when off() is called for unknown event', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    expect(() => bus.off('nonexistent', handler)).not.toThrow();
  });

  // ---- unsubscribe (return value of on) ----

  it('should unsubscribe via returned function', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    const unsub = bus.on('evt', handler);
    unsub();
    bus.emit('evt');
    expect(handler).not.toHaveBeenCalled();
  });

  // ---- once ----

  it('should call handler only once with once()', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.once('evt', handler);
    bus.emit('evt', 'first');
    bus.emit('evt', 'second');
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith('first');
  });

  it('should unsubscribe once handler after first call', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.once('evt', handler);
    bus.emit('evt');
    // Emit again — should not be called
    bus.emit('evt');
    expect(handler).toHaveBeenCalledOnce();
  });

  // ---- clear ----

  it('should remove all listeners on clear()', () => {
    const bus = createEventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('evt:a', h1);
    bus.on('evt:b', h2);
    (bus as { clear(): void }).clear();
    bus.emit('evt:a');
    bus.emit('evt:b');
    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  // ---- Error handling ----

  it('should not break other handlers when one throws', () => {
    const bus = createEventBus();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const badHandler = vi.fn(() => { throw new Error('boom'); });
    const goodHandler = vi.fn();
    bus.on('evt', badHandler);
    bus.on('evt', goodHandler);
    bus.emit('evt');
    expect(badHandler).toHaveBeenCalled();
    expect(goodHandler).toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  // ---- Edge cases ----

  it('should handle emitting event with no listeners', () => {
    const bus = createEventBus();
    expect(() => bus.emit('nonexistent')).not.toThrow();
  });

  it('should allow re-subscribing after unsubscribe', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    const unsub = bus.on('evt', handler);
    unsub();
    bus.on('evt', handler);
    bus.emit('evt');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('createEventBus is idempotent — returns same instance on repeated calls', () => {
    const first = createEventBus();
    const second = createEventBus();
    expect(first).toBe(second);
  });

  it('getEventBus returns the same instance as createEventBus', async () => {
    const { getEventBus: getBus } = await import('@/core/event-bus');
    const created = createEventBus();
    const got = getBus();
    expect(got).toBe(created);
  });
});
