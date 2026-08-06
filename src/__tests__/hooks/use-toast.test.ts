// ============================================================
// Unit tests for use-toast reducer (pure functions only)
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { reducer } from '@/hooks/use-toast';

describe('use-toast reducer', () => {
  const empty = { toasts: [] };

  beforeEach(() => {
    // reducer is pure, no state to reset
  });

  it('adds a toast and respects TOAST_LIMIT (1)', () => {
    const add1 = { type: 'ADD_TOAST' as const, toast: { id: '1', title: 'First', open: true } };
    const s1 = reducer(empty, add1);
    expect(s1.toasts).toHaveLength(1);
    expect(s1.toasts[0].id).toBe('1');

    const add2 = { type: 'ADD_TOAST' as const, toast: { id: '2', title: 'Second', open: true } };
    const s2 = reducer(s1, add2);
    // limit is 1, only newest remains
    expect(s2.toasts).toHaveLength(1);
    expect(s2.toasts[0].id).toBe('2');
  });

  it('updates an existing toast', () => {
    const start = { toasts: [{ id: 'x', title: 'Old', open: true }] };
    const upd = { type: 'UPDATE_TOAST' as const, toast: { id: 'x', title: 'New', description: 'Desc' } };
    const result = reducer(start, upd);
    expect(result.toasts).toHaveLength(1);
    expect(result.toasts[0].title).toBe('New');
    // description added via spread
    expect((result.toasts[0] as any).description).toBe('Desc');
  });
});
