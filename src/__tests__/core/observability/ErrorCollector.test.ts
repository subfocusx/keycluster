import { describe, it, expect, beforeEach } from 'vitest';
import { ErrorCollector } from '@/core/errors/ErrorCollector';

describe('ErrorCollector', () => {
  let collector: ErrorCollector;

  beforeEach(() => {
    collector = new ErrorCollector();
  });

  it('starts empty', () => {
    expect(collector.getAll()).toHaveLength(0);
  });

  it('adds an error record', () => {
    collector.add('test-module', 'init', new Error('test error'));
    const records = collector.getAll();
    expect(records).toHaveLength(1);
    expect(records[0].moduleId).toBe('test-module');
    expect(records[0].phase).toBe('init');
    expect(records[0].message).toBe('test error');
    expect(records[0].count).toBe(1);
    expect(records[0].resolved).toBe(false);
  });

  it('deduplicates by moduleId + message', () => {
    collector.add('mod-a', 'init', new Error('same error'));
    collector.add('mod-a', 'init', new Error('same error'));
    const records = collector.getAll();
    expect(records).toHaveLength(1);
    expect(records[0].count).toBe(2);
  });

  it('separates different modules', () => {
    collector.add('mod-a', 'init', new Error('err1'));
    collector.add('mod-b', 'init', new Error('err1'));
    const records = collector.getAll();
    expect(records).toHaveLength(2);
  });

  it('separates different messages in same module', () => {
    collector.add('mod-a', 'init', new Error('err1'));
    collector.add('mod-a', 'init', new Error('err2'));
    const records = collector.getAll();
    expect(records).toHaveLength(2);
  });

  it('handles string errors', () => {
    collector.add('mod-a', 'runtime', 'string error');
    const records = collector.getAll();
    expect(records[0].message).toBe('string error');
  });

  it('captures stack trace from Error objects', () => {
    const err = new Error('stacked');
    collector.add('mod-a', 'init', err);
    expect(collector.getAll()[0].stack).toBeTruthy();
  });

  it('updates lastOccurrence on dedup', () => {
    collector.add('mod-a', 'init', new Error('err'));
    const first = collector.getAll()[0].lastOccurrence;
    collector.add('mod-a', 'init', new Error('err'));
    expect(collector.getAll()[0].lastOccurrence).toBeGreaterThanOrEqual(first);
  });

  it('getByModule returns only matching modules', () => {
    collector.add('mod-a', 'init', new Error('a1'));
    collector.add('mod-b', 'init', new Error('b1'));
    collector.add('mod-a', 'init', new Error('a2'));
    const a = collector.getByModule('mod-a');
    expect(a).toHaveLength(2);
    expect(a.every(r => r.moduleId === 'mod-a')).toBe(true);
  });

  it('getUnresolved returns only unresolved records', () => {
    collector.add('mod-a', 'init', new Error('err1'));
    collector.add('mod-b', 'init', new Error('err2'));
    collector.markResolved(collector.getAll()[0].id);
    expect(collector.getUnresolved()).toHaveLength(1);
  });

  it('markResolved sets resolved to true', () => {
    collector.add('mod-a', 'init', new Error('err'));
    const id = collector.getAll()[0].id;
    collector.markResolved(id);
    expect(collector.getAll()[0].resolved).toBe(true);
  });

  it('markResolved is idempotent', () => {
    collector.add('mod-a', 'init', new Error('err'));
    const id = collector.getAll()[0].id;
    collector.markResolved(id);
    collector.markResolved(id);
    expect(collector.getAll().filter(r => r.resolved)).toHaveLength(1);
  });

  it('clearForModule removes only specified module', () => {
    collector.add('mod-a', 'init', new Error('a'));
    collector.add('mod-b', 'init', new Error('b'));
    collector.clearForModule('mod-a');
    const records = collector.getAll();
    expect(records).toHaveLength(1);
    expect(records[0].moduleId).toBe('mod-b');
  });

  it('clear removes all records', () => {
    collector.add('mod-a', 'init', new Error('a'));
    collector.add('mod-b', 'init', new Error('b'));
    collector.clear();
    expect(collector.getAll()).toHaveLength(0);
  });

  it('notifies subscribers on add', () => {
    let called = 0;
    collector.subscribe(() => called++);
    collector.add('mod', 'init', new Error('err'));
    expect(called).toBe(1);
  });

  it('notifies subscribers on markResolved', () => {
    collector.add('mod', 'init', new Error('err'));
    let called = 0;
    collector.subscribe(() => called++);
    collector.markResolved(collector.getAll()[0].id);
    expect(called).toBe(1);
  });

  it('notifies subscribers on clear', () => {
    collector.add('mod', 'init', new Error('err'));
    let called = 0;
    collector.subscribe(() => called++);
    collector.clear();
    expect(called).toBe(1);
  });

  it('unsubscribe stops notifications', () => {
    let called = 0;
    const unsub = collector.subscribe(() => called++);
    unsub();
    collector.add('mod', 'init', new Error('err'));
    expect(called).toBe(0);
  });

  it('getFiltered works with all filter combos', () => {
    collector.add('mod-a', 'init', new Error('init err'));
    collector.add('mod-b', 'render', new Error('render err'));
    const records = collector.getAll();
    const modARecord = records.find(r => r.moduleId === 'mod-a')!;
    collector.markResolved(modARecord.id);

    const initErrors = collector.getFiltered({ phase: 'init' });
    expect(initErrors).toHaveLength(1);
    expect(initErrors[0].phase).toBe('init');

    const unresolvedB = collector.getFiltered({ moduleId: 'mod-b', resolved: false });
    expect(unresolvedB).toHaveLength(1);
    expect(unresolvedB[0].moduleId).toBe('mod-b');
  });
});
