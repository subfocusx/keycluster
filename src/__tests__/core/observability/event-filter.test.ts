import { describe, it, expect, beforeEach } from 'vitest';
import { EventFilter } from '@/core/observability/event-filter';

describe('EventFilter', () => {
  let filter: EventFilter;

  beforeEach(() => {
    filter = new EventFilter();
  });

  it('passes all events when nothing is blocked', () => {
    expect(filter.isBlocked('module:error')).toBe(false);
    expect(filter.isBlocked('log:entry')).toBe(false);
    expect(filter.isBlocked('groups:changed')).toBe(false);
  });

  it('blocks exact event name', () => {
    filter.blockExact('log:entry');
    expect(filter.isBlocked('log:entry')).toBe(true);
    expect(filter.isBlocked('module:error')).toBe(false);
  });

  it('unblocks exact event name', () => {
    filter.blockExact('log:entry');
    filter.unblockExact('log:entry');
    expect(filter.isBlocked('log:entry')).toBe(false);
  });

  it('blocks by prefix', () => {
    filter.blockPrefix('module:');
    expect(filter.isBlocked('module:error')).toBe(true);
    expect(filter.isBlocked('module:initialized')).toBe(true);
    expect(filter.isBlocked('log:entry')).toBe(false);
    expect(filter.isBlocked('groups:changed')).toBe(false);
  });

  it('unblocks by prefix', () => {
    filter.blockPrefix('module:');
    filter.unblockPrefix('module:');
    expect(filter.isBlocked('module:error')).toBe(false);
  });

  it('exact match takes priority over prefix', () => {
    filter.blockPrefix('module:');
    filter.unblockExact('module:error');
    expect(filter.isBlocked('module:error')).toBe(false);
    expect(filter.isBlocked('module:initialized')).toBe(true);
  });

  it('stops delivery through EventBus when blocked', () => {
    const bus = {
      on: (_event: string, handler: (payload: unknown) => void) => {
        handler('payload');
        return () => {};
      },
    } as any;

    let delivered = 0;
    const handler = () => { delivered++; };

    filter.blockExact('blocked-event');
    filter.on(bus, 'blocked-event', handler);
    expect(delivered).toBe(0);

    filter.unblockExact('blocked-event');
    filter.on(bus, 'unblocked-event', handler);
    expect(delivered).toBe(1);
  });

  it('prevents event loop when LogStore emits log:entry through EventBus', () => {
    const bus = {
      on(_event: string, handler: (payload: unknown) => void) {
        handler('payload');
        return () => {};
      },
    } as any;

    let recursionCount = 0;
    filter.blockExact('log:entry');

    filter.on(bus, 'log:entry', () => {
      recursionCount++;
    });

    expect(recursionCount).toBe(0);
  });

  it('allows events through when properly unblocked', () => {
    const bus = {
      on(_event: string, handler: (payload: unknown) => void) {
        handler('payload');
        return () => {};
      },
    } as any;

    filter.blockExact('log:entry');
    let received = 0;
    filter.on(bus, 'log:entry', () => received++);
    expect(received).toBe(0);

    filter.unblockExact('log:entry');
    filter.on(bus, 'log:entry', () => received++);
    expect(received).toBe(1);
  });
});
