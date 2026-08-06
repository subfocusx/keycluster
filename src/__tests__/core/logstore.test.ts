// ============================================================
// Tests: core/logging/LogStore.ts
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LogStore } from '@/plugin-sdk';

describe('LogStore', () => {
  beforeEach(() => {
    LogStore.clear();
  });

  it('accumulates log entries', () => {
    LogStore._log('info', 'test', 'hello');
    LogStore._log('warn', 'test', 'warning');
    const all = LogStore.getAll();
    expect(all).toHaveLength(2);
    expect(all[0].message).toBe('hello');
    expect(all[1].message).toBe('warning');
  });

  it('filters by level', () => {
    LogStore._log('info', 'mod', 'info msg');
    LogStore._log('warn', 'mod', 'warn msg');
    LogStore._log('error', 'mod', 'error msg');

    const filtered = LogStore.getFiltered({ level: 'warn' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].level).toBe('warn');
  });

  it('filters by module', () => {
    LogStore._log('info', 'mod-a', 'msg a');
    LogStore._log('info', 'mod-b', 'msg b');

    const filtered = LogStore.getFiltered({ module: 'mod-b' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].module).toBe('mod-b');
  });

  it('filters by search text in message', () => {
    LogStore._log('info', 'mod', 'something special');
    LogStore._log('info', 'mod', 'ordinary');

    const filtered = LogStore.getFiltered({ search: 'special' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].message).toBe('something special');
  });

  it('filters by search text in data', () => {
    LogStore._log('info', 'mod', 'msg', { key: 'secret-value' });
    LogStore._log('info', 'mod', 'other');

    const filtered = LogStore.getFiltered({ search: 'secret' });
    expect(filtered).toHaveLength(1);
  });

  it('clears all entries', () => {
    LogStore._log('info', 'mod', 'msg');
    LogStore.clear();
    expect(LogStore.getAll()).toHaveLength(0);
  });

  it('calls subscribe listeners on new entry', () => {
    const listener = vi.fn();
    const unsub = LogStore.subscribe(listener);

    LogStore._log('info', 'mod', 'msg');
    expect(listener).toHaveBeenCalledTimes(1);

    LogStore._log('info', 'mod', 'msg2');
    expect(listener).toHaveBeenCalledTimes(2);

    unsub();
  });

  it('unsubscribe removes listener', () => {
    const listener = vi.fn();
    const unsub = LogStore.subscribe(listener);
    unsub();

    LogStore._log('info', 'mod', 'msg');
    expect(listener).not.toHaveBeenCalled();
  });

  it('exportText produces formatted output', () => {
    LogStore._log('info', 'mod', 'test message');
    const text = LogStore.exportText();
    expect(text).toContain('[INFO ]');
    expect(text).toContain('[mod]');
    expect(text).toContain('test message');
  });

  it('exportJSON produces valid JSON', () => {
    LogStore._log('info', 'mod', 'test');
    const json = LogStore.exportJSON();
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].message).toBe('test');
  });

  it('enforces max buffer size of 2000', () => {
    for (let i = 0; i < 2500; i++) {
      LogStore._log('debug', 'mod', `entry ${i}`);
    }
    expect(LogStore.getAll().length).toBe(2000);
    expect(LogStore.getAll()[0].message).toBe('entry 500');
  });
});
