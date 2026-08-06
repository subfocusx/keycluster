import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LogStore } from '@/plugin-sdk';

describe('LogStore', () => {
  beforeEach(() => {
    LogStore.clear();
  });

  it('starts empty', () => {
    expect(LogStore.getAll()).toHaveLength(0);
  });

  it('adds a log entry', () => {
    LogStore._log('info', 'test', 'hello');
    const entries = LogStore.getAll();
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe('info');
    expect(entries[0].module).toBe('test');
    expect(entries[0].message).toBe('hello');
  });

  it('assigns unique ids', () => {
    LogStore._log('info', 'mod', 'a');
    LogStore._log('info', 'mod', 'b');
    const ids = LogStore.getAll().map(e => e.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('includes timestamps', () => {
    const before = Date.now();
    LogStore._log('info', 'mod', 'msg');
    const after = Date.now();
    const ts = LogStore.getAll()[0].timestamp;
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('stores optional data payload', () => {
    const data = { foo: 'bar', num: 42 };
    LogStore._log('info', 'mod', 'msg', data);
    expect(LogStore.getAll()[0].data).toEqual(data);
  });

  it('encodes all log levels', () => {
    const levels = ['debug', 'info', 'warn', 'error'] as const;
    for (const l of levels) LogStore._log(l, 'mod', `level ${l}`);
    const all = LogStore.getAll();
    expect(all).toHaveLength(4);
    expect(all.map(e => e.level).sort()).toEqual(levels.slice().sort());
  });

  it('does not deduplicate — each _log call creates a separate entry', () => {
    LogStore._log('info', 'mod', 'same message');
    LogStore._log('info', 'mod', 'same message');
    const entries = LogStore.getAll();
    expect(entries).toHaveLength(2);
    expect(entries[0].id).not.toBe(entries[1].id);
  });

  describe('ring buffer', () => {
    it('caps at 2000 entries', () => {
      for (let i = 0; i < 2500; i++) {
        LogStore._log('debug', 'load', `entry ${i}`);
      }
      expect(LogStore.getAll().length).toBeLessThanOrEqual(2000);
    });

    it('drops oldest entries first', () => {
      for (let i = 0; i < 2000; i++) LogStore._log('info', 'mod', `old ${i}`);
      LogStore._log('info', 'mod', 'fresh entry');
      const entries = LogStore.getAll();
      expect(entries.length).toBe(2000);
      expect(entries.some(e => e.message === 'old 0')).toBe(false);
      expect(entries.some(e => e.message === 'fresh entry')).toBe(true);
    });
  });

  describe('getFiltered', () => {
    beforeEach(() => {
      LogStore._log('info', 'mod-a', 'hello world');
      LogStore._log('warn', 'mod-a', 'warning msg');
      LogStore._log('error', 'mod-b', 'error msg');
      LogStore._log('debug', 'mod-b', 'debug msg');
    });

    it('filters by level', () => {
      const errs = LogStore.getFiltered({ level: 'error' });
      expect(errs).toHaveLength(1);
      expect(errs[0].level).toBe('error');
    });

    it('filters by module', () => {
      const ms = LogStore.getFiltered({ module: 'mod-a' });
      expect(ms).toHaveLength(2);
      expect(ms.every(e => e.module === 'mod-a')).toBe(true);
    });

    it('filters by search text', () => {
      const res = LogStore.getFiltered({ search: 'warning' });
      expect(res).toHaveLength(1);
    });

    it('combines all filters', () => {
      const res = LogStore.getFiltered({ level: 'error', module: 'mod-b' });
      expect(res).toHaveLength(1);
      expect(res[0].message).toBe('error msg');
    });
  });

  describe('exportText', () => {
    it('formats entries as text lines', () => {
      LogStore._log('info', 'test', 'msg');
      const text = LogStore.exportText();
      expect(text).toContain('[INFO');
      expect(text).toContain('[test]');
      expect(text).toContain('msg');
    });
  });

  describe('exportJSON', () => {
    it('serializes entries as JSON', () => {
      LogStore._log('info', 'test', 'msg', { key: 'val' });
      const json = LogStore.exportJSON();
      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].message).toBe('msg');
      expect(parsed[0].data.key).toBe('val');
    });
  });

  describe('subscribe', () => {
    it('notifies on new entry', () => {
      return new Promise<void>((done) => {
        const unsub = LogStore.subscribe(() => {
          const entries = LogStore.getAll();
          expect(entries.length).toBe(1);
          done();
          unsub();
        });
        LogStore._log('info', 'test', 'trigger');
      });
    });

    it('notifies on clear', () => {
      LogStore._log('info', 'mod', 'msg');
      return new Promise<void>((done) => {
        const unsub = LogStore.subscribe(() => {
          expect(LogStore.getAll()).toHaveLength(0);
          done();
          unsub();
        });
        LogStore.clear();
      });
    });

    it('unsubscribe stops notifications', () => {
      let count = 0;
      const unsub = LogStore.subscribe(() => count++);
      unsub();
      LogStore._log('info', 'test', 'msg');
      expect(count).toBe(0);
    });
  });

  describe('logDuration', () => {
    it('stores duration field', () => {
      LogStore._logDuration('mod', 'slow op', 42.5);
      const entry = LogStore.getAll()[0];
      expect(entry.duration).toBe(42.5);
    });
  });

  describe('Startup integration', () => {
    function resetLogStore() {
      LogStore.clear();
    }

    it('records bootstrap:started log entry on simulated bootstrap start', () => {
      resetLogStore();
      LogStore._log('info', 'system', 'bootstrap:started', { version: '0.3.0' });
      const entries = LogStore.getAll();
      expect(entries.length).toBeGreaterThanOrEqual(1);
      const started = entries.find(e => e.message === 'bootstrap:started');
      expect(started).toBeDefined();
      expect(started?.module).toBe('system');
      expect(started?.level).toBe('info');
      expect(started?.data).toEqual({ version: '0.3.0' });
    });

    it('records bootstrap:completed log entry', () => {
      resetLogStore();
      LogStore._log('info', 'system', 'bootstrap:completed', { modulesLoaded: ['devtools', 'groups'], initTimeMs: 150 });
      const entries = LogStore.getAll();
      const completed = entries.find(e => e.message === 'bootstrap:completed');
      expect(completed).toBeDefined();
      expect(completed?.data).toHaveProperty('modulesLoaded');
      expect(completed?.data).toHaveProperty('initTimeMs');
    });

    it('startup log entries appear before module logs', () => {
      resetLogStore();
      LogStore._log('info', 'system', 'bootstrap:started');
      LogStore._log('info', 'system', 'bootstrap:completed');
      LogStore._log('info', 'groups', 'init done');
      const all = LogStore.getAll();
      const startedIdx = all.findIndex(e => e.message === 'bootstrap:started');
      const completedIdx = all.findIndex(e => e.message === 'bootstrap:completed');
      const groupsIdx = all.findIndex(e => e.message === 'init done');
      expect(startedIdx).toBeLessThan(completedIdx);
      expect(completedIdx).toBeLessThan(groupsIdx);
    });
  });
});
