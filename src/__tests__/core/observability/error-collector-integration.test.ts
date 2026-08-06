import { describe, it, expect, beforeEach } from 'vitest';
import { LogStore } from '@/plugin-sdk';
import { globalErrorCollector } from '@/core/errors/ErrorCollector';

describe('ErrorCollector integration', () => {
  beforeEach(() => {
    globalErrorCollector.clear();
  });

  it('LogStore error level adds to globalErrorCollector', () => {
    LogStore._log('error', 'test-module', 'something broke');
    const errors = globalErrorCollector.getAll();
    expect(errors).toHaveLength(1);
    expect(errors[0].moduleId).toBe('test-module');
    expect(errors[0].phase).toBe('runtime');
  });

  it('LogStore non-error levels do not add to globalErrorCollector', () => {
    LogStore._log('info', 'test', 'info msg');
    LogStore._log('warn', 'test', 'warn msg');
    LogStore._log('debug', 'test', 'debug msg');
    expect(globalErrorCollector.getAll()).toHaveLength(0);
  });

  it('multiple identical errors get deduplicated in collector', () => {
    LogStore._log('error', 'mod-a', 'dup error');
    LogStore._log('error', 'mod-a', 'dup error');
    const errors = globalErrorCollector.getAll();
    expect(errors).toHaveLength(1);
    expect(errors[0].count).toBe(2);
  });
});
